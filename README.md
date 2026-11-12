# github-blog

基于 [Astro](https://astro.build) 的静态博客，部署在 GitHub Pages。
视觉是「银白 + 藏蓝 + 淡金」的轻盈纸感风格，全静态无动画。

> 换新会话接着做时，先看 [工作记录.md](工作记录.md)：里面有当前进度、设计决策、踩过的坑和验证方法。

## 快速开始

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # 产物输出到 dist/
npm run preview  # 本地预览构建结果
npm run editor   # 图形化文章编辑器 → http://localhost:4322
```

## 文章编辑器（图形界面）

不想手写 frontmatter 时用它。两种打开方式：

**双击**项目根目录的 `打开编辑器.bat`（会自启服务并打开浏览器，关掉后服务继续在后台）

**或者命令行**：

```bash
npm run editor     # 然后在浏览器打开 http://localhost:4322
```

用完想关掉服务，双击 `停止编辑器.bat`。

> 想要桌面快捷方式：右键 `打开编辑器.bat` → 发送到 → 桌面快捷方式，之后双击即可。

- 左侧是文章列表，可搜索；点一篇就打开，改完点「保存」（或 `Ctrl+S`）
- 标题 / 文件名 / 日期 / 标签 / 封面 / 摘要 / 草稿都是表单，保存时自动生成正确的 frontmatter
- 右侧实时预览（`marked` 渲染，支持表格等 GFM 语法），可切「分屏 / 编辑 / 预览」
- 工具栏有加粗、标题、列表、引用、代码块等快捷插入
- 封面可以点「选图」从 `public/` 里挑，也能直接上传到 `public/covers/`
- 改文件名会自动重命名 `.md` 并删除旧文件
- `Ctrl+N` 新建，`Ctrl+S` 保存

### 一键上传

右上角有「↑ 一键上传」，一步完成 **构建校验 → git add → commit → push**：

- 按钮左边实时显示 git 状态（当前分支 + 还有几个改动待上传）
- 「先构建」默认勾选：推送前跑一次 `npm run build`，**文章 frontmatter 写错会直接被拦住**，不会把坏内容推上线
- 点下去先弹确认框（写明目标分支、改动文件数、是否构建），确认后才执行
- 执行过程有逐条日志，成功/失败都会说明原因；失败时提示里给修复命令
- 若当前文章还没保存，会先自动保存再上传

常见失败提示及处理：

| 提示 | 处理 |
| --- | --- |
| 没有配置提交身份 | `git config user.name "..."` / `git config user.email "..."` |
| 推送需要登录 GitHub | 手动执行一次 `git push` 输入凭据，或改用 SSH 远程地址 |
| 构建失败 | 按日志里的报错改文章 frontmatter（多半是缺 `pubDate` 或类型不对） |

推送成功后 GitHub Actions 会自动构建发布，一两分钟后线上生效。

它只改 `src/content/posts/*.md`，跑起来后 `npm run dev` 那边会热更新，能立刻在博客里看到效果。
`tools/editor/` 不会被 Astro 构建，也不会部署到线上。

自测：

```bash
node tools/editor/test-editor.mjs       # 接口：读写/预览/改名/删除/防穿越（26 项）
node tools/editor/test-editor-ui.mjs    # 真实浏览器走一遍界面（25 项）
node tools/editor/test-publish.mjs      # git 状态 + dry-run 上传流程（16 项，不推送）
node tools/editor/test-publish-ui.mjs   # 上传按钮与确认框（12 项，不推送）
```

## 目录结构

```
├─ .github/workflows/deploy.yml   GitHub Pages 自动部署
├─ astro.config.mjs               站点地址、base、代码高亮主题
├─ make-email-image.py            由配置渲染邮箱图片（防爬虫）
├─ make-icons.py                  由 favicon.ico 生成各尺寸图标与页头 logo
├─ public/                        静态资源：图标、助手头像、封面、邮箱图
└─ src/
   ├─ site.config.ts              ★ 站名、简介、作者、导航、友链、背景图
   ├─ assistant.config.ts         ★ 右下角助手的头像、台词、搜索文案
   ├─ content.config.ts           文章 frontmatter 字段校验
   ├─ content/posts/              ★ 所有文章（Markdown）
   ├─ layouts/BaseLayout.astro    HTML 骨架、meta、图标、背景图变量
   ├─ components/                 Header / Footer / PostItem / Assistant
   ├─ styles/global.css           ★ 全部样式与配色变量
   ├─ utils/                      链接前缀、日期、文章排序分组
   └─ pages/
      ├─ [...page].astro          首页卡片网格 + 分页
      ├─ posts/[slug].astro       文章详情
      ├─ tags/index.astro         标签云
      ├─ tags/[tag].astro         单标签文章列表
      ├─ about.astro              关于页
      ├─ 404.astro                404
      ├─ search-index.json.ts     站内搜索索引（构建时生成）
      └─ rss.xml.ts               RSS 订阅
```

## 首页卡片

首页是图片 + 标题的卡片网格（4 列，移动端 2 列 / 小屏 1 列）。
每篇文章在 frontmatter 里加一行就能指定封面：

```yaml
cover: /covers/hello.webp   # 放在 public/covers/ 下
```

也支持外链 URL。**不填封面不会破版**——会自动用标题生成一个稳定的淡色渐变块并显示首字。

## 页头与页脚

- 页头通栏：左边是「图标 + 金色竖线 + 站名」，右边是导航，左右贴边
- 页脚通栏：左边版权，右边友链

友链在 `src/site.config.ts` 里配置，留空数组则整块不显示：

```ts
friends: [
  { label: 'monopolize的博客', href: 'https://monopolize7789.github.io/' },
],
```

## 右下角助手

页面右下角浮着一个可拖动的小助手（`src/components/Assistant.astro`）：

- **点头像** → 从台词池随机弹出一句（`Ciallo～(∠・ω< )⌒★` / `哇达西诺哦那尼呦迷蝶扣大赛`），同时随机播放一条语音，几秒后自动收起，再点会重新计时
- **拖动** → 抓住头像拖到任意位置，位置记在 `localStorage`，刷新和换页都保持；窗口缩小会自动收回可视范围
- **搜索按钮**（头像左边的放大镜）→ 展开搜索框，实时检索站内文章（标题权重最高，其次标签、摘要、正文），点结果直接跳转
- **静音按钮**（搜索左边）→ 一键开关语音，状态记在 `localStorage`，刷新和换页都保持；静音时台词气泡照常弹出，只是不出声
- **快捷键**：`/` 或 `Ctrl+K` 打开搜索，`Esc` 或点击空白处关闭

改装内容：

| 想改什么 | 改哪里 |
| --- | --- |
| 头像图片 | 替换 `public/assistant.png`（建议透明背景 PNG） |
| 台词池 / 显示时长 | `src/assistant.config.ts` 的 `greetings`（数组，加一行就多一句）、`bubbleDuration` |
| 语音池 / 音量 | `src/assistant.config.ts` 的 `sounds`（`public/` 下的路径数组，留空则不出声）、`soundVolume` |
| 是否避免连续重复同一句 | `src/assistant.config.ts` 的 `avoidRepeat`（默认 `true`） |
| 搜索占位符、空结果文案 | `src/assistant.config.ts` 的 `search` |
| 头像大小 | `Assistant.astro` 里 `.assistant__avatar` 的 `width` / `height` |

搜索索引由 `src/pages/search-index.json.ts` 在构建时从所有文章正文生成，**新增文章会自动进索引，不需要手动维护**。

> 自动化检查（都需先 `npm run dev`）：
> `node test-assistant.mjs` 助手交互回归（22 项）；
> `node check-nav.mjs` 手机菜单与断点；
> `node check-sound.mjs` 点击随机播放语音；
> `node check-mute.mjs` 静音开关与状态记忆；
> `node check-smoke.mjs` 图标 / 页头 / 页脚 / 卡片列数。


## 邮箱用图片显示（防爬虫）

关于页的邮箱是一张图片（`public/email.png`），页面 HTML 里**不出现明文邮箱**，
避免被垃圾邮件爬虫抓取。

邮箱地址保存在 `src/site.config.ts` 的 `email` 字段，它只用于生成图片，不会输出到页面。
改邮箱后重新生成图片：

```bash
python make-email-image.py
```

脚本会从配置里读出邮箱、渲染成透明背景 PNG（4 倍尺寸，显示时用 CSS 缩放）。
生成后 `npm run build` 即可。若换了邮箱想确认没泄漏，可在构建产物里搜一下：

```bash
Select-String -Path dist/**/*.html -Pattern "gmail|mailto:"
```


## 写文章

在 `src/content/posts/` 新建 `xxx.md`，URL 就是 `/posts/xxx/`：

```yaml
---
title: 文章标题
description: 一句话摘要（列表和 RSS 用）
pubDate: 2026-11-10
updatedDate: 2026-11-12   # 可选
tags: ['标签A', '标签B']   # 可选
draft: false              # true 时只在 npm run dev 显示，不会上线
cover: /images/a.jpg      # 可选，预留给封面图
---

正文用 Markdown。
```

## 部署到 GitHub Pages

1. 新建仓库，把本目录内容推到 `main` 分支。
2. 仓库 **Settings → Pages → Build and deployment → Source** 选 **GitHub Actions**。
3. 之后每次 push 到 `main`，`.github/workflows/deploy.yml` 会自动构建并发布。

工作流会自动推导地址：

- 仓库名是 `<用户名>.github.io` → 站点根路径 `/`
- 其他仓库名 → 子路径 `/<仓库名>/`（`astro.config.mjs` 里通过 `BASE` 环境变量生效，站内链接都用 `withBase()` 包了一层，所以子路径下不会 404）

> 本地 `npm run build` 默认 `SITE=https://example.github.io`，只影响 canonical 和 sitemap；
> 想本地模拟子路径，可以：
> `$env:SITE="https://user.github.io"; $env:BASE="/my-blog/"; npm run build`

### 用自定义域名

仓库 Settings → Pages → Custom domain 填好域名后，把 `astro.config.mjs` 里的默认 `SITE` 改成你的域名、`BASE` 改回 `'/'`，并在 `public/` 放一个 `CNAME` 文件写域名。

## 已有功能

- 文章列表卡片 + 分页（`site.config.ts` 的 `pageSize`）
- 文章详情、代码高亮（GitHub Light 配色）、表格、引用
- 标签云 + 单标签列表页
- 固定浅色主题（color-scheme: light，不响应系统深色偏好，也没有切换按钮）
- RSS (`/rss.xml`) 与 sitemap（构建时自动生成）
- 404 页、响应式布局、基础 SEO meta
- 右下角可拖动助手：点击弹台词气泡 + 站内文章实时搜索

## 留给你决定的（后续再改）

- [ ] 视觉风格：配色、字体、留白、卡片式还是纯文字流
- [ ] 首页要不要头像 / 简介 / 置顶文章
- [ ] 是否需要封面图、目录（TOC）、阅读时长、上一篇/下一篇
- [ ] 是否需要评论（giscus / utterances）、访问统计
- [ ] 站名、域名、导航项、社交链接
- [ ] 是否要多语言

设计相关的东西基本都集中在两处，改起来不会牵连别的地方：
`src/styles/global.css`（样式与配色变量）和 `src/site.config.ts`（文案与链接）。
