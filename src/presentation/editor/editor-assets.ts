import type { Patch } from "immer";
import { collectReferencedAssetIds } from "../../domain/worksheet/worksheet.assets";
import type { Worksheet } from "../../domain/worksheet/worksheet";
import type { HistoryEntry } from "./editor-store";
/**
 * collectRetainedAssetIdsで必要な値を取得する。
 *
 * @param worksheet worksheetとして使用する値
 * @param historyEntries historyEntriesとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
export function collectRetainedAssetIds(worksheet: Worksheet, historyEntries: readonly HistoryEntry[]): Set<string> {
    const retainedIds = collectReferencedAssetIds(worksheet);
    for (const entry of historyEntries) {
        for (const patch of [...entry.patches, ...entry.inversePatches]) {
            collectAssetIdsFromPatch(patch, retainedIds);
        }
    }
    return retainedIds;
}
/**
 * pruneAssetUrlsの対象となる要素を削除または解放する。
 *
 * @param current 更新前または現在の状態
 * @param retainedIds retainedIdsとして使用する値
 * @param revokeObjectUrl revokeObjectUrlとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
export function pruneAssetUrls(current: Map<string, string>, retainedIds: ReadonlySet<string>, revokeObjectUrl: (url: string) => void = (/**
 * 呼び出し元から要求された処理を実行する。
 *
 * @param url urlとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function commentRuleCallback1(url) {
    return URL.revokeObjectURL(url);
})): Map<string, string> {
    let next: Map<string, string> | null = null;
    current.forEach((/**
     * 各要素へ必要な処理を適用する。
     *
     * @param url urlとして使用する値
     * @param assetId 対象を識別するID
     */
    function processItem2(url, assetId) {
        if (retainedIds.has(assetId))
            return;
        revokeObjectUrl(url);
        next ??= new Map(current);
        next.delete(assetId);
    }));
    return next ?? current;
}
/**
 * collectAssetIdsFromPatchで必要な値を取得する。
 *
 * @param patch patchとして使用する値
 * @param retainedIds retainedIdsとして使用する値
 */
function collectAssetIdsFromPatch(patch: Patch, retainedIds: Set<string>): void {
    if (patch.path.at(-1) === "assetId" && "value" in patch && typeof patch.value === "string") {
        retainedIds.add(patch.value);
    }
    if (!("value" in patch))
        return;
    collectReferencedAssetIds(patch.value).forEach((/**
     * 各要素へ必要な処理を適用する。
     *
     * @param assetId 対象を識別するID
     * @returns 呼び出し元で使用する処理結果
     */
    function processItem3(assetId) {
        return retainedIds.add(assetId);
    }));
}
