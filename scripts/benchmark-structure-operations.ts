import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { performance } from "node:perf_hooks";
import { addProblem, duplicateProblem, moveProblem, type WorksheetCommandResult, } from "../src/domain/worksheet/worksheet.commands";
import type { Worksheet } from "../src/domain/worksheet/worksheet";
import { createEditorStressFixture } from "../src/test/fixtures/editor-stress-fixture";
const WARMUP_ITERATIONS = 3;
const MEASURE_ITERATIONS = 20;
const DEFAULT_MAX_P95_MS = 500;
const MAX_P95_MS = readPositiveNumber(process.env.STRUCTURE_BENCHMARK_MAX_P95_MS, DEFAULT_MAX_P95_MS);
type Measurement = {
    durationsMs: number[];
    medianMs: number;
    p95Ms: number;
    maxMs: number;
    heapDeltaBytes: number;
};
const fixture199 = createEditorStressFixture(199).worksheet;
const fixture200 = createEditorStressFixture(200).worksheet;
const middleProblemId = fixture200.problems[Math.floor(fixture200.problems.length / 2)]!.id;
const duplicateTargetId = fixture199.problems[Math.floor(fixture199.problems.length / 2)]!.id;
const appendAfterId = fixture199.problems.at(-1)!.id;
const measurements = {
    addProblemAt199: measure((/**
     * 対象操作をウォームアップ後に繰り返し実行し、代表値とp95処理時間を算出する。
     *
     * @returns add・問題の結果
     */
    function measureCallback1() {
        return addProblem(fixture199, appendAfterId);
    })),
    duplicateProblemAt199: measure((/**
     * 対象操作をウォームアップ後に繰り返し実行し、代表値とp95処理時間を算出する。
     *
     * @returns duplicate・問題の結果
     */
    function measureCallback2() {
        return duplicateProblem(fixture199, duplicateTargetId);
    })),
    moveProblemAt200: measure((/**
     * 対象操作をウォームアップ後に繰り返し実行し、代表値とp95処理時間を算出する。
     *
     * @returns move・問題の結果
     */
    function measureCallback3() {
        return moveProblem(fixture200, middleProblemId, 0);
    })),
};
const result = {
    dataset: {
        sourceProblemsForAddAndDuplicate: fixture199.problems.length,
        sourceProblemsForMove: fixture200.problems.length,
        contentsPerProblem: fixture200.problems[0]?.contents.length ?? 0,
        warmupIterations: WARMUP_ITERATIONS,
        measuredIterations: MEASURE_ITERATIONS,
    },
    threshold: { maxP95Ms: MAX_P95_MS },
    operations: measurements,
    process: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
    },
};
const resultJson = JSON.stringify(result, null, 2);
console.log(resultJson);
const resultPath = process.env.STRUCTURE_BENCHMARK_RESULT_PATH;
if (resultPath) {
    await mkdir(dirname(resultPath), { recursive: true });
    await writeFile(resultPath, `${resultJson}\n`, "utf8");
}
const failures = Object.entries(measurements)
    .filter((/**
 * measurementのp95・MsがMAX・P95・MS以上である要素だけを後続処理へ残す。
 *
 * @param callbackInput コールバックの呼び出し元から渡される入力情報
 * @returns measurementのp95・MsがMAX・P95・MS以上である場合はtrue
 */
function filterItem4(callbackInput) {
    let [, measurement] = callbackInput;
    return measurement.p95Ms >= MAX_P95_MS;
}))
    .map((/**
 * 各生成物または計測項目を識別する名前とmeasurementの組を画面表示またはレポート用の文字列へ変換する。
 *
 * @param callbackInput コールバックの呼び出し元から渡される入力情報
 * @returns 画面表示またはレポート用の文字列
 */
function mapItem5(callbackInput) {
    let [name, measurement] = callbackInput;
    return `${name}: ${measurement.p95Ms.toFixed(1)}ms`;
}));
if (failures.length > 0) {
    throw new Error(`構造操作のp95が${MAX_P95_MS}ms以上です: ${failures.join(", ")}`);
}
/**
 * 対象操作をウォームアップ後に繰り返し実行し、代表値とp95処理時間を算出する。
 *
 * @param operation 計測または適用する操作
 * @returns durations・Ms・median・Ms・p95・Ms・max・Ms・heap・Delta・Bytesを持つオブジェクト
 */
function measure(operation: () => WorksheetCommandResult): Measurement {
    for (let iteration = 0; iteration < WARMUP_ITERATIONS; iteration += 1) {
        assertSuccessfulResult(operation());
    }
    collectGarbage();
    const heapBefore = process.memoryUsage().heapUsed;
    const durationsMs: number[] = [];
    for (let iteration = 0; iteration < MEASURE_ITERATIONS; iteration += 1) {
        const startedAt = performance.now();
        assertSuccessfulResult(operation());
        durationsMs.push(performance.now() - startedAt);
    }
    collectGarbage();
    const sorted = [...durationsMs].sort((/**
     * 二つの要素の表示順を、題名・番号・更新日時など呼び出し側の基準で決定する。
     *
     * @param left 並び順を比較する左側の値
     * @param right 並び順を比較する右側の値
     * @returns 左を先に並べる場合は負、同順なら0、右を先に並べる場合は正の値
     */
    function compareItems6(left, right) {
        return left - right;
    }));
    return {
        durationsMs,
        medianMs: percentile(sorted, 0.5),
        p95Ms: percentile(sorted, 0.95),
        maxMs: sorted.at(-1) ?? 0,
        heapDeltaBytes: process.memoryUsage().heapUsed - heapBefore,
    };
}
/**
 * assert・Successful・結果が永続化・表示・テストの制約を満たすか検証する。
 *
 * @param result 処理によって得られた結果
 * @returns 結果の処理対象となるプリント
 */
function assertSuccessfulResult(result: WorksheetCommandResult): Worksheet {
    if (!result.ok)
        throw new Error(`構造操作が失敗しました: ${result.code}`);
    if (result.worksheet.problems.length !== 200) {
        throw new Error(`構造操作後の問題数が不正です: ${result.worksheet.problems.length}`);
    }
    return result.worksheet;
}
/**
 * percentileをmaxで処理し、その結果を呼び出し元へ反映する。
 *
 * @param sortedValues 昇順に並べた計測値一覧
 * @param ratio 幅や高さへ適用する倍率
 * percentileをmaxで処理し、その結果を呼び出し元へ反映する。
  * @returns 二つの値を比較した結果から算出した数値
 */
function percentile(sortedValues: readonly number[], ratio: number): number {
    return sortedValues[Math.max(0, Math.ceil(sortedValues.length * ratio) - 1)] ?? 0;
}
/**
 * Garbageを入力データまたは現在の状態から取り出す。
 */
function collectGarbage(): void {
    const gc = (globalThis as typeof globalThis & {
        gc?: () => void;
    }).gc;
    gc?.();
}
/**
 * 環境変数の文字列を正の数として検証し、不正な場合は安全な既定値へ戻す。
 *
 * @param value read・Positive・番号で判定または変換する入力値
 * @param fallback 設定値が不正な場合に採用する既定値
 * @returns 設定値が不正な場合に採用する既定値から算出した数値
 */
function readPositiveNumber(value: string | undefined, fallback: number): number {
    if (value === undefined)
        return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`STRUCTURE_BENCHMARK_MAX_P95_MS must be a positive number: ${value}`);
    }
    return parsed;
}
