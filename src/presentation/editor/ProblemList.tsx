import { memo, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";

import type { AssetRecord, ImagePlacement, ImageWidthPercent, Worksheet } from "../../domain/worksheet/worksheet";
import { getProblemNumbers } from "../../domain/worksheet/worksheet.numbering";
import type { RichTextDocumentTarget } from "../../domain/worksheet/worksheet.commands";
import { useEditorStore } from "./editor-store";
import { ProblemCard } from "./ProblemCard";

type Props = {
  assetUrls: ReadonlyMap<string, string>;
  onAddImage: (problemId: string, asset: AssetRecord, placement: ImagePlacement, width: ImageWidthPercent, alt: string, target?: RichTextDocumentTarget) => void;
  onUpdateImage: (problemId: string, imageId: string, asset: AssetRecord | null, placement: ImagePlacement, width: ImageWidthPercent, alt: string, target?: RichTextDocumentTarget) => void;
  onToast: (message: string) => void;
};

type ProblemDescriptor = {
  id: string;
  index: number;
  displayNumber: string | null;
};

const getCurrentWorksheet = (): Worksheet | null => useEditorStore.getState().worksheet;

export const ProblemList = memo(function ProblemList({ assetUrls, onAddImage, onUpdateImage, onToast }: Props) {
  // Rich-text edits preserve these primitive values, so the list itself does
  // not rerender when one problem changes. Structural and numbering changes do.
  const structureKey = useEditorStore(useShallow((state) => {
    const worksheet = state.worksheet;
    if (!worksheet) return [];
    return [
      worksheet.pageSettings.problemNumberFormat,
      worksheet.pageSettings.subQuestionNumberFormat,
      ...worksheet.problems.flatMap((problem) => [
        problem.id,
        problem.kind,
        problem.numbering.enabled,
        problem.numbering.restartAt,
      ]),
    ];
  }));

  const descriptors = useMemo<ProblemDescriptor[]>(() => {
    // structureKey is the intentionally narrow subscription that invalidates
    // this snapshot without rerendering the list for rich-text-only edits.
    void structureKey;
    const worksheet = getCurrentWorksheet();
    if (!worksheet) return [];
    const numbers = getProblemNumbers(worksheet);
    return worksheet.problems.map((problem, index) => ({
      id: problem.id,
      index,
      displayNumber: numbers.get(problem.id) ?? null,
    }));
  }, [structureKey]);

  return <>{descriptors.map((descriptor) => <StoreProblemCard
    key={descriptor.id}
    descriptor={descriptor}
    assetUrls={assetUrls}
    onAddImage={onAddImage}
    onUpdateImage={onUpdateImage}
    onToast={onToast}
  />)}</>;
});

function StoreProblemCard({ descriptor, assetUrls, onAddImage, onUpdateImage, onToast }: Props & { descriptor: ProblemDescriptor }) {
  const problem = useEditorStore((state) => {
    const candidate = state.worksheet?.problems[descriptor.index];
    return candidate?.id === descriptor.id
      ? candidate
      : state.worksheet?.problems.find((item) => item.id === descriptor.id);
  });
  const selected = useEditorStore((state) => state.selectedProblemId === descriptor.id);
  const selectedContentId = useEditorStore((state) => (
    state.selectedProblemId === descriptor.id ? state.selectedContentId : null
  ));
  const selectProblem = useEditorStore((state) => state.selectProblem);
  const selectContent = useEditorStore((state) => state.selectContent);
  const commit = useEditorStore((state) => state.commit);
  const mutate = useEditorStore((state) => state.mutate);
  const worksheet = getCurrentWorksheet();

  if (!worksheet || !problem) return null;
  return <ProblemCard
    worksheet={worksheet}
    getWorksheet={getCurrentWorksheet}
    problem={problem}
    index={descriptor.index}
    displayNumber={descriptor.displayNumber}
    selected={selected}
    selectedContentId={selectedContentId}
    onSelect={() => selectProblem(descriptor.id)}
    onSelectContent={selectContent}
    onCommit={commit}
    onMutate={mutate}
    onAddImage={onAddImage}
    onUpdateImage={onUpdateImage}
    assetUrls={assetUrls}
    onToast={onToast}
  />;
}
