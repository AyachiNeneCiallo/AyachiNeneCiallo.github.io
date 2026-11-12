/* 一键上传功能测试：git-info、dry-run 全流程、UI 按钮与确认框 */
const BASE = 'http://localhost:4322';
let pass = 0;
let fail = 0;
const ok = (c, m) => {
  console.log((c ? 'PASS ' : 'FAIL ') + m);
  c ? pass++ : fail++;
};

/* 1. git-info */
const info = await (await fetch(`${BASE}/api/git-info`)).json();
ok(info.isRepo === true, '识别到 git 仓库');
ok(info.branch === 'main', `分支：${info.branch}`);
ok(/github\.com/.test(info.remote || ''), `远程：${info.remote}`);
ok(typeof info.dirty === 'number', `待上传改动：${info.dirty} 个`);
ok(!!info.lastCommit, `最近提交：${info.lastCommit}`);

/* 2. dry-run：跑完整流程但不提交 */
const dry = await fetch(`${BASE}/api/publish`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ build: true, dryRun: true }),
});
const dryData = await dry.json();
ok(dry.status === 200 && dryData.ok === true, 'dry-run 返回成功');
ok(dryData.dryRun === true, '确实是 dry-run（没有提交）');
const texts = (dryData.steps || []).map((s) => s.text).join('\n');
ok(texts.includes('构建通过'), 'dry-run 里跑了构建校验');
ok(texts.includes('已暂存'), 'dry-run 里完成了暂存');
ok(/已暂存 \d+ 个文件/.test(texts), '报告了暂存文件数');
ok(!texts.includes('已提交'), 'dry-run 没有提交');
ok(Array.isArray(dryData.files) && dryData.files.length > 0, `列出 ${dryData.files?.length} 个文件`);

/* 3. 提交历史未变（确认真的没提交） */
const after = await (await fetch(`${BASE}/api/git-info`)).json();
ok(after.lastCommit === info.lastCommit, 'dry-run 后 HEAD 未变化');

/* 4. 构建失败能被拦住（用一个临时坏文章） */
const fs = await import('node:fs');
const badPath = 'src/content/posts/__bad_test__.md';
fs.writeFileSync(badPath, '---\ntitle: 坏文章\n---\n\n正文\n', 'utf8'); // 缺 pubDate，schema 会失败
const bad = await fetch(`${BASE}/api/publish`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ build: true, dryRun: true }),
});
const badData = await bad.json();
fs.unlinkSync(badPath);
ok(bad.status === 500, '构建失败时返回错误');
ok(/构建失败/.test(badData.error || ''), '错误信息说明是构建失败');

/* 5. 坏文章删除后恢复正常 */
const good = await fetch(`${BASE}/api/publish`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ build: true, dryRun: true }),
});
ok(good.status === 200, '删掉坏文章后恢复成功');

console.log(`\n${pass}/${pass + fail} 通过`);
process.exit(fail ? 1 : 0);