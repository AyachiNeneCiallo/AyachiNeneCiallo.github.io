import { readdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { join } from 'node:path';

const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);

const root = join(process.env.LOCALAPPDATA, 'ms-playwright');
const dir = readdirSync(root).find((n) => n.startsWith('chromium-'));
const browser = await chromium.launch({ executablePath: join(root, dir, 'chrome-win64', 'chrome.exe') });

const state = (page) =>
  page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const vis = (s) => {
      const el = q(s);
      if (!el) return false;
      return getComputedStyle(el).display !== 'none' && el.offsetParent !== null;
    };
    const panel = q('[data-menu-panel]');
    const btn = q('[data-menu-toggle]');
    const st = btn ? getComputedStyle(btn) : null;
    const r = btn ? btn.getBoundingClientRect() : null;
    return {
      navVisible: vis('.site-nav'),
      navLinks: [...document.querySelectorAll('.site-nav a')].map((a) => a.textContent.trim()),
      menuVisible: vis('.site-menu'),
      panelHidden: panel ? panel.hidden : null,
      menuLinks: [...document.querySelectorAll('.site-menu__link')].map((a) => a.textContent.trim()),
      btnText: btn ? btn.textContent.trim() : null,
      btnSize: r ? `${Math.round(r.width)}x${Math.round(r.height)}` : null,
      btnRadius: st ? st.borderRadius : null,
    };
  });

console.log('--- 桌面 1280px ---');
const desktop = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await desktop.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
let s = await state(desktop);
ok(s.navVisible, '横向导航可见: ' + s.navLinks.join(' / '));
ok(!s.menuVisible, '菜单按钮隐藏');
await desktop.screenshot({ path: 'desk-1-home.png', clip: { x: 0, y: 0, width: 1280, height: 120 } });

console.log('\n--- 手机 390px ---');
const mobile = await browser.newPage({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 3 });
await mobile.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
s = await state(mobile);
ok(!s.navVisible, '横向导航隐藏');
ok(s.menuVisible, '菜单按钮可见');
ok(s.btnText === '', '按钮无文字');
ok(s.btnRadius === '9px', '按钮是圆角方形 (' + s.btnRadius + ', ' + s.btnSize + ')');
ok(s.panelHidden === true, '面板初始收起');
await mobile.screenshot({ path: 'mobile-1-home.png' });

await mobile.locator('[data-menu-toggle]').click();
await mobile.waitForTimeout(250);
s = await state(mobile);
ok(s.panelHidden === false, '点击展开');
ok(JSON.stringify(s.menuLinks) === JSON.stringify(['首页', '标签', '关于']), '菜单项: ' + s.menuLinks.join(' / '));
await mobile.screenshot({ path: 'mobile-2-menu.png' });

await mobile.keyboard.press('Escape');
await mobile.waitForTimeout(200);
ok((await state(mobile)).panelHidden === true, 'Esc 收起');

await mobile.goto('http://localhost:4321/tags/', { waitUntil: 'networkidle' });
await mobile.screenshot({ path: 'mobile-3-tags.png' });

await mobile.goto('http://localhost:4321/posts/hello-world/', { waitUntil: 'networkidle' });
await mobile.screenshot({ path: 'mobile-4-post.png' });

console.log('\n--- 平板 700px ---');
const tablet = await browser.newPage({ viewport: { width: 700, height: 800 } });
await tablet.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
s = await state(tablet);
ok(s.navVisible && !s.menuVisible, '700px 仍是横向导航');

console.log('\n--- 手机 480px ---');
const small = await browser.newPage({ viewport: { width: 480, height: 800 } });
await small.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
s = await state(small);
ok(s.menuVisible && !s.navVisible, '480px 是菜单模式');

await browser.close();