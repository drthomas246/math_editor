import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it } from "vitest";
import { getMathEditorCapabilities } from "../../infrastructure/webmcp/math-editor-capabilities";
import { webMcpSession } from "../../infrastructure/webmcp/webmcp-session";
import { AiIntegrationStatus } from "./AiIntegrationStatus";

/** WebMCPツールの登録が完了したページを再現する。 */
function prepare(): void {
  webMcpSession.setSupported(true);
  webMcpSession.setRegistered(true);
  webMcpSession.setDirectImportAvailable(true);
  webMcpSession.revokeWriteConsent();
}

/** 共有セッションを未対応の初期状態へ戻す。 */
function cleanup(): void {
  webMcpSession.revokeWriteConsent();
  webMcpSession.setRegistered(false);
  webMcpSession.setDirectImportAvailable(false);
  webMcpSession.setSupported(false);
}
beforeEach(prepare);
afterEach(cleanup);

it("説明確認後だけページ限定のAI書込みを許可し、同じボタンで解除する", /**
 * Consentダイアログとcapabilitiesが共有セッションへ追従することを確認する。
 * @returns 許可と解除の画面検証完了
 */
async function grantsAndRevokesConsent() {
  render(<AiIntegrationStatus/>);
  expect(getMathEditorCapabilities()).toMatchObject({ directImportAvailable: true, writeConsentGranted: false });
  await userEvent.click(screen.getByRole("button", { name: "AI連携: OFF" }));
  expect(screen.getByText("既存プリントは変更しません。")).toBeInTheDocument();
  expect(screen.getByText("許可はこのページセッションだけです。")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "許可" }));
  expect(screen.getByRole("button", { name: "AI連携: ON" })).toBeInTheDocument();
  expect(getMathEditorCapabilities().writeConsentGranted).toBe(true);
  await userEvent.click(screen.getByRole("button", { name: "AI連携: ON" }));
  expect(screen.getByRole("button", { name: "AI連携: OFF" })).toBeInTheDocument();
  expect(getMathEditorCapabilities().writeConsentGranted).toBe(false);
});

it("WebMCP未対応環境ではAI連携UIを表示しない", /** 未対応時に通常画面を増やさないことを確認する。 */
function hidesWhenUnsupported() {
  webMcpSession.setSupported(false);
  render(<AiIntegrationStatus/>);
  expect(screen.queryByRole("button", { name: /AI連携/u })).not.toBeInTheDocument();
});
