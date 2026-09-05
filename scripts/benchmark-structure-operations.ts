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
     * measureへ渡す処理を実行する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function measureCallback1() {
        return addProblem(fixture199, appendAfterId);
    })),
    duplicateProblemAt199: measure((/**
     * measureへ渡す処理を実行する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function measureCallback2() {
        return duplicateProblem(fixture199, duplicateTargetId);
    })),
    moveProblemAt200: measure((/**
     * measureへ渡す処理を実行する。
     *
     * @returns 呼び出し元で使用する処理結果
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
 * 対象要素を結果へ残すか判定する。
 *
 * @param parameter1 parameter1として使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function filterItem4(parameter1) {
    let [, measurement] = parameter1;
    return measurement.p95Ms >= MAX_P95_MS;
}))
    .map((/**
 * 各要素を画面表示または別形式へ変換する。
 *
 * @param parameter1 parameter1として使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function mapItem5(parameter1) {
    let [name, measurement] = parameter1;
    return `${name}: ${measurement.p95Ms.toFixed(1)}ms`;
}));
if (failures.length > 0) {
    throw new Error(`構造操作のp95が${MAX_P95_MS}ms以上です: ${failures.join(", ")}`);
}
/**
 * measureで必要な値を取得する。
 *
 * @param operation operationとして使用する値
 * @returns 呼び出し元で使用する処理結果
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
     * 表示順を決めるため二つの要素を比較する。
     *
     * @param left leftとして使用する値
     * @param right rightとして使用する値
     * @returns 呼び出し元で使用する処理結果
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
 * assertSuccessfulResultに必要な処理を実行する。
 *
 * @param result 処理によって得られた結果
 * @returns 呼び出し元で使用する処理結果
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
 * percentileに必要な処理を実行する。
 *
 * @param sortedValues sortedValuesとして使用する値
 * @param ratio ratioとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function percentile(sortedValues: readonly number[], ratio: number): number {
    return sortedValues[Math.max(0, Math.ceil(sortedValues.length * ratio) - 1)] ?? 0;
}
/**
 * collectGarbageで必要な値を取得する。
 */
function collectGarbage(): void {
    const gc = (globalThis as typeof globalThis & {
        gc?: () => void;
    }).gc;
    gc?.();
}
/**
 * readPositiveNumberで必要な値を取得する。
 *
 * @param value 処理対象の値
 * @param fallback fallbackとして使用する値
 * @returns 呼び出し元で使用する処理結果
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
