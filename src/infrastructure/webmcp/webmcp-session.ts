export type WebMcpSessionSnapshot = {
  supported: boolean;
  writeConsentGranted: boolean;
  registered: boolean;
  directImportAvailable: boolean;
};

type WebMcpSessionListener = () => void;

let snapshot: WebMcpSessionSnapshot = {
  supported: false,
  writeConsentGranted: false,
  registered: false,
  directImportAvailable: false,
};
const listeners = new Set<WebMcpSessionListener>();

/** 現在のWebMCP連携状態を購読者へ通知する。 */
function emitChange(): void {
  for (const listener of listeners) listener();
}

/**
 * WebMCP APIの対応状態を更新する。
 * @param supported 登録APIが利用可能ならtrue
 */
function setSupported(supported: boolean): void {
  if (snapshot.supported === supported) return;
  snapshot = { ...snapshot, supported };
  emitChange();
}

/**
 * すうがく仕立てツール一式の登録状態を更新する。
 * @param registered 全ツールの登録が完了していればtrue
 */
function setRegistered(registered: boolean): void {
  if (snapshot.registered === registered) return;
  snapshot = { ...snapshot, registered };
  emitChange();
}

/**
 * Receiptを含む直接取込ツールの利用可否を更新する。
 * @param available 直接取込ツールまで登録済みならtrue
 */
function setDirectImportAvailable(available: boolean): void {
  if (snapshot.directImportAvailable === available) return;
  snapshot = { ...snapshot, directImportAvailable: available };
  emitChange();
}

/** このページセッションでのAI書込みを許可する。 */
function grantWriteConsent(): void {
  if (snapshot.writeConsentGranted) return;
  snapshot = { ...snapshot, writeConsentGranted: true };
  emitChange();
}

/** このページセッションでのAI書込み許可を解除する。 */
function revokeWriteConsent(): void {
  if (!snapshot.writeConsentGranted) return;
  snapshot = { ...snapshot, writeConsentGranted: false };
  emitChange();
}

/**
 * AI書込みが利用者によって許可されているか確認する。
 * @returns 現在のページセッションで許可済みならtrue
 */
function isWriteConsentGranted(): boolean { return snapshot.writeConsentGranted; }

/**
 * Reactおよび能力取得で共有する状態を返す。
 * @returns 参照が状態変更時だけ変わる現在のスナップショット
 */
function getSnapshot(): WebMcpSessionSnapshot { return snapshot; }

/**
 * WebMCP連携状態の変更を購読する。
 * @param listener 状態変更時に呼び出す処理
 * @returns 購読を解除する処理
 */
function subscribe(listener: WebMcpSessionListener): () => void {
  listeners.add(listener);
  /** WebMCP連携状態の購読を解除する。 */
  function unsubscribe(): void { listeners.delete(listener); }
  return unsubscribe;
}

export const webMcpSession = {
  setSupported,
  setRegistered,
  setDirectImportAvailable,
  grantWriteConsent,
  revokeWriteConsent,
  isWriteConsentGranted,
  subscribe,
  getSnapshot,
};
