import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const REQUIRED_DISCOVERY_TOOLS = ["sujita_get_capabilities", "sujita_validate_import"];
const DIRECT_IMPORT_TOOL = "sujita_import_worksheet";
export const OFFICIAL_APP_URL = "https://app.sujita.jp/";

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
 * ページ選択に利用できる空白以外の識別子を検証する。
 * @param value ホストが観測したページ識別子
 * @returns 利用可能な識別子。未指定や不正な値ならnull
 */
function targetPageId(value) {
  return typeof value === "string" && value.trim() ? value : null;
}

/**
 * 発見したページを配送処理が利用する最小情報へ変換する。
 * @param page ホストが観測したページ
 * @returns 必須ツールを持つページ。対象外ならnull
 */
function discoveredPage(page) {
  const url = targetUrl(page?.url);
  const toolNames = Array.isArray(page?.toolNames) ? page.toolNames : [];
  if (!url || !REQUIRED_DISCOVERY_TOOLS.every(function hasRequiredTool(name) { return toolNames.includes(name); })) return null;
  const pageId = targetPageId(page?.pageId);
  return {
    url,
    source: "discovered",
    directImportToolAvailable: toolNames.includes(DIRECT_IMPORT_TOOL),
    ...(pageId ? { pageId } : {}),
  };
}

/**
 * 複数候補から一意なページだけを選択結果へ変換する。
 * @param pages 条件に一致したページ
 * @returns 一意な選択結果。複数なら選択待ちのエラー
 */
function uniquePage(pages) {
  if (pages.length === 1) return { success: true, ...pages[0] };
  return { success: false, error: { code: "TARGET_URL_REQUIRED", reason: "ambiguous", message: "すうがく仕立てが複数あります。対象ページを指定してください。" } };
}

/**
 * ホストが観測したページ一覧から接続先を選ぶ。ネットワークへはアクセスしない。
 * @param input ページ一覧、選択済みページ識別子、利用者または自己テストが明示したURL
 * @returns 選択した接続先と根拠、または選択待ちのエラー
 */
export function resolveSujitaTarget(input) {
  const pages = Array.isArray(input?.pages) ? input.pages : [];
  const userUrl = targetUrl(input?.userTargetUrl);
  const testUrl = targetUrl(input?.testTargetUrl);
  const selectedPageId = targetPageId(input?.selectedPageId);
  const discovered = pages.map(discoveredPage).filter(function isDiscovered(page) { return page !== null; });
  if (input?.selectedPageId !== undefined && !selectedPageId) {
    return { success: false, error: { code: "TARGET_URL_REQUIRED", reason: "invalid-page-id", message: "すうがく仕立ての有効なページ識別子を指定してください。" } };
  }
  if (selectedPageId) {
    const matches = discovered.filter(function matchesSelectedPage(page) { return page.pageId === selectedPageId; });
    if (matches.length === 0) {
      return { success: false, error: { code: "TARGET_URL_REQUIRED", reason: "page-not-found", message: "指定したすうがく仕立てページを現在のページ一覧で確認できません。" } };
    }
    if (userUrl && matches.some(function conflictsWithExplicitUrl(page) { return page.url !== userUrl; })) {
      return { success: false, error: { code: "TARGET_URL_REQUIRED", reason: "target-conflict", message: "指定したページ識別子とURLが同じすうがく仕立てページを示していません。" } };
    }
    return uniquePage(matches);
  }
  if (discovered.length === 1) return { success: true, ...discovered[0] };
  if (discovered.length > 1) {
    // 同じURLでもタブごとの候補ストアは異なるため、重複を統合しない。
    const explicitUrl = userUrl ?? testUrl;
    const matches = discovered.filter(function matchesExplicit(page) { return page.url === explicitUrl; });
    return uniquePage(matches);
  }
  // 不正な明示URLを黙って別のテスト先に置換しない。
  if (input?.userTargetUrl !== undefined) {
    if (userUrl) return { success: true, url: userUrl, source: "user" };
    return { success: false, error: { code: "TARGET_URL_REQUIRED", reason: "invalid-url", message: "すうがく仕立ての有効なURLを指定してください。" } };
  }
  if (testUrl) return { success: true, url: testUrl, source: "test" };
  return { success: true, url: OFFICIAL_APP_URL, source: "official" };
}

/**
 * ページの観測結果ファイルを読み、機械可読な選択結果を出力する。
 * @returns CLIの実行完了
 */
async function main() {
  if (process.argv.length !== 4 || process.argv[2] !== "--input") throw new Error("Usage: --input <observed-pages.json>");
  const result = resolveSujitaTarget(JSON.parse(await readFile(process.argv[3], "utf8")));
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result.success) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await main(); } catch {
    process.stdout.write(`${JSON.stringify({ success: false, error: { code: "TARGET_URL_REQUIRED", reason: "invalid-input", message: "観測ページ一覧のJSONを--inputで指定してください。" } })}\n`);
    process.exitCode = 1;
  }
}
