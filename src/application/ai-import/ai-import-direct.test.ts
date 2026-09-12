import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorksheet } from "../../domain/worksheet/worksheet.defaults";
import { createWebMcpCandidateStore } from "../../infrastructure/webmcp/webmcp-candidate-store";
import { createWebMcpImportReceiptStore } from "../../infrastructure/webmcp/webmcp-import-receipt";
import type { WorksheetWithAssets } from "../repositories/worksheet-repository";
import { APP_SCHEMA_SHA256 } from "../../infrastructure/webmcp/sujita-capabilities";
import type { AiImportCompletedEvent, AiImportReceiptStore } from "./ai-import-types";
import { createAiImportService } from "./ai-import-service";

const PAYLOAD_HASH = "a".repeat(64);
let store: ReturnType<typeof createWebMcpCandidateStore>;
let repository: MemoryRepository;
let receiptStore: AiImportReceiptStore;
let consentGranted: boolean;
let events: AiImportCompletedEvent[];

class MemoryRepository {
  readonly items = new Map<string, WorksheetWithAssets>();
  createError: unknown = null;
  createCalls = 0;

  /**
   * 保存済みプリントを識別子で読み込む。
   * @param id 読み込むプリントの識別子
   * @returns 保存済みデータ。存在しない場合はnull
   */
  async get(id: string): Promise<WorksheetWithAssets | null> {
    return structuredClone(this.items.get(id) ?? null);
  }

  /**
   * 新規プリントを保存し、テスト用の呼出回数を記録する。
   * @param item 保存するプリントと画像
   * @returns 保存完了時に解決するPromise
   */
  async create(item: WorksheetWithAssets): Promise<void> {
    this.createCalls += 1;
    if (this.createError) throw this.createError;
    this.items.set(item.worksheet.id, structuredClone(item));
  }
}

/** 各テストで候補、Receipt、Repository、Consentを初期化する。 */
function prepare(): void {
  sessionStorage.clear();
  store = createWebMcpCandidateStore();
  repository = new MemoryRepository();
  receiptStore = createWebMcpImportReceiptStore();
  consentGranted = true;
  events = [];
}

/** 各テストで確保した候補とブラウザー保存領域を解放する。 */
function cleanup(): void {
  store.dispose();
  sessionStorage.clear();
  vi.restoreAllMocks();
}

beforeEach(prepare);
afterEach(cleanup);

/**
 * 現在のテスト状態を参照する直接取込サービスを作る。
 * @returns メモリRepositoryとsessionStorage Receiptを使うサービス
 */
function createService() {
  /**
   * 現在のテスト用書込み許可を返す。
   * @returns Consentのテスト値
   */
  function isWriteConsentGranted(): boolean { return consentGranted; }
  /**
   * 保存完了イベントを検証用配列へ記録する。
   * @param event 保存完了時に公開された最小イベント
   */
  function publishCompleted(event: AiImportCompletedEvent): void { events.push(event); }
  return createAiImportService(store, APP_SCHEMA_SHA256, {
    repository,
    receiptStore,
    isWriteConsentGranted,
    publishCompleted,
  });
}

/**
 * 検証候補と直接取込入力を作る。
 * @param requestId 冪等性を識別する要求ID
 * @returns 保存対象のitem、候補要約、ツール入力
 */
function candidateFixture(requestId = "request-1") {
  const worksheet = createWorksheet();
  worksheet.title = "AI取込プリント";
  worksheet.header.title = worksheet.title;
  const item = { worksheet, assets: [] } satisfies WorksheetWithAssets;
  const summary = store.create(item, PAYLOAD_HASH);
  return {
    item,
    summary,
    input: {
      candidateToken: summary.candidateToken,
      requestId,
      expectedPayloadSha256: PAYLOAD_HASH,
    },
  };
}

