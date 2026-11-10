import { existsSync, readdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { join } from 'node:path';

const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);

console.log('--- 文件 ---');
ok(existsSync('dist/favicon.ico'), 'favicon.ico');
ok(existsSync('dist/apple-touch-icon.png'), 'apple-touch-icon.png');
ok(!existsSync('dist/archive'), '归档页已删除');

const root = join(process.env.LOCALAPPDATA, 'ms-playwright');
const dir = readdirSync(root).find((n) => n.startsWith('chromium-'));
const browser = await chromium.launch({ executablePath: join(root, dir, 'chrome-win64', 'chrome.exe') });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto('http://localhost:4321/', { waitUntil: 'networkidle' });

const d = await page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const r = (s) => {
    const el = q(s);
    return el ? el.getBoundingClientRect() : null;
  };
  return {
    logo: q('.site-title__logo')?.getAttribute('src'),
    nav: [...document.querySelectorAll('.site-nav a')].map((a) => a.textContent.trim()),
    titleLeft: Math.round(r('.site-title').left),
    navRight: Math.round(r('.site-nav').right),
    vw: innerWidth,
    footerText: q('.site-footer__inner')?.textContent.replace(/\s+/g, ' ').trim(),
    footerLabel: q('.site-footer__label')?.textContent.trim(),
    footerWidth: Math.round(r('.site-footer__inner').width),
    cards: document.querySelectorAll('.post-card').length,
    cols: getComputedStyle(q('.post-grid')).gridTemplateColumns.split(' ').length,
    icons: [...document.querySelectorAll('link[rel*="icon"]')].map((l) => l.getAttribute('href')),
  };
});

console.log('\n--- 页面 ---');
ok(d.logo?.endsWith('assistant.png'), '页头图标 = assistant.png');
ok(JSON.stringify(d.nav) === JSON.stringify(['首页', '标签', '关于']), '导航: ' + d.nav.join(' / '));
ok(d.titleLeft <= 60 && d.vw - d.navRight <= 60, `页头左右贴边 (左${d.titleLeft} 右${d.vw - d.navRight})`);
ok(d.footerLabel === '友链：', '页脚有「友链：」标签');
ok(d.footerText.includes('monopolize的博客'), '友链内容: ' + d.footerText);
ok(d.footerWidth === 704, `页脚保持原布局宽度 44rem (实际 ${d.footerWidth}px)`);
ok(d.cols === 4, '桌面 4 列');
ok(d.icons.length === 4, '图标: ' + d.icons.join(' '));

for (const [w, expect] of [
  [390, 1],
  [700, 2],
]) {
  const p = await browser.newPage({ viewport: { width: w, height: 800 } });
  await p.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
  const c = await p.evaluate(
    () => getComputedStyle(document.querySelector('.post-grid')).gridTemplateColumns.split(' ').length,
  );
  ok(c === expect, `${w}px 下 ${expect} 列 (实际 ${c})`);
  await p.close();
}

await browser.close();