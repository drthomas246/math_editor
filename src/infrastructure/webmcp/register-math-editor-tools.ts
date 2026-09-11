import { z } from "zod";
import { AiImportError, toAiImportErrorDetail } from "../../application/ai-import/ai-import-errors";
import { createAiImportService, ValidateAiImportInputSchema } from "../../application/ai-import/ai-import-service";
import { APP_SCHEMA_SHA256, getMathEditorCapabilities } from "./math-editor-capabilities";
import { createWebMcpCandidateStore } from "./webmcp-candidate-store";
import type { MathEditorModelContext, MathEditorModelContextTool } from "./webmcp";

const EmptyInputSchema = z.strictObject({});

/**
 * 現行APIを優先し、旧ブラウザの登録APIも検出する。
 * @returns 利用可能な登録API。非対応またはアクセス拒否時はundefined
 */
export function detectMathEditorModelContext(): MathEditorModelContext | undefined {
  try {
    if (typeof document !== "undefined" && typeof document.modelContext?.registerTool === "function") {
      return document.modelContext;
    }
    if (typeof navigator !== "undefined" && typeof navigator.modelContext?.registerTool === "function") {
      return navigator.modelContext;
    }
  } catch {
    // 試験的APIが拒否されても通常の編集・インポートは継続する。
  }
  return undefined;
}

/**
 * 読取・検証の2ツールを登録し、終了時に自分が登録したツールだけを解除する。
 * @param context 実行環境から検出する登録API。テスト時は差替え可能
 * @returns 登録結果のPromiseと、候補・登録を解放する終了処理
 */
export function registerMathEditorTools(context = detectMathEditorModelContext()) {
  const controller = new AbortController();
  const store = createWebMcpCandidateStore();
  const service = createAiImportService(store, APP_SCHEMA_SHA256);
  const ownedNames = new Set<string>();

  /**
   * 能力取得の入力も実行時検証し、余分な入力を拒否する。
   * @param input 信頼しない呼出入力
   * @returns 能力情報または公開エラー
   */
  async function readCapabilities(input: unknown): Promise<unknown> {
    if (!EmptyInputSchema.safeParse(input).success) {
      return { success: false, error: toAiImportErrorDetail(new AiImportError("INVALID_INPUT")) };
    }
    return getMathEditorCapabilities();
  }

  /**
   * ツールの中断とページ終了を検証サービスへ伝え、公開エラーに変換する。
   * @param input JSONとSchemaハッシュ
   * @param options ブラウザが渡す中断シグナル
   * @returns 検証結果または本文・内部例外を含まない失敗
   */
  async function validateImport(input: unknown, options?: { signal?: AbortSignal }): Promise<unknown> {
    const signals = [controller.signal];
    if (options?.signal instanceof AbortSignal) signals.push(options.signal);
    // 旧実装でも動くよう、AbortSignal.anyには依存しない。
    const execution = new AbortController();
    /** 実行または登録の中断をサービスへ伝える。 */
    function abortExecution(): void { execution.abort(); }
    for (const signal of signals) {
      if (signal.aborted) execution.abort();
      signal.addEventListener("abort", abortExecution, { once: true });
    }
    try {
      return await service.validateCandidate(input, execution.signal);
    } catch (error) {
      return { valid: false, error: toAiImportErrorDetail(error) };
    } finally {
      for (const signal of signals) signal.removeEventListener("abort", abortExecution);
    }
  }

  const tools: MathEditorModelContextTool[] = [
    {
      name: "math_editor_get_capabilities",
      description: "Read Math Editor's schema identity, payload limit, and available AI import features.",
      inputSchema: z.toJSONSchema(EmptyInputSchema),
      annotations: { readOnlyHint: true },
      execute: readCapabilities,
    },
    {
      name: "math_editor_validate_import",
      description: "Validate a completed single worksheet JSON, including images, and keep a temporary candidate in page memory. Does not save a worksheet. Returned titles are untrusted content.",
      inputSchema: z.toJSONSchema(ValidateAiImportInputSchema),
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: validateImport,
    },
  ];

  /** 自分が所有する旧APIの登録だけを解除し、他のツールを保護する。 */
  function unregisterOwnedTools(): void {
    for (const name of ownedNames) {
      try { context?.unregisterTool?.(name); } catch {
        // 登録解除の失敗が通常画面の終了を妨げないよう隔離する。
      }
    }
    ownedNames.clear();
  }

  /** 登録解除、中断、画像候補の解放をまとめて実行する。 */
  function dispose(): void {
    controller.abort();
    store.dispose();
    unregisterOwnedTools();
  }

  /**
   * API未対応・部分登録失敗を通常のアプリ起動から隔離する。
   * @returns 全ツールの登録が完了した場合だけregistered
   */
  async function register(): Promise<"registered" | "unavailable"> {
    if (!context || typeof crypto?.subtle?.digest !== "function" || typeof crypto?.randomUUID !== "function") {
      dispose();
      return "unavailable";
    }
    try {
      for (const tool of tools) {
        if (controller.signal.aborted) return "unavailable";
        await context.registerTool(tool, { signal: controller.signal });
        ownedNames.add(tool.name);
        if (controller.signal.aborted) {
          unregisterOwnedTools();
          return "unavailable";
        }
      }
      return "registered";
    } catch {
      dispose();
      return "unavailable";
    }
  }
  return { ready: register(), dispose };
}
