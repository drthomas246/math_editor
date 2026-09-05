/**
 * collectReferencedAssetIdsで必要な値を取得する。
 *
 * @param value 処理対象の値
 * @returns 呼び出し元で使用する処理結果
 */
export function collectReferencedAssetIds(value: unknown): Set<string> {
    const referencedIds = new Set<string>();
    const visit = (/**
     * visitで定義された一連の処理を実行する。
     *
     * @param child childとして使用する値
     */
    function visitImplementation1(child: unknown): void {
        if (Array.isArray(child)) {
            child.forEach(visit);
            return;
        }
        if (typeof child !== "object" || child === null)
            return;
        Object.entries(child).forEach((/**
         * 各要素へ必要な処理を適用する。
         *
         * @param parameter1 parameter1として使用する値
         */
        function processItem2(parameter1) {
            let [key, nested] = parameter1;
            if (key === "assetId" && typeof nested === "string")
                referencedIds.add(nested);
            visit(nested);
        }));
    });
    visit(value);
    return referencedIds;
}
