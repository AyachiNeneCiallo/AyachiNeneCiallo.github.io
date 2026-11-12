/* 编辑器前端逻辑 */

const $ = (id) => document.getElementById(id);

const el = {
  postList: $('postList'),
  search: $('search'),
  emptyState: $('emptyState'),
  editorBody: $('editorBody'),
  newBtn: $('newBtn'),
  emptyNewBtn: $('emptyNewBtn'),
  saveBtn: $('saveBtn'),
  deleteBtn: $('deleteBtn'),
  saveState: $('saveState'),
  fTitle: $('fTitle'),
  fSlug: $('fSlug'),
  fPubDate: $('fPubDate'),
  fTags: $('fTags'),
  fCover: $('fCover'),
  fDesc: $('fDesc'),
  fDraft: $('fDraft'),
  body: $('body'),
  preview: $('preview'),
  panes: $('panes'),
  toolbar: $('toolbar'),
  statText: $('statText'),
  pickCoverBtn: $('pickCoverBtn'),
  imageModal: $('imageModal'),
  imageGrid: $('imageGrid'),
  imageFilter: $('imageFilter'),
  uploadInput: $('uploadInput'),
  closeModal: $('closeModal'),
  gitState: $('gitState'),
  publishBtn: $('publishBtn'),
  buildBeforePush: $('buildBeforePush'),
  publishModal: $('publishModal'),
  publishTitle: $('publishTitle'),
  publishLog: $('publishLog'),
  publishHint: $('publishHint'),
  closePublish: $('closePublish'),
};

const state = {
  posts: [],
  currentSlug: null,
  originalSlug: null,
  dirty: false,
  images: [],
};

/* ---------------- 工具 ---------------- */

async function api(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `请求失败 (${res.status})`);
  return data;
}

function setSaveState(text, kind = '') {
  el.saveState.textContent = text;
  el.saveState.className = 'save-state' + (kind ? ' ' + kind : '');
}

function markDirty() {
  state.dirty = true;
  setSaveState('未保存');
}

function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/* ---------------- 文章列表 ---------------- */

async function loadPosts() {
  const { posts } = await api('/api/posts');
  state.posts = posts;
  renderPosts();
}

function renderPosts() {
  const q = el.search.value.trim().toLowerCase();
  const list = state.posts.filter(
    (p) =>
      !q ||
      p.title.toLowerCase().includes(q) ||
      p.slug.toLowerCase().includes(q) ||
      p.tags.join(' ').toLowerCase().includes(q),
  );

  el.postList.innerHTML = '';
  if (list.length === 0) {
    const li = document.createElement('li');
    li.className = 'm';
    li.textContent = q ? '没有匹配的文章' : '还没有文章';
    el.postList.append(li);
    return;
  }

  for (const p of list) {
    const li = document.createElement('li');
    if (p.slug === state.currentSlug) li.classList.add('active');

    const t = document.createElement('span');
    t.className = 't';
    t.textContent = p.title;
    t.title = p.slug;

    const m = document.createElement('span');
    m.className = 'm';
    m.textContent = p.pubDate || '';
    if (p.draft) {
      const b = document.createElement('span');
      b.className = 'badge draft';
      b.textContent = '草稿';
      m.append(b);
    }

    li.append(t, m);
    li.addEventListener('click', () => openPost(p.slug));
    el.postList.append(li);
  }
}

/* ---------------- 打开 / 新建 ---------------- */

async function openPost(slug) {
  if (state.dirty && !confirm('当前文章有未保存的改动，确定切换吗？')) return;

  const data = await api(`/api/post?slug=${encodeURIComponent(slug)}`);
  const d = data.data || {};

  el.fTitle.value = d.title || '';
  el.fSlug.value = data.slug;
  el.fPubDate.value = String(d.pubDate || today()).slice(0, 10);
  el.fTags.value = Array.isArray(d.tags) ? d.tags.join(', ') : '';
  el.fCover.value = d.cover || '';
  el.fDesc.value = d.description || '';
  el.fDraft.checked = d.draft === true;
  el.body.value = data.body || '';

  state.currentSlug = data.slug;
  state.originalSlug = data.slug;
  state.dirty = false;
  setSaveState('已加载');

  el.emptyState.hidden = true;
  el.editorBody.hidden = false;
  el.deleteBtn.hidden = false;
  renderPosts();

  // 归零滚动与光标，避免打开新文章时停在上一处的中间位置
  el.body.scrollTop = 0;
  el.body.setSelectionRange(0, 0);
  el.preview.scrollTop = 0;

  refreshPreview();
  updateStats();
  el.body.focus();
  el.body.scrollTop = 0;
}

