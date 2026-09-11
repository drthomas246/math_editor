# Phase 2: WebMCP read / validate

Phase 1のマージ後、`develop/#33`で能力取得と事前検証を実装した。参照設計は`追加AI詳細設計書.md`のPhase 2。書込み・Consent UI・requestId・receipt・一覧通知はPhase 3の対象であり、この実装では登録しない。

## 公開するツール

| ツール | 入力 | 結果 |
| --- | --- | --- |
| `math_editor_get_capabilities` | `{}` | Schema version / SHA-256、UTF-8上限、実装済み機能、候補保持条件 |
| `math_editor_validate_import` | `{ payloadText, skillSchemaSha256 }` | 検証結果と候補のtoken / payload hash / 要約 / 期限 |

能力情報は`app: math-editor`、`integrationVersion: 1`、`worksheetFormat: math-worksheet`、`worksheetFileVersion: 1`、`schemaVersion: 1`、`validationAvailable: true`を返す。`directImportAvailable`と`writeConsentGranted`はfalse。Schema hashはリポジトリのmanifestをビルド時に取り込み、小文字16進で返す。Skill同梱manifestの大文字ハッシュも同一値として受け付ける。

`validate_import`は永続保存を行わないがメモリ状態を変えるため、`readOnlyHint: false`を指定する。題名などの入力由来文字列を返すため`untrustedContentHint: true`を指定する。能力取得は`readOnlyHint: true`。

## 検証と保持

`ai-import-service.ts`はWebMCPやRepositoryに依存せず、次を順に実行する。

1. ツール入力の厳密検証（未知フィールドも拒否）。
2. 2 MiB以下のUTF-8バイト長検査。通常JSONインポートの100 MiB上限は変更しない。
3. SkillとアプリのSchema SHA-256の比較。
4. JSON解析、正本`MathWorksheetFileSchema`による構造・ID・Asset参照などの検証、`kind: single`の確認。
5. 既存`hydrateBackup`によるID再割当て、画像署名・デコード・寸法検証。
6. 受信した文字列そのもののSHA-256を計算。空白や改行も含み、再直列化しない。
7. ページ内候補を作成し、本文や画像を含まない要約だけを返す。

候補は`crypto.randomUUID()`で識別し、10分で失効する。最大8件を保持し、容量超過時は最古の候補を破棄する。タイマーが停止・遅延した場合も参照時の期限検査で拒否する。期限到来時には画像を解放し、直近32件の失効トークンだけをエラー分類用に保持する。保存・取得の両方でコピーを返し、外部参照経由の改変を防ぐ。取得時はtokenとpayload hashを照合する。

中断やモジュール終了後の非同期完了では新候補を保持しない。再読込で候補は失われる。検証成功はWorksheet保存完了を意味しない。

## 登録と互換性

登録はReactの外の`main.tsx`で一度だけ起動し、StrictModeや画面遷移による重複登録を避ける。HMR時は登録と候補を解放する。

現行の`document.modelContext.registerTool()`とAbortSignalによる解除を優先する。旧`navigator.modelContext`と`unregisterTool()`にも対応する。ブラウザAPIを読む箇所と登録処理は`infrastructure/webmcp`に閉じ込めた。

API未対応・Web Crypto不足・登録拒否・部分登録失敗は通常の画面起動から隔離する。部分登録失敗時に解除するのは、この登録処理が所有するツールだけ。全ツールの一括削除は行わない。

仕様確認日: 2026-09-12。[WebMCP Community Group Draft](https://webmachinelearning.github.io/webmcp/) の登録API、実行シグナル、annotationsを参照。実験的APIなので、この境界モジュールとテストを更新して追従する。

## Skillの接続先解決

正本Skillの`references/webmcp-integration.md`に、完成確認・Builder・Validator成功後の能力取得と事前検証を追加した。配送は引き続き検証済みJSONを利用者へ渡す。

`scripts/resolve_math_editor_target.mjs`は、ホストが観測したページ一覧から対象を選ぶportableな補助CLI。ブラウザ操作やネットワーク通信は行わない。

- 発見した同一ページの2ツールを優先する。
- 発見できなければ、利用者が明示したURL、自己テストが明示した実起動URLの順で選ぶ。
- 複数ページが残る場合は選択待ち。同じURLの別タブも統合しない。
- 対象なし・不正URLは`TARGET_URL_REQUIRED`。本番originや開発ポートを固定しない。
- 選択後、ホストのSite toolsで能力を呼び、アプリ識別とSchemaを照合する。ページ名だけでは判定しない。

## 検証

- アプリ単体テスト: 入力、Schema、2 MiB境界、日本語のバイト長、archive拒否、参照不整合、不正画像、ハッシュ、候補の改変・期限・容量・終了・中断、API検出、現行／旧登録、部分登録失敗、公開エラー。
- Pluginテスト: URL選択の優先順位、複数候補、同一URLの別タブ、推測禁止。新referenceと補助CLIを配布必須ファイルとして検証する。
- ブラウザテスト: 登録APIをテスト用に再現し、アプリ起動からツール実行、実画像の生成・デコード・検証を実行する。成功・失敗後ともIndexedDB件数と一覧が不変であること、WebMCP未対応／登録拒否でも通常作成・保存・再読込できることを確認する。

主なコマンド:

```text
npm run verify
npm run build
npm run plugin:build
npm run plugin:verify
npm run test:e2e
```

2026-09-12の実行結果: `npm run verify`成功（アプリ197件）、本番ビルド成功、ブラウザE2E 8件成功（うちWebMCP 3件）。Skillの`quick_validate.py`も成功。Pluginは本番ビルド後に正本から再生成し、配布物との一致を検証する。

ブラウザテストではWebMCP登録APIを模擬する。実ホストからのSite tools発見・呼出しと、ネイティブWebMCP実装での互換性確認は別途必要。installed Pluginキャッシュの更新・再インストールは今回のソース実装には含めない。
