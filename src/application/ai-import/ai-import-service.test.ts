import { createHash, webcrypto } from "node:crypto";
import { Blob as NodeBlob } from "node:buffer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createId, createWorksheet } from "../../domain/worksheet/worksheet.defaults";
import { createArchiveBackup, createSingleBackup } from "../backup/backup";
import { APP_SCHEMA_SHA256 } from "../../infrastructure/webmcp/math-editor-capabilities";
import { createWebMcpCandidateStore } from "../../infrastructure/webmcp/webmcp-candidate-store";
import { createWebMcpImportReceiptStore } from "../../infrastructure/webmcp/webmcp-import-receipt";
import { MAX_WEBMCP_CANDIDATES, MAX_WEBMCP_DIRECT_IMPORT_BYTES, WEBMCP_CANDIDATE_TTL_MS } from "./ai-import-types";
import { createAiImportService, sha256Utf8 } from "./ai-import-service";

let store: ReturnType<typeof createWebMcpCandidateStore>;
let service: ReturnType<typeof createAiImportService>;

/** 実際の暗号処理を使い、タイマーだけを固定する。 */
function prepare(): void {
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("Blob", NodeBlob);
  vi.useFakeTimers();
  store = createWebMcpCandidateStore();
  service = createAiImportService(store, APP_SCHEMA_SHA256, {
    repository: {
      /**
       * 検証専用Repositoryには保存済みデータがないことを示す。
       * @returns 常にnull
       */
      async get() { return null; },
      /**
       * 検証テストではデータを保持せず保存完了だけを返す。
       * @returns 完了済みPromise
       */
      async create() { return Promise.resolve(); },
    },
    receiptStore: createWebMcpImportReceiptStore(),
    /**
     * 検証テスト用の直接取込許可状態を返す。
     * @returns 常にtrue
     */
    isWriteConsentGranted() { return true; },
    /** 検証テストでは保存完了イベントを処理しない。 */
    publishCompleted() {},
  });
}
/** 候補の寿命と環境の変更をテストごとに終了する。 */
function cleanup(): void {
  store.dispose();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
}
beforeEach(prepare);
afterEach(cleanup);

/**
 * 検証済み単一プリントから入力を組み立てる。
 * @returns ファイル本文とSchemaハッシュ
 */
async function inputFixture() {
  const worksheet = createWorksheet();
  worksheet.title = "正負の数";
  worksheet.header.title = worksheet.title;
  return {
    payloadText: JSON.stringify(await createSingleBackup(worksheet, [])),
    skillSchemaSha256: APP_SCHEMA_SHA256.toUpperCase(),
  };
}

/**
 * 画像の署名・寸法・所有関係を持つ入力を組み立てる。
 * @returns 画像付きの単一プリント
 */
async function imageFixture() {
  const input = await inputFixture();
  const file = JSON.parse(input.payloadText);
  const id = createId();
  file.worksheet.problems[0].contents.push({ id: createId(), type: "image", assetId: id, placement: "block", widthPercent: 50, alt: "図版" });
  file.assets.push({ id, worksheetId: file.worksheet.id, mimeType: "image/png", dataBase64: "iVBORw0KGgo=", width: 1, height: 1, createdAt: file.worksheet.createdAt });
  return { input, file };
}

/**
 * 検証とID再割当てがDBを開かずに完了することを確認する。
 * @returns 検証完了
 */
async function validatesWithoutPersistence(): Promise<void> {
  const input = await inputFixture();
  const open = vi.spyOn(indexedDB, "open");
  const result = await service.validateCandidate(input);
  expect(result).toMatchObject({ valid: true, title: "正負の数", problemCount: 1, assetCount: 0 });
  expect(result.payloadSha256).toBe(createHash("sha256").update(input.payloadText).digest("hex"));
  expect(result.worksheetId).not.toBe(JSON.parse(input.payloadText).worksheet.id);
  expect(Date.parse(result.expiresAt)).toBe(Date.now() + WEBMCP_CANDIDATE_TTL_MS);
  expect(Object.keys(result)).not.toContain("item");
  expect(open).not.toHaveBeenCalled();
}
it("正本Schemaで検証し、保存せずに新IDの候補を返す", validatesWithoutPersistence);

/**
 * UTF-8で計測した上限を含む境界を確認する。
 * @returns 境界の検証完了
 */
