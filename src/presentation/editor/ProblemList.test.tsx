import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createProblem, createWorksheet } from "../../domain/worksheet/worksheet.defaults";
import { useEditorStore } from "./editor-store";
import { ProblemList } from "./ProblemList";
const { renderCounts } = vi.hoisted((/**
 * 「対象機能」で外部依存から返すrender・Countsを持つオブジェクトを固定し、検証を決定的にする。
 *
 * @returns render・Countsを持つオブジェクト
 */
function hoistedCallback1() {
    return ({ renderCounts: new Map<string, number>() });
}));
vi.mock("./ProblemCard", (/**
 * 「対象機能」で外部依存から返す問題・カードを持つオブジェクトを固定し、検証を決定的にする。
 *
 * @returns 問題・カードを持つオブジェクト
 */
function mockCallback2() {
    return ({
        ProblemCard: (/**
         * 一問分の種類・本文・解説・画像・表・小問を編集し、並べ替えや複製操作も提供する。
         *
         * @param callbackInput let・{・問題をまとめて受け取るコールバック入力
         * @returns 問題・カードを表示するReact要素
         */
        function ProblemCardCallback3(callbackInput: {
            problem: {
                id: string;
            };
        }) {
            let { problem } = callbackInput;
            renderCounts.set(problem.id, (renderCounts.get(problem.id) ?? 0) + 1);
            return <article data-testid={`problem-${problem.id}`}/>;
        }),
    });
}));
describe("ProblemList", (/**
 * 「ProblemList」に関するテスト条件と検証例をまとめる。
 */
function defineTestSuite4() {
    afterEach((/**
     * 各テストで変更したDOM・モック・永続状態を次のテスト前に復元する。
     */
    function cleanUpTestCase5() {
        useEditorStore.getState().clear();
        renderCounts.clear();
    }));
    it("本文更新では対象Problemだけを再描画する", (/**
     * 「本文更新では対象Problemだけを再描画する」という仕様を操作結果から検証する。
     */
    function runTestCase6() {
        const worksheet = createWorksheet();
        worksheet.problems = Array.from({ length: 20 }, (/**
         * 配列位置ごとにcreate・問題の結果を生成し、fixtureまたはバイナリの要素として格納する。
         *
         * @returns create・問題の結果
         */
        function fromCallback7() {
            return createProblem();
        }));
        useEditorStore.getState().initialize(worksheet);
        const targetProblem = worksheet.problems[10]!;
        const view = render(<ProblemList assetUrls={new Map()} onAddImage={vi.fn()} onUpdateImage={vi.fn()} onToast={vi.fn()}/>);
        const initialCounts = new Map(renderCounts);
        act((/**
         * 「本文更新では対象Problemだけを再描画する」で発生するReactの状態更新と副作用をまとめて完了させる。
         *
         */
        function actCallback8() {
            return useEditorStore.getState().mutate("本文を編集", (/**
             * 処理対象の問題本文または解説の処理対象のリッチテキスト文書の内容を順序を保った要素一覧へ更新する。
             *
             * @param draft Immerが提供する更新中の状態
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
