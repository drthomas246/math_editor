const assetModules = import.meta.glob(
  "./assets/*.{png,jpg,jpeg,webp}",
  { eager: true, query: "?url", import: "default" },
) as Record<string, string>;

const SAFE_ASSET_NAME = /^[A-Za-z0-9._-]+$/u;

const manualAssets = new Map<string, string>(
  Object.entries(assetModules).flatMap(([path, url]) => {
    const fileName = path.split("/").pop();
    return fileName ? [[`manual-assets/${fileName}`, url]] : [];
  }),
);

export function resolveManualAsset(source: string): string | undefined {
  if (!source.startsWith("manual-assets/")) return undefined;
  const fileName = source.slice("manual-assets/".length);
  if (!SAFE_ASSET_NAME.test(fileName) || fileName.includes("..")) return undefined;
  return manualAssets.get(source);
}
