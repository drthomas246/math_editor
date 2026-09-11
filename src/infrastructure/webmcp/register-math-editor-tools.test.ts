import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createWorksheet } from "../../domain/worksheet/worksheet.defaults";
import { createSingleBackup } from "../../application/backup/backup";
import { APP_SCHEMA_SHA256, getMathEditorCapabilities } from "./math-editor-capabilities";
import { detectMathEditorModelContext, registerMathEditorTools } from "./register-math-editor-tools";
import type { MathEditorModelContext, MathEditorModelContextTool } from "./webmcp";

let registration: ReturnType<typeof registerMathEditorTools> | undefined;

/** Web Cryptoを実装済みの環境を再現する。 */
function prepare(): void { vi.stubGlobal("crypto", webcrypto); }
/** 登録・ブラウザAPI差替えを復元する。 */
function cleanup(): void {
  registration?.dispose();
  registration = undefined;
  Reflect.deleteProperty(document, "modelContext");
  Reflect.deleteProperty(navigator, "modelContext");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
}
beforeEach(prepare);
afterEach(cleanup);

/**
 * 現行のAbortSignal式または旧API式の登録先を再現する。
 * @param modern 現行の非同期APIを使うかどうか
 * @returns 登録APIと実行可能なツール一覧
 */
function contextFixture(modern: boolean) {
  const tools = new Map<string, MathEditorModelContextTool>();
  /**
   * 重複登録を拒否してツールを保持する。
   * @param tool 登録するツール
   * @param options 登録解除の通知
   * @returns 現行APIでは完了Promise
   */
  function registerTool(tool: MathEditorModelContextTool, options?: { signal: AbortSignal }) {
    if (tools.has(tool.name)) throw new Error("duplicate");
    tools.set(tool.name, tool);
    /** 現行APIのシグナルによって登録を解除する。 */
    function unregister(): void { tools.delete(tool.name); }
    if (modern) {
      options?.signal.addEventListener("abort", unregister, { once: true });
      return Promise.resolve();
    }
  }
  /**
   * 旧APIでは名前によってツールを解除する。
   * @param name 解除する登録名
   */
  function unregisterTool(name: string): void { tools.delete(name); }
  const registerMock = vi.fn(registerTool);
  const unregisterMock = vi.fn(unregisterTool);
  const context: MathEditorModelContext = { registerTool: registerMock };
  if (!modern) context.unregisterTool = unregisterMock;
  return { context, tools, registerMock, unregisterMock };
}

/**
 * Schema manifestとの一致と保存機能の非公開を確認する。
 * @returns 登録と検証の完了
 */
async function modernRegistration(): Promise<void> {
  const { context, tools } = contextFixture(true);
  registration = registerMathEditorTools(context);
  expect(await registration.ready).toBe("registered");
  expect([...tools.keys()]).toEqual(["math_editor_get_capabilities", "math_editor_validate_import"]);
  const read = tools.get("math_editor_get_capabilities")!;
  const validate = tools.get("math_editor_validate_import")!;
  expect(await read.execute({})).toEqual(getMathEditorCapabilities());
  expect(getMathEditorCapabilities()).toMatchObject({ schemaSha256: APP_SCHEMA_SHA256, schemaVersion: 1, validationAvailable: true, directImportAvailable: false, writeConsentGranted: false });
  expect(read.annotations?.readOnlyHint).toBe(true);
  expect(validate.annotations).toEqual({ readOnlyHint: false, untrustedContentHint: true });
  const payloadText = JSON.stringify(await createSingleBackup(createWorksheet(), []));
  expect(await validate.execute({ payloadText, skillSchemaSha256: APP_SCHEMA_SHA256 })).toMatchObject({ valid: true, assetCount: 0 });
  registration.dispose();
  expect(tools.size).toBe(0);
  registration = registerMathEditorTools(context);
  expect(await registration.ready).toBe("registered");
  expect(tools.size).toBe(2);
}
it("現行APIに2ツールだけを登録し、解除後も再登録できる", modernRegistration);

/**
 * 旧APIの登録・解除の互換性を確認する。
 * @returns 登録検証の完了
 */
async function legacyRegistration(): Promise<void> {
  const { context, tools, unregisterMock } = contextFixture(false);
  Object.defineProperty(navigator, "modelContext", { configurable: true, value: context });
  registration = registerMathEditorTools();
  expect(await registration.ready).toBe("registered");
  registration.dispose();
  expect(tools.size).toBe(0);
  expect(unregisterMock).toHaveBeenCalledTimes(2);
}
it("旧navigator APIでも登録でき、自分の2ツールだけを解除する", legacyRegistration);