function newPost() {
  if (state.dirty && !confirm('当前文章有未保存的改动，确定新建吗？')) return;

  el.fTitle.value = '';
  el.fSlug.value = '';
  el.fPubDate.value = today();
  el.fTags.value = '';
  el.fCover.value = '';
  el.fDesc.value = '';
  el.fDraft.checked = false;
  el.body.value = '';

  state.currentSlug = null;
  state.originalSlug = null;
  state.dirty = false;
  setSaveState('新建中');

  el.emptyState.hidden = true;
  el.editorBody.hidden = false;
  el.deleteBtn.hidden = true;
  renderPosts();
  el.preview.innerHTML = '';
  updateStats();
  el.fTitle.focus();
}

/* ---------------- 保存 ---------------- */

function slugify(title) {
  return title
    .trim()
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60) || `post-${Date.now()}`;
}

async function save() {
  const title = el.fTitle.value.trim();
  if (!title) {
    setSaveState('标题不能为空', 'err');
    el.fTitle.focus();
    return;
  }

  // 没填文件名就用标题自动生成
  if (!el.fSlug.value.trim()) el.fSlug.value = slugify(title);

  const data = {
    title,
    description: el.fDesc.value.trim(),
    pubDate: el.fPubDate.value || today(),
    tags: el.fTags.value
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean),
    cover: el.fCover.value.trim(),
    draft: el.fDraft.checked,
  };

  try {
    setSaveState('保存中…');
    const res = await api('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: el.fSlug.value.trim(),
        originalSlug: state.originalSlug,
        data,
        body: el.body.value,
      }),
    });

    state.currentSlug = res.slug;
    state.originalSlug = res.slug;
    el.fSlug.value = res.slug;
    state.dirty = false;
    setSaveState('已保存 ✓', 'ok');
    await loadPosts();
    setTimeout(() => {
      if (!state.dirty) setSaveState('已保存 ✓', 'ok');
    }, 1500);
  } catch (err) {
    setSaveState('保存失败', 'err');
    alert('保存失败：' + err.message);
  }
}

async function removePost() {
  if (!state.originalSlug) return;
  if (!confirm(`确定删除「${el.fTitle.value || state.originalSlug}」？此操作不可撤销。`)) return;
  await api('/api/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug: state.originalSlug }),
  });
  state.currentSlug = null;
  state.originalSlug = null;
  state.dirty = false;
  el.editorBody.hidden = true;
  el.emptyState.hidden = false;
  setSaveState('');
  await loadPosts();
}

/* ---------------- 预览 ---------------- */

let previewTimer;

function refreshPreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(async () => {
    try {
      const { html } = await api('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ md: el.body.value }),
      });
      el.preview.innerHTML = html;
    } catch {
      /* 预览失败不打断编辑 */
    }
  }, 220);
}

function updateStats() {
  const text = el.body.value;
  const chars = text.replace(/\s/g, '').length;
  const lines = text ? text.split('\n').length : 0;
  el.statText.textContent = `${chars} 字 · ${lines} 行`;
}

/* ---------------- 工具栏 ---------------- */

function surround(before, after = before, placeholder = '文字') {
  const ta = el.body;
  const { selectionStart: s, selectionEnd: e, value } = ta;
  const picked = value.slice(s, e) || placeholder;
  ta.setRangeText(before + picked + after, s, e, 'end');
  ta.focus();
  ta.setSelectionRange(s + before.length, s + before.length + picked.length);
  markDirty();
  refreshPreview();
  updateStats();
}

