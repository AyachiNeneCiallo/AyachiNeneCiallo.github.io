/* 编辑器 API 自测：读写、预览、改名、删除、防路径穿越 */
const BASE = 'http://localhost:4322';
let pass = 0;
let fail = 0;
const ok = (c, m) => {
  console.log((c ? 'PASS ' : 'FAIL ') + m);
  c ? pass++ : fail++;
};

const j = async (url, opt) => {
  const r = await fetch(BASE + url, opt);
  const data = await r.json().catch(() => ({}));
  return { status: r.status, data };
};

/* 1. 静态资源 */
for (const p of ['/', '/app.js', '/styles.css']) {
  const r = await fetch(BASE + p);
  ok(r.status === 200, `GET ${p} → ${r.status}`);
}

/* 2. 列表 */
const list = await j('/api/posts');
ok(list.status === 200 && Array.isArray(list.data.posts), '文章列表可读');
ok(list.data.posts.length >= 3, `共 ${list.data.posts.length} 篇`);
const slugs = list.data.posts.map((p) => p.slug);
ok(slugs.includes('writing-guide'), '含 writing-guide');

/* 3. 读单篇 */
const one = await j('/api/post?slug=writing-guide');
ok(!!one.data.data?.title, `读到标题：${one.data.data?.title}`);
ok(typeof one.data.body === 'string' && one.data.body.length > 0, '读到正文');
ok(!one.data.body.trimStart().startsWith('---'), '正文开头不含 frontmatter');

/* 4. 预览 */
const prev = await j('/api/preview', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ md: '# 标题\n\n**粗体** 和 `代码`\n\n| a | b |\n|---|---|\n| 1 | 2 |' }),
});
ok(prev.data.html?.includes('<h1'), '预览渲染标题');
ok(prev.data.html?.includes('<strong>'), '预览渲染粗体');
ok(prev.data.html?.includes('<table>'), '预览渲染表格（GFM）');

/* 5. 新建 */
const TEST_SLUG = '__editor_test__';
const testBody = '\n\n第一段。\n\n## 小标题\n\n- a\n- b\n';
const created = await j('/api/save', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    slug: TEST_SLUG,
    originalSlug: null,
    data: {
      title: '编辑器测试文章',
      description: '这是一次自动化测试',
      pubDate: '2026-01-02',
      tags: ['测试', '编辑器'],
      cover: '/covers/hello.webp',
      draft: true,
    },
    body: testBody,
  }),
});
ok(created.status === 200 && created.data.slug === TEST_SLUG, '新建成功');

/* 6. 回读校验格式 */
const back = await j(`/api/post?slug=${TEST_SLUG}`);
ok(back.data.data.title === '编辑器测试文章', '标题写入正确');
ok(JSON.stringify(back.data.data.tags) === JSON.stringify(['测试', '编辑器']), '标签数组写入正确');
ok(back.data.data.draft === true, '草稿标记写入正确');
ok(back.data.data.pubDate === '2026-01-02', `日期：${back.data.data.pubDate}`);
ok(back.data.body.trim() === testBody.trim(), '正文原样保存');

/* 7. 改名 */
await j('/api/save', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    slug: '__editor_test_renamed__',
    originalSlug: TEST_SLUG,
    data: { title: '编辑器测试文章', pubDate: '2026-01-02', tags: [] },
    body: testBody,
  }),
});
const oldGone = await j(`/api/post?slug=${TEST_SLUG}`);
ok(oldGone.status === 400, '改名后旧文件已删除');
const renamed = await j('/api/post?slug=__editor_test_renamed__');
ok(renamed.status === 200, '改名后新文件存在');

/* 8. 删除 */
await j('/api/delete', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ slug: '__editor_test_renamed__' }),
});
const afterDel = await j('/api/post?slug=__editor_test_renamed__');
ok(afterDel.status === 400, '删除生效');

/* 9. 安全 */
const trav = await j('/api/post?slug=../../package');
ok(trav.status === 400 || trav.status === 404, '路径穿越被拒绝');
const trav2 = await j('/api/save', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ slug: '../evil', data: { title: 'x' }, body: '' }),
});
ok(trav2.status === 400, '非法文件名被拒绝');
const noTitle = await j('/api/save', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ slug: 'x', data: { title: '  ' }, body: '' }),
});
ok(noTitle.status === 400, '空标题被拒绝');

/* 10. 图片列表 */
const imgs = await j('/api/images');
ok(Array.isArray(imgs.data.images) && imgs.data.images.length > 0, `图片 ${imgs.data.images.length} 张`);
ok(imgs.data.images.some((p) => p.includes('covers/')), '含 covers 目录图片');

console.log(`\n${pass}/${pass + fail} 通过`);
process.exit(fail ? 1 : 0);