import { performance } from "node:perf_hooks";
import { produceWithPatches } from "immer";
import type { Worksheet } from "../src/domain/worksheet/worksheet";
import { createProblem, createRichTextBlock, createWorksheet } from "../src/domain/worksheet/worksheet.defaults";
import { useEditorStore } from "../src/presentation/editor/editor-store";
const PROBLEM_COUNT = 100;
const CONTENTS_PER_PROBLEM = 20;
const PARAGRAPHS_PER_CONTENT = 10;
const WARMUP_ITERATIONS = 3;
const MEASURE_ITERATIONS = 20;
type BenchmarkResult = {
    totalMs: number;
    medianMs: number;
    p95Ms: number;
};
/**
 * Benchmark・プリントを識別子・初期値・関連データが揃った新しい値として組み立てる。
 *
 * @returns 処理対象となるプリント
 */
function createBenchmarkWorksheet(): Worksheet {
    const worksheet = createWorksheet(new Date("2026-08-21T00:00:00.000Z"));
    worksheet.problems = Array.from({ length: PROBLEM_COUNT }, (/**
     * 配列位置ごとに処理対象の問題または例題を生成し、fixtureまたはバイナリの要素として格納する。
     *
     * @param _ コールバックの契約上受け取るが、この処理では参照しない未使用の入力
     * @param problemIndex プリント内での問題位置
     * @returns 処理対象の問題または例題
     */
    function fromCallback1(_, problemIndex) {
        const problem = createProblem();
        problem.contents = Array.from({ length: CONTENTS_PER_PROBLEM }, (/**
         * 配列位置ごとに処理対象の問題本文または解説を生成し、fixtureまたはバイナリの要素として格納する。
         *
         * @param _ コールバックの契約上受け取るが、この処理では参照しない未使用の入力
         * @param contentIndex 問題内での本文・解説の位置
         * @returns 処理対象の問題本文または解説
         */
        function fromCallback2(_, contentIndex) {
            const content = createRichTextBlock();
            content.document.content = Array.from({ length: PARAGRAPHS_PER_CONTENT }, (/**
             * 配列位置ごとに作成または検証する要素種別・ノードへ設定する属性・処理対象の問題本文または解説を持つオブジェクトを生成し、fixtureまたはバイナリの要素として格納する。
             *
             * @param _ コールバックの契約上受け取るが、この処理では参照しない未使用の入力
             * @param paragraphIndex 文書内での段落位置
             * @returns 作成または検証する要素種別・ノードへ設定する属性・処理対象の問題本文または解説を持つオブジェクト
             */
            function fromCallback3(_, paragraphIndex) {
                return ({
                    type: "paragraph" as const,
                    attrs: { textAlign: "left" as const },
                    content: [{
                            type: "text" as const,
                            text: `問題${problemIndex + 1} 内容${contentIndex + 1} 段落${paragraphIndex + 1} `.repeat(3),
                        }],
                });
            }));
            return content;
        }));
        return problem;
    }));
    return worksheet;
}
/**
 * 対象操作をウォームアップ後に繰り返し実行し、代表値とp95処理時間を算出する。
 *
 * @param operation 計測または適用する操作
 * @returns 合計・Ms・median・Ms・p95・Msを持つオブジェクト
 */
function measure(operation: (iteration: number) => void): BenchmarkResult {
    for (let iteration = 0; iteration < WARMUP_ITERATIONS; iteration += 1)
        operation(iteration);
    const durations: number[] = [];
    for (let iteration = 0; iteration < MEASURE_ITERATIONS; iteration += 1) {
        const startedAt = performance.now();
        operation(iteration + WARMUP_ITERATIONS);
        durations.push(performance.now() - startedAt);
    }
    const sorted = [...durations].sort((/**
     * 二つの要素の表示順を、題名・番号・更新日時など呼び出し側の基準で決定する。
     *
     * @param left 並び順を比較する左側の値
     * @param right 並び順を比較する右側の値
     * @returns 左を先に並べる場合は負、同順なら0、右を先に並べる場合は正の値
     */
    function compareItems4(left, right) {
        return left - right;
    }));
    return {
        totalMs: durations.reduce((/**
         * 現在の計算途中の累積値を、それまでの集計結果へ重複なく反映する。
         *
         * @param total 計算途中の累積値
         * @param duration 一回の編集操作に要したミリ秒数
         * @returns 計算途中の累積値を反映した次の累積結果
         */
        function reduceItems5(total, duration) {
            return total + duration;
        }), 0),
        medianMs: sorted[Math.floor(sorted.length / 2)] ?? 0,
        p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1] ?? 0,
    };
}
/**
 * 処理対象の問題本文または解説の処理対象のリッチテキスト文書の内容を順序を保った要素一覧へ更新する。
 *
 * @param worksheet 処理対象となるプリント
 * @param text 文書または画面へ設定する文字列
 */
