# Phase 4 実ホスト自己テスト記録

## 実施情報

- 実施日: 2026-09-12
- 対象commit: `0719dd233c805a1dc80de57e1ed229cf6cba9ea9`
- ChatGPT環境: ChatGPT Web、Plus、Chat mode、Microsoft Edge
- portable Plugin version: `2.1.0`
- ローカルインストール版: `2.1.0+codex.20260912093415`
- Math Editor URL種別: localhost（`http://127.0.0.1:5173/`。秘密情報なし）
- GitHub Actions: Verify run `34679344031` PASS
- 総合判定: **BLOCKED**。実ChatGPTホストがローカルPluginとWebMCP Site toolsを発見できないため、Issue #37の完了条件6は未達のままとする。

## 実ChatGPTホスト確認

| 確認項目 | 結果 | 証拠・補足 |
|---|---|---|
| 最終portable Pluginをbuild / verify | PASS | 22ファイルを再生成し、正本との全バイト一致を確認 |
| ローカルPluginをcachebuster付きで再インストール | PASS | personal marketplaceから`2.1.0+codex.20260912093415`をインストール |
| Phase 4配送ファイルをインストール先で確認 | PASS | `webmcp-integration.md`、`plan_webmcp_delivery.mjs`、`resolve_math_editor_target.mjs`を確認 |
| ChatGPTで新規会話を開く | PASS | Edge上のChatGPT Webで新規会話を開始 |
| `math-editor-textbook-import` Skillを選択 | BLOCKED | ChatGPT Webのインストール済みPluginにMath Editor AIがなく、Skill一覧も「まだスキルがありません」。`@math-editor`でもSkill候補が出ない |
| Math Editorを実ブラウザで開く | PASS | localhostの一覧画面をEdgeで表示 |
| WebMCP Site toolsを発見 | BLOCKED | 実ページで`document.modelContext`が未注入。ブラウザホストが公開したtab capabilityにもSite toolsがない |
| capabilities取得 | NOT RUN | Site tools未発見のため |
| validate成功 | NOT RUN | Site tools未発見のため |
| Consent OFFで書込み拒否 | NOT RUN | Site tools未発見のため |
| 利用者のConsent ON後にdirect import | NOT RUN | Site tools未発見のため。Consentを自動操作していない |
| 同じ`requestId`のreplayで二重作成なし | NOT RUN | Site tools未発見のため |
| reloadでConsent OFF、再許可後にreceipt recovery | NOT RUN | Site tools未発見のため |
| 同一URLの2タブから`pageId`で選択 | NOT RUN | 実ホストのページ発見自体が利用不能なため |
| WebMCP利用不能時の同一完成JSON fallback | NOT RUN | Skillを実ChatGPTで起動できないため |

## 自動統合テストによる補完確認

実ホストの代替ではないが、ブロック箇所以外の実装退行を次の検査で確認した。

| 確認項目 | 結果 | 実行内容 |
|---|---|---|
| capabilities、validate、Consent、import、replay、reload recovery | PASS | `npx playwright test e2e/ai-webmcp-import.spec.ts`（実ブラウザ内でWebMCPホストを模擬） |
| 同一URL複数タブと`selectedPageId` | PASS | `webmcp-target.test.mjs`を含むPlugin test |
| JSON fallback、import toolのfail-closed判定 | PASS | `webmcp-delivery.test.mjs` |
| candidate再検証の上限 | PASS | `CANDIDATE_EXPIRED`初回は再検証、2回目は手動JSON fallback |
| transport再試行の上限 | PASS | validation / importとも初回だけ再試行し、再失敗は手動JSON fallback |
| CI全工程 | PASS | GitHub Actions Verify run `34679344031`。Plugin runtime、PDF fallback、Playwright E2Eを含む全step成功 |

## JSON fallback確認

plannerはWebMCP未提供、import tool発見結果が`true`以外、Schema不一致、2 MiB超過、candidate再検証またはtransport再試行の上限到達時に、`preservePayload: true`の`manual-import`を返す。完成JSONを変更しないことは自動テストで確認した。実ChatGPT上での操作確認はSkill発見ブロックの解消後に再実施する。

## 既知の制限と再テスト条件

- ローカルPluginはCodex側へ正常にインストールされたが、今回利用可能だったChatGPT Webホストからは発見できなかった。
- localhostのMath Editorには通常のEdgeタブだけでは`document.modelContext`が注入されない。WebMCP対応ホストからページを開く必要がある。
- 実ホストでPluginとSite toolsの両方が発見できる環境が利用可能になったら、本書の`NOT RUN`項目を順番に実施してPASSへ更新する。
- 実ホスト確認が完了するまではIssue #37を閉じず、Phase 4完了としてmasterへマージしない。
