import { memo } from "react";
import { convertLatexToMarkup, convertLatexToSpeakableText } from "mathlive/ssr";
import { mathMacros } from "./math-macros";
type Props = {
    latex: string;
    block?: boolean;
    textSize?: "small" | "normal" | "large" | "xLarge";
    className?: string;
};
const CACHE_LIMIT = 2000;
const markupCache = new Map<string, string>();
const ariaLabelCache = new Map<string, string>();
/**
 * renderMathMarkupに対応する画面表示を更新する。
 *
 * @param latex latexとして使用する値
 * @param block blockとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
export function renderMathMarkup(latex: string, block: boolean): string {
    const key = `${block ? "block" : "inline"}:${latex}`;
    const cached = markupCache.get(key);
    if (cached !== undefined)
        return cached;
    try {
        const markup = convertLatexToMarkup(latex, {
            defaultMode: block ? "math" : "inline-math",
            macros: mathMacros,
        });
        cacheValue(markupCache, key, markup);
        return markup;
    }
    catch {
        return "";
    }
}
/**
 * getMathAriaLabelで必要な値を取得する。
 *
 * @param latex latexとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
export function getMathAriaLabel(latex: string): string {
    const cached = ariaLabelCache.get(latex);
    if (cached !== undefined)
        return cached;
    try {
        const label = convertLatexToSpeakableText(latex) || `数式 ${latex}`;
        cacheValue(ariaLabelCache, latex, label);
        return label;
    }
    catch {
        return `数式 ${latex}`;
    }
}
export const MathFormula = memo((/**
 * MathFormulaコンポーネントを表示する。
 *
 * @param parameter1 parameter1として使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function MathFormula(parameter1: Props) {
    let { latex, block = false, textSize = "normal", className = "" } = parameter1;
    const markup = renderMathMarkup(latex, block);
    const Tag = block ? "div" : "span";
    const classes = ["math-formula", block ? "math-formula-block" : "math-formula-inline", `math-size-${textSize}`, className]
        .filter(Boolean)
        .join(" ");
    if (!markup) {
        return <Tag className={`${classes} math-formula-fallback`} role="math" aria-label={getMathAriaLabel(latex)}>{latex}</Tag>;
    }
    return <Tag className={classes} role="math" aria-label={getMathAriaLabel(latex)} dangerouslySetInnerHTML={{ __html: markup }}/>;
}));
/**
 * cacheValueに必要な処理を実行する。
 *
 * @param cache cacheとして使用する値
 * @param key keyとして使用する値
 * @param value 処理対象の値
 */
function cacheValue(cache: Map<string, string>, key: string, value: string): void {
    if (cache.size >= CACHE_LIMIT) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey !== undefined)
            cache.delete(oldestKey);
    }
    cache.set(key, value);
}
