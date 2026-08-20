import type { Patch } from "immer";

import { collectReferencedAssetIds } from "../../domain/worksheet/worksheet.assets";
import type { Worksheet } from "../../domain/worksheet/worksheet";
import type { HistoryEntry } from "./editor-store";

export function collectRetainedAssetIds(
  worksheet: Worksheet,
  historyEntries: readonly HistoryEntry[],
): Set<string> {
  const retainedIds = collectReferencedAssetIds(worksheet);

  for (const entry of historyEntries) {
    for (const patch of [...entry.patches, ...entry.inversePatches]) {
      collectAssetIdsFromPatch(patch, retainedIds);
    }
  }

  return retainedIds;
}

export function pruneAssetUrls(
  current: Map<string, string>,
  retainedIds: ReadonlySet<string>,
  revokeObjectUrl: (url: string) => void = URL.revokeObjectURL,
): Map<string, string> {
  let next: Map<string, string> | null = null;
  current.forEach((url, assetId) => {
    if (retainedIds.has(assetId)) return;
    revokeObjectUrl(url);
    next ??= new Map(current);
    next.delete(assetId);
  });
  return next ?? current;
}

function collectAssetIdsFromPatch(patch: Patch, retainedIds: Set<string>): void {
  if (patch.path.at(-1) === "assetId" && "value" in patch && typeof patch.value === "string") {
    retainedIds.add(patch.value);
  }
  if (!("value" in patch)) return;
  collectReferencedAssetIds(patch.value).forEach((assetId) => retainedIds.add(assetId));
}
