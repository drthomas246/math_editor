import { describe, expect, it } from "vitest";
import { MANUAL_TOPIC_CHAPTERS } from "./manual-context";
import { isManualChapterSlug } from "./manual-chapters";
describe("manual context", (/**
 * 関連するテストケースをまとめて定義する。
 */
function defineTestSuite1() {
    it("すべてのTopicを有効な章へ割り当てる", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase2() {
        expect(Object.values(MANUAL_TOPIC_CHAPTERS).every(isManualChapterSlug)).toBe(true);
    }));
}));
