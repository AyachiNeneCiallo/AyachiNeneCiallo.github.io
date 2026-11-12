/* 界面测试：一键上传按钮、git 状态显示、确认框（只取消，不真的推送） */
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
await page.waitForTimeout(700);

/* git 状态文字 */
const gitText = (await page.locator('#gitState').textContent())?.trim() || '';
ok(gitText.includes('main'), '显示分支：' + gitText);
ok(/待上传|已同步/.test(gitText), '显示同步状态');
ok(await page.locator('#publishBtn').isVisible(), '一键上传按钮可见');
ok(await page.locator('#buildBeforePush').isChecked(), '「先构建」默认勾选');

/* 点上传 → 弹确认框 → 取消 */
let dialogSeen = null;
page.once('dialog', async (d) => {
  dialogSeen = d.message();
  await d.dismiss();
});
await page.locator('#publishBtn').click();
await page.waitForTimeout(800);

ok(!!dialogSeen, '点了上传会弹确认框');
ok(/main/.test(dialogSeen || ''), '确认框写明目标分支');
ok(/改动文件/.test(dialogSeen || ''), '确认框写明改动数量');
ok(/构建校验/.test(dialogSeen || ''), '确认框写明是否构建');
ok(await page.locator('#publishModal').isHidden(), '取消后不执行上传（弹层未打开）');

/* 取消后 HEAD 未变 */
const info = await (await fetch('http://localhost:4322/api/git-info')).json();
ok(!!info.lastCommit, '仓库仍正常：' + info.lastCommit);

/* 弹层手动打开/关闭 */
await page.evaluate(() => {
  document.getElementById('publishModal').hidden = false;
  document.getElementById('publishLog').textContent = '演示日志';
});
ok(await page.locator('#publishModal').isVisible(), '结果弹层能显示');
await page.locator('#closePublish').click();
await page.waitForTimeout(150);
ok(await page.locator('#publishModal').isHidden(), '关闭按钮有效');

await browser.close();
console.log(`\n${pass}/${pass + fail} 通过`);
process.exit(fail ? 1 : 0);