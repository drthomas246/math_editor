import type { MarginPreset, PageSize } from "./worksheet";
export const PAGE_SIZES_MM: Record<PageSize, {
    width: number;
    height: number;
    label: string;
}> = {
    A4: { width: 210, height: 297, label: "A4" },
    B5: { width: 182, height: 257, label: "JIS B5" },
};
export const MARGINS_MM: Record<MarginPreset, number> = {
    wide: 20,
    normal: 15,
    narrow: 10,
    veryNarrow: 5,
};
export const mmToPt = (/**
 * ミリメートル値をPDFレイアウトで使うポイント値へ換算する。
 *
 * @param millimeters ポイントへ変換するミリメートル値
  * @returns ポイントへ変換するミリメートル値と72を乗算した値と25.4で除算した値から算出した数値
 */
function mmToPtImplementation1(millimeters: number): number {
    return millimeters * 72 / 25.4;
});
/**
 * 幅・Mm・ミリメートル単位の高さ・margin・Mmを持つオブジェクトを一つの結果へまとめる。
 *
 * @param size 適用または検証する寸法
 * @param margin ページへ適用する余白設定
 * @returns 幅・Mm・ミリメートル単位の高さ・margin・Mmを持つオブジェクト
 */
export function getPrintableArea(size: PageSize, margin: MarginPreset) {
    const page = PAGE_SIZES_MM[size];
    const marginMm = MARGINS_MM[margin];
    return {
        widthMm: page.width - marginMm * 2,
        heightMm: page.height - marginMm * 2,
        marginMm,
    };
}
