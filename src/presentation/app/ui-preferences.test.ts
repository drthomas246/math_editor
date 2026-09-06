import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_UI_PREFERENCES, loadUiPreferences, UI_PREFERENCES_KEY } from "./ui-preferences";
describe("UI preferences", (/**
 * 「UI preferences」に関するテスト条件と検証例をまとめる。
 */
function defineTestSuite1() {
    beforeEach((/**
     * 各テストが互いに影響しない初期状態とモックを準備する。
     */
    function prepareTestCase2() {
        const values = new Map<string, string>();
        vi.stubGlobal("localStorage", {
            getItem: (/**
             * 要素を入力データまたは現在の状態から取り出す。
             *
             * @param key 保存先または要素を特定するキー
             * @returns 二つの値を比較した結果
             */
            function getItemCallback3(key: string) {
                return values.get(key) ?? null;
            }),
            setItem: (/**
             * 要素を現在の編集結果へ反映する。
             *
             * @param key 保存先または要素を特定するキー
             * @param value set・要素で判定または変換する入力値
             * @returns Zustand状態を更新する関数の結果
             */
            function setItemCallback4(key: string, value: string) {
                return values.set(key, value);
            }),
            removeItem: (/**
             * 要素と、参照されなくなった関連データを安全に取り除く。
             *
             * @param key 保存先または要素を特定するキー
             * @returns deleteの結果
             */
            function removeItemCallback5(key: string) {
                return values.delete(key);
            }),
            clear: (/**
             * Callback6と不要になった関連データを安全に取り除く。
             *
             * @returns clearの結果
             */
            function clearCallback6() {
                return values.clear();
            }),
        });
    }));
    afterEach((/**
     * 各テストで変更したDOM・モック・永続状態を次のテスト前に復元する。
     *
     */
    function cleanUpTestCase7() {
        return vi.unstubAllGlobals();
    }));
    it("loads manual zoom values set in 5% increments", (/**
     * 「loads manual zoom values set in 5% increments」という仕様を操作結果から検証する。
     */
    function runTestCase8() {
        localStorage.setItem(UI_PREFERENCES_KEY, JSON.stringify({
            ...DEFAULT_UI_PREFERENCES,
            zoom: 1.05,
        }));
        expect(loadUiPreferences().zoom).toBe(1.05);
    }));
    it("rejects manual zoom values outside 5% increments", (/**
     * 「rejects manual zoom values outside 5% increments」という仕様を操作結果から検証する。
     */
    function runTestCase9() {
        localStorage.setItem(UI_PREFERENCES_KEY, JSON.stringify({
            ...DEFAULT_UI_PREFERENCES,
            zoom: 1.03,
        }));
        expect(loadUiPreferences()).toEqual(DEFAULT_UI_PREFERENCES);
    }));
    it("以前の問題＋解答プレビュー設定を問題のみに移行する", (/**
     * 「以前の問題＋解答プレビュー設定を問題のみに移行する」という仕様を操作結果から検証する。
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
