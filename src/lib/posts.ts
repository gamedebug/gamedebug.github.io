import { getCollection, type CollectionEntry } from 'astro:content';
import { CATEGORY_META } from '../consts';

export type Post = CollectionEntry<'posts'>;

/** All posts, newest first. */
export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('posts');
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf() || a.id.localeCompare(b.id));
}

export const isHidden = (category: string) => Boolean(CATEGORY_META[category]?.hidden);

/** Posts that may appear on the home page and category/tag listings. */
export const visible = (posts: Post[]) => posts.filter((p) => !isHidden(p.data.category));

export const postUrl = (post: Post) => `/${post.id}/`;
export const tagUrl = (tag: string) => `/tags/${tagSlug(tag)}/`;
export const categoryUrl = (category: string) => `/category/${category}/`;
export const tagSlug = (tag: string) => tag.trim().replace(/\s+/g, '-');

export function formatDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Minutes to read: CJK at ~400 characters/min, other words at ~200 words/min. */
export function readingMinutes(markdown: string): number {
  const text = markdown
    .replace(/^---[\s\S]*?---/, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ');
  const cjk = (text.match(/[㐀-鿿豈-﫿]/g) || []).length;
  const words = (text.replace(/[㐀-鿿豈-﫿]/g, ' ').match(/[A-Za-z0-9_'-]+/g) || []).length;
  return Math.max(1, Math.round(cjk / 400 + words / 200));
}

/** Short plain-text summary for meta descriptions and listings. */
export function excerpt(markdown: string, length = 120): string {
  // Only prose before the first code block: unbalanced fences (e.g. ASCII art
  // that starts with ```) would otherwise leak code into the summary.
  const fence = markdown.search(/^ {0,3}(```|~~~)/m);
  const prose = fence > 40 ? markdown.slice(0, fence) : markdown;
  const text = prose
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*\[[^\]]+\]:.*$/gm, ' ')
    .replace(/[#>*_`|~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

export function tagCounts(posts: Post[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const p of posts) for (const t of p.data.tags) counts.set(t, (counts.get(t) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh'));
}
