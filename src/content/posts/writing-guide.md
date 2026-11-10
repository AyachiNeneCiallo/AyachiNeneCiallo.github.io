---
title: 如何新增一篇文章
description: 这个骨架的写作流程说明，可以当作模板参考。
pubDate: 2026-11-09
tags: ['指南']
cover: /covers/writing-guide.webp
---

## 1. 新建文件

在 `src/content/posts/` 下新建一个 `.md` 文件，文件名就是 URL 的一部分，
例如 `my-first-post.md` → `/posts/my-first-post/`。

## 2. 写 frontmatter

```yaml
---
title: 文章标题
description: 一句话摘要，会显示在列表和 RSS 里
pubDate: 2026-11-09
updatedDate: 2026-11-12   # 可选
tags: ['标签A', '标签B']   # 可选
draft: false              # true = 只在本地 dev 显示，不会构建上线
cover: /images/cover.jpg  # 可选，预留给封面图
---
```

## 3. 写正文

普通 Markdown 即可。代码块带语法高亮，深浅色主题各有一套配色。

## 4. 本地预览

```bash
npm run dev      # http://localhost:4321
npm run build    # 产物在 dist/
```