async function sizeBoundary(): Promise<void> {
  const input = await inputFixture();
  const padding = MAX_WEBMCP_DIRECT_IMPORT_BYTES - new TextEncoder().encode(input.payloadText).length;
  input.payloadText += " ".repeat(padding);
  await expect(service.validateCandidate(input)).resolves.toMatchObject({ valid: true });
  input.payloadText += " ";
  await expect(service.validateCandidate(input)).rejects.toMatchObject({ code: "DIRECT_IMPORT_TOO_LARGE" });
  input.payloadText = "数".repeat(Math.ceil(MAX_WEBMCP_DIRECT_IMPORT_BYTES / 3));
  expect(input.payloadText.length).toBeLessThan(MAX_WEBMCP_DIRECT_IMPORT_BYTES);
  await expect(service.validateCandidate(input)).rejects.toMatchObject({ code: "DIRECT_IMPORT_TOO_LARGE" });
}
it("2 MiBちょうどを許可し超過を文字数ではなくUTF-8で拒否する", sizeBoundary);

/**
 * 書式やSchema不一致を明確な公開エラーに分ける。
 * @returns 不正入力の検証完了
 */
async function invalidInputs(): Promise<void> {
  const input = await inputFixture();
  for (const value of [null, [], {}, { ...input, extra: true }, { ...input, payloadText: 7 }, { ...input, skillSchemaSha256: "invalid" }]) {
    await expect(service.validateCandidate(value)).rejects.toMatchObject({ code: "INVALID_INPUT" });
  }
  await expect(service.validateCandidate({ ...input, payloadText: "{", skillSchemaSha256: "0".repeat(64) })).rejects.toMatchObject({ code: "SCHEMA_MISMATCH" });
  await expect(service.validateCandidate({ ...input, payloadText: "{" })).rejects.toMatchObject({ code: "INVALID_JSON" });
  for (const value of [{}, { ...JSON.parse(input.payloadText), version: 2 }]) {
    await expect(service.validateCandidate({ ...input, payloadText: JSON.stringify(value) })).rejects.toMatchObject({ code: "INVALID_WORKSHEET_FILE" });
  }
  const archive = await createArchiveBackup([createWorksheet()], []);
  await expect(service.validateCandidate({ ...input, payloadText: JSON.stringify(archive) })).rejects.toMatchObject({ code: "INVALID_WORKSHEET_FILE" });
}
it("不正入力・Schema不一致・JSON不正・archiveを候補にしない", invalidInputs);

/**
 * 既存Validatorの相互参照チェックも適用されることを確認する。
 * @returns 不整合データの検証完了
 */
async function invalidReferences(): Promise<void> {
  const { input, file } = await imageFixture();
  file.assets = [];
  await expect(service.validateCandidate({ ...input, payloadText: JSON.stringify(file) })).rejects.toMatchObject({ code: "INVALID_WORKSHEET_FILE" });
  const source = JSON.parse(input.payloadText);
  source.worksheet.header.title = "別題名";
  await expect(service.validateCandidate({ ...input, payloadText: JSON.stringify(source) })).rejects.toMatchObject({ code: "INVALID_WORKSHEET_FILE" });
}
it("画像の未解決参照と題名不整合を拒否する", invalidReferences);

/**
 * 画像の検証後にだけ候補を作り、画像IDも再割当てする。
 * @returns 画像付き候補の検証完了
 */
async function images(): Promise<void> {
  const { input, file } = await imageFixture();
  const close = vi.fn();
  /**
   * 画像デコードの寸法を返す。
   * @returns テスト用の画像寸法と解放処理
   */
  async function decode() { return { width: 1, height: 1, close }; }
  const decodeSpy = vi.fn(decode);
  vi.stubGlobal("createImageBitmap", decodeSpy);
  const result = await service.validateCandidate({ ...input, payloadText: JSON.stringify(file) });
  const candidate = store.get(result.candidateToken, result.payloadSha256);
  expect(result.assetCount).toBe(1);
  expect(candidate.item.assets[0]!.id).not.toBe(file.assets[0].id);
  expect(candidate.item.assets[0]!.worksheetId).toBe(result.worksheetId);
  expect(close).toHaveBeenCalledOnce();
  file.assets[0].width = 2;
  await expect(service.validateCandidate({ ...input, payloadText: JSON.stringify(file) })).rejects.toMatchObject({ code: "INVALID_ASSET" });
  file.assets[0].dataBase64 = "YWJj";
  await expect(service.validateCandidate({ ...input, payloadText: JSON.stringify(file) })).rejects.toMatchObject({ code: "INVALID_ASSET" });
  expect(decodeSpy).toHaveBeenCalledTimes(2);
}
it("画像署名・実寸法を検証してIDを再割当てし、不正画像を拒否する", images);