/** 現行APIを優先し、非対応やアクセス拒否を検出する。 */
function detection(): void {
  expect(detectMathEditorModelContext()).toBeUndefined();
  const modern = contextFixture(true).context;
  const legacy = contextFixture(false).context;
  Object.defineProperty(document, "modelContext", { configurable: true, value: modern });
  Object.defineProperty(navigator, "modelContext", { configurable: true, value: legacy });
  expect(detectMathEditorModelContext()).toBe(modern);
  /**
   * APIアクセスがブラウザに拒否される状況を再現する。
   * @returns この検査では常に例外となる
   */
  function denied(): never { throw new Error("permission denied"); }
  Object.defineProperty(document, "modelContext", { configurable: true, get: denied });
  expect(detectMathEditorModelContext()).toBeUndefined();
}
it("documentを優先し、未対応・拒否されたAPIを安全に扱う", detection);

/**
 * APIや暗号処理が利用できない場合でも失敗を外へ投げない。
 * @returns 非対応時の起動確認完了
 */
async function unavailable(): Promise<void> {
  registration = registerMathEditorTools();
  expect(await registration.ready).toBe("unavailable");
  vi.stubGlobal("crypto", {});
  const { context, registerMock } = contextFixture(true);
  registration = registerMathEditorTools(context);
  expect(await registration.ready).toBe("unavailable");
  expect(registerMock).not.toHaveBeenCalled();
}
it("WebMCPまたは暗号APIが未対応でも通常アプリの起動を妨げない", unavailable);

/**
 * 部分登録失敗でも他者の同名ツールを登録解除しない。
 * @returns 失敗時の後始末の検証完了
 */
async function partialFailure(): Promise<void> {
  const { context, tools, unregisterMock } = contextFixture(false);
  /**
   * 他の所有者のツールを再現する。
   * @returns 他者の結果
   */
  async function externalTool() { return { owner: "other" }; }
  const external = { name: "math_editor_validate_import", description: "other", inputSchema: {}, execute: externalTool };
  tools.set(external.name, external);
  registration = registerMathEditorTools(context);
  expect(await registration.ready).toBe("unavailable");
  expect([...tools.values()]).toEqual([external]);
  expect(unregisterMock).toHaveBeenCalledExactlyOnceWith("math_editor_get_capabilities");
}
it("部分登録の失敗を回収し、登録に失敗した同名ツールを削除しない", partialFailure);

/**
 * 非同期登録中の終了でツールが後から残らないことを確認する。
 * @returns 遅延登録の後始末確認完了
 */
async function disposedDuringRegistration(): Promise<void> {
  const { context, tools } = contextFixture(false);
  let finish!: () => void;
  /**
   * 遅延させるPromiseの完了処理を取り出す。
   * @param resolve 登録を完了する処理
   */
  function captureFinish(resolve: () => void): void { finish = resolve; }
  const deferred = new Promise<void>(captureFinish);
  /**
   * 登録の完了通知だけを遅らせる。
   * @param tool 登録するツール
   * @returns 遅延された登録結果
   */
  function registerTool(tool: MathEditorModelContextTool) {
    tools.set(tool.name, tool);
    return deferred;
  }
  context.registerTool = registerTool;
  registration = registerMathEditorTools(context);
  registration.dispose();
  finish();
  expect(await registration.ready).toBe("unavailable");
  expect(tools.size).toBe(0);
}
it("非同期登録の途中で終了した場合も登録を回収する", disposedDuringRegistration);

/**
 * 実行時の入力を検証し、内部例外や本文を公開しない。
 * @returns 公開エラーの確認完了
 */
async function publicErrors(): Promise<void> {
  const { context, tools } = contextFixture(true);
  registration = registerMathEditorTools(context);
  await registration.ready;
  const validate = tools.get("math_editor_validate_import")!;
  expect(await tools.get("math_editor_get_capabilities")!.execute({ extra: true })).toMatchObject({ success: false, error: { code: "INVALID_INPUT" } });
  expect(await validate.execute({ payloadText: "PRIVATE INVALID JSON", skillSchemaSha256: APP_SCHEMA_SHA256 })).toMatchObject({ valid: false, error: { code: "INVALID_JSON", fallbackRecommended: false } });
  const input = { payloadText: JSON.stringify(await createSingleBackup(createWorksheet(), [])), skillSchemaSha256: APP_SCHEMA_SHA256 };
  /**
   * 暗号APIが内部例外を返す状況を再現する。
   * @returns この検査では常に例外となる
   */
  async function cryptoFailure(): Promise<never> { throw new Error("PRIVATE STACK DETAILS"); }
  const digest = vi.spyOn(webcrypto.subtle, "digest").mockImplementation(cryptoFailure);
  const result = await validate.execute(input);
  expect(result).toMatchObject({ valid: false, error: { code: "VALIDATION_FAILED" } });
  expect(JSON.stringify(result)).not.toContain("PRIVATE");
  digest.mockRestore();
  const controller = new AbortController();
  controller.abort();
  expect(await validate.execute(input, { signal: controller.signal })).toMatchObject({ valid: false, error: { code: "VALIDATION_ABORTED" } });
  registration.dispose();
  expect(await validate.execute(input)).toMatchObject({ valid: false, error: { code: "VALIDATION_ABORTED" } });
}
it("不正入力・内部障害・中断を本文やstackのない公開エラーに変換する", publicErrors);
