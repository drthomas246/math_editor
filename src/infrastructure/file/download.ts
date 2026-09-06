/**
 * ダウンロード名が衝突しにくいよう、基準日時をローカル時刻の短い文字列へ整形する。
 *
 * @param date ファイル名へ時刻を付与する基準日時
 * @returns 値を埋め込んだ表示文字列として得た文字列。変換できない場合は関数固有の既定値
 */
export function localTimestamp(date = new Date()): string {
    const pad = (/**
     * padをpad・Startで処理し、その結果を呼び出し元へ反映する。
     *
     * @param value padで判定または変換する入力値
     * @returns pad・Startの結果
     */
    function padImplementation1(value: number) {
        return String(value).padStart(2, "0");
    });
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}
/**
 * ファイル・名前・Partを比較・保存・表示先が要求する形式へ変換する。
 *
 * @param value sanitize・ファイル・名前・Partで判定または変換する入力値
 * ファイル・名前・Partを比較・保存・表示先が要求する形式へ変換する。
  * @returns 二つの値を比較した結果として得た文字列。変換できない場合は関数固有の既定値
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
 * Blobを利用者が再利用できる永続形式へ出力する。
 *
 * @param blob 検証または保存するバイナリデータ
 * @param fileName 安全性または規則を検証するファイル名
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
         * ブラウザーがダウンロードURLを読み取った後にObject URLを解放する。
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
 * prepare・Json・ダウンロードをprepare・Json・テキスト・ダウンロードで処理し、その結果を呼び出し元へ反映する。
 *
 * @param value prepare・Json・ダウンロードで判定または変換する入力値
 * @param fileName 安全性または規則を検証するファイル名
 * @returns prepare・Json・テキスト・ダウンロードの結果
 */
export function prepareJsonDownload(value: unknown, fileName: string): PreparedDownload {
    return prepareJsonTextDownload(JSON.stringify(value, null, 2), fileName);
}
/**
 * 安全性または規則を検証するファイル名・安全性の検証または解放を行うURL・revokeを持つオブジェクトを一つの結果へまとめる。
 *
 * @param json ダウンロード用に整形済みのJSON文字列
 * @param fileName 安全性または規則を検証するファイル名
 * @returns 安全性または規則を検証するファイル名・安全性の検証または解放を行うURL・revokeを持つオブジェクト
 */
export function prepareJsonTextDownload(json: string, fileName: string): PreparedDownload {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    let revoked = false;
    return {
        fileName,
        url,
        revoke: (/**
         * 不要になったイベント購読またはブラウザーリソースを解放し、後続画面への影響を防ぐ。
         */
        function revokeCallback3() {
            if (revoked)
                return;
            revoked = true;
            URL.revokeObjectURL(url);
        }),
    };
}
