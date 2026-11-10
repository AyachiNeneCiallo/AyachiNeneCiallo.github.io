/**
 * 用 headless Chromium 验证右下角助手的交互：
 *   1. 点头像弹出 Ciallo 气泡
 *   2. 拖动后位置被记住（localStorage）
 *   3. 搜索按钮弹出搜索框，输入能搜到文章
 * 运行前先启动 npm run dev（默认 http://localhost:4321）。
 */
import { chromium } from 'playwright-core';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.TEST_BASE ?? 'http://localhost:4321';

function findChromium() {
  const root = join(process.env.LOCALAPPDATA, 'ms-playwright');
  const dir = readdirSync(root).find((n) => n.startsWith('chromium-'));
  if (!dir) throw new Error('没找到 playwright chromium');
  return join(root, dir, 'chrome-win64', 'chrome.exe');
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};

const browser = await chromium.launch({ executablePath: findChromium() });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(BASE, { waitUntil: 'networkidle' });

/* 1. 气泡 */
const bubble = page.locator('[data-bubble]');
check('初始气泡隐藏', await bubble.isHidden());

const EXPECTED_LINES = ['Ciallo～(∠・ω< )⌒★', '哇达西诺哦那尼呦迷蝶扣大赛'];

await page.locator('[data-avatar]').click();
await page.waitForTimeout(200);
const bubbleVisible = await bubble.isVisible();
const bubbleText = (await bubble.textContent())?.trim();
check('点头像弹出气泡', bubbleVisible, bubbleVisible ? bubbleText : '');
check('台词来自台词池', EXPECTED_LINES.includes(bubbleText ?? ''), bubbleText);

// 连点多次：两句都应出现
const seen = new Set([bubbleText]);
for (let i = 0; i < 24; i++) {
  await page.locator('[data-avatar]').click();
  await page.waitForTimeout(90);
  seen.add((await bubble.textContent())?.trim() ?? '');
}
check('两句台词都会出现', EXPECTED_LINES.every((line) => seen.has(line)), [...seen].join(' | '));
check('台词都在台词池内', [...seen].every((line) => EXPECTED_LINES.includes(line)));

// 单独验证「不连续重复」
const sequence = [];
for (let i = 0; i < 10; i++) {
  await page.locator('[data-avatar]').click();
  await page.waitForTimeout(90);
  sequence.push((await bubble.textContent())?.trim() ?? '');
}
const adjacentRepeat = sequence.some((line, i) => i > 0 && line === sequence[i - 1]);
check('连续两次不重复（avoidRepeat）', !adjacentRepeat, sequence.join(' → '));

// 到时间自动收起
await page.waitForTimeout(4200);
check('气泡自动消失', await bubble.isHidden());

/* 2. 拖动 */
const before = await page.locator('#site-assistant').evaluate((el) => ({
  x: getComputedStyle(el).getPropertyValue('--a-x').trim(),
  y: getComputedStyle(el).getPropertyValue('--a-y').trim(),
}));
const avatarBox = await page.locator('[data-avatar]').boundingBox();
await page.mouse.move(avatarBox.x + avatarBox.width / 2, avatarBox.y + avatarBox.height / 2);
await page.mouse.down();
await page.mouse.move(avatarBox.x - 260, avatarBox.y - 200, { steps: 12 });
await page.mouse.up();
await page.waitForTimeout(200);

const after = await page.locator('#site-assistant').evaluate((el) => ({
  x: getComputedStyle(el).getPropertyValue('--a-x').trim(),
  y: getComputedStyle(el).getPropertyValue('--a-y').trim(),
}));
check('拖动改变位置', before.x !== after.x || before.y !== after.y, `${before.x},${before.y} → ${after.x},${after.y}`);
check('拖动不触发气泡', await bubble.isHidden());

const stored = await page.evaluate(() => localStorage.getItem('assistant-pos'));
check('位置写入 localStorage', Boolean(stored), stored ?? '');

await page.reload({ waitUntil: 'networkidle' });
const restored = await page.locator('#site-assistant').evaluate((el) => ({
  x: getComputedStyle(el).getPropertyValue('--a-x').trim(),
  y: getComputedStyle(el).getPropertyValue('--a-y').trim(),
}));
check('刷新后位置保留', restored.x === after.x && restored.y === after.y, `${restored.x},${restored.y}`);

/* 3. 搜索 */
const panel = page.locator('[data-panel]');
check('初始搜索面板隐藏', await panel.isHidden());

await page.locator('[data-search-toggle]').click();
await page.waitForTimeout(200);
check('点搜索按钮打开面板', await panel.isVisible());
check('输入框自动聚焦', await page.locator('[data-search-input]').evaluate((el) => el === document.activeElement));

await page.locator('[data-search-input]').fill('Markdown');
await page.waitForTimeout(600);
const hitCount = await page.locator('[data-search-results] a').count();
check('搜索 Markdown 有结果', hitCount > 0, `${hitCount} 条`);

await page.locator('[data-search-input]').fill('骨架');
await page.waitForTimeout(500);
const hit2 = await page.locator('[data-search-results] a').count();
check('搜索中文有结果', hit2 > 0, `${hit2} 条`);

await page.locator('[data-search-input]').fill('zzzz不存在zzzz');
await page.waitForTimeout(500);
const emptyText = (await page.locator('[data-search-results]').textContent())?.trim();
check('无结果时提示', emptyText?.includes('没有找到') ?? false, emptyText ?? '');

await page.locator('[data-panel-close]').click();
await page.waitForTimeout(200);
check('关闭按钮收起面板', await panel.isHidden());

/* 4. 快捷键 */
await page.locator('body').click({ position: { x: 20, y: 400 } });
await page.keyboard.press('/');
await page.waitForTimeout(200);
check('按 / 打开搜索', await panel.isVisible());
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
check('Esc 关闭搜索', await panel.isHidden());

/* 5. 确认站点是固定浅色：没有主题切换按钮，且会忽略系统的深色偏好 */
check('没有主题切换按钮', (await page.locator('[data-theme-toggle]').count()) === 0);
await page.emulateMedia({ colorScheme: 'dark' });
await page.reload({ waitUntil: 'networkidle' });
const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
// 背景是可改的配色，这里只断言「不是深色」，不绑定具体色值
const { r, g, b } = await page.evaluate(() => {
  const c = getComputedStyle(document.body).backgroundColor;
  const m = (c.match(/\d+/g) ?? []).map(Number);
  return { r: m[0], g: m[1], b: m[2] };
});
check('系统深色下仍是浅色背景', (r + g + b) / 3 > 200, bg);
await page.emulateMedia({ colorScheme: 'light' });

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} 通过`);
process.exit(failed.length === 0 ? 0 : 1);
