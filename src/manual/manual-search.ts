import { MANUAL_CHAPTERS, type ManualChapter } from "./manual-chapters";
import type { ManualChapterSlug } from "./manual-manifest";

export type ManualSearchResult = {
  slug: ManualChapterSlug;
  title: string;
  summary: string;
  excerpt: string;
  score: number;
  order: number;
};

type SearchableManualChapter = {
  chapter: ManualChapter;
  normalizedTitle: string;
  normalizedSummary: string;
  normalizedKeywords: readonly string[];
  plainTextBlocks: readonly string[];
  normalizedBlocks: readonly string[];
  normalizedBody: string;
};

export function normalizeManualSearchText(value: string): string {
  return value
    .normalize("NFC")
    .replace(/\u3000/gu, " ")
    .replace(/[\uFF01-\uFF5E]/gu, (character) =>
      String.fromCharCode(character.charCodeAt(0) - 0xfee0),
    )
    .toLocaleLowerCase("ja-JP")
    .replace(/\s+/gu, " ")
    .trim();
}

export function markdownToPlainTextBlocks(markdown: string): readonly string[] {
  const text = markdown
    .replace(/\r\n?/gu, "\n")
    .replace(/^```[^\n]*$/gmu, "")
    .replace(/^~~~[^\n]*$/gmu, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/gu, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
    .replace(/^\s*\|?(?:\s*:?-+:?\s*\|)+\s*$/gmu, "")
    .replace(/<\/?[A-Za-z][^>]*>/gu, "")
    .replace(/^\s{0,3}(?:#{1,6}|>|[-+*]|\d+[.)])\s+/gmu, "")
    .replace(/[*_~`]+/gu, "")
    .replace(/\|/gu, " ");

  return text
    .split(/\n\s*\n/gu)
    .map((block) => block.replace(/\s+/gu, " ").trim())
    .filter(Boolean);
}

const searchableChapters: readonly SearchableManualChapter[] = MANUAL_CHAPTERS.map((chapter) => {
  const plainTextBlocks = markdownToPlainTextBlocks(chapter.markdown);
  const normalizedBlocks = plainTextBlocks.map(normalizeManualSearchText);
  return {
    chapter,
    normalizedTitle: normalizeManualSearchText(chapter.title),
    normalizedSummary: normalizeManualSearchText(chapter.summary),
    normalizedKeywords: chapter.keywords.map(normalizeManualSearchText),
    plainTextBlocks,
    normalizedBlocks,
    normalizedBody: normalizedBlocks.join(" "),
  };
});

function truncateExcerpt(value: string, limit = 120): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit - 1).trimEnd()}…`;
}

function createManualExcerpt(item: SearchableManualChapter, tokens: readonly string[]): string {
  let bestIndex = -1;
  let bestMatches = 0;
  item.normalizedBlocks.forEach((block, index) => {
    const matches = tokens.filter((token) => block.includes(token)).length;
    if (matches > bestMatches) {
      bestMatches = matches;
      bestIndex = index;
    }
  });
  return truncateExcerpt(bestIndex >= 0 ? (item.plainTextBlocks[bestIndex] ?? item.chapter.summary) : item.chapter.summary);
}

export function searchManual(query: string): readonly ManualSearchResult[] {
  const normalizedQuery = normalizeManualSearchText(query);
  const tokens = [...new Set(normalizedQuery.split(" ").filter(Boolean))];
  if (tokens.length === 0) return [];

  return searchableChapters
    .flatMap((item): ManualSearchResult[] => {
      const containsToken = (token: string) =>
        item.normalizedTitle.includes(token)
        || item.normalizedSummary.includes(token)
        || item.normalizedKeywords.some((keyword) => keyword.includes(token))
        || item.normalizedBody.includes(token);
      if (!tokens.every(containsToken)) return [];

      let score = item.normalizedTitle === normalizedQuery
        ? 500
        : item.normalizedTitle.includes(normalizedQuery) ? 300 : 0;
      tokens.forEach((token) => {
        if (item.normalizedTitle.includes(token)) score += 100;
        if (item.normalizedKeywords.some((keyword) => keyword.includes(token))) score += 60;
        if (item.normalizedSummary.includes(token)) score += 30;
        if (item.normalizedBody.includes(token)) score += 10;
      });
      return [{
        slug: item.chapter.slug,
        title: item.chapter.title,
        summary: item.chapter.summary,
        excerpt: createManualExcerpt(item, tokens),
        score,
        order: item.chapter.order,
      }];
    })
    .sort((a, b) => b.score - a.score || a.order - b.order);
}