function updateTargetText(worksheet: Worksheet, text: string): void {
    const content = worksheet.problems[50]?.contents[10];
    if (content?.type !== "richText")
        throw new Error("ベンチマーク対象を作成できませんでした");
    content.document.content = [{
            type: "paragraph",
            attrs: { textAlign: "left" },
            content: [{ type: "text", text }],
        }];
}
const fixture = createBenchmarkWorksheet();
let legacyWorksheet = structuredClone(fixture);
const legacy = measure((/**
 * legacy・プリントを編集操作を適用した後のプリントへ更新する。
 *
 * @param iteration ウォームアップまたは本計測の反復番号
 */
function measureCallback6(iteration) {
    const nextWorksheet = structuredClone(legacyWorksheet);
    updateTargetText(nextWorksheet, `legacy-${iteration}`);
    if (JSON.stringify(legacyWorksheet) !== JSON.stringify(nextWorksheet)) {
        produceWithPatches(legacyWorksheet, (/**
         * produceWithPatchesが渡す更新対象へ、produce・With・Patchesで定義した変更を反映する。
         *
         * @param draft Immerが提供する更新中の状態
         */
        function produceWithPatchesCallback7(draft) {
            Object.assign(draft, nextWorksheet);
        }));
        legacyWorksheet = nextWorksheet;
    }
}));
useEditorStore.getState().initialize(structuredClone(fixture));
const targetProblemId = fixture.problems[50]!.id;
const targetContentId = fixture.problems[50]!.contents[10]!.id;
const optimized = measure((/**
 * 対象操作をウォームアップ後に繰り返し実行し、代表値とp95処理時間を算出する。
 *
 * @param iteration ウォームアップまたは本計測の反復番号
 */
function measureCallback8(iteration) {
    useEditorStore.getState().mutate("本文を編集", (/**
     * 処理対象の問題本文または解説の処理対象のリッチテキスト文書の内容を順序を保った要素一覧へ更新する。
     *
     * @param draft Immerが提供する更新中の状態
     */
    function mutateCallback9(draft) {
        const problem = draft.problems.find((/**
         * 要素の対象を一意に特定する識別子が対象・問題・Idと一致する最初の要素を検索する。
         *
         * @param item 配列処理で現在参照している要素
         * @returns 要素の対象を一意に特定する識別子が対象・問題・Idと一致する場合はtrue
         */
        function findItem10(item) {
            return item.id === targetProblemId;
        }));
        const content = problem?.contents.find((/**
         * 要素の対象を一意に特定する識別子が対象・内容・Idと一致する最初の要素を検索する。
         *
         * @param item 配列処理で現在参照している要素
         * @returns 要素の対象を一意に特定する識別子が対象・内容・Idと一致する場合はtrue
         */
        function findItem11(item) {
            return item.id === targetContentId;
        }));
        if (content?.type !== "richText")
            throw new Error("ベンチマーク対象が見つかりません");
        content.document.content = [{
                type: "paragraph",
                attrs: { textAlign: "left" },
                content: [{ type: "text", text: `optimized-${iteration}` }],
            }];
    }), { historyGroup: `richText:${targetProblemId}:${targetContentId}` });
}));
const speedup = legacy.totalMs / Math.max(optimized.totalMs, Number.EPSILON);
console.log(JSON.stringify({
    dataset: {
        problems: PROBLEM_COUNT,
        contentsPerProblem: CONTENTS_PER_PROBLEM,
        paragraphsPerContent: PARAGRAPHS_PER_CONTENT,
        measuredKeystrokes: MEASURE_ITERATIONS,
    },
    legacyWholeWorksheetMs: legacy,
    partialImmerMs: optimized,
    totalSpeedup: Number(speedup.toFixed(2)),
}, null, 2));
