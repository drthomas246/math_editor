/**
 * 検索・キーを比較・保存・表示先が要求する形式へ変換する。
 *
 * @param value normalize・検索・キーで判定または変換する入力値
 * @returns trimの結果として得た文字列。変換できない場合は関数固有の既定値
 */
export function normalizeSearchKey(value: string): string {
    return value
        .normalize("NFC")
        .replace(/[！-～]/gu, (/**
     * 正規表現に一致した文字列を検索比較用の正規形へ置き換える。
     *
     * @param character 検査中の一文字
     * @returns 変換元・コード・Pointの結果
     */
    function replaceCallback1(character) {
        return String.fromCodePoint(character.codePointAt(0)! - 0xfee0);
    }))
        .replace(/　/gu, " ")
        .toLocaleLowerCase("ja-JP")
        .trim();
}
