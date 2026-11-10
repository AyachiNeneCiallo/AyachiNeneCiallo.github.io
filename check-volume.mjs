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
  window.__vol = [];
  const origPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    window.__vol.push(this.volume);
    return origPlay.call(this);
  };
});

await page.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });

const configured = await page.evaluate(
  () => Number(document.querySelector('#site-assistant').dataset.volume),
);
console.log('配置音量:', configured, '(1 = 100%)');
ok(configured === 0.35, '配置值为 0.35');

for (let i = 0; i < 4; i++) {
  await page.locator('[data-avatar]').click();
  await page.waitForTimeout(150);
}
const vols = await page.evaluate(() => window.__vol);
console.log('实际播放音量:', vols.join(', '));
ok(vols.length === 4, `播放了 ${vols.length} 次`);
ok(
  vols.every((v) => Math.abs(v - 0.35) < 0.001),
  '每次都用了新音量',
);

await browser.close();