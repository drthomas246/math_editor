const assetModules = import.meta.glob("./assets/*.{png,jpg,jpeg,webp}", { eager: true, query: "?url", import: "default" }) as Record<string, string>;
const SAFE_ASSET_NAME = /^[A-Za-z0-9._-]+$/u;
const manualAssets = new Map<string, string>(Object.entries(assetModules).flatMap((/**
 * 各要素を変換しながら一つの配列へ展開する。
 *
 * @param parameter1 parameter1として使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function expandItem1(parameter1) {
    let [path, url] = parameter1;
    const fileName = path.split("/").pop();
    return fileName ? [[`manual-assets/${fileName}`, url]] : [];
})));
/**
 * resolveManualAssetで必要な値を取得する。
 *
 * @param source sourceとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
export function resolveManualAsset(source: string): string | undefined {
    if (!source.startsWith("manual-assets/"))
        return undefined;
    const fileName = source.slice("manual-assets/".length);
    if (!SAFE_ASSET_NAME.test(fileName) || fileName.includes(".."))
        return undefined;
    return manualAssets.get(source);
}
