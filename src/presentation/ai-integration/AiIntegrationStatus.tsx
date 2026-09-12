import { Bot, ShieldCheck } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { webMcpSession } from "../../infrastructure/webmcp/webmcp-session";
import { AiIntegrationConsentDialog } from "./AiIntegrationConsentDialog";

/**
 * WebMCP対応時だけ、ツール登録状態とページ限定の書込み許可を表示する。
 * @returns AI連携状態ボタンと必要に応じたConsentダイアログ
 */
export function AiIntegrationStatus() {
  const session = useSyncExternalStore(webMcpSession.subscribe, webMcpSession.getSnapshot, webMcpSession.getSnapshot);
  const [dialogOpen, setDialogOpen] = useState(false);
  if (!session.supported || !session.directImportAvailable) return null;

  /** AI連携ボタンから許可確認または許可解除を実行する。 */
  function toggleConsent(): void {
    if (session.writeConsentGranted) {
      webMcpSession.revokeWriteConsent();
      return;
    }
    setDialogOpen(true);
  }

  /** 利用者の明示操作で書込みを許可し、確認ダイアログを閉じる。 */
  function allowConsent(): void {
    webMcpSession.grantWriteConsent();
    setDialogOpen(false);
  }

  /** 許可状態を変更せず確認ダイアログを閉じる。 */
  function closeDialog(): void { setDialogOpen(false); }

  const granted = session.writeConsentGranted;
  return <>
    <button
      className={`ai-integration-button ${granted ? "enabled" : ""}`}
      type="button"
      disabled={!session.registered}
      aria-pressed={granted}
      onClick={toggleConsent}
      title={session.registered
        ? granted ? "クリックするとAI書込み許可を解除します" : "ChatGPTからの新規プリント追加を許可します"
        : "AI連携ツールを登録できませんでした"}
    >
      {granted ? <ShieldCheck size={16}/> : <Bot size={16}/>}
      AI連携: {granted ? "ON" : session.registered ? "OFF" : "利用不可"}
    </button>
    {dialogOpen && <AiIntegrationConsentDialog onClose={closeDialog} onAllow={allowConsent}/>} 
  </>;
}
