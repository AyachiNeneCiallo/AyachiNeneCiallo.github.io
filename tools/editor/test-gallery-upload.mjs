import { existsSync, readdirSync, readFileSync, unlinkSync } from 'node:fs';
import { execSync } from 'node:child_process';

const BASE = 'http://localhost:4322';
let pass = 0;
let fail = 0;
const ok = (c, m) => {
  console.log((c ? 'PASS ' : 'FAIL ') + m);
  c ? pass++ : fail++;
};

const src = readFileSync('public/gallery/01-bedroom.webp');
const NAME = 'zz-upload-test.webp';

const upload = (query) =>
  fetch(`${BASE}/api/upload?dir=covers&name=${encodeURIComponent(NAME)}${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/webp' },
    body: src,
  }).then((r) => r.json());

/* 1. 带 gallery=1 */
const a = await upload('&gallery=1');
ok(a.ok === true, '上传成功');
ok(a.path === '/covers/' + NAME, `封面路径：${a.path}`);
ok(!!a.galleryPath && a.galleryPath.startsWith('/gallery/'), `图集路径：${a.galleryPath}`);
ok(existsSync('public/covers/' + NAME), '封面文件已写入 public/covers');
const gFile = decodeURIComponent(a.galleryPath.replace('/gallery/', ''));
ok(existsSync('public/gallery/' + gFile), '图集文件已写入 public/gallery');
ok(/^\d{2}-zz-upload-test\.webp$/.test(gFile), '图集文件名带序号前缀：' + gFile);

/* 2. 重复上传同一张：应覆盖而不是新增 */
const before = readdirSync('public/gallery').length;
const b = await upload('&gallery=1');
const after = readdirSync('public/gallery').length;
ok(after === before, '重复上传不产生重复文件');
ok(b.galleryPath === a.galleryPath, '重复上传复用同一张');

/* 3. gallery=0：只进 covers，不进图集 */
const c = await upload('');
const before2 = readdirSync('public/gallery').length;
const d = await upload('');
ok(d.galleryPath === null, '不带 gallery 参数时 galleryPath 为 null');
ok(readdirSync('public/gallery').length === before2, '不带 gallery 参数不写图集');

/* 4. 图集页会收录（构建后检查） */
execSync('npm.cmd run build', { stdio: 'ignore' });
const html = readFileSync('dist/gallery/index.html', 'utf8');
ok(html.includes(encodeURIComponent(gFile)), '构建产物里图集页包含这张图');

/* 清理 */
unlinkSync('public/covers/' + NAME);
unlinkSync('public/gallery/' + gFile);
execSync('npm.cmd run build', { stdio: 'ignore' });
const html2 = readFileSync('dist/gallery/index.html', 'utf8');
ok(!html2.includes('zz-upload-test'), '清理后图集页不再包含');
ok(!existsSync('public/gallery/' + gFile), '测试文件已删除');

console.log(`\n${pass}/${pass + fail} 通过`);
process.exit(fail ? 1 : 0);
