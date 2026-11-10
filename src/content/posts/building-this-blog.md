---
title: 这个博客是怎么搭起来的
description: 从零到上线的完整过程。
pubDate: 2026-11-10
tags: ['建站']
cover: /covers/build.webp
---

~~其实这个站主要是展示老婆（）~~

## 为什么是 Astro
~~因为展示老婆这样就够了~~\
因为搞静态网页好用

## 现在的样子：

- 首页一页文章卡片，带分页
- 文章详情页，支持 Markdown、代码高亮、表格、引用
- 标签云和单标签列表、站内搜索索引
- 关于页
- 右下角一个可以拖动的宁宁（~~开外放按一下有惊喜~~）

## 视觉：一层玻璃，一张背景

~~背景当然得放老婆~~

**一张插画铺满背景，上面盖一张半透明的玻璃纸卡**。

```css
main > .container {
  background: rgb(255 255 255 / 20%);
  backdrop-filter: blur(4px) saturate(1.08);
  border: 1px solid rgb(255 255 255 / 34%);
  border-radius: 20px;
}
```

几个问题的改进：

1. **只降白色的透明度没用**。一开始把卡片底色调到 20% 还是像一块白雾，因为 `backdrop-filter: blur(14px)` 把背景糊成了一片均匀的浅色。模糊半径要一起降，画面才有轮廓。
2. **文字必须跟着加深**。正文会压在插画上，浅灰在深色头发和蓝衣服上会糊成一团，所以次级文字比常规浅色站点深了一档（`--color-text-soft: #474e60`）。
3. **不要动画**。试过渐变流动、粒子之类的，结论是不好看几把还卡，现在全是静态的。

## 手机上真几把麻烦，搞半天搞不好

桌面是横构图背景，手机竖屏下 `cover` 只会横向裁切——人物往往只剩一撮头发，而且正好被白色文章卡片挡住。

所以手机端：

- 首页换了张背景图，并单独调取景位置
- 在标题区下面留出一块留白，让脸完整落在这块区域里
- 玻璃虚化单独降到 2px，否则人物会被糊掉
- 但是没有更好的图片，效果还是一般般

```css
@media (max-width: 640px) {
  body:has(.page-head) {
    background-image: var(--bg-image-mobile);
    background-position: var(--bg-position-mobile);
  }
  .page-subtitle {
    margin-bottom: clamp(7rem, calc(50vh - 12.25rem), 17rem);
  }
}
```

## 之后想做的

- **藏个放涩图的页面（）**
- **来点涩图！**
- **多来点涩图！**