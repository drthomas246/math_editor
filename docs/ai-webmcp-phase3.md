# Phase 3: WebMCP direct import

Phase 2の事前検証で作成したcandidateを、利用者の明示的な許可後に新規Worksheetとして保存できるようにした。実装範囲は`追加AI詳細設計書.md`のPhase 3であり、この時点で残したSkillの配送フロー変更は[Phase 4](ai-skill-delivery-phase4.md)で統合した。実ホスト自己テストはWebMCPのロールアウト状態に応じて実施する。

## 公開ツール

Phase 3では次の3ツールを登録する。

| ツール | 性質 | 主な結果 |
| --- | --- | --- |
| `math_editor_get_capabilities` | 読取り | Schema、上限、直接取込可否、現在のConsent |
| `math_editor_validate_import` | メモリ上の候補作成 | candidate token、payload SHA-256、要約、期限 |
| `math_editor_import_worksheet` | IndexedDBへの新規保存 | Worksheet ID、題名、編集画面パス |

直接取込の入力は`candidateToken`、`requestId`、`expectedPayloadSha256`の3項目で、未知フィールドを拒否する。保存処理はWebMCP層からDexieへ直接到達せず、Application層のサービスから既存`WorksheetRepository.create()`を使用する。

直接取込ツールは保存を伴うことをホストへ示すため、`readOnlyHint: false`と`consequentialHint: true`を公開する。実行時の`AbortSignal`はApplication層まで伝え、保存開始前に中断済みならReceiptもWorksheetも作成しない。

## Consent

WebMCP対応環境のWorksheet一覧ヘッダーに「AI連携: OFF」を表示する。利用者が説明ダイアログで許可した場合だけONになり、ONのボタンを再度押すと解除する。

許可状態は`webmcp-session.ts`のメモリだけに保持し、IndexedDB、LocalStorage、sessionStorageには保存しない。ページ再読込では必ずOFFへ戻る。OFFのままimport toolを呼ぶと`CONSENT_REQUIRED`を返し、candidate、Receipt、Worksheetを変更しない。

## Receipt-firstの冪等性

`webmcp-import-receipt.ts`は次の最小情報を`sessionStorage`へ保持する。

- requestId
- payload SHA-256
- Worksheet ID
- 題名
- `pending`または`completed`
- 作成日時と完了日時

Consent確認後、candidateより先にReceiptを確認する。completed Receiptの同一要求はcandidate消失後も過去の成功結果を返し、再保存しない。pending ReceiptはRepositoryのWorksheet実体を照合し、実体があればcompletedへ回復する。実体もcandidateも失われていれば`REVALIDATION_REQUIRED`を返す。

新規保存ではpending Receipt、Repository保存、completed Receipt、candidate消費、AI Import Eventの順に処理する。同一ページで同時に届いた同じrequestIdと同じpayload SHA-256は、一つの実行中Promiseへまとめて二重保存を防ぐ。同じrequestIdで異なるpayload SHA-256が並行して届いた場合は`PAYLOAD_HASH_MISMATCH`で拒否し、先行要求の結果を返さない。

## 一覧同期

Repository保存とcompleted Receiptの確定後、Application層の`ai-import-completed`イベントを発行する。イベントはWorksheet ID、題名、requestIdだけを持ち、payload本文や画像を含まない。

表示中の`WorksheetListScreen`はイベントを購読し、Repositoryの一覧を再読込して成功Toastを表示する。WebMCP層はReact stateへ直接アクセスしない。一覧画面が表示されていない場合は、次回表示時の通常ロードで保存済みデータへ収束する。

## 失敗時の扱い

- Consentなし: `CONSENT_REQUIRED`
- candidateなし・期限切れ・消費済み: 対応するcandidateエラー
- Receiptと入力のhash不一致: `PAYLOAD_HASH_MISMATCH`
- 保存開始前の実行中断: `IMPORT_ABORTED`
- stale pendingかつcandidate消失: `REVALIDATION_REQUIRED`
- プリント件数上限: `WORKSHEET_LIMIT_REACHED`
- その他のRepositoryまたはReceipt障害: `IMPORT_FAILED`

公開エラーにpayload、Base64画像、内部stack traceを含めない。Repository transactionが失敗した場合はpending Receiptを整理し、成功イベントを発行しない。保存後のReceipt確定に失敗した場合はpendingを残し、同じrequestIdの再試行でRepository実体から回復する。

## 検証

単体テストではConsent、candidate消費、completed replay、pending回復、再検証要求、hash不一致、件数上限、同じhashの同時再試行、同じrequestIdで異なるhashの並行拒否、保存前の実行中断、イベント隔離、UIの許可・解除、一覧再読込を確認する。

PlaywrightではWebMCPホスト相当の登録APIをブラウザー内に用意し、次を通す。

1. 完成JSONをvalidateしてcandidateを作成する。
2. Consent OFFのimportが無副作用で拒否される。
3. Consent ON後に1件だけ保存され、一覧とToastへ反映される。
4. 同じrequestIdを再送しても件数が増えない。
5. reloadでConsentがOFFへ戻る。
6. 再許可後、消失したcandidateではなくcompleted Receiptから同じ成功結果を返す。

WebMCP API未対応または登録拒否の環境でも、通常の作成・保存・JSONインポートは引き続き使用できる。
