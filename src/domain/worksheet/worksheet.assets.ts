export function collectReferencedAssetIds(value: unknown): Set<string> {
  const referencedIds = new Set<string>();

  const visit = (child: unknown): void => {
    if (Array.isArray(child)) {
      child.forEach(visit);
      return;
    }
    if (typeof child !== "object" || child === null) return;

    Object.entries(child).forEach(([key, nested]) => {
      if (key === "assetId" && typeof nested === "string") referencedIds.add(nested);
      visit(nested);
    });
  };

  visit(value);
  return referencedIds;
}
