# 数学プリント作成ソフト

中学校数学向けのプリントをPCブラウザ上で作成する、ローカル完結型のWebアプリケーションです。問題、小問、数式、画像、表、解答欄などを編集し、ページプレビューを確認しながらPDFへ出力できます。

アプリ本体のデータはサーバーへ送信せず、ブラウザのIndexedDBへ保存します。単一プリントまたは通常一覧全体をJSONでバックアップできます。

任意機能として、教科書PDFの指定範囲をMath Editor用JSONへ変換する`math-editor-textbook-import` Skillを同梱しています。Skillはアプリ内ではなく、対応するAIサービスまたはAIエージェントの処理環境で動作します。詳細は[教科書PDF取込Skill](#教科書pdf取込skill)を参照してください。

## 動作環境

- 最新版のGoogle ChromeまたはMicrosoft Edge
- 編集画面は横幅1024px以上のPC画面
- IndexedDB、Blob、Object URL、`createImageBitmap`を利用できること

アカウント、クラウド保存、同期、共同編集には対応していません。ブラウザやプロファイルが異なると、保存済みデータは共有されません。

## セットアップ

```bash
npm install
npm run dev
```

Viteが表示したURLをChromeまたはEdgeで開きます。

100問題規模の状態更新処理を計測する場合は、`npm run benchmark:editor`を実行します。React描画、TipTap、DOM、layout、paintを含む実ブラウザ入力レイテンシは、`npm run benchmark:editor:browser`で検証できます。

## 主な使い方

1. 一覧画面で「新しいプリント」を選択します。
2. 編集画面の左側で問題やコンテンツを編集します。
3. 右側で「問題のみ」「解答付き」を切り替えて確認します。
4. 「プリント設定」で用紙、余白、問題番号、ヘッダーを設定します。
5. 「PDF出力」からPDFをダウンロードします。
6. 一覧画面の「設定・バックアップ」から定期的にJSONを保存します。

画面右上の「使い方」から、検索に対応したアプリ内マニュアルを別タブで開けます。編集ダイアログなどにある「詳しい使い方」からは、操作中の機能に対応する章を直接開けます。

## 実装済み機能

### プリント管理

- 新規作成、更新日時順の一覧、題名検索
- 1ページ50件のページング
- プリント複製と画像アセットの複製
- ゴミ箱への移動、直後の取り消し、復元、完全削除、ゴミ箱を空にする
- 単一プリント／通常一覧全体のJSONエクスポート
- 単一／全体バックアップの追加インポート

### 編集

- 題名の直接編集
- 問題／例題の追加、種類変更、複製、削除、上下移動
- 問題と例題で独立した採番、番号の表示切替、途中からの振り直し、小問番号形式の一括設定
- 本文、囲み枠、小問、解答欄、スペーサー、改ページ
- 太字、下線、斜体、4段階の文字サイズ、箇条書き、番号付きリスト
- MathLiveを使った行内／独立数式の挿入と再編集
- PNG、JPEG、WebP画像の挿入、差し替え、配置、サイズ、代替テキスト
- 一般表、関数表、度数分布表、行列操作、セル結合、行高、列幅、セル内数式
- 数式、画像、表を含む問題色・解答色の内容と、問題単位の教師用解説
- 最大100操作のUndo / Redo（同じ入力欄への短時間の連続入力は1操作へ結合）

### プレビューとPDF

- JIS B5／A4、縦向き、4段階の余白
- 通常プレビューは「問題のみ」「解答付き」の2モード、PDF出力は「問題＋解答」を加えた3モード
- 編集ペインのスクロールに、同じ問題・例題の位置を基準としてプレビューが追従
- 25～200%の倍率（5%刻み）、ペイン実寸に追従する「幅に合わせる」「ページ全体」
- コンテンツ単位の自動改ページと明示改ページ
- 各出力セクションの先頭ページに題名と年・組・番・名前を表示
- プレビューの各ページを高解像度PNGへ変換し、同じ見た目のPDFとして出力

### アプリ内マニュアル

- はじめての操作、編集、数式、画像・表、解答、PDF、保存、バックアップ、トラブル対応を含む13章
- 章題、概要、キーワード、本文を対象としたマニュアル検索
- 一覧、編集、各種ダイアログ、ゴミ箱から関連する章を新しいタブで開く文脈リンク
- 教科書PDF取込Skillの準備、サービス別の開始例、内容確認、JSONインポートまでの手順

## 教科書PDF取込Skill

[`math-editor-textbook-import`](AI/skills/math-editor-textbook-import/SKILL.md)は、利用権限のある教科書PDFから指定範囲の例題、問題、小問、数式、表、図版、教科書に掲載された解答・解説を抽出し、再編集可能なMath Editorの単一プリントJSONへ変換するSkillです。

SkillはMath Editorへ直接書き込みません。処理の流れは次のとおりです。

```text
教科書PDF → Skill対応AI環境 → 利用者による内容確認 → 検証済みJSON → Math Editorのインポート
```

### 利用前の準備

- `math-editor-textbook-import`を導入でき、PDF添付とファイル保存に対応したAIサービスまたはAIエージェント
- 利用する権限があり、パスワードで保護されていない教科書PDF
- 開始・終了それぞれの紙面ページと問題／例題ラベル
- 必要に応じてプリント題名と、例題の説明スタイル（`normal`、`detailed`、`concise`）

Skill本体は[`AI/skills/math-editor-textbook-import/`](AI/skills/math-editor-textbook-import/)にあります。リポジトリをクローンしただけでは、利用するAI環境へ自動登録されません。このディレクトリを、その環境のSkills、拡張機能、Pluginなどの導入方法に従って追加または有効化してください。サービス別の画面操作は、アプリ内マニュアルの「AI Skillsの使い方」に掲載しています。

### 利用手順

1. Skillを有効にした新しいチャットまたはタスクへ教科書PDFを添付します。
2. 紙面ページと問題／例題ラベルの両方で取込範囲を指定します。PDF上の物理ページと紙面ページがずれている場合は両方を伝えます。
3. PDFがMath Editorの外部にあるSkill実行環境へ渡されることを理解し、PDFの利用権限と外部処理を確認します。この確認が済むまで解析は始まりません。
4. 問題ごとの採否、種別、本文、LaTeX、小問、図版、教科書解答、解説、Warningを元PDFと照合します。
5. 修正があれば具体的に伝えて再確認します。内容を確定するときは「この内容で確定し、Math Editor用JSONを作成してください」のように、JSON生成を明示します。
6. 生成されたJSONを保存し、Math Editorの一覧画面にある「インポート」から読み込みます。既存プリントは上書きされず、新しいプリントとして追加されます。

依頼例：

```text
math-editor-textbook-import Skillを使って、添付した教科書PDFの
42ページの例題1から45ページの問8までをMath Editor用に取り込んでください。
例題の解説は普通にしてください。結果を確認してからJSONを作りたいです。
```

### 安全性と対象外

- PDF解析前に、外部処理とPDF利用権限について利用者の確認を必須とします。
- 確認中のDraftと完成JSONを分離し、現在の`revision`に対する明示確定後だけJSONを組み立てます。
- 教科書にない新規問題、類題、誤答例、ヒント、解答は生成しません。教科書解答が見つからない場合もAIの解答で補完しません。
- 図やグラフは元PDFから切り出し、AI画像として描き直しません。
- 完成JSONには採用した内容と図版だけを含め、PDF本体、範囲外本文、OCR中間結果、棄却した図版を含めません。
- 出力は`format: "math-worksheet"`、`kind: "single"`、`version: 1`です。Schema検証に成功しても数学的な正しさを保証するものではないため、インポート後も利用者が最終確認してください。

### Skillパッケージの構成と保守

```text
AI/skills/math-editor-textbook-import/
├─ SKILL.md               適用範囲、状態遷移、確認ゲート、実行手順
├─ agents/openai.yaml     表示名、説明、既定プロンプトなどのメタデータ
├─ references/            解析、Draft、数式、図版、変換、検証、エラー規則
├─ scripts/               図版切り出し、JSON組立て、最終Validator
└─ schemas/               Skillへ同梱するJSON SchemaとSHA-256 manifest
```

決定論的な処理は次のスクリプトが担当します。通常の利用ではSkillが呼び出すため、利用者が手動実行する必要はありません。

```bash
# 元PDFから図版を切り出す（Python、Pillow、pypdf、Popplerのpdftoppmが必要）
python scripts/crop_pdf_figure.py --input request.json

# 確定済みDraftをMath Editor単一プリントJSONへ変換する（Node.js）
node scripts/build_math_worksheet_file.mjs --draft draft.json --output candidate.json --asset-root crop-dir

# 同梱Schemaと相関制約、画像実体、サイズ上限を最終検証する（Node.js）
node scripts/validate_math_worksheet.mjs candidate.json
```

上記コマンドは`AI/skills/math-editor-textbook-import/`をカレントディレクトリとして実行します。Validatorの成功条件は終了コード0だけでなく、標準出力JSONの`valid === true`かつ`errors.length === 0`です。

保存形式を変更した場合は、正本である`src/domain/worksheet/worksheet.schema.ts`からルートのJSON Schemaを再生成し、Skill側のSchema、manifest、Validator、mappingを一式で同期してください。更新手順と検証条件は[`validation-rules.md`](AI/skills/math-editor-textbook-import/references/validation-rules.md)に記載しています。

## 保存とバックアップ

- 編集内容は最後の変更から750ms後にIndexedDBへ自動保存します。
- 一覧へ戻る前とPDF出力前には未保存内容を即時保存します。
- 未保存状態でリロードやタブ終了を行う場合は、ブラウザの離脱警告を表示します。
- Undo / Redo履歴は編集セッション内だけで保持し、再読み込み後は復元しません。
- JSON形式は`format: "math-worksheet"`、`version: 1`です。
- 画像Blobは通常データと分離してIndexedDBへ保存し、JSON出力時だけ`assets[].dataBase64`へ変換します。
- インポートは既存データを置換せず、新しいIDを付けて追加します。
- version 1以外や旧`dataUrl`形式の自動移行は行いません。

## 現在の制約

- 問題の並べ替えはメニューの「上へ移動／下へ移動」を使用します。ドラッグ＆ドロップとAlt＋矢印キーは未実装です。
- 小問は追加、削除、半幅／全幅、採番の振り直しに対応します。複製、並べ替え、小問別の教師用正解編集は未実装です。
- 段落の揃え情報は保存形式にありますが、左・中央・右揃えを変更するツールバーは未実装です。
- フォント選択値は保存されますが、現行のプレビューとPDFは固定のフォントスタックを使用しており、選択したフォントへの切替は未完了です。
- 自動ページ分割はコンテンツブロック単位です。1ブロックが1ページより高い場合の内部分割・自動縮小は未実装で、紙面からはみ出す部分が切れる場合があります。
- PDFは各ページを画像として格納するため、PDF内の文字は検索・選択できません。
- 画像挿入時はMIME型、10MiB、各辺10,000px、40MPを確認します。バックアップ取込時はJSON構造と参照整合性を検証しますが、画像バイトの再デコード検証は行いません。
- ブラウザのタブを直接閉じる直前の未保存変更を同期保存する処理はありません。離脱警告が出た場合はキャンセルし、「保存済み」になってから閉じてください。

詳細な上限値と受け入れ条件は[要件定義書.md](要件定義書.md)を参照してください。

## プロジェクト構成

```text
src/
├─ domain/             Zodスキーマ、既定値、コマンド、採番、表操作
├─ application/        Repository契約、バックアップ、PDF生成
├─ infrastructure/     Dexie / IndexedDB、ファイルダウンロード
├─ manual/             Markdown本文、章マニフェスト、検索、アセット
└─ presentation/       一覧、編集、プレビュー、ゴミ箱、マニュアル、ダイアログ
AI/skills/              Skill本体、参照規則、決定論的スクリプト、同梱Schema
e2e/                    Playwrightによる離脱・保存の実ブラウザテスト
schemas/                生成済みJSON Schema
scripts/                Schema・マニュアル生成／検証、ベンチマーク
```

`src/domain/worksheet/worksheet.schema.ts`を保存形式の正本とし、TypeScript型と`schemas/math-worksheet.schema.json`をそこから導出します。生成済みJSON Schemaは直接編集しません。

## 開発コマンド

```bash
# 開発サーバー
npm run dev

# 単体・UI・IndexedDBテスト
npm run test

# Oxlint（TypeScript type-aware・React Hooksを含む）
npm run lint

# アプリ内マニュアルの章構成、リンク、本文を検証
npm run manual:check

# 型、Lint、Schema生成差分、Schema振る舞い、マニュアル、全テスト
npm run verify

# Chromeによる離脱・保存E2Eテスト
npm run test:e2e

# 本番ビルド
npm run build
```

E2Eテストはローカルではインストール済みのGoogle Chromeを使用する。GitHub ActionsではPlaywright Chromiumをインストールして実行する。

スキーマを変更した場合は、必要に応じて`structure-limits.ts`も更新し、`npm run schema:generate`でJSON Schemaを再生成してください。
