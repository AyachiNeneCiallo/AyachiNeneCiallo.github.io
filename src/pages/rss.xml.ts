import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getAllPosts, postHref } from '../utils/posts';
import { siteConfig } from '../site.config';

export async function GET(context: APIContext) {
  const posts = await getAllPosts();
  const base = import.meta.env.BASE_URL;
  return rss({
    title: siteConfig.title,
    description: siteConfig.description,
    site: context.site ?? 'https://example.github.io',
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `${base}${postHref(post).replace(/^\//, '')}`,
      categories: post.data.tags,
    })),
    customData: '<language>zh-cn</language>',
  });
}
