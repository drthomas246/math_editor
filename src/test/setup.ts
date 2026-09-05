import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";
import { afterEach, vi } from "vitest";
import { cleanup, configure } from "@testing-library/react";
configure({ asyncUtilTimeout: 5000 });
afterEach((/**
 * 各テストケースで使用した状態を後片付けする。
 *
 * @returns 呼び出し元で使用する処理結果
 */
function cleanUpTestCase1() {
    return cleanup();
}));
Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn((/**
     * fnへ渡す処理を実行する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function fnCallback2() {
        return "blob:test";
    })) });
Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
Object.defineProperty(window, "scrollTo", { configurable: true, value: vi.fn() });
