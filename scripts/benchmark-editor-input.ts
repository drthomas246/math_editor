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

function createBenchmarkWorksheet(): Worksheet {
  const worksheet = createWorksheet(new Date("2026-08-21T00:00:00.000Z"));
  worksheet.problems = Array.from({ length: PROBLEM_COUNT }, (_, problemIndex) => {
    const problem = createProblem();
    problem.contents = Array.from({ length: CONTENTS_PER_PROBLEM }, (_, contentIndex) => {
      const content = createRichTextBlock();
      content.document.content = Array.from({ length: PARAGRAPHS_PER_CONTENT }, (_, paragraphIndex) => ({
        type: "paragraph" as const,
        attrs: { textAlign: "left" as const },
        content: [{
          type: "text" as const,
          text: `問題${problemIndex + 1} 内容${contentIndex + 1} 段落${paragraphIndex + 1} `.repeat(3),
        }],
      }));
      return content;
    });
    return problem;
  });
  return worksheet;
}

function measure(operation: (iteration: number) => void): BenchmarkResult {
  for (let iteration = 0; iteration < WARMUP_ITERATIONS; iteration += 1) operation(iteration);
  const durations: number[] = [];
  for (let iteration = 0; iteration < MEASURE_ITERATIONS; iteration += 1) {
    const startedAt = performance.now();
    operation(iteration + WARMUP_ITERATIONS);
    durations.push(performance.now() - startedAt);
  }
  const sorted = [...durations].sort((left, right) => left - right);
  return {
    totalMs: durations.reduce((total, duration) => total + duration, 0),
    medianMs: sorted[Math.floor(sorted.length / 2)] ?? 0,
    p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1] ?? 0,
  };
}

function updateTargetText(worksheet: Worksheet, text: string): void {
  const content = worksheet.problems[50]?.contents[10];
  if (content?.type !== "richText") throw new Error("ベンチマーク対象を作成できませんでした");
  content.document.content = [{
    type: "paragraph",
    attrs: { textAlign: "left" },
    content: [{ type: "text", text }],
  }];
}

const fixture = createBenchmarkWorksheet();
let legacyWorksheet = structuredClone(fixture);
const legacy = measure((iteration) => {
  const nextWorksheet = structuredClone(legacyWorksheet);
  updateTargetText(nextWorksheet, `legacy-${iteration}`);
  if (JSON.stringify(legacyWorksheet) !== JSON.stringify(nextWorksheet)) {
    produceWithPatches(legacyWorksheet, (draft) => {
      Object.assign(draft, nextWorksheet);
    });
    legacyWorksheet = nextWorksheet;
  }
});

useEditorStore.getState().initialize(structuredClone(fixture));
const targetProblemId = fixture.problems[50]!.id;
const targetContentId = fixture.problems[50]!.contents[10]!.id;
const optimized = measure((iteration) => {
  useEditorStore.getState().mutate("本文を編集", (draft) => {
    const problem = draft.problems.find((item) => item.id === targetProblemId);
    const content = problem?.contents.find((item) => item.id === targetContentId);
    if (content?.type !== "richText") throw new Error("ベンチマーク対象が見つかりません");
    content.document.content = [{
      type: "paragraph",
      attrs: { textAlign: "left" },
      content: [{ type: "text", text: `optimized-${iteration}` }],
    }];
  }, { historyGroup: `richText:${targetProblemId}:${targetContentId}` });
});

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
