import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * 文章集合：src/content/posts/*.md
 * frontmatter 字段说明见 README.md
 */
const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string().default(''),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    /** 封面图：public/ 下的路径（如 /covers/a.webp）或外链 URL；不填显示渐变色块 */
    cover: z.string().optional(),
    /** 卡片上显示的顺序，小的在前；不填按发布时间 */
    order: z.number().optional(),
  }),
});

export const collections = { posts };
