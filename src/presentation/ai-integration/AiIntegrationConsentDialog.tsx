import { Modal } from "../components/Modal";

/**
 * このページセッションに限ったAI書込み許可を利用者へ確認する。
 * @param props ダイアログの終了処理と許可確定処理
 * @returns AI連携の影響範囲を説明する確認ダイアログ
 */
export function AiIntegrationConsentDialog(props: { onClose: () => void; onAllow: () => void }) {
  const { onClose, onAllow } = props;
  return <Modal
    title="AI連携を許可しますか？"
    size="small"
    onClose={onClose}
    footer={<>
      <button className="secondary-button" onClick={onClose}>キャンセル</button>
      <button className="primary-button" onClick={onAllow}>許可</button>
    </>}
  >
    <p>ChatGPTから、このタブのMath Editorへ新しいプリントを追加できるようにします。</p>
    <ul className="ai-consent-list">
      <li>既存プリントは変更しません。</li>
      <li>許可はこのページセッションだけです。</li>
      <li>教科書PDF本体はMath Editorへ保存しません。</li>
    </ul>
  </Modal>;
}
