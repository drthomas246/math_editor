/**
 * Referenced・アセット・Idsを入力データまたは現在の状態から取り出す。
 *
 * @param value collect・Referenced・アセット・Idsで判定または変換する入力値
 * @returns referenced・Idsとして得た文字列。変換できない場合は関数固有の既定値
 */
export function collectReferencedAssetIds(value: unknown): Set<string> {
    const referencedIds = new Set<string>();
    const visit = (/**
     * 入れ子の文書・表・問題構造を再帰走査し、対象値を漏れなく収集または検証する。
     *
     * @param child 走査中の子ノード
     */
    function visitImplementation1(child: unknown): void {
        if (Array.isArray(child)) {
            child.forEach(visit);
            return;
        }
        if (typeof child !== "object" || child === null)
            return;
        Object.entries(child).forEach((/**
         * 各保存先または要素を特定するキーとnestedの組についてaddを実行し、対応関係または検証状態を更新する。
         *
         * @param callbackInput コールバックの呼び出し元から渡される入力情報
         */
        function processItem2(callbackInput) {
            let [key, nested] = callbackInput;
            if (key === "assetId" && typeof nested === "string")
                referencedIds.add(nested);
            visit(nested);
        }));
    });
    visit(value);
    return referencedIds;
}
