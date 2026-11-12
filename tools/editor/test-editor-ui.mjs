/* 编辑器界面自测：真实浏览器里走一遍 选文章 → 改标题 → 预览 → 保存 → 还原 */
import { readdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { join } from 'node:path';

const root = join(process.env.LOCALAPPDATA, 'ms-playwright');
const dir = readdirSync(root).find((n) => n.startsWith('chromium-'));
const browser = await chromium.launch({ executablePath: join(root, dir, 'chrome-win64', 'chrome.exe') });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

let pass = 0;
let fail = 0;
const ok = (c, m) => {
  console.log((c ? 'PASS ' : 'FAIL ') + m);
  c ? pass++ : fail++;
};

page.on('pageerror', (e) => ok(false, '页面报错: ' + e.message));

await page.goto('http://localhost:4322/', { waitUntil: 'networkidle' });

/* 列表加载 */
const items = await page.locator('#postList li').count();
ok(items >= 3, `侧栏列出 ${items} 篇文章`);
ok(await page.locator('#emptyState').isVisible(), '初始显示空状态');

/* 打开一篇文章 */
await page.locator('#postList li', { hasText: '如何新增一篇文章' }).first().click();
await page.waitForTimeout(400);
ok(await page.locator('#editorBody').isVisible(), '打开后显示编辑区');
ok((await page.locator('#fTitle').inputValue()) === '如何新增一篇文章', '标题回填正确');
ok((await page.locator('#fSlug').inputValue()) === 'writing-guide', '文件名回填正确');
ok((await page.locator('#body').inputValue()).length > 50, '正文回填');
ok(
  (await page.locator('#fCover').inputValue()).startsWith('/'),
  '封面路径回填: ' + (await page.locator('#fCover').inputValue()),
);

/* 预览渲染 */
await page.waitForTimeout(600);
const h2 = await page.locator('#preview h2').count();
ok(h2 > 0, `预览渲染出 ${h2} 个二级标题`);

/* 工具栏：加粗 */
await page.locator('#body').click();
await page.locator('#body').evaluate((t) => {
  t.focus();
  t.setSelectionRange(0, 0);
});
await page.locator('[data-wrap="**"]').click();
const afterBold = await page.locator('#body').inputValue();
ok(afterBold.startsWith('**文字**'), '工具栏插入加粗标记');

/* 撤销刚才的改动：重新打开（有未保存确认框） */
page.on('dialog', (d) => d.accept());

/* 重建：直接改标题再保存 */
await page.locator('#postList li', { hasText: '如何新增一篇文章' }).first().click();
await page.waitForTimeout(400);
const originalTitle = await page.locator('#fTitle').inputValue();
const originalBody = await page.locator('#body').inputValue();

await page.locator('#fTitle').fill(originalTitle + '（测试）');
await page.waitForTimeout(150);
ok((await page.locator('#saveState').textContent()) === '未保存', '改动后提示未保存');

await page.locator('#saveBtn').click();
await page.waitForTimeout(800);
const stateText = await page.locator('#saveState').textContent();
ok(stateText.includes('已保存'), '保存后提示：' + stateText);

/* 磁盘校验 */
const file = 'src/content/posts/writing-guide.md';
const disk = readFileSync(file, 'utf8');
ok(disk.includes(originalTitle + '（测试）'), '标题已写入磁盘');
ok(disk.startsWith('---\n'), 'frontmatter 结构正确');
ok(disk.includes("tags: ["), '标签数组格式正确');

/* 还原 */
await page.locator('#fTitle').fill(originalTitle);
await page.locator('#body').fill(originalBody);
await page.locator('#saveBtn').click();
await page.waitForTimeout(800);
const restored = readFileSync(file, 'utf8');
ok(restored.includes(`title: "${originalTitle}"`), '已还原标题');
ok(!restored.includes('（测试）'), '测试痕迹已清除');

/* 新建文章按钮 */
await page.locator('#newBtn').click();
await page.waitForTimeout(300);
ok((await page.locator('#fTitle').inputValue()) === '', '新建后标题为空');
ok((await page.locator('#fPubDate').inputValue()).length === 10, '新建自动填今天日期');

/* 空标题保存应被拦 */
await page.locator('#saveBtn').click();
await page.waitForTimeout(300);
ok((await page.locator('#saveState').textContent()).includes('标题不能为空'), '空标题被拦截');

/* 模式切换 */
await page.locator('[data-mode="preview"]').click();
await page.waitForTimeout(200);
ok(!(await page.locator('#body').isVisible()), '切到预览模式隐藏编辑框');
await page.locator('[data-mode="split"]').click();
await page.waitForTimeout(200);
ok(await page.locator('#body').isVisible(), '切回分屏');

/* 选图弹层 */
await page.locator('#postList li').first().click();
await page.waitForTimeout(400);
await page.locator('#pickCoverBtn').click();
await page.waitForTimeout(600);
ok(await page.locator('#imageModal').isVisible(), '选图弹层打开');
const thumbs = await page.locator('.image-item').count();
ok(thumbs > 0, `弹层里有 ${thumbs} 张图`);
await page.locator('.image-item').first().click();
await page.waitForTimeout(200);
ok(!(await page.locator('#imageModal').isVisible()), '选中后弹层关闭');
ok((await page.locator('#fCover').inputValue()).startsWith('/'), '封面路径已填入');

/* 不保存直接刷新（避免污染） */
page.on('dialog', (d) => d.accept());

await browser.close();
console.log(`\n${pass}/${pass + fail} 通过`);
process.exit(fail ? 1 : 0);