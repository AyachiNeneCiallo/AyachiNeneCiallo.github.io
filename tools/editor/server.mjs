/**
 * 本地博客文章编辑器 —— 一个零框架的小服务
 *
 *   node tools/editor/server.mjs      # 或 npm run editor
 *   打开 http://localhost:4322
 *
 * 只做三件事：
 *   1. 读写 src/content/posts/*.md（frontmatter + 正文）
 *   2. 用 marked 在服务端渲染预览
 *   3. 列出 / 上传 public 下的图片，方便选封面
 *
 * 注意：这个目录不会被 Astro 构建，也不会部署到线上。
 */
import { createServer } from 'node:http';
import { readFile, writeFile, readdir, stat, mkdir, rename, unlink } from 'node:fs/promises';
import { execFile, exec } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { marked } from 'marked';

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const POSTS_DIR = path.join(ROOT, 'src/content/posts');
const PUBLIC_DIR = path.join(ROOT, 'public');
const PORT = Number(process.env.EDITOR_PORT || 4322);

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.avif']);
const MAX_BODY = 20 * 1024 * 1024; // 20MB，够传一张大图

/** 静态文件用的 MIME */
function mimeOf(file) {
  const ext = path.extname(file).toLowerCase();
  return (
    {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.avif': 'image/avif',
      '.ico': 'image/x-icon',
      '.css': 'text/css; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.mp3': 'audio/mpeg',
    }[ext] || 'application/octet-stream'
  );
}

/* ---------------- frontmatter ---------------- */

function parseValue(raw) {
  if (raw === '') return '';
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  // 行内数组：['a', 'b'] 或 ["a", "b"]
  if (raw.startsWith('[') && raw.endsWith(']')) {
    const inner = raw.slice(1, -1).trim();
    if (inner === '') return [];
    return inner
      .split(',')
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);
  }
  return raw.replace(/^['"]|['"]$/g, '');
}

function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: text };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const hit = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!hit) continue;
    data[hit[1]] = parseValue(hit[2].trim());
  }
  return { data, body: text.slice(m[0].length) };
}

const yamlStr = (s) => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';

function buildMarkdown(data, body) {
  const lines = ['---'];
  lines.push(`title: ${yamlStr(data.title ?? '')}`);
  if (data.description) lines.push(`description: ${yamlStr(data.description)}`);
  lines.push(`pubDate: ${data.pubDate || new Date().toISOString().slice(0, 10)}`);
  if (data.updatedDate) lines.push(`updatedDate: ${data.updatedDate}`);
  const tags = (data.tags ?? []).filter(Boolean);
  lines.push(`tags: ${tags.length ? JSON.stringify(tags) : '[]'}`);
  if (data.cover) lines.push(`cover: ${yamlStr(data.cover)}`);
  if (data.draft === true) lines.push('draft: true');
  if (data.order !== undefined && data.order !== '' && !Number.isNaN(Number(data.order))) {
    lines.push(`order: ${Number(data.order)}`);
  }
  lines.push('---', '');
  return lines.join('\n') + (body ?? '');
}

/* ---------------- git / 发布 ---------------- */

/** 跑一条 git 命令；设置 GIT_TERMINAL_PROMPT=0 避免卡在凭据输入 */
function git(args, timeout = 120000) {
  return execFileAsync('git', args, {
    cwd: ROOT,
    timeout,
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
}

const tail = (s, n = 600) => String(s || '').trim().split('\n').slice(-n).join('\n');

async function gitInfo() {
  try {
    await git(['rev-parse', '--is-inside-work-tree'], 15000);
  } catch {
    return { isRepo: false };
  }

  const info = { isRepo: true, branch: '', remote: '', remoteName: '', dirty: 0, lastCommit: '', ahead: 0 };

  try {
    info.branch = (await git(['branch', '--show-current'], 15000)).stdout.trim();
  } catch {
    /* ignore */
  }
  try {
    const out = (await git(['remote', '-v'], 15000)).stdout.trim();
    const push = out.split('\n').find((l) => l.includes('(push)')) || out.split('\n')[0] || '';
    info.remoteName = push.split(/\s+/)[0] || '';
    info.remote = push.split(/\s+/)[1] || '';
  } catch {
    /* ignore */
  }
  try {
    const st = (await git(['status', '--porcelain'], 20000)).stdout.trim();
    info.dirty = st ? st.split('\n').length : 0;
  } catch {
    /* ignore */
  }
  try {
    info.lastCommit = (await git(['log', '-1', '--pretty=%h %s'], 15000)).stdout.trim();
  } catch {
    /* ignore */
  }
  try {
    info.ahead = Number((await git(['rev-list', '--count', '@{u}..HEAD'], 15000)).stdout.trim()) || 0;
  } catch {
    /* 没有上游分支时忽略 */
  }
  return info;
}

async function publish({ build = true, dryRun = false } = {}) {
  const steps = [];
  const add = (text, kind = 'info') => steps.push({ text, kind });

  // 1. 仓库检查
  try {
    await git(['rev-parse', '--is-inside-work-tree'], 15000);
  } catch {
    throw new Error('当前目录不是 git 仓库。先在项目根目录执行 git init 并配置远程仓库。');
  }
  add('✓ 已确认是 git 仓库');

  const info = await gitInfo();
  if (!info.remote) throw new Error('没有配置远程仓库。执行：git remote add origin <仓库地址>');
  if (!info.branch) throw new Error('当前不在任何分支上（detached HEAD），请先切回 main。');
  add(`✓ 分支 ${info.branch} → ${info.remote}`);

  // 2. 构建校验（可选，能提前发现文章格式错误）
  if (build) {
    add('· 正在构建校验…');
    try {
      await execAsync('npm.cmd run build', { cwd: ROOT, timeout: 180000, maxBuffer: 10 * 1024 * 1024 });
      add('✓ 构建通过');
    } catch (err) {
      throw new Error(`构建失败，已中止上传：\n${tail(err.stdout || err.stderr || err.message)}`);
    }
  }

  // 3. 暂存
  await git(['add', '-A']);
  const status = (await git(['status', '--porcelain'], 20000)).stdout.trim();
  const files = status ? status.split('\n') : [];
  if (files.length === 0) {
    add('· 没有需要提交的改动');
    return { ok: true, noChanges: true, steps };
  }
  add(`✓ 已暂存 ${files.length} 个文件`);
  if (dryRun) {
    add('· dry-run：跳过提交与推送');
    return { ok: true, dryRun: true, steps, files };
  }
  for (const line of files.slice(0, 15)) add('   ' + line, 'dim');
  if (files.length > 15) add(`   …还有 ${files.length - 15} 个`, 'dim');

  // 4. 提交
  const stamp = new Date().toLocaleString('zh-CN', { hour12: false });
  const message = `content: 更新文章（${stamp}）`;
  try {
    await git(['commit', '-m', message], 60000);
    add(`✓ 已提交：${message}`);
  } catch (err) {
    const detail = tail(err.stdout || err.stderr || err.message);
    if (/user\.name|user\.email|Author identity unknown/i.test(detail)) {
      throw new Error(
        'git 还没配置提交身份。请执行：\n' +
          'git config user.name "你的名字"\n' +
          'git config user.email "你的邮箱"\n\n' +
          detail,
      );
    }
    throw new Error(`提交失败：\n${detail}`);
  }

  // 5. 推送
  add('· 正在推送…');
  try {
    await git(['push', 'origin', info.branch], 180000);
    add('✓ 推送完成');
  } catch (err) {
    const detail = tail(err.stderr || err.stdout || err.message);
    if (/Connection was reset|Failed to connect|Could not resolve|timed out|ECONNRESET/i.test(detail)) {
      throw new Error(
        '连不上 GitHub（本地已提交，但没推上去）。\n' +
          '先确认代理/VPN 开着，并且 git 能走代理，例如：\n' +
          '  git config --global http.proxy http://127.0.0.1:7890\n' +
          '（端口填你代理软件里的 HTTP 端口；不用代理时用 --unset 取消）\n\n' +
          detail,
      );
    }
    if (/Authentication|credential|Permission denied|403/i.test(detail)) {
      throw new Error(
        '推送需要登录 GitHub（本地已提交，但没推上去）。\n' +
          '先手动执行一次 git push 输入凭据，或把远程改成 SSH 地址。\n\n' +
          detail,
      );
    }
    throw new Error(`推送失败：\n${detail}`);
  }

  return { ok: true, steps, info: await gitInfo() };
}

/* ---------------- 文件工具 ---------------- */

/** 只允许简单文件名，挡住路径穿越 */
function safeSlug(input) {
  const s = String(input ?? '').trim().replace(/\.md$/i, '');
  if (!s) throw new Error('文件名不能为空');
  if (s.startsWith('.')) throw new Error('文件名不能以点开头');
  if (/[/\\:*?"<>|]/.test(s)) throw new Error('文件名不能包含 / \\ : * ? " < > |');
  if (s === '..') throw new Error('非法文件名');
  return s;
}

const postPath = (slug) => path.join(POSTS_DIR, `${safeSlug(slug)}.md`);

async function listPosts() {
  let names = [];
  try {
    names = await readdir(POSTS_DIR);
  } catch {
    return [];
  }
  const out = [];
  for (const name of names) {
    if (!name.endsWith('.md') || name.startsWith('.')) continue;
    const full = path.join(POSTS_DIR, name);
    const info = await stat(full);
    const text = await readFile(full, 'utf8');
    const { data } = parseFrontmatter(text);
    out.push({
      slug: name.replace(/\.md$/, ''),
      title: data.title || name,
      pubDate: data.pubDate || '',
      tags: data.tags || [],
      cover: data.cover || '',
      draft: data.draft === true,
      mtime: info.mtime.toISOString(),
    });
  }
  out.sort((a, b) => String(b.pubDate).localeCompare(String(a.pubDate)));
  return out;
}

/** 递归列出 public 下的图片（跳过 voice 这类非图片目录也自然被扩展名过滤） */
async function listImages(dir = PUBLIC_DIR, prefix = '', depth = 0) {
  if (depth > 3) return [];
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) {
      if (e.name.startsWith('.')) continue;
      out.push(...(await listImages(full, rel, depth + 1)));
    } else if (IMAGE_EXT.has(path.extname(e.name).toLowerCase())) {
      out.push(rel);
    }
  }
  return out;
}

/* ---------------- HTTP ---------------- */

function json(res, code, data) {
  const body = JSON.stringify(data);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('内容超过 20MB'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const STATIC = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;

  try {
    /* ---- 静态资源 ---- */
    if (req.method === 'GET' && STATIC[p]) {
      const [file, type] = STATIC[p];
      const buf = await readFile(path.join(HERE, file));
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
      res.end(buf);
      return;
    }

    /* ---- 列表 ---- */
    if (p === '/api/posts' && req.method === 'GET') {
      return json(res, 200, { posts: await listPosts(), dir: 'src/content/posts' });
    }

    /* ---- 单篇 ---- */
    if (p === '/api/post' && req.method === 'GET') {
      const slug = safeSlug(url.searchParams.get('slug'));
      const text = await readFile(postPath(slug), 'utf8');
      const { data, body } = parseFrontmatter(text);
      return json(res, 200, { slug, data, body });
    }

    /* ---- 保存（新建 / 覆盖 / 改名） ---- */
    if (p === '/api/save' && req.method === 'POST') {
      const payload = JSON.parse((await readBody(req)).toString('utf8'));
      const slug = safeSlug(payload.slug);
      const originalSlug = payload.originalSlug ? safeSlug(payload.originalSlug) : null;
      if (!payload.data?.title?.trim()) throw new Error('标题不能为空');

      await mkdir(POSTS_DIR, { recursive: true });
      const target = postPath(slug);
      const content = buildMarkdown(payload.data, payload.body ?? '');
      await writeFile(target, content, 'utf8');

      // 改了文件名：删掉旧文件
      if (originalSlug && originalSlug !== slug) {
        try {
          await unlink(postPath(originalSlug));
        } catch {
          /* 旧文件可能已不存在 */
        }
      }
      return json(res, 200, { ok: true, slug });
    }

    /* ---- 删除 ---- */
    if (p === '/api/delete' && req.method === 'POST') {
      const payload = JSON.parse((await readBody(req)).toString('utf8'));
      await unlink(postPath(payload.slug));
      return json(res, 200, { ok: true });
    }

    /* ---- 预览 ---- */
    if (p === '/api/preview' && req.method === 'POST') {
      const payload = JSON.parse((await readBody(req)).toString('utf8'));
      const html = await marked.parse(payload.md ?? '', { gfm: true, breaks: false });
      return json(res, 200, { html });
    }

    /* ---- 图片列表 ---- */
    if (p === '/api/images' && req.method === 'GET') {
      const images = await listImages();
      return json(res, 200, { images });
    }

    /* ---- git 状态 ---- */
    if (p === '/api/git-info' && req.method === 'GET') {
      return json(res, 200, await gitInfo());
    }

    /* ---- 一键上传 ---- */
    if (p === '/api/publish' && req.method === 'POST') {
      const payload = JSON.parse((await readBody(req)).toString('utf8') || '{}');
      try {
        const result = await publish({ build: payload.build !== false, dryRun: payload.dryRun === true });
        return json(res, 200, result);
      } catch (err) {
        return json(res, 500, { ok: false, error: err && err.message ? err.message : String(err) });
      }
    }

    /* ---- 上传图片（原始二进制，?dir=&name=） ---- */
    if (p === '/api/upload' && req.method === 'POST') {
      const dir = (url.searchParams.get('dir') || 'covers').replace(/^\/+|\/+$/g, '');
      const rawName = (url.searchParams.get('name') || '').trim();
      if (!rawName) throw new Error('缺少文件名');
      if (/[/\\:*?"<>|]/.test(rawName) || rawName.startsWith('.')) throw new Error('非法文件名');

      const destDir = path.join(PUBLIC_DIR, ...dir.split('/').filter(Boolean));
      await mkdir(destDir, { recursive: true });
      const buf = await readBody(req);
      if (buf.length === 0) throw new Error('空文件');
      await writeFile(path.join(destDir, rawName), buf);
      return json(res, 200, { ok: true, path: `/${dir}/${rawName}`.replace(/\/+/g, '/') });
    }

    /* ---- public 下的静态文件（选图缩略图、封面预览用） ---- */
    if (req.method === 'GET') {
      const rel = decodeURIComponent(p).replace(/^\/+/, '');
      const full = path.resolve(PUBLIC_DIR, rel);
      // 防穿越：解析后的路径必须仍在 public 内
      if (rel && full.startsWith(PUBLIC_DIR + path.sep)) {
        try {
          const info = await stat(full);
          if (info.isFile()) {
            const buf = await readFile(full);
            res.writeHead(200, { 'Content-Type': mimeOf(full), 'Cache-Control': 'no-store' });
            res.end(buf);
            return;
          }
        } catch {
          /* 落到 404 */
        }
      }
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  } catch (err) {
    json(res, 400, { error: err?.message || String(err) });
  }
});

server.listen(PORT, () => {
  console.log('');
  console.log('  文章编辑器已启动');
  console.log(`  →  http://localhost:${PORT}`);
  console.log(`  文章目录：${POSTS_DIR}`);
  console.log('  Ctrl+C 退出');
  console.log('');
});
