import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createProblem, createWorksheet } from "../../domain/worksheet/worksheet.defaults";
import { useEditorStore } from "./editor-store";
import { ProblemList } from "./ProblemList";
const { renderCounts } = vi.hoisted((/**
 * hoistedへ渡す処理を実行する。
 *
 * @returns 呼び出し元で使用する処理結果
 */
function hoistedCallback1() {
    return ({ renderCounts: new Map<string, number>() });
}));
vi.mock("./ProblemCard", (/**
 * mockへ渡す処理を実行する。
 *
 * @returns 呼び出し元で使用する処理結果
 */
function mockCallback2() {
    return ({
        ProblemCard: (/**
         * ProblemCardコンポーネントを表示する。
         *
         * @param parameter1 parameter1として使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function ProblemCardCallback3(parameter1: {
            problem: {
                id: string;
            };
        }) {
            let { problem } = parameter1;
            renderCounts.set(problem.id, (renderCounts.get(problem.id) ?? 0) + 1);
            return <article data-testid={`problem-${problem.id}`}/>;
        }),
    });
}));
describe("ProblemList", (/**
 * 関連するテストケースをまとめて定義する。
 */
function defineTestSuite4() {
    afterEach((/**
     * 各テストケースで使用した状態を後片付けする。
     */
    function cleanUpTestCase5() {
        useEditorStore.getState().clear();
        renderCounts.clear();
    }));
    it("本文更新では対象Problemだけを再描画する", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase6() {
        const worksheet = createWorksheet();
        worksheet.problems = Array.from({ length: 20 }, (/**
         * fromへ渡す処理を実行する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function fromCallback7() {
            return createProblem();
        }));
        useEditorStore.getState().initialize(worksheet);
        const targetProblem = worksheet.problems[10]!;
        const view = render(<ProblemList assetUrls={new Map()} onAddImage={vi.fn()} onUpdateImage={vi.fn()} onToast={vi.fn()}/>);
        const initialCounts = new Map(renderCounts);
        act((/**
         * actへ渡す処理を実行する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function actCallback8() {
            return useEditorStore.getState().mutate("本文を編集", (/**
             * mutateへ渡す処理を実行する。
             *
             * @param draft draftとして使用する値
             */
            function mutateCallback9(draft) {
                const content = draft.problems[10]?.contents[0];
                if (content?.type === "richText") {
                    content.document.content = [{
                            type: "paragraph",
                            attrs: { textAlign: "left" },
                            content: [{ type: "text", text: "対象だけ更新" }],
                        }];
                }
            }));
        }));
        for (const problem of worksheet.problems) {
            const expected = (initialCounts.get(problem.id) ?? 0) + (problem.id === targetProblem.id ? 1 : 0);
            expect(renderCounts.get(problem.id)).toBe(expected);
        }
        view.unmount();
    }));
}));
