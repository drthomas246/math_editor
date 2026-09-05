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
 * mmToPtに必要な処理を実行する。
 *
 * @param millimeters millimetersとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function mmToPtImplementation1(millimeters: number): number {
    return millimeters * 72 / 25.4;
});
/**
 * getPrintableAreaで必要な値を取得する。
 *
 * @param size sizeとして使用する値
 * @param margin marginとして使用する値
 * @returns 呼び出し元で使用する処理結果
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
