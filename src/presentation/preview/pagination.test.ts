import { describe, expect, it } from "vitest";
import { paginateMeasuredItems, planMeasuredPagination, type MeasuredPaginationItem } from "./pagination";
const item = (/**
 * itemに必要な処理を実行する。
 *
 * @param key keyとして使用する値
 * @param height heightとして使用する値
 * @param startsProblem startsProblemとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function itemImplementation1(key: string, height: number, startsProblem = true): MeasuredPaginationItem {
    return ({
        key,
        height,
        startsProblem,
        breakBefore: false,
        breakAfter: false,
    });
});
describe("paginateMeasuredItems", (/**
 * 関連するテストケースをまとめて定義する。
 */
function defineTestSuite2() {
    it("moves overflowing problems to following pages", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase3() {
        expect(paginateMeasuredItems([
            item("p1", 40), item("p2", 40), item("p3", 40),
        ], 100, 100, 10)).toEqual([["p1", "p2"], ["p3"]]);
    }));
    it("does not add a problem gap between continuation fragments", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase4() {
        expect(paginateMeasuredItems([
            item("p1:a", 55), item("p1:b", 45, false), item("p2", 10),
        ], 100, 100, 10)).toEqual([["p1:a", "p1:b"], ["p2"]]);
    }));
    it("honors explicit page breaks", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase5() {
        expect(paginateMeasuredItems([
            item("p1", 20),
            { ...item("p2", 20), breakBefore: true },
            { ...item("p3", 20), breakAfter: true },
            item("p4", 20),
        ], 100, 100, 10)).toEqual([["p1"], ["p2", "p3"], ["p4"]]);
    }));
    it("uses the header-free capacity after the first page", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase6() {
        expect(paginateMeasuredItems([
            item("p1", 70), item("p2", 100),
        ], 80, 110, 10)).toEqual([["p1"], ["p2"]]);
    }));
    it("moves a first fragment to a header-free page when it fits there", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase7() {
        expect(planMeasuredPagination([
            item("p1", 90),
        ], 80, 100, 10)).toEqual({
            pages: [[], ["p1"]],
            oversizedItemKeys: [],
        });
    }));
    it("reports a fragment that is taller than a header-free page", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase8() {
        expect(planMeasuredPagination([
            item("p1", 120),
        ], 80, 100, 10)).toEqual({
            pages: [[], ["p1"]],
            oversizedItemKeys: ["p1"],
        });
    }));
}));