function prefixLine(prefix) {
  const ta = el.body;
  const { selectionStart: s, value } = ta;
  const lineStart = value.lastIndexOf('\n', s - 1) + 1;
  ta.setRangeText(prefix, lineStart, lineStart, 'end');
  ta.focus();
  markDirty();
  refreshPreview();
  updateStats();
}

el.toolbar.addEventListener('click', (event) => {
  const btn = event.target.closest('button');
  if (!btn) return;

  if (btn.dataset.mode) {
    el.panes.dataset.mode = btn.dataset.mode;
    el.toolbar
      .querySelectorAll('.tool.mode')
      .forEach((b) => b.classList.toggle('on', b === btn));
    return;
  }
  if (btn.dataset.wrap) return surround(btn.dataset.wrap);
  if (btn.dataset.line) return prefixLine(btn.dataset.line);
  if (btn.dataset.link) return surround('[', '](https://)', '链接文字');
  if (btn.dataset.image) return surround('![', '](/covers/图片.webp)', '图片说明');
  if (btn.dataset.code) return surround('\n```ts\n', '\n```\n', 'console.log(1)');
});

/* ---------------- 图片选择 ---------------- */

async function openImagePicker() {
  el.imageModal.hidden = false;
  if (state.images.length === 0) {
    const { images } = await api('/api/images');
    state.images = images;
  }
  renderImages();
}

function renderImages() {
  const q = el.imageFilter.value.trim().toLowerCase();
  const list = state.images.filter((p) => !q || p.toLowerCase().includes(q));

  el.imageGrid.innerHTML = '';
  if (list.length === 0) {
    const p = document.createElement('p');
    p.className = 'm';
    p.textContent = '没有找到图片';
    el.imageGrid.append(p);
    return;
  }

  for (const rel of list) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'image-item';

    const img = document.createElement('img');
    img.src = '/' + rel;
    img.alt = rel;
    img.loading = 'lazy';

    const name = document.createElement('span');
    name.textContent = rel;

    btn.append(img, name);
    btn.addEventListener('click', () => {
      el.fCover.value = '/' + rel;
      el.imageModal.hidden = true;
      markDirty();
    });
    el.imageGrid.append(btn);
  }
}

