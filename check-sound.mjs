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

const played = [];
// 记录每次 new Audio().play() 的 src
await page.addInitScript(() => {
  window.__played = [];
  const origPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    window.__played.push(this.currentSrc || this.src);
    return origPlay.call(this);
  };
});

await page.goto('http://localhost:4321/', { waitUntil: 'networkidle' });

const sounds = await page.evaluate(() =>
  JSON.parse(document.querySelector('#site-assistant').dataset.sounds || '[]'),
);
console.log('配置的语音:', sounds);
ok(sounds.length === 2, '配置了 2 条语音');

for (let i = 0; i < 8; i++) {
  await page.locator('[data-avatar]').click();
  await page.waitForTimeout(160);
}
const log = await page.evaluate(() => window.__played.map((s) => s.split('/').pop()));
console.log('播放序列:', log.join(', '));

ok(log.length === 8, `每次点击都播放 (${log.length}/8)`);
ok(
  log.every((f) => f === 'oh-nani-1.mp3' || f === 'oh-nani-2.mp3'),
  '播放的都是配置里的文件',
);
ok(new Set(log).size === 2, '两条语音都出现过');
ok(
  log.every((f, i) => i === 0 || f !== log[i - 1]),
  '不连续重复同一条',
);

// 音频可正常加载
const meta = await page.evaluate(async () => {
  const load = (src) =>
    new Promise((res) => {
      const a = new Audio(src);
      a.addEventListener('loadedmetadata', () => res({ src, dur: a.duration }));
      a.addEventListener('error', () => res({ src, err: true }));
    });
  return Promise.all([load('/voice/oh-nani-1.mp3'), load('/voice/oh-nani-2.mp3')]);
});
for (const m of meta) {
  ok(!m.err && m.dur > 0, `${m.src} 可加载，时长 ${m.dur?.toFixed(2)}s`);
}

// 拖动不应该播放
const before = (await page.evaluate(() => window.__played.length)) ?? 0;
const box = await page.locator('[data-avatar]').boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x - 200, box.y - 150, { steps: 12 });
await page.mouse.up();
await page.waitForTimeout(300);
const after = await page.evaluate(() => window.__played.length);
ok(after === before, '拖动不触发播放');

await browser.close();