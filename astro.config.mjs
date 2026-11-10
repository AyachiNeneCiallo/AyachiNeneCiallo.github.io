// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

/**
 * 站点配置
 * ------------------------------------------------------------
 * 部署到 GitHub Pages 时，CI 会通过环境变量注入真实的地址，本地开发用默认值即可。
 *
 * 1) 用户/组织主页仓库（仓库名必须是 <用户名>.github.io）
 *      SITE = https://<用户名>.github.io     BASE = /
 * 2) 项目仓库（例如仓库名 my-blog）
 *      SITE = https://<用户名>.github.io     BASE = /my-blog/
 *
 * 换域名（自定义域名）时只改 SITE，BASE 保持 /。
 */
const SITE = process.env.SITE ?? 'https://example.github.io';
const BASE = process.env.BASE ?? '/';

export default defineConfig({
  site: SITE,
  base: BASE,
  trailingSlash: 'ignore',
  integrations: [sitemap()],
  markdown: {
    shikiConfig: {
      theme: 'github-light',
      wrap: true,
    },
  },
});
