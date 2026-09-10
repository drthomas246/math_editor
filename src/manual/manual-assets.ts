const assetModules = import.meta.glob("./assets/*.{png,jpg,jpeg,webp}", { eager: true, query: "?url", import: "default" }) as Record<string, string>;
const SAFE_ASSET_NAME = /^[A-Za-z0-9._-]+$/u;
const manualAssets = new Map<string, string>(Object.entries(assetModules).flatMap((/**
 * 各検証エラーが指すデータ位置と安全性の検証または解放を行うURLの組を条件に応じて選択した値へ変換し、空の結果を除いて一つの配列へ展開する。
 *
 * @param callbackInput コールバックの呼び出し元から渡される入力情報
 * @returns 条件に応じて選択した値
 */
function expandItem1(callbackInput) {
    let [path, url] = callbackInput;
    const fileName = path.split("/").pop();
    return fileName ? [[`manual-assets/${fileName}`, url]] : [];
})));
/**
 * 安全なマニュアル画像パスをビルド済みURLへ解決し、不正な名前は拒否する。
 *
 * @param source Markdownから参照されたマニュアル画像の相対パス
 * @returns ビルド時に割り当てられた画像URL。不正または未登録のパスではundefined
 */
export function resolveManualAsset(source: string): string | undefined {
    if (!source.startsWith("manual-assets/"))
        return undefined;
    const fileName = source.slice("manual-assets/".length);
    if (!SAFE_ASSET_NAME.test(fileName) || fileName.includes(".."))
        return undefined;
    return manualAssets.get(source);
}