async function uploadImage(file) {
  const name = file.name.replace(/[\\/:*?"<>|]/g, '_');
  await api(`/api/upload?dir=covers&name=${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  state.images = [];
  await openImagePicker();
  el.fCover.value = `/covers/${name}`;
  markDirty();
}

/* ---------------- 一键上传 ---------------- */

async function refreshGitState() {
  if (!el.gitState) return;
  try {
    const info = await api('/api/git-info');
    if (!info.isRepo) {
      el.gitState.textContent = '未初始化 git';
      el.gitState.className = 'git-state err';
      el.publishBtn.disabled = true;
      return;
    }
    if (info.dirty > 0) {
      el.gitState.textContent = `${info.branch} · ${info.dirty} 个改动待上传`;
      el.gitState.className = 'git-state dirty';
    } else {
      el.gitState.textContent = `${info.branch} · 已同步`;
      el.gitState.className = 'git-state clean';
    }
    el.gitState.title = info.lastCommit ? `最近提交：${info.lastCommit}` : '';
    el.publishBtn.disabled = false;
  } catch {
    el.gitState.textContent = '';
    el.gitState.className = 'git-state';
  }
}

function renderPublishLog(steps, error) {
  const lines = (steps || []).map((s) => s.text);
  if (error) lines.push('', '✗ ' + error);
  el.publishLog.textContent = lines.join('\n');
  el.publishLog.scrollTop = el.publishLog.scrollHeight;
}

async function publish() {
  if (state.dirty) {
    save();
    await new Promise((r) => setTimeout(r, 300));
  }

  const info = await api('/api/git-info').catch(() => null);
  if (!info || !info.isRepo) {
    alert('当前目录不是 git 仓库，无法上传。');
    return;
  }
  if (!info.remote) {
    alert('没有配置远程仓库，无法上传。');
    return;
  }

  const withBuild = el.buildBeforePush.checked;
  const msg =
    `将提交并推送到 ${info.branch} → ${info.remote}\n\n` +
    `改动文件：${info.dirty} 个\n` +
    `推送前构建校验：${withBuild ? '开' : '关'}\n\n` +
    '确定上传吗？';

  if (!confirm(msg)) return;

  el.publishModal.hidden = false;
  el.publishTitle.textContent = '正在上传…';
  el.publishLog.textContent = '';
  el.publishHint.textContent = '';
  el.publishBtn.disabled = true;

  try {
    const res = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ build: withBuild }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      renderPublishLog(data.steps, null);
      el.publishTitle.textContent = data.noChanges ? '没有需要上传的改动' : '上传成功 ✓';
      el.publishHint.textContent = data.noChanges
        ? '工作区是干净的。'
        : 'GitHub Actions 会自动构建并发布，稍等一两分钟就能在线上看到。';
    } else {
      renderPublishLog(data.steps, data.error || '未知错误');
      el.publishTitle.textContent = '上传失败';
      el.publishHint.textContent = '按提示修好后再试一次。';
    }
  } catch (err) {
    renderPublishLog([], err.message);
    el.publishTitle.textContent = '上传失败';
    el.publishHint.textContent = '请求没发出去，检查编辑器服务是否还在运行。';
  } finally {
    el.publishBtn.disabled = false;
    refreshGitState();
  }
}

/* ---------------- 事件绑定 ---------------- */

el.newBtn.addEventListener('click', newPost);
el.emptyNewBtn.addEventListener('click', newPost);
el.saveBtn.addEventListener('click', save);
el.deleteBtn.addEventListener('click', removePost);
el.search.addEventListener('input', renderPosts);
el.publishBtn.addEventListener('click', publish);
el.closePublish.addEventListener('click', () => { el.publishModal.hidden = true; });
el.publishModal.addEventListener('click', (e) => { if (e.target === el.publishModal) el.publishModal.hidden = true; });

for (const input of [el.fTitle, el.fSlug, el.fPubDate, el.fTags, el.fCover, el.fDesc]) {
  input.addEventListener('input', markDirty);
}
el.fDraft.addEventListener('change', markDirty);

el.body.addEventListener('input', () => {
  markDirty();
  refreshPreview();
  updateStats();
});

// Tab 缩进而不是跳焦点
el.body.addEventListener('keydown', (event) => {
  if (event.key === 'Tab') {
    event.preventDefault();
    const ta = el.body;
    const s = ta.selectionStart;
    ta.setRangeText('  ', s, ta.selectionEnd, 'end');
    markDirty();
  }
});

document.addEventListener('keydown', (event) => {
  const mod = event.ctrlKey || event.metaKey;
  if (mod && event.key.toLowerCase() === 's') {
    event.preventDefault();
    save();
  }
  if (mod && event.key.toLowerCase() === 'n') {
    event.preventDefault();
    newPost();
  }
  if (event.key === 'Escape' && !el.imageModal.hidden) {
    el.imageModal.hidden = true;
  }
});

el.pickCoverBtn.addEventListener('click', openImagePicker);
el.closeModal.addEventListener('click', () => {
  el.imageModal.hidden = true;
});
el.imageModal.addEventListener('click', (event) => {
  if (event.target === el.imageModal) el.imageModal.hidden = true;
});
el.imageFilter.addEventListener('input', renderImages);
el.uploadInput.addEventListener('change', async () => {
  const file = el.uploadInput.files?.[0];
  el.uploadInput.value = '';
  if (!file) return;
  try {
    await uploadImage(file);
  } catch (err) {
    alert('上传失败：' + err.message);
  }
});

window.addEventListener('beforeunload', (event) => {
  if (state.dirty) {
    event.preventDefault();
    event.returnValue = '';
  }
});

/* ---------------- 启动 ---------------- */

el.panes.dataset.mode = 'split';
el.toolbar.querySelector('[data-mode="split"]').classList.add('on');

refreshGitState();

loadPosts().catch((err) => {
  setSaveState('读取失败', 'err');
  alert('读取文章列表失败：' + err.message);
});
