import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_UI_PREFERENCES, loadUiPreferences, UI_PREFERENCES_KEY } from "./ui-preferences";
describe("UI preferences", (/**
 * 関連するテストケースをまとめて定義する。
 */
function defineTestSuite1() {
    beforeEach((/**
     * 各テストケースに必要な前提条件を準備する。
     */
    function prepareTestCase2() {
        const values = new Map<string, string>();
        vi.stubGlobal("localStorage", {
            getItem: (/**
             * getItemで必要な値を取得する。
             *
             * @param key keyとして使用する値
             * @returns 呼び出し元で使用する処理結果
             */
            function getItemCallback3(key: string) {
                return values.get(key) ?? null;
            }),
            setItem: (/**
             * setItemの対象となる状態を更新する。
             *
             * @param key keyとして使用する値
             * @param value 処理対象の値
             * @returns 呼び出し元で使用する処理結果
             */
            function setItemCallback4(key: string, value: string) {
                return values.set(key, value);
            }),
            removeItem: (/**
             * removeItemの対象となる要素を削除または解放する。
             *
             * @param key keyとして使用する値
             * @returns 呼び出し元で使用する処理結果
             */
            function removeItemCallback5(key: string) {
                return values.delete(key);
            }),
            clear: (/**
             * clearの対象となる要素を削除または解放する。
             *
             * @returns 呼び出し元で使用する処理結果
             */
            function clearCallback6() {
                return values.clear();
            }),
        });
    }));
    afterEach((/**
     * 各テストケースで使用した状態を後片付けする。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function cleanUpTestCase7() {
        return vi.unstubAllGlobals();
    }));
    it("loads manual zoom values set in 5% increments", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase8() {
        localStorage.setItem(UI_PREFERENCES_KEY, JSON.stringify({
            ...DEFAULT_UI_PREFERENCES,
            zoom: 1.05,
        }));
        expect(loadUiPreferences().zoom).toBe(1.05);
    }));
    it("rejects manual zoom values outside 5% increments", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase9() {
        localStorage.setItem(UI_PREFERENCES_KEY, JSON.stringify({
            ...DEFAULT_UI_PREFERENCES,
            zoom: 1.03,
        }));
        expect(loadUiPreferences()).toEqual(DEFAULT_UI_PREFERENCES);
    }));
    it("以前の問題＋解答プレビュー設定を問題のみに移行する", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase10() {
        localStorage.setItem(UI_PREFERENCES_KEY, JSON.stringify({
            ...DEFAULT_UI_PREFERENCES,
            paneRatio: 0.6,
            zoom: "fitWidth",
            previewMode: "questionsAndAnswers",
        }));
        expect(loadUiPreferences()).toEqual({
            ...DEFAULT_UI_PREFERENCES,
            paneRatio: 0.6,
            zoom: "fitWidth",
            previewMode: "questions",
        });
    }));
}));
