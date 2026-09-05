/**
 * normalizeSearchKeyの入力値を必要な形式へ変換する。
 *
 * @param value 処理対象の値
 * @returns 呼び出し元で使用する処理結果
 */
export function normalizeSearchKey(value: string): string {
    return value
        .normalize("NFC")
        .replace(/[！-～]/gu, (/**
     * replaceへ渡す処理を実行する。
     *
     * @param character characterとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function replaceCallback1(character) {
        return String.fromCodePoint(character.codePointAt(0)! - 0xfee0);
    }))
        .replace(/　/gu, " ")
        .toLocaleLowerCase("ja-JP")
        .trim();
}
