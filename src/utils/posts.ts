import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'posts'>;

/** 是否显示草稿：本地开发显示，构建产物里不显示 */
const SHOW_DRAFTS = import.meta.env.DEV;

/** 取全部文章，按发布时间倒序 */
export async function getAllPosts(): Promise<Post[]> {
  const posts = await getCollection(
    'posts',
    (entry) => SHOW_DRAFTS || entry.data.draft !== true,
  );
  return posts.sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
  );
}

export function postHref(post: Post): string {
  return `/posts/${post.id}/`;
}

/** 统计标签 -> 文章列表 */
export function groupByTag(posts: Post[]): Map<string, Post[]> {
  const map = new Map<string, Post[]>();
  for (const post of posts) {
    for (const tag of post.data.tags) {
      const list = map.get(tag) ?? [];
      list.push(post);
      map.set(tag, list);
    }
  }
  return new Map([...map.entries()].sort((a, b) => b[1].length - a[1].length));
}

/** 按年份分组，用于归档页 */
export function groupByYear(posts: Post[]): Array<[string, Post[]]> {
  const map = new Map<string, Post[]>();
  for (const post of posts) {
    const year = String(post.data.pubDate.getFullYear());
    const list = map.get(year) ?? [];
    list.push(post);
    map.set(year, list);
  }
  return [...map.entries()].sort((a, b) => Number(b[0]) - Number(a[0]));
}
