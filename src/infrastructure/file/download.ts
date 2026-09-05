/**
 * localTimestampに必要な処理を実行する。
 *
 * @param date dateとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
export function localTimestamp(date = new Date()): string {
    const pad = (/**
     * padに必要な処理を実行する。
     *
     * @param value 処理対象の値
     * @returns 呼び出し元で使用する処理結果
     */
    function padImplementation1(value: number) {
        return String(value).padStart(2, "0");
    });
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}
/**
 * sanitizeFileNamePartに必要な処理を実行する。
 *
 * @param value 処理対象の値
 * @returns 呼び出し元で使用する処理結果
 */
export function sanitizeFileNamePart(value: string): string {
    const normalized = value
        .trim()
        .replace(/[\p{Cc}<>:"/\\|?*]/gu, "_")
        .replace(/_+/gu, "_")
        .replace(/[ .]+$/gu, "")
        .slice(0, 80);
    return normalized || "無題のプリント";
}
/**
 * downloadBlobの対象となるデータを保存または出力する。
 *
 * @param blob blobとして使用する値
 * @param fileName fileNameとして使用する値
 */
export function downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.style.display = "none";
    document.body.append(link);
    try {
        link.click();
    }
    finally {
        link.remove();
    // ブラウザーがダウンロード対象を読み始めるまでObject URLを維持する。
        window.setTimeout((/**
         * 指定時間後に必要な処理を実行する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function handleScheduledTask2() {
            return URL.revokeObjectURL(url);
        }), 60000);
    }
}
export type PreparedDownload = {
    fileName: string;
    url: string;
    revoke: () => void;
};
/**
 * prepareJsonDownloadに必要な処理を実行する。
 *
 * @param value 処理対象の値
 * @param fileName fileNameとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
export function prepareJsonDownload(value: unknown, fileName: string): PreparedDownload {
    return prepareJsonTextDownload(JSON.stringify(value, null, 2), fileName);
}
/**
 * prepareJsonTextDownloadに必要な処理を実行する。
 *
 * @param json jsonとして使用する値
 * @param fileName fileNameとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
export function prepareJsonTextDownload(json: string, fileName: string): PreparedDownload {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    let revoked = false;
    return {
        fileName,
        url,
        revoke: (/**
         * revokeの対象となる要素を削除または解放する。
         */
        function revokeCallback3() {
            if (revoked)
                return;
            revoked = true;
            URL.revokeObjectURL(url);
        }),
    };
}