describe("AI直接取込", /** 直接取込のConsent、Receipt、冪等性、失敗回復をまとめて検証する。 */
function defineDirectImportSuite() {
  it("ConsentがOFFならReceiptもWorksheetも作らない", /**
   * 許可前の直接取込が副作用なしで拒否されることを確認する。
   * @returns 拒否結果の検証完了
   */
  async function rejectsWithoutConsent() {
    consentGranted = false;
    const service = createService();
    const { input } = candidateFixture();
    await expect(service.importCandidate(input)).rejects.toMatchObject({ code: "CONSENT_REQUIRED" });
    expect(repository.createCalls).toBe(0);
    expect(receiptStore.read(input.requestId)).toBeNull();
  });

  it("保存成功後は同じrequestIdをcandidate消失後も重複保存しない", /**
   * completed Receiptが候補より先に再試行を完了させることを確認する。
   * @returns 初回保存と再試行の検証完了
   */
  async function savesOnceAndReplaysReceipt() {
    const service = createService();
    const { input, summary } = candidateFixture();
    const first = await service.importCandidate(input);
    expect(first).toMatchObject({ success: true, worksheetId: summary.worksheetId, title: "AI取込プリント" });
    expect(first.editorPath).toBe(`/worksheets/${summary.worksheetId}`);
    expect(repository.createCalls).toBe(1);
    expect(events).toHaveLength(1);
    /** 消費済み候補を別要求から参照する。 */
    function readConsumedCandidate(): void { store.get(summary.candidateToken, PAYLOAD_HASH); }
    expect(readConsumedCandidate).toThrow("すでに使用");
    store.dispose();
    expect(await service.importCandidate(input)).toEqual(first);
    expect(repository.createCalls).toBe(1);
    expect(events).toHaveLength(1);
  });

  it("pending Receiptと保存実体からcompletedへ回復する", /**
   * 保存直後に処理が中断された状態から再保存なしで回復することを確認する。
   * @returns pending回復の検証完了
   */
  async function recoversPendingReceipt() {
    const service = createService();
    const { item, input } = candidateFixture();
    const pending = receiptStore.writePending({
      requestId: input.requestId,
      payloadSha256: PAYLOAD_HASH,
      worksheetId: item.worksheet.id,
      title: item.worksheet.title,
    });
    repository.items.set(item.worksheet.id, structuredClone(item));
    store.dispose();
    const result = await service.importCandidate({ ...input, candidateToken: "candidate-lost" });
    expect(result).toMatchObject({ success: true, worksheetId: item.worksheet.id });
    expect(repository.createCalls).toBe(0);
    expect(receiptStore.read(input.requestId)).toMatchObject({ status: "completed", createdAt: pending.createdAt });
    expect(events).toHaveLength(1);
  });

  it("保存実体もcandidateもないpending Receiptは再検証を要求する", /**
   * reload後に保存の有無を確定できない要求が安全に停止することを確認する。
   * @returns 再検証要求の確認完了
   */
  async function requestsRevalidation() {
    const service = createService();
    receiptStore.writePending({
      requestId: "request-stale",
      payloadSha256: PAYLOAD_HASH,
      worksheetId: crypto.randomUUID(),
      title: "失われた候補",
    });
    await expect(service.importCandidate({
      candidateToken: "candidate-lost",
      requestId: "request-stale",
      expectedPayloadSha256: PAYLOAD_HASH,
    })).rejects.toMatchObject({ code: "REVALIDATION_REQUIRED" });
    expect(repository.createCalls).toBe(0);
  });

  it("保存実体がないpending Receiptでもcandidateが残っていれば保存を再試行する", /**
   * Repository transaction前に止まった要求を同じ候補から正常完了できることを確認する。
   * @returns stale pendingからの保存再試行の検証完了
   */
  async function retriesStalePendingWithCandidate() {
    const service = createService();
    const { item, input } = candidateFixture("request-retry");
    receiptStore.writePending({
      requestId: input.requestId,
      payloadSha256: PAYLOAD_HASH,
      worksheetId: item.worksheet.id,
      title: item.worksheet.title,
    });
    const result = await service.importCandidate(input);
    expect(result).toMatchObject({ success: true, worksheetId: item.worksheet.id });
    expect(repository.createCalls).toBe(1);
    expect(receiptStore.read(input.requestId)).toMatchObject({ status: "completed" });
    expect(events).toHaveLength(1);
  });

  it("同じrequestIdで異なるpayloadハッシュを受け付けない", /**
   * Receiptと異なる内容が同一要求として再利用されないことを確認する。
   * @returns 改ざん検出の確認完了
   */
  async function rejectsReceiptHashMismatch() {
    const service = createService();
    const { input } = candidateFixture();
    await service.importCandidate(input);
    await expect(service.importCandidate({ ...input, expectedPayloadSha256: "b".repeat(64) }))
      .rejects.toMatchObject({ code: "PAYLOAD_HASH_MISMATCH" });
    expect(repository.createCalls).toBe(1);
  });

  it("Repository失敗時はReceiptを整理し、件数上限を公開コードへ変換する", /**
   * トランザクション失敗後に誤った成功状態を残さないことを確認する。
   * @returns Repository失敗の検証完了
   */
  async function handlesRepositoryFailure() {
    const service = createService();
    const { input } = candidateFixture();
    repository.createError = { code: "WORKSHEET_LIMIT_EXCEEDED" };
    await expect(service.importCandidate(input)).rejects.toMatchObject({ code: "WORKSHEET_LIMIT_REACHED" });
    expect(receiptStore.read(input.requestId)).toBeNull();
    expect(events).toHaveLength(0);
  });

  it("Abort済みの直接取込はReceipt作成とRepository保存を開始しない", /**
   * WebMCPから渡された実行中断をApplication層の保存境界で確認する。
   * @returns 中断時に副作用がないことの検証完了
   */
  async function abortsBeforePersistence() {
    const service = createService();
    const { input } = candidateFixture("request-aborted");
    const controller = new AbortController();
    controller.abort();
    await expect(service.importCandidate(input, controller.signal)).rejects.toMatchObject({ code: "IMPORT_ABORTED" });
    expect(repository.createCalls).toBe(0);
    expect(receiptStore.read(input.requestId)).toBeNull();
    expect(events).toHaveLength(0);
  });

  it("同時に届いた同一requestIdは同じhashだけをまとめ、異なるhashを拒否する", /**
   * 通信層の並行再試行で二重作成とpayload取り違えを防ぐことを確認する。
   * @returns 並行要求の検証完了
   */
  async function serializesConcurrentRequest() {
    const service = createService();
    const { input } = candidateFixture();
    let release: (() => void) | undefined;
    const gate = new Promise<void>(/**
     * Repository保存をテストから再開できるよう解決関数を保持する。
     * @param resolve 待機を完了する関数
     */
    function captureRelease(resolve) { release = resolve; });
    const originalCreate = repository.create.bind(repository);
    /**
     * 初回のRepository保存を待機させ、並行要求が重なる状態を作る。
     * @param item 保存するプリントと画像
     * @returns 待機解除後に完了する保存処理
     */
    async function delayedCreate(item: WorksheetWithAssets): Promise<void> {
      await gate;
      await originalCreate(item);
    }
    repository.create = delayedCreate;
    const first = service.importCandidate(input);
    const second = service.importCandidate(input);
    const conflicting = service.importCandidate({ ...input, expectedPayloadSha256: "b".repeat(64) });
    await expect(conflicting).rejects.toMatchObject({ code: "PAYLOAD_HASH_MISMATCH" });
    release?.();
    expect(await Promise.all([first, second])).toEqual([await first, await first]);
    expect(repository.createCalls).toBe(1);
    expect(events).toHaveLength(1);
  });
});
