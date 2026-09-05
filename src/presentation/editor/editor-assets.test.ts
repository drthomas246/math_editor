import { describe, expect, it, vi } from "vitest";
import { createWorksheet } from "../../domain/worksheet/worksheet.defaults";
import type { HistoryEntry } from "./editor-store";
import { collectRetainedAssetIds, pruneAssetUrls } from "./editor-assets";
describe("editor asset lifecycle", (/**
 * 関連するテストケースをまとめて定義する。
 */
function defineTestSuite1() {
    it("現在参照中またはUndo/Redoで復元可能なAssetだけを保持する", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase2() {
        const worksheet = createWorksheet();
        worksheet.problems[0]!.contents = [{
                id: crypto.randomUUID(),
                type: "image",
                assetId: "current-asset",
                alt: "",
                placement: "block",
                widthPercent: 50,
            }];
        const history: HistoryEntry = {
            label: "画像を差し替え",
            patches: [{ op: "replace", path: ["problems", 0, "contents", 0, "assetId"], value: "current-asset" }],
            inversePatches: [{ op: "replace", path: ["problems", 0, "contents", 0, "assetId"], value: "undo-asset" }],
            createdAt: 0,
        };
        expect(collectRetainedAssetIds(worksheet, [history])).toEqual(new Set([
            "current-asset",
            "undo-asset",
        ]));
        expect(collectRetainedAssetIds(worksheet, [])).toEqual(new Set(["current-asset"]));
    }));
    it("履歴から外れたAssetのObject URLを解放する", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase3() {
        const current = new Map([
            ["retained-asset", "blob:retained"],
            ["discarded-asset", "blob:discarded"],
        ]);
        const revokeObjectUrl = vi.fn();
        const next = pruneAssetUrls(current, new Set(["retained-asset"]), revokeObjectUrl);
        expect([...next]).toEqual([["retained-asset", "blob:retained"]]);
        expect(revokeObjectUrl).toHaveBeenCalledWith("blob:discarded");
        expect(current).toHaveLength(2);
    }));
}));
