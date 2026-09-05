export const OVERSIZED_PAGINATION_ERROR = "oversized-content";
export const OVERSIZED_PAGINATION_MESSAGE = "1ページに収まらない内容があるため、PDFを生成できません。内容を分割するか、画像・表・解答欄などを小さくしてください。";
/**
 * assertPreviewPaginationCanExportに必要な処理を実行する。
 *
 * @param previewRoot previewRootとして使用する値
 */
export function assertPreviewPaginationCanExport(previewRoot: HTMLElement): void {
    if (previewRoot.dataset.paginationError === OVERSIZED_PAGINATION_ERROR) {
        throw new Error(OVERSIZED_PAGINATION_MESSAGE);
    }
}