/**
 * ハッシュが再直列化したJSONではなく元の入力を識別することを確認する。
 * @returns ハッシュの比較完了
 */
async function exactPayloadHash(): Promise<void> {
  const input = await inputFixture();
  expect(await sha256Utf8(input.payloadText)).not.toBe(await sha256Utf8(input.payloadText + "\n"));
  expect(await sha256Utf8("日本語😀")).toBe(createHash("sha256").update("日本語😀").digest("hex"));
}
it("payload SHA-256は空白・改行・日本語を含む元のUTF-8を識別する", exactPayloadHash);

/**
 * 参照を通じた改変、他トークン、ハッシュ違い、期限境界を拒否する。
 * @returns 候補の保護検証完了
 */
async function candidateIntegrity(): Promise<void> {
  const item = { worksheet: createWorksheet(), assets: [] };
  const originalTitle = item.worksheet.title;
  const summary = store.create(item, "a".repeat(64));
  item.worksheet.title = "外部から変更";
  const candidate = store.get(summary.candidateToken, summary.payloadSha256);
  candidate.item.worksheet.title = "返却値から変更";
  expect(store.get(summary.candidateToken, summary.payloadSha256).item.worksheet.title).toBe(originalTitle);
  /** 異なるハッシュで候補を参照する。 */
  function wrongHash(): void { store.get(summary.candidateToken, "b".repeat(64)); }
  /** 存在しないトークンで候補を参照する。 */
  function wrongToken(): void { store.get("unknown", summary.payloadSha256); }
  expect(wrongHash).toThrow("ハッシュが一致しません");
  expect(wrongToken).toThrow("見つかりません");
  vi.advanceTimersByTime(WEBMCP_CANDIDATE_TTL_MS - 1);
  expect(store.get(summary.candidateToken, summary.payloadSha256)).toBeDefined();
  vi.advanceTimersByTime(1);
  /** 期限到来直後に候補を参照する。 */
  function expired(): void { store.get(summary.candidateToken, summary.payloadSha256); }
  expect(expired).toThrow("有効期限");
  expect(vi.getTimerCount()).toBe(0);
}
it("候補の改変・異なるハッシュ・期限切れを検出する", candidateIntegrity);

/** 容量上限・破棄・タイマー遅延時の期限検査を確認する。 */
function candidateLifetime(): void {
  const item = { worksheet: createWorksheet(), assets: [] };
  const first = store.create(item, "a".repeat(64));
  for (let index = 0; index < MAX_WEBMCP_CANDIDATES; index++) store.create(item, "a".repeat(64));
  /** 容量超過で破棄された候補を参照する。 */
  function evicted(): void { store.get(first.candidateToken, first.payloadSha256); }
  expect(evicted).toThrow("見つかりません");
  expect(vi.getTimerCount()).toBe(MAX_WEBMCP_CANDIDATES);
  const last = store.create(item, "a".repeat(64));
  vi.setSystemTime(Date.now() + WEBMCP_CANDIDATE_TTL_MS);
  /** タイマーが実行されないまま期限を超えた候補を参照する。 */
  function suspendedExpiry(): void { store.get(last.candidateToken, last.payloadSha256); }
  expect(suspendedExpiry).toThrow("有効期限");
  store.dispose();
  expect(vi.getTimerCount()).toBe(0);
  /** 終了済みストアへ遅れて候補を登録する。 */
  function lateCreate(): void { store.create(item, "a".repeat(64)); }
  expect(lateCreate).toThrow("中断");
}
it("候補保持を8件に制限し、ページ終了やタイマー遅延でも失効させる", candidateLifetime);

/**
 * 非同期検証中にページを終了しても候補を残さない。
 * @returns 中断後の検証完了
 */
async function abortValidation(): Promise<void> {
  const input = await inputFixture();
  const controller = new AbortController();
  const create = vi.spyOn(store, "create");
  const pending = service.validateCandidate(input, controller.signal);
  controller.abort();
  await expect(pending).rejects.toMatchObject({ code: "VALIDATION_ABORTED" });
  expect(create).not.toHaveBeenCalled();
  const late = service.validateCandidate(input);
  store.dispose();
  await expect(late).rejects.toMatchObject({ code: "VALIDATION_ABORTED" });
}
it("検証中の中断・ページ終了で候補を作らない", abortValidation);
