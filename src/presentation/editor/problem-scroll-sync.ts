import type { EditorPreviewMode } from "../../application/pdf/generate-pdf";

type ScrollAnchor = {
  source: number;
  target: number;
};

/**
 * Synchronizes the preview using corresponding problem starts instead of a raw
 * scroll percentage. Interpolation keeps movement smooth between problems.
 */
export function syncProblemScroll(
  editorScroll: HTMLElement,
  previewScroll: HTMLElement,
  previewMode: EditorPreviewMode,
): number | null {
  const previewProblems = new Map(
    Array.from(previewScroll.querySelectorAll<HTMLElement>("[data-preview-problem-id]"))
      .filter((element) => element.dataset.previewSection === previewMode)
      .map((element) => [element.dataset.previewProblemId!, element]),
  );
  const editorProblems = Array.from(
    editorScroll.querySelectorAll<HTMLElement>("[data-editor-problem-id]"),
  );
  const matchingProblems = editorProblems.flatMap((editorProblem) => {
    const problemId = editorProblem.dataset.editorProblemId;
    const previewProblem = problemId ? previewProblems.get(problemId) : undefined;
    return previewProblem ? [{ editorProblem, previewProblem }] : [];
  });

  if (matchingProblems.length === 0) return null;

  const sourceMax = Math.max(0, editorScroll.scrollHeight - editorScroll.clientHeight);
  const targetMax = Math.max(0, previewScroll.scrollHeight - previewScroll.clientHeight);
  if (sourceMax === 0 || targetMax === 0) {
    previewScroll.scrollTop = 0;
    return 0;
  }

  const anchors: ScrollAnchor[] = [{ source: 0, target: 0 }];
  for (const { editorProblem, previewProblem } of matchingProblems) {
    const source = getScrollOffset(editorProblem, editorScroll);
    if (source <= 0 || source >= sourceMax) continue;
    anchors.push({
      source,
      target: clamp(getScrollOffset(previewProblem, previewScroll), 0, targetMax),
    });
  }
  anchors.push({ source: sourceMax, target: targetMax });
  anchors.sort((left, right) => left.source - right.source);

  const target = interpolateScrollPosition(
    clamp(editorScroll.scrollTop, 0, sourceMax),
    anchors,
  );
  previewScroll.scrollTop = target;
  return target;
}

export function interpolateScrollPosition(position: number, anchors: readonly ScrollAnchor[]): number {
  if (anchors.length === 0) return 0;
  if (position <= anchors[0]!.source) return anchors[0]!.target;

  for (let index = 1; index < anchors.length; index += 1) {
    const right = anchors[index]!;
    if (position > right.source) continue;
    const left = anchors[index - 1]!;
    const distance = right.source - left.source;
    if (distance <= 0) return right.target;
    const progress = (position - left.source) / distance;
    return left.target + (right.target - left.target) * progress;
  }

  return anchors.at(-1)!.target;
}

function getScrollOffset(element: HTMLElement, scrollContainer: HTMLElement): number {
  return element.getBoundingClientRect().top
    - scrollContainer.getBoundingClientRect().top
    + scrollContainer.scrollTop;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
