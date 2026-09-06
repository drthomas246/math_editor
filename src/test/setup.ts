import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";
import { afterEach, vi } from "vitest";
import { cleanup, configure } from "@testing-library/react";
configure({ asyncUtilTimeout: 5000 });
afterEach((/**
 * 各テストで変更したDOM・モック・永続状態を次のテスト前に復元する。
 *
 */
function cleanUpTestCase1() {
    return cleanup();
}));
Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn((/**
     * 「対象機能」で外部依存から返す「blob:test」を固定し、検証を決定的にする。
     *
     * @returns テスト用Blob URLを示す文字列「blob:test」
     */
    function fnCallback2() {
        return "blob:test";
    })) });
Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
Object.defineProperty(window, "scrollTo", { configurable: true, value: vi.fn() });
