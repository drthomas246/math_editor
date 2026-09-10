export const MIN_PREVIEW_ZOOM = 0.25;
export const MAX_PREVIEW_ZOOM = 2;
export const PREVIEW_ZOOM_STEP = 0.05;
export const PREVIEW_PAGE_BASE_WIDTH_PX = 520;
const PAGE_COUNTER_HEIGHT_PX = 24;
/**
 * 現在の倍率から指定方向の次の倍率を求め、許容範囲内へ収める。
 *
 * @param currentZoom 現在のプレビュー倍率
 * @param direction 倍率を上げるか下げるかを示す方向
 * @returns 1段階拡大または縮小したプレビュー倍率
 */
export function getNextPreviewZoom(currentZoom: number, direction: -1 | 1): number {
    const currentStep = currentZoom / PREVIEW_ZOOM_STEP;
    const nextStep = direction === 1
        ? Math.floor(currentStep + 1e-8) + 1
        : Math.ceil(currentStep - 1e-8) - 1;
    return clampZoom(Number((nextStep * PREVIEW_ZOOM_STEP).toFixed(2)));
}
/**
 * プレビュー領域へ用紙の幅または全体が収まる表示倍率を計算する。
 *
 * @param callbackInput 合わせ方、表示領域、余白、用紙の縦横比
 * @returns 許容範囲内へ収めた表示倍率
 */
export function calculateFittedPreviewZoom(callbackInput: {
    mode: "fitWidth" | "fitPage";
    viewportWidth: number;
    viewportHeight: number;
    horizontalPadding: number;
    verticalPadding: number;
    pageAspectRatio: number;
}): number {
    let { mode, viewportWidth, viewportHeight, horizontalPadding, verticalPadding, pageAspectRatio, } = callbackInput;
    const availableWidth = Math.max(1, viewportWidth - horizontalPadding);
    const widthZoom = availableWidth / PREVIEW_PAGE_BASE_WIDTH_PX;
    if (mode === "fitWidth")
        return clampZoom(widthZoom);
    const availableHeight = Math.max(1, viewportHeight - verticalPadding - PAGE_COUNTER_HEIGHT_PX);
    const pageHeight = PREVIEW_PAGE_BASE_WIDTH_PX * pageAspectRatio;
    return clampZoom(Math.min(widthZoom, availableHeight / pageHeight));
}
/**
 * clamp・倍率をminで処理し、その結果を呼び出し元へ反映する。
 *
 * @param zoom 適用候補となるプレビュー倍率
 * @returns minの結果から算出した数値
 */
function clampZoom(zoom: number): number {
    return Math.min(MAX_PREVIEW_ZOOM, Math.max(MIN_PREVIEW_ZOOM, zoom));
}
