import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

export const CATEGORIES = ['技术', 'ACG', '科普', '健康'] as const;

const posts = defineCollection({
  // One directory per post: src/content/posts/<date>-<name>/index.md
  loader: glob({
    base: './src/content/posts',
    pattern: '**/index.md',
    // The URL slug comes from front matter, copied from the live Jekyll site.
    generateId: ({ data }) => String(data.slug),
  }),
  schema: z.object({
    title: z.string().min(1),
    date: z.coerce.date(),
    slug: z.string().min(1),
    category: z.enum(CATEGORIES),
    tags: z.array(z.string()).default([]),
    description: z.string().optional(),
    source: z.object({ title: z.string(), url: z.url() }).optional(),
    updated: z.coerce.date().optional(),
  }),
});

export const collections = { posts };
