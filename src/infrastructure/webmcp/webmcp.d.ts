// 現行仕様と旧Navigator実装の差分を、この登録用の最小型だけに閉じ込める。
export type MathEditorModelContextTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean; consequentialHint?: boolean };
  /**
   * 信頼しない入力から公開結果を生成する。
   * @param input ブラウザまたはエージェントからの入力
   * @param options 現行APIの実行中断通知
   * @returns JSONへ直列化可能な結果
   */
  execute(input: unknown, options: { signal: AbortSignal }): Promise<unknown>;
};

export interface MathEditorModelContext {
  /**
   * ページのツールを登録する。
   * @param tool 公開するツール
   * @param options 現行APIの登録解除シグナル
   * @returns 現行APIでは登録完了、旧APIでは即座に終了
   */
  registerTool(tool: MathEditorModelContextTool, options?: { signal: AbortSignal }): void | Promise<void>;
  /**
   * 旧APIで所有ツールを登録解除する。
   * @param name 登録したツール名
   */
  unregisterTool?(name: string): void;
}

declare global {
  interface Document { readonly modelContext?: MathEditorModelContext; }
  interface Navigator { readonly modelContext?: MathEditorModelContext; }
}
