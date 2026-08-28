import { memo } from "react";
import { convertLatexToMarkup, convertLatexToSpeakableText } from "mathlive/ssr";

import { mathMacros } from "./math-macros";

type Props = {
  latex: string;
  block?: boolean;
  textSize?: "small" | "normal" | "large" | "xLarge";
  className?: string;
};

const CACHE_LIMIT = 2_000;
const markupCache = new Map<string, string>();
const ariaLabelCache = new Map<string, string>();

export function renderMathMarkup(latex: string, block: boolean): string {
  const key = `${block ? "block" : "inline"}:${latex}`;
  const cached = markupCache.get(key);
  if (cached !== undefined) return cached;
  try {
    const markup = convertLatexToMarkup(latex, {
      defaultMode: block ? "math" : "inline-math",
      macros: mathMacros,
    });
    cacheValue(markupCache, key, markup);
    return markup;
  } catch {
    return "";
  }
}

export function getMathAriaLabel(latex: string): string {
  const cached = ariaLabelCache.get(latex);
  if (cached !== undefined) return cached;
  try {
    const label = convertLatexToSpeakableText(latex) || `数式 ${latex}`;
    cacheValue(ariaLabelCache, latex, label);
    return label;
  } catch {
    return `数式 ${latex}`;
  }
}

export const MathFormula = memo(function MathFormula({ latex, block = false, textSize = "normal", className = "" }: Props) {
  const markup = renderMathMarkup(latex, block);
  const Tag = block ? "div" : "span";
  const classes = ["math-formula", block ? "math-formula-block" : "math-formula-inline", `math-size-${textSize}`, className]
    .filter(Boolean)
    .join(" ");

  if (!markup) {
    return <Tag className={`${classes} math-formula-fallback`} role="math" aria-label={getMathAriaLabel(latex)}>{latex}</Tag>;
  }

  return <Tag className={classes} role="math" aria-label={getMathAriaLabel(latex)} dangerouslySetInnerHTML={{ __html: markup }} />;
});

function cacheValue(cache: Map<string, string>, key: string, value: string): void {
  if (cache.size >= CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }
  cache.set(key, value);
}
