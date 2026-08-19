import { MANUAL_CONTENT } from "./manual-content";
import { MANUAL_CHAPTER_MANIFEST, type ManualChapterSlug } from "./manual-manifest";
import type { ManualChapterMetadata } from "./manual-types";

export type ManualChapter = ManualChapterMetadata & {
  slug: ManualChapterSlug;
  order: number;
  markdown: string;
};

export const MANUAL_CHAPTERS: readonly ManualChapter[] = MANUAL_CHAPTER_MANIFEST.map(
  (metadata, index) => ({ ...metadata, order: index + 1, markdown: MANUAL_CONTENT[metadata.slug] }),
);

export const MANUAL_CHAPTER_BY_SLUG = new Map(
  MANUAL_CHAPTERS.map((chapter) => [chapter.slug, chapter]),
);

export function getManualChapter(slug: string): ManualChapter | undefined {
  return MANUAL_CHAPTER_BY_SLUG.get(slug as ManualChapterSlug);
}

export function isManualChapterSlug(value: string): value is ManualChapterSlug {
  return MANUAL_CHAPTER_BY_SLUG.has(value as ManualChapterSlug);
}

export function getAdjacentManualChapters(slug: ManualChapterSlug): {
  previous?: ManualChapter;
  next?: ManualChapter;
} {
  const index = MANUAL_CHAPTERS.findIndex((chapter) => chapter.slug === slug);
  const previous = MANUAL_CHAPTERS[index - 1];
  const next = MANUAL_CHAPTERS[index + 1];
  return {
    ...(previous ? { previous } : {}),
    ...(next ? { next } : {}),
  };
}
