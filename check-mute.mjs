import { readdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { join } from 'node:path';

const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);

const root = join(process.env.LOCALAPPDATA, 'ms-playwright');
const dir = readdirSync(root).find((n) => n.startsWith('chromium-'));
const browser = await chromium.launch({
  executablePath: join(root, dir, 'chrome-win64', 'chrome.exe'),
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.addInitScript(() => {
  window.__played = [];
  const origPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    window.__played.push(this.currentSrc || this.src);
    return origPlay.call(this);
  };
});

await page.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });

const played = () => page.evaluate(() => window.__played.length);
const muted = () =>
  page.evaluate(() => {
    const b = document.querySelector('[data-mute-toggle]');
    return {
      cls: document.querySelector('#site-assistant').classList.contains('is-muted'),
      pressed: b.getAttribute('aria-pressed'),
      label: b.getAttribute('aria-label'),
      stored: localStorage.getItem('assistant-muted'),
      iconSound: getComputedStyle(b.querySelector('.icon-sound')).display,
      iconMuted: getComputedStyle(b.querySelector('.icon-muted')).display,
    };
  });

console.log('--- 初始状态 ---');
let m = await muted();
ok(!m.cls, '默认未静音');
ok(m.pressed === 'false' && m.label === '静音', 'aria: ' + m.label);
ok(m.iconSound !== 'none' && m.iconMuted === 'none', '显示喇叭图标');

console.log('\n--- 未静音播放 ---');
await page.locator('[data-avatar]').click();
await page.waitForTimeout(200);
ok((await played()) === 1, '未静音时正常播放');

console.log('\n--- 打开静音 ---');
await page.locator('[data-mute-toggle]').click();
await page.waitForTimeout(150);
m = await muted();
ok(m.cls, '进入静音状态');
ok(m.pressed === 'true' && m.label === '取消静音', 'aria: ' + m.label);
ok(m.stored === 'true', '已写入 localStorage: ' + m.stored);
ok(m.iconMuted !== 'none' && m.iconSound === 'none', '显示禁音图标');

const before = await played();
for (let i = 0; i < 4; i++) {
  await page.locator('[data-avatar]').click();
  await page.waitForTimeout(140);
}
ok((await played()) === before, '静音时点击不播放（气泡仍显示）');
const bubbleVisible = await page.locator('[data-bubble]').isVisible();
ok(bubbleVisible, '静音时气泡照常出现');

console.log('\n--- 刷新后保持 ---');
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
m = await muted();
ok(m.cls && m.stored === 'true', '刷新后仍是静音');
const before2 = await played();
await page.locator('[data-avatar]').click();
await page.waitForTimeout(200);
ok((await played()) === before2, '刷新后静音仍生效');

console.log('\n--- 取消静音 ---');
await page.locator('[data-mute-toggle]').click();
await page.waitForTimeout(150);
m = await muted();
ok(!m.cls && m.stored === 'false', '恢复未静音');
const before3 = await played();
await page.locator('[data-avatar]').click();
await page.waitForTimeout(200);
ok((await played()) === before3 + 1, '恢复后重新出声');

// 正在播放的语音里切换静音，不能抛错（组件会暂停自己缓存的音频）
console.log('\n--- 播放中切换静音 ---');
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.locator('[data-avatar]').click(); // 触发播放（最长 2.25s）
await page.waitForTimeout(100);
await page.locator('[data-mute-toggle]').click(); // 播放中静音
await page.waitForTimeout(300);
ok(errors.length === 0, '播放中切换静音无报错' + (errors.length ? ': ' + errors[0] : ''));

const m2 = await page.evaluate(() => ({
  cls: document.querySelector('#site-assistant').classList.contains('is-muted'),
  stored: localStorage.getItem('assistant-muted'),
}));
ok(m2.cls && m2.stored === 'true', '状态正确（静音）');

// 静音期间反复点击都不应产生新的播放
const b = await played();
for (let i = 0; i < 3; i++) {
  await page.locator('[data-avatar]').click();
  await page.waitForTimeout(120);
}
ok((await played()) === b, '静音期间点击不再播放');

await browser.close();