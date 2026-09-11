import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

/**
 * 観測されたURLを検証し、比較可能な形式にする。
 * @param value ホストまたは利用者から受け取ったURL
 * @returns 利用可能なURL。未指定や不正な値ならnull
 */
function targetUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}

/**
 * ホストが観測したページ一覧から接続先を選ぶ。ネットワークへはアクセスしない。
 * @param input ページ一覧と利用者または自己テストが明示したURL
 * @returns 選択した接続先と根拠、または選択待ちのエラー
 */
export function resolveMathEditorTarget(input) {
  const pages = Array.isArray(input?.pages) ? input.pages : [];
  const userUrl = targetUrl(input?.userTargetUrl);
  const testUrl = targetUrl(input?.testTargetUrl);
  const discovered = [];
  for (const page of pages) {
    const url = targetUrl(page?.url);
    if (url && Array.isArray(page?.toolNames)
      && page.toolNames.includes("math_editor_get_capabilities")
      && page.toolNames.includes("math_editor_validate_import")) {
      discovered.push({ url, source: "discovered", ...(typeof page.pageId === "string" ? { pageId: page.pageId } : {}) });
    }
  }
  if (discovered.length === 1) return { success: true, ...discovered[0] };
  if (discovered.length > 1) {
    // 同じURLでもタブごとの候補ストアは異なるため、重複を統合しない。
    const explicitUrl = userUrl ?? testUrl;
    const matches = discovered.filter(function matchesExplicit(page) { return page.url === explicitUrl; });
    if (matches.length === 1) return { success: true, ...matches[0] };
    return { success: false, error: { code: "TARGET_URL_REQUIRED", reason: "ambiguous", message: "Math Editorが複数あります。対象ページを指定してください。" } };
  }
  // 不正な明示URLを黙って別のテスト先に置換しない。
  if (input?.userTargetUrl !== undefined) {
    if (userUrl) return { success: true, url: userUrl, source: "user" };
    return { success: false, error: { code: "TARGET_URL_REQUIRED", reason: "invalid-url", message: "Math Editorの有効なURLを指定してください。" } };
  }
  if (testUrl) return { success: true, url: testUrl, source: "test" };
  return { success: false, error: { code: "TARGET_URL_REQUIRED", reason: "missing", message: "Math EditorのページまたはURLを指定してください。" } };
}

/**
 * ページの観測結果ファイルを読み、機械可読な選択結果を出力する。
 * @returns CLIの実行完了
 */
async function main() {
  if (process.argv.length !== 4 || process.argv[2] !== "--input") throw new Error("Usage: --input <observed-pages.json>");
  const result = resolveMathEditorTarget(JSON.parse(await readFile(process.argv[3], "utf8")));
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result.success) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await main(); } catch {
    process.stdout.write(`${JSON.stringify({ success: false, error: { code: "TARGET_URL_REQUIRED", reason: "invalid-input", message: "観測ページ一覧のJSONを--inputで指定してください。" } })}\n`);
    process.exitCode = 1;
  }
}
