import type { Patch } from "immer";
import { collectReferencedAssetIds } from "../../domain/worksheet/worksheet.assets";
import type { Worksheet } from "../../domain/worksheet/worksheet";
import type { HistoryEntry } from "./editor-store";
/**
 * Retained・アセット・Idsを入力データまたは現在の状態から取り出す。
 *
 * @param worksheet 処理対象となるプリント
 * @param historyEntries 参照アセットを調べるUndo・Redo履歴
 * @returns 解放せず保持するアセット識別子集合として得た文字列。変換できない場合は関数固有の既定値
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
 * prune・アセット・Urlsをfor・Eachで処理し、その結果を呼び出し元へ反映する。
 *
 * @param current 更新前または現在の状態
 * @param retainedIds 解放せず保持するアセット識別子集合
 * @param revokeObjectUrl 不要になったObject URLを解放する処理
  * @returns 二つの値を比較した結果として得た文字列。変換できない場合は関数固有の既定値
 */
export function pruneAssetUrls(current: Map<string, string>, retainedIds: ReadonlySet<string>, revokeObjectUrl: (url: string) => void = (/**
 * 不要になったイベント購読またはブラウザーリソースを解放し、後続画面への影響を防ぐ。
 *
 * @param url 安全性の検証または解放を行うURL
 */
function releaseResources1(url) {
    return URL.revokeObjectURL(url);
})): Map<string, string> {
    let next: Map<string, string> | null = null;
    current.forEach((/**
     * 各安全性の検証または解放を行うURLについてhasを実行し、対応関係または検証状態を更新する。
     *
     * @param url 安全性の検証または解放を行うURL
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
 * アセット・Ids・From・Patchを入力データまたは現在の状態から取り出す。
 *
 * @param patch 履歴またはアセット参照を調べるImmerパッチ
 * @param retainedIds 解放せず保持するアセット識別子集合
 */
function collectAssetIdsFromPatch(patch: Patch, retainedIds: Set<string>): void {
    if (patch.path.at(-1) === "assetId" && "value" in patch && typeof patch.value === "string") {
        retainedIds.add(patch.value);
    }
    if (!("value" in patch))
        return;
    collectReferencedAssetIds(patch.value).forEach((/**
     * 各アセット・Idについてaddを実行し、対応関係または検証状態を更新する。
     *
     * @param assetId 対象を識別するID
     */
    function processItem3(assetId) {
        return retainedIds.add(assetId);
    }));
}
