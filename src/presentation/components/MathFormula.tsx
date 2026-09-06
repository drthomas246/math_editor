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
 * 数式・Markupの内容と操作を、アクセシブルな画面要素として構成する。
 *
 * @param latex 描画または保存するLaTeX式
 * @param block 処理対象のリッチテキストブロック
 * @returns cachedとして得た文字列。変換できない場合は関数固有の既定値
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
 * 数式・Aria・表示名を入力データまたは現在の状態から取り出す。
 *
 * @param latex 描画または保存するLaTeX式
 * @returns cachedとして得た文字列。変換できない場合は関数固有の既定値
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
 * LaTeX式をMathLiveで静的描画し、読み上げ用ラベルと描画キャッシュを適用する。
 *
 * @param callbackInput let・{・latex・ブロック・=・false・テキスト・寸法・=・"normal"・class・名前・=・""をまとめて受け取るコールバック入力
 * @returns 数式・Formulaを表示するReact要素
 */
function MathFormula(callbackInput: Props) {
    let { latex, block = false, textSize = "normal", className = "" } = callbackInput;
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
 * cache・値を適用候補となる次の値で処理し、その結果を呼び出し元へ反映する。
 *
 * @param cache 再利用する計算結果のキャッシュ
 * @param key 保存先または要素を特定するキー
 * @param value cache・値で判定または変換する入力値
 */
function cacheValue(cache: Map<string, string>, key: string, value: string): void {
    if (cache.size >= CACHE_LIMIT) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey !== undefined)
            cache.delete(oldestKey);
    }
    cache.set(key, value);
}
