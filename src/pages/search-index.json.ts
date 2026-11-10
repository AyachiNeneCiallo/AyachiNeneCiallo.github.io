import type { APIContext } from 'astro';
import { getAllPosts, postHref } from '../utils/posts';

/** 把 Markdown 正文压成纯文本，用于站内搜索 */
function toPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^---[\s\S]*?---/, ' ')
    .replace(/[#>*_~|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function GET(_context: APIContext) {
  const posts = await getAllPosts();
  const base = import.meta.env.BASE_URL;

  const index = posts.map((post) => ({
    title: post.data.title,
    description: post.data.description,
    tags: post.data.tags,
    date: post.data.pubDate.toISOString().slice(0, 10),
    url: `${base}${postHref(post).replace(/^\//, '')}`,
    body: toPlainText(post.body ?? '').slice(0, 3000),
  }));

  return new Response(JSON.stringify(index), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
