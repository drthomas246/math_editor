import { describe, expect, it } from "vitest";
import { MANUAL_TOPIC_CHAPTERS } from "./manual-context";
import { isManualChapterSlug } from "./manual-chapters";
describe("manual context", (/**
 * 「manual context」に関するテスト条件と検証例をまとめる。
 */
function defineTestSuite1() {
    it("すべてのTopicを有効な章へ割り当てる", (/**
     * 「すべてのTopicを有効な章へ割り当てる」という仕様を操作結果から検証する。
     */
    function runTestCase2() {
        expect(Object.values(MANUAL_TOPIC_CHAPTERS).every(isManualChapterSlug)).toBe(true);
    }));
}));
