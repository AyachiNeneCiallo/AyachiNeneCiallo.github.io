import { readdirSync } from 'node:fs';
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

await page.goto('http://localhost:4322/', { waitUntil: 'networkidle' });
await page.locator('#postList li').first().click();
await page.waitForTimeout(400);
await page.locator('#pickCoverBtn').click();
await page.waitForTimeout(700);

ok(await page.locator('#imageModal').isVisible(), '选图弹层打开');
const box = page.locator('#alsoGallery');
ok(await box.isVisible(), '「同时加入图集」勾选框可见');
ok(await box.isChecked(), '默认勾选');
ok(await page.locator('#imageModalTitle').isVisible(), '弹层标题存在');

await page.screenshot({ path: 'editor-6-gallery-opt.png' });

// 取消勾选后仍能正常操作
await box.uncheck();
ok(!(await box.isChecked()), '可以取消勾选');

await page.locator('#closeModal').click();
await page.waitForTimeout(200);
ok(await page.locator('#imageModal').isHidden(), '弹层可关闭');

await browser.close();
console.log(`\n${pass}/${pass + fail} 通过`);
process.exit(fail ? 1 : 0);
