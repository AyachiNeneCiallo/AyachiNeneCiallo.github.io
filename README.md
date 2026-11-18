# Ayachi_Nene_ciallo 的博客

个人博客，用 [Astro](https://astro.build) 构建的纯静态站点，托管在 GitHub Pages。

🔗 线上地址：<https://ayachineneciallo.github.io/>

视觉走「银白 + 藏蓝 + 淡金」的轻盈路线，固定浅色主题，没有任何动画，只靠一张背景图和一层半透明的玻璃纸卡撑起氛围。

---

## 功能

- **首页卡片流**：封面图 + 标题 + 日期 + 摘要 + 标签，桌面 4 列 / 平板 2 列 / 手机 1 列，带分页
- **文章页**：Markdown 渲染、代码高亮、表格、引用
- **标签**：标签云 + 单标签文章列表
- **图集**：图片墙页面
- **站内搜索**：右下角助手的放大镜，实时检索标题 / 标签 / 摘要 / 正文
- **右下角助手**：可拖动，点头像随机弹台词并播放语音，带静音开关，位置和静音状态都存在本地
- **订阅**：RSS（`/rss.xml`）与 sitemap，构建时自动生成
- 响应式布局、404 页、基础 SEO meta

## 技术栈

| 部分 | 用什么 |
| --- | --- |
| 框架 | Astro 7（纯静态输出） |
| 样式 | 原生 CSS，配色集中在 `src/styles/global.css` 的变量里 |
| 内容 | Markdown + Astro Content Collections（frontmatter 有 schema 校验） |
| 部署 | GitHub Actions → GitHub Pages |

## 本地开发

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # 产物输出到 dist/
npm run preview  # 预览构建结果
```

## 写文章

在 `src/content/posts/` 下新建 `xxx.md`，访问路径就是 `/posts/xxx/`：

```yaml
---
title: 文章标题
description: 一句话摘要（列表卡片和 RSS 用）
pubDate: 2026-11-10
updatedDate: 2026-11-12   # 可选
tags: ['随笔', '建站']     # 可选
cover: /covers/a.webp     # 可选，封面图放 public/covers/ 下，也支持外链
draft: false              # true 表示草稿，只在 npm run dev 时可见
---

正文用 Markdown 写。
```

不填 `cover` 也不会破版：卡片会自动用标题生成一个稳定的渐变色块。

## 图形化编辑器

不想手写 frontmatter 时可以用自带的本地编辑器：

```bash
npm run editor    # 打开 http://localhost:4322
```

也可以直接双击项目根目录的 `打开编辑器.bat`（自动起服务并打开浏览器），用完双击 `停止编辑器.bat`。

编辑器功能：

- 左侧文章列表可搜索，改完点「保存」（`Ctrl+S`）
- 表单化的标题 / 文件名 / 日期 / 标签 / 封面 / 摘要 / 草稿，保存时自动生成正确的 frontmatter
- 右侧实时预览，支持分屏 / 只看编辑 / 只看预览
- 封面可从 `public/` 里选图，也能直接上传
- 右上角「一键上传」：构建校验 → commit → push，一条龙

编辑器只改 `src/content/posts/*.md`，同时开着 `npm run dev` 就能立刻看到效果。

## 配置速查

| 想改什么 | 改哪里 |
| --- | --- |
| 站名 / 简介 / 作者 / 导航 / 友链 | `src/site.config.ts` |
| 背景图（含手机端竖图） | `src/site.config.ts` 的 `background` |
| 助手头像 / 台词 / 语音 / 音量 | `src/assistant.config.ts` |
| 全部颜色、字体、间距 | `src/styles/global.css` 顶部的 `:root` 变量 |
| 站点头像与图标 | `public/assistant.png`、`public/favicon.ico` |

## 目录结构

```
├─ .github/workflows/deploy.yml   GitHub Pages 自动部署
├─ astro.config.mjs               站点地址、base、代码高亮主题
├─ tools/editor/                  本地图形化编辑器（不参与构建）
├─ public/                        静态资源：图标、头像、封面、背景图、语音
└─ src/
   ├─ site.config.ts              站名、简介、导航、友链、背景图
   ├─ assistant.config.ts         右下角助手配置
   └─ content/posts/              所有文章（Markdown）
```

## 部署

1. 推到 `main` 分支。
2. 仓库 **Settings → Pages → Source** 选 **GitHub Actions**。
3. 之后每次 push，`.github/workflows/deploy.yml` 自动构建并发布。

工作流会自动推导站点地址：

- 仓库名为 `<用户名>.github.io` → 站点在根路径 `/`
- 其他仓库名 → 自动使用子路径 `/<仓库名>/`

用自定义域名时：Settings → Pages → Custom domain 填域名，把 `astro.config.mjs` 的默认 `SITE` 改成该域名、`BASE` 改回 `'/'`，并在 `public/` 放一个 `CNAME` 文件写域名。

---

## 一点说明

关于页的邮箱是图片而不是文字（`public/email.png`），页面 HTML 里不出现明文地址，避免被垃圾邮件爬虫抓取。

站内文章、图片均为个人使用，转载前请先联系。
