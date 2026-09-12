# すうがく仕立て 追加AI要件定義書

## 1. 文書情報

| 項目 | 内容 |
|---|---|
| 文書名 | すうがく仕立て 追加AI要件定義書 |
| 文書版 | 2.2 |
| 基準日 | 2026-09-13 |
| 対象システム | `drthomas246/math_editor` |
| 基準ブランチ | `master` |
| 基準コミット | `1ef632ad20d24dbb1e12e0bf022ecc1d6168837d` |
| 対象 | 中学校数学を中心とする授業プリント作成 |
| AI実行方式 | 利用者自身のChatGPT上で実行するすうがく仕立て Skill |
| 配布方式 | portable Plugin |
| すうがく仕立て連携方式 | WebMCP Site tools |
| 正式URL | `https://app.sujita.jp/` |
| フォールバック | `math-worksheet` 単一プリントJSON |
| OpenAI API | 使用しない |
| APIキー | 使用しない |
| 永続データ正本 | `src/domain/worksheet/worksheet.schema.ts` |
| 生成意味論の正本 | `src/application/backup/backup.ts` |
| すうがく仕立て保存先 | ブラウザIndexedDB |
| 教科書PDF保存 | すうがく仕立てへ永続保存しない |

本書は、既存すうがく仕立ての教科書PDF取込Skillをportable Pluginとして配布し、WebMCPに対応したすうがく仕立てと直接連携させるための要件を定義する。

従来の「ChatGPTでJSONを生成し、利用者が手動ですうがく仕立てへインポートする」方式を廃止するのではなく、WebMCPが利用可能な環境では直接インポートを主経路とし、利用できない環境では既存JSON方式へ安全にフォールバックする。

---

### 1.1 変更履歴

| 版 | 基準日 | 主な変更 |
|---|---|---|
| 2.0 | 2026-09-11 | portable Plugin + WebMCP直接取込の基本構成を定義 |
| 2.1 | 2026-09-11 | Skill実行環境フォールバック、WebMCP保存後のReact画面同期、receipt先行の冪等性、未確定公開URLの扱い、個人ローカルMarketplaceでのPlugin利用・テスト範囲を確定 |
| 2.2 | 2026-09-13 | 正式URLを `https://app.sujita.jp/`、WebMCPツール名を `sujita_*` に確定 |

### 1.2 現行版で確定した判断

本版では次を正式な設計判断とする。

1. Skill実行環境で既存のPDF図版切り出し依存関係が不足する場合、同等の結果を生成できる利用可能な代替経路を自動検出して使用する。代替経路も利用できず、採用問題に図版が必須である場合は完成処理を停止する。
2. WebMCP直接インポート成功後は、Application層のAI Import Eventを発行し、Worksheet一覧画面がRepositoryを再読込して表示を同期する。
3. WebMCPインポートの再試行では、candidate確認より先に`requestId`のImport Receiptを確認する。
4. すうがく仕立ての正式URLは `https://app.sujita.jp/` とし、接続先を発見・明示できない場合の既定値として使用する。
5. v2.1のPlugin配布対象は開発者本人によるローカルMarketplaceへの導入・テストまでとし、第三者配布・公開Plugin Directoryへの提出は対象外とする。

## 2. 背景

すうがく仕立てはブラウザ上で問題・例題・数式・画像・表・解答色・教師用解説を編集し、IndexedDBへローカル保存してPDF出力できる。

既存の `sujita-textbook-import` Skill は、利用権限のある教科書PDFから指定範囲の問題・例題・数式・図版・教科書解答・解説を抽出し、利用者確認後にすうがく仕立て単一プリントJSONを生成できる。

一方、現行フローでは、AI処理完了後に次の手動操作が必要である。

```text
ChatGPT
  ↓
JSONファイル生成
  ↓
ダウンロード
  ↓
すうがく仕立てを開く
  ↓
インポート
  ↓
ファイル選択
```

WebMCPを利用し、この中の「JSONファイルの手動受け渡し」を省略する。

---

## 3. 目的

本追加機能の目的は次のとおり。

1. 既存Skillをportable Pluginとして再利用可能な形で配布する。
2. ChatGPTからすうがく仕立てへ検証済みプリントを直接追加できるようにする。
3. OpenAI API、APIキー、外部MCPサーバーを必要としない構成を維持する。
4. すうがく仕立てのローカル保存と既存Schemaを維持する。
5. AI結果を利用者が明示確定した後だけ書き込む。
6. WebMCPの提供状況に依存してすうがく仕立て本体が使えなくなることを防ぐ。
7. WebMCPが使えない場合は既存JSON方式へ戻れるようにする。
8. すうがく仕立て開発者が利用者のAI従量料金を負担する構造にしない。

---

## 4. 基本方針

### 4.1 AIとすうがく仕立ての責務を分離する

AI処理はChatGPT側で行う。

ChatGPT側の責務:

- PDF理解
- 対象範囲解決
- 問題・例題認識
- 数式転記
- 教科書解答・解説取得
- 説明スタイル調整
- 図版候補決定
- Draft生成
- 利用者確認
- 完成候補生成
- Skill側Validator
- WebMCP直接配送またはJSONフォールバックの選択

すうがく仕立て側の責務:

- WebMCP Site tools提供
- 最終データ再検証
- 画像検証
- ID再採番
- 新規Worksheet保存
- AI Import Event発行
- 画面再同期
- 編集
- プレビュー
- PDF出力

### 4.2 OpenAI APIを使用しない

すうがく仕立て本体、Plugin、Skillの通常利用にOpenAI APIキーを必要としない。

利用者またはすうがく仕立て運営者へAPIキー入力を要求しない。

### 4.3 AI利用量

AI推論は、Plugin/Skillを実行している利用者本人のChatGPT環境で行う。

すうがく仕立て開発者のAPIアカウントへ利用量を集約しない。

ChatGPT側の利用可能量、モデル、クレジット、レート制限等はOpenAIの利用条件に従い、すうがく仕立てが保証しない。

### 4.4 Skillを正本として再利用する

Plugin化のために教科書解析ロジックを別実装しない。

`AI/skills/sujita-textbook-import/` をSkillの正本とし、Plugin配布物へ機械的にコピーする。

### 4.5 WebMCPは任意機能とする

`document.modelContext` が存在しないブラウザでもすうがく仕立て本体を正常動作させる。

WebMCPはすうがく仕立ての必須ブラウザーAPIに含めない。

### 4.6 Skill実行環境を事前検査する

Skillは、外部コマンド・Pythonモジュール・JavaScript実行環境等を「存在するはず」と仮定しない。

図版切り出しまたは決定論的検証を実行する前に必要能力を検査し、次の順で処理する。

```text
必要能力あり
  → 既存の決定論的スクリプトを使用

必要能力の一部なし
  ↓
同等結果を保証できる代替経路を検出
  ├─ 利用可能 → 代替経路を使用して結果を検証
  └─ 利用不可
       ├─ 当該能力が不要 → 続行
       └─ 当該能力が完成に必須 → blocked
```

AIによる画像生成、PDF紙面の再描画、未検証の推測結果を「代替経路」として扱わない。

### 4.7 WebMCP保存とReact表示を分離する

WebMCP層はReact componentを直接操作しない。

Repository保存成功後にApplication層からAI Import Eventを発行し、表示中のWorksheet一覧がイベントを購読してRepositoryを再読込する。

### 4.8 正式URL

すうがく仕立ての正式URLは `https://app.sujita.jp/` とする。

PluginとSkillは、開いているSite tools、利用者が明示したURL、自己テストURLを優先し、いずれもない場合に正式URLを使用する。開発・自己テストではlocalhostを利用できるが、ポート番号は固定しない。

### 4.9 v2.1のPlugin利用範囲は個人テストとする

v2.1ではportable Pluginを作成し、開発者本人のローカルMarketplaceへ追加してインストール・テストできることを必須とする。

第三者への配布、組織配布、公開Plugin Directoryへの提出・審査・公開は将来要件とする。

## 5. OpenAI製品面の前提

2026-09-11時点のOpenAI公式仕様を基準として、次を前提とする。

- 再利用可能なSkillの配布にはPluginを利用できる。
- portable Pluginはルートの `plugin.json` と `skills/` を持つ構成を利用できる。
- ChatGPTのSite toolsはWebMCPを利用して、開いているWebページがツールを提供できる。
- ChatGPTの内蔵ブラウザでは、ページのトップレベルJavaScriptから登録されたSite toolsをChatGPT Work/Codexが利用できる。
- WebMCPの利用可能モデル・プラン・ワークスペース・ロールアウト状況はOpenAI側で変更されうる。
- 2026-09-11時点ではWebMCP Site toolsに利用環境上の制限があるため、リリース時に公式仕様を再確認する。

これらはすうがく仕立ての永続仕様ではなく、外部プラットフォーム依存条件として扱う。

---

## 6. 全体構成

```text
利用者
  │
  ▼
ChatGPT
  │
  ├─ すうがく仕立て portable Plugin
  │    └─ sujita-textbook-import Skill
  │          ├─ PDF解析
  │          ├─ Draft生成
  │          ├─ 確認
  │          ├─ Builder
  │          └─ Validator
  │
  │ WebMCP Site tools
  ▼
すうがく仕立て
  ├─ WebMCP登録層
  ├─ AI Import Application Service
  ├─ MathWorksheetFileSchema
  ├─ hydrateBackup()
  ├─ WorksheetRepository
  └─ IndexedDB
```

外部MCPサーバー、AIバックエンド、OpenAI APIサーバーは置かない。

---

## 7. 対象範囲

### 7.1 初期リリース対象

1. 既存Skillをportable Pluginとしてパッケージできる。
2. Plugin内Skillとリポジトリ内Skillの内容が一致する。
3. 教科書PDFをChatGPTへ添付できる。
4. 開始ページ・開始問題を指定できる。
5. 終了ページ・終了問題を指定できる。
6. 例題・問題・小問を抽出できる。
7. 数式をすうがく仕立てで再編集可能なLaTeXへ変換できる。
8. 必要な図版を元PDFから切り出せる。
9. 教科書掲載解答を取得できる。
10. 教科書掲載解説を利用できる。
11. 「普通に・ていねいに・端的に」を指定できる。
12. 問題単位で採用・除外・修正できる。
13. 現revisionを利用者が明示確定するまで完成データを書き込まない。
14. WebMCP対応すうがく仕立ての能力情報を取得できる。
15. Skill側とすうがく仕立て側のSchema互換性を確認できる。
16. すうがく仕立て側で完成候補を再検証できる。
17. AI連携書込許可後だけIndexedDBへ新規プリントを保存できる。
18. 既存プリントをAI連携で上書きしない。
19. 保存後に新規Worksheet IDを返せる。
20. WebMCPが使えない場合に単一プリントJSONを生成できる。
21. WebMCP直接取込上限を超える場合にJSONへフォールバックできる。
22. インポート後は既存編集・保存・Undo/Redo・プレビュー・PDF出力を利用できる。

### 7.2 初期リリース対象外

- OpenAI API呼び出し
- APIキー登録
- 外部MCPサーバー
- すうがく仕立て独自AIバックエンド
- ChatGPTアカウント認証のすうがく仕立てへの組み込み
- クラウド同期
- 既存プリントのAIによる自動上書き
- AIによるプリント削除
- AIによるごみ箱操作
- AIによる任意IndexedDB操作
- AIによる任意JavaScript実行
- 教科書PDFのすうがく仕立て内永続保存
- 市販教科書PDFのリポジトリ格納
- AI画像による教科書図版の描き直し
- 類題生成
- 自動作問
- 誤答例生成
- 生徒別個別最適化
- WebMCP経由の巨大ファイル分割転送
- 専用図版ドラッグトリミングUI
- WebMCPが利用できない環境での無理な自動操作

---

## 8. Plugin要件

### 8.1 portable Plugin

Pluginはportable形式を採用する。

配布候補物:

```text
sujita-ai/
├─ plugin.json
└─ skills/
   └─ sujita-textbook-import/
      └─ <Skill一式>
```

### 8.2 Plugin名

推奨Plugin名を `sujita-ai` とする。

理由:

- 現在の教科書取込以外のSkillを将来追加できる。
- すうがく仕立て本体とAI連携パッケージを区別できる。
- Skill名 `sujita-textbook-import` を変更せずに済む。

### 8.3 Skill同期

Plugin内Skillは手作業で編集してはならない。

ビルド時に `AI/skills/sujita-textbook-import/` からコピーし、ファイル一覧とSHA-256を検証する。

### 8.4 v2.1のインストール・配布範囲

v2.1で必須とするのは、開発者本人がローカルMarketplaceへPluginを追加し、ChatGPTまたはCodexの対応画面からインストールして代表ケースをテストできることまでとする。

標準フロー:

```text
Skill正本
  ↓
plugin:build
  ↓
plugin:verify
  ↓
portable Pluginフォルダ
  ↓
開発者本人のローカルMarketplaceへ登録
  ↓
インストール
  ↓
新規会話で動作確認
```

次はv2.1対象外とする。

- 公開Plugin Directoryへの提出
- 公開審査対応
- 第三者向け自動更新
- GitHub経由の組織配布
- 一般利用者向けインストールサポート

portable形式自体は将来配布できる構造を維持する。

## 9. PDF入力要件

### 9.1 入力

必須入力形式はPDFとする。

### 9.2 PDF種類

- テキストレイヤーを持つPDF
- スキャンPDF

を対象とする。

### 9.3 暗号化PDF

Skill実行環境で読取不能な暗号化PDFは処理対象外とする。

### 9.4 外部送信の明示

PDF解析前に利用者へ次を説明する。

- PDFはすうがく仕立てではなくChatGPT側で解析される。
- すうがく仕立てのローカル保存経路とは異なる。
- 利用者自身がPDFの利用権限を確認する。
- 完成WorksheetにPDF本体を保存しない。

利用者確認前にPDF解析を開始しない。

---

## 10. 範囲指定要件

利用者は最低限次を指定できる。

- 開始紙面ページ
- 開始問題または開始例題ラベル
- 終了紙面ページ
- 終了問題または終了例題ラベル

PDF物理ページと紙面ページが異なる場合は両方を記録できる。

開始位置から終了位置までを包含範囲とし、指定範囲外の問題を完成Worksheetへ含めない。

解答探索のために範囲外ページを見ることは許可できるが、その本文を完成Worksheetへ混入させない。

---

## 11. 問題・例題・小問要件

教科書上の例題は既存 `ProblemBlock.kind = "example"` へ変換する。

通常問題は `ProblemBlock.kind = "problem"` へ変換する。

小問構造を安全に判定できる場合は既存小問構造へ変換する。

判定が不確実な場合は内容欠落を避け、Warningとして利用者へ提示する。

---

## 12. 数式要件

- 文章中の数式は原則 `inlineMath`。
- 独立行の数式は原則 `blockMath`。
- MathLiveで再編集できるLaTeXを生成する。
- 既存 `LatexStringSchema` の制約に適合させる。
- 禁止コマンドや長さ制限を無視しない。
- 符号、指数、分数、根号、添字、角度、図形記号等に不確実性がある場合はWarningを付ける。
- AIが意味を推測して式を勝手に変更しない。

---

## 13. 教科書解答要件

- 正答は教科書掲載解答を優先する。
- AIによる検算結果が異なる場合、教科書解答を自動上書きしない。
- 差異をWarningとして利用者へ提示する。
- 教科書解答を確認できない場合は「解答を確認できない」と明示する。
- 初期版では、教科書にないAI独自解答を完成データへ自動採用しない。

---

## 14. 例題解説要件

説明スタイルは次とする。

### `normal`

教科書解説を原則そのまま利用し、形式変換に必要な編集だけを行う。

### `detailed`

教科書の問題・解答・解説を根拠に、途中過程や理由を補足する。

### `concise`

教科書解説を根拠に説明量を減らし、必要な式・理由・結論を残す。

全モードで問題条件と最終正答を変更してはならない。

---

## 15. 図版要件

### 15.1 基本原則

- AI画像生成で描き直さない。
- 元PDFから切り出す。
- 不要な別問題や本文を含めない。
- 修正時も元PDFから再切り出す。
- 採用した図版だけをすうがく仕立て Assetへ含める。
- 図版候補は利用者が確認できるようにする。
- WebMCP直接取込上限を超える場合はJSONファイルへフォールバックする。

### 15.2 Skill Runtime Capability Probe

図版処理前に、現在のSkill実行環境が既存の決定論的crop経路を実行できるか確認する。

最低限確認対象:

- JavaScript/Node系スクリプトを実行できること
- Python実行環境
- `Pillow`
- `pypdf`
- `pdftoppm` / Poppler
- 入出力ファイルへアクセスできること

実装時の正確な必須バージョンは、現在のSkillスクリプトとCIで固定する。

### 15.3 自動フォールバック

既存crop経路を利用できない場合、Skillは同等の次条件を満たす代替経路を自動検出してよい。

- 元PDFページを直接レンダリングできる。
- 指定矩形を元PDF由来画像から切り出せる。
- AI画像生成または図の再描画を行わない。
- 別問題や範囲外本文を混入させない。
- 出力画像を利用者が確認できる。
- 既存Asset要件へ変換できる。

代替候補は、実行環境で実際に利用可能であることを確認してから使用する。特定ライブラリが「一般には存在する」という理由だけで利用可能と仮定してはならない。

### 15.4 代替不能時

代替経路も利用できない場合:

```text
採用問題に図版が不要
  → 図版処理をスキップして続行可能

採用問題に図版が必須
  → FIGURE_RUNTIME_UNAVAILABLE
  → 完成処理をblocked
```

必須図版を欠落させたWorksheetを完成品として提供してはならない。

### 15.5 初期版で行わないこと

WebMCP経由の画像分割アップロード、AI画像による再生成、PDF紙面の意味的再描画は実装しない。

## 16. 中間データ要件

AI解析結果を直接永続Schemaへ確定しない。

既存 `AiWorksheetDraft` を使用し、少なくとも次を保持する。

```text
AiWorksheetDraft
├─ revision
├─ confirmedRevision
├─ state
├─ source
├─ range
├─ explanationStyle
├─ items[]
│  ├─ sourcePage
│  ├─ sourceLabel
│  ├─ kind
│  ├─ problemContent
│  ├─ subQuestions
│  ├─ formulas
│  ├─ figures
│  ├─ textbookAnswer
│  ├─ textbookExplanation
│  ├─ finalExplanation
│  ├─ issues
│  └─ acceptance
└─ validationSummary
```

DraftはChatGPT/Skill側の作業形式であり、すうがく仕立ての永続データ正本にしない。

---

## 17. 確認・確定要件

### 17.1 自動確定禁止

PDF解析完了後に自動ですうがく仕立てへ書き込まない。

### 17.2 確認内容

問題ごとに最低限次を確認できるようにする。

- 採用 / 除外
- 例題 / 問題
- PDFページ
- 紙面ページ
- 元ラベル
- 問題文
- 数式
- 小問
- 図版
- 教科書解答
- 解説
- Warning
- Fatal

### 17.3 明示確定

「確定」「この内容ですうがく仕立てへ追加」「採用した問題で出力」等、完成データ生成意図が明確な発話のみ確定として扱う。

「進めて」「確認した」「よいと思う」等だけでは確定扱いにしない。

### 17.4 revision

確定後に内容を修正した場合は `revision` を増やし、以前の確定を無効にする。

`confirmedRevision === revision` の場合だけ完成候補を配送できる。

---

## 18. Skill完成ゲート

完成候補生成には最低限次のAND条件を要求する。

1. 利用権限確認済み
2. ChatGPT側処理への送信理解済み
3. 対象範囲解決済み
4. 採用項目1件以上
5. 未解決Fatal 0件
6. 全採用項目の確認済み
7. 保留項目0件
8. 採用図版の最終Crop確定済み
9. Warning提示済み
10. `confirmedRevision === revision`
11. 利用者が完成データ生成を明示

---

## 19. WebMCP能力確認要件

すうがく仕立ては次のSite toolを提供する。

```text
sujita_get_capabilities
```

最低限返す情報:

```json
{
  "app": "sujita",
  "integrationVersion": 1,
  "worksheetFormat": "math-worksheet",
  "worksheetFileVersion": 1,
  "schemaSha256": "...",
  "directImportAvailable": true,
  "maxDirectImportBytes": 2097152,
  "writeConsentGranted": false
}
```

`maxDirectImportBytes = 2 MiB` はすうがく仕立て初期実装で採用する保守的な設計値であり、OpenAI公式上限を意味しない。

---

## 20. Schema互換性要件

直接インポート前に、Skill同梱Schemaとすうがく仕立て側Schemaの互換性を確認する。

初期版ではSHA-256完全一致を要求する。

```text
一致
 → WebMCP直接取込可能

不一致
 → 直接取込禁止
 → JSONフォールバック
```

AIが「たぶん互換」と判断して無視してはならない。

---

## 21. WebMCP検証要件

Site tool:

```text
sujita_validate_import
```

は、完成JSON相当の `payloadText` を受け取り、保存せずに検証する。

処理:

1. WebMCP直接取込サイズ上限確認
2. JSON parse
3. `MathWorksheetFileSchema` parse
4. `kind === "single"` 確認
5. `hydrateBackup()` 実行
6. 画像データ検証
7. ID再採番
8. 検証済み候補をページメモリへ一時保存
9. SHA-256算出
10. `candidateToken` 発行

返却:

```json
{
  "valid": true,
  "candidateToken": "...",
  "payloadSha256": "...",
  "worksheetId": "...",
  "title": "...",
  "problemCount": 8,
  "assetCount": 2,
  "expiresAt": "..."
}
```

検証候補は永続保存しない。

---

## 22. AI連携書込許可要件

### 22.1 初期値

書込許可はOFF。

### 22.2 許可範囲

許可は現在のすうがく仕立てページセッションだけに限定する。

### 22.3 永続化

書込許可をIndexedDBやLocalStorageへ永続保存しない。

### 22.4 UI

WebMCP対応環境で、利用者が明示的にONへ変更できるUIを用意する。

### 22.5 拒否

許可OFF時に `sujita_import_worksheet` が呼ばれた場合、データを書き込まず `CONSENT_REQUIRED` 相当を返す。

---

## 23. WebMCP直接インポート要件

Site tool:

```text
sujita_import_worksheet
```

入力:

- `candidateToken`
- `requestId`
- `expectedPayloadSha256`

保存条件:

1. AI連携書込許可ON
2. candidateが存在
3. candidate未失効
4. SHA-256一致
5. candidate未消費
6. すうがく仕立て件数上限内
7. Repository保存可能

保存は必ず既存 `WorksheetRepository` を通す。

WebMCP登録コードからDexieテーブルへ直接 `put()` してはならない。

---

## 24. 冪等性要件

同じWebMCPインポート要求が再試行されても、同一ブラウザ/タブセッション内の通常再試行でプリントを重複作成しない。

`requestId` を必須とする。

### 24.1 確認順序

`sujita_import_worksheet` はcandidateより先にImport Receiptを確認する。

```text
requestId receipt確認
  ├─ completed
  │    → candidateが消えていても前回成功結果を返す
  │
  ├─ pending
  │    ↓
  │  receipt.worksheetId をRepositoryで確認
  │    ├─ 存在 → completedへ昇格して前回成功結果を返す
  │    └─ 不在
  │         → stale pendingとして整理
  │         → candidate確認へ進む
  │
  └─ receiptなし
       → candidate確認へ進む
```

### 24.2 pending後にcandidateが失われた場合

ページ再読込等によりcandidateが失われ、かつpending receiptのWorksheetがRepositoryにも存在しない場合は、`REVALIDATION_REQUIRED` を返してよい。

Skillは同じ完成payloadを再度 `sujita_validate_import` し、新しいcandidateを作った後、**同じrequestId** で再試行する。

payload SHA-256が以前のreceiptと一致しない場合は再試行せず `PAYLOAD_HASH_MISMATCH` とする。

### 24.3 Receipt保存

同一タブの再読込を考慮し、`sessionStorage` に最低限次を保持する。

```json
{
  "requestId": "...",
  "payloadSha256": "...",
  "worksheetId": "...",
  "title": "...",
  "status": "pending | completed"
}
```

### 24.4 保証範囲

v2.1で保証するのは、同一ブラウザ/タブセッションにおける通常再試行の重複防止である。

ブラウザセッション完全終了後までの厳密なExactly-once保証は対象外とする。

AI連携許可そのものは `sessionStorage` へ保存しない。

## 25. 直接取込後の要件

成功時に最低限次を返す。

```json
{
  "success": true,
  "worksheetId": "...",
  "title": "...",
  "editorPath": "/worksheets/<id>"
}
```

### 25.1 AI Import Event

Repositoryへの保存が成功し、completed receiptを確定した後、Application層から次のイベントを発行する。

概念:

```ts
type AiImportCompletedEvent = {
  type: "ai-import-completed";
  worksheetId: string;
  title: string;
  requestId: string;
};
```

イベントへ教科書本文、PDF、Base64 Asset、完成payload全文を含めない。

### 25.2 Worksheet一覧の同期

`WorksheetListScreen` が表示中の場合、`ai-import-completed` を受信したら既存の一覧ロード処理を再実行する。

期待動作:

```text
WebMCP import成功
  ↓
Repository保存
  ↓
completed receipt
  ↓
AI Import Event
  ↓
WorksheetListScreen
  ↓
repository.list()
  ↓
一覧更新 + Toast
```

WebMCP層からReactの`setState`を直接呼び出してはならない。

### 25.3 既存プリント保護

直接取込は必ず新規Worksheetとして作成し、既存プリントを上書きしない。

## 26. JSONフォールバック要件

次の場合は直接取込を断念し、既存単一プリントJSON方式を利用する。

- WebMCP非対応
- Site toolsが利用不可
- すうがく仕立てが開かれていない
- Schema hash不一致
- WebMCP直接取込サイズ超過
- WebMCP候補検証失敗
- Site tool呼び出し失敗
- 利用者が直接取込を望まない
- OpenAI側のロールアウト・モデル・プラン等によりSite toolsを使えない
- すうがく仕立て側が安全に直接取込できないと判断した

フォールバック時もSkill完成ゲートとValidatorを省略しない。

---

## 27. すうがく仕立て JSON要件

完成データの形式は既存単一プリント形式を維持する。

```json
{
  "format": "math-worksheet",
  "kind": "single",
  "version": 1,
  "exportedAt": "ISO 8601 datetime",
  "worksheet": {},
  "assets": []
}
```

`src/domain/worksheet/worksheet.schema.ts` を正本とする。

AI専用の永続フィールドを安易に追加しない。

---

## 28. 既存処理再利用要件

最低限次を再利用する。

- `MathWorksheetFileSchema`
- `hydrateBackup()`
- `WorksheetRepository.create()`
- 既存画像検証
- `createId()`
- 構造上限
- IndexedDBトランザクション
- 編集画面
- プレビュー
- PDF出力
- Undo / Redo
- JSONインポート / エクスポート

---

## 29. WebMCPで公開しない機能

初期版では次のSite toolを作らない。

- 任意JavaScript実行
- 任意URL fetch
- IndexedDB任意read/write
- 全プリント取得
- 教科書データ取得
- 既存プリント更新
- プリント削除
- ごみ箱操作
- バックアップ全件出力
- 任意ファイル読取
- OSファイル操作

最小権限とする。

---

## 30. セキュリティ・プライバシー要件

### 30.1 APIキー

APIキー入力欄を作らない。

APIキーをソース、LocalStorage、sessionStorage、IndexedDB、生成JSONへ保存しない。

### 30.2 入力不信頼

ChatGPTから渡されるWebMCP入力を信頼済みデータとして扱わない。

必ずサイズ・JSON・Schema・画像・構造制約をすうがく仕立て側で再検証する。

### 30.3 出力不信頼

Site toolの結果もAIが誤解する可能性を前提とし、成功・失敗・ID・件数等を機械可読な形で返す。

### 30.4 PDF

PDF本体をすうがく仕立てのIndexedDBへ保存しない。

### 30.5 既存データ保護

AI連携は新規プリント作成だけを許可する。

既存プリントへ直接変更を加えない。

---

## 31. エラー・警告要件

最低限次を区別する。

| コード例 | 種別 | 内容 |
|---|---|---|
| `WEBMCP_UNAVAILABLE` | Warning | Site toolsを利用できない |
| `SCHEMA_MISMATCH` | Warning | Skillとすうがく仕立てのSchemaが一致しない |
| `DIRECT_IMPORT_TOO_LARGE` | Warning | WebMCP直接取込上限超過 |
| `CONSENT_REQUIRED` | Recoverable | すうがく仕立て側書込許可が必要 |
| `CANDIDATE_EXPIRED` | Recoverable | 検証候補が失効 |
| `CANDIDATE_NOT_FOUND` | Recoverable | candidateTokenが無効 |
| `PAYLOAD_HASH_MISMATCH` | Fatal for direct import | 検証時と取込時のデータが一致しない |
| `INVALID_WORKSHEET_FILE` | Fatal | Schema不正 |
| `INVALID_ASSET` | Fatal | 画像不正 |
| `WORKSHEET_LIMIT_REACHED` | Recoverable | 保存件数上限 |
| `IMPORT_FAILED` | Recoverable/Fatal | 保存失敗 |

WebMCP直接取込失敗とSkillの数学的Fatalを混同しない。

WebMCP経路だけの失敗であればJSONフォールバックを検討する。

---

## 32. 性能要件

- WebMCP非対応時に通常起動性能を大きく悪化させない。
- WebMCPツール登録はアプリ起動後に軽量に実施する。
- PDF解析をすうがく仕立て側で行わない。
- WebMCP直接取込の初期上限を2 MiBとする。
- 通常JSONバックアップ上限は既存仕様を維持する。
- 画像検証は既存処理を再利用する。
- 同一候補に対する不要な再hydrateを避ける。

---

## 33. 可用性・障害耐性要件

WebMCPは追加機能であり、障害時に次を維持する。

- プリント一覧表示
- 新規作成
- 編集
- 保存
- PDF出力
- JSONバックアップ
- JSONインポート
- ごみ箱
- マニュアル

OpenAI側の機能変更ですうがく仕立て本体が起動不能になってはならない。

---

## 34. ブラウザ・保存領域要件

ChatGPT内蔵ブラウザは通常ブラウザと別プロファイルを利用する場合があるため、IndexedDBも別保存領域となり得る。

そのため利用者向けマニュアルに次を明示する。

- AI統合モードで保存したプリントは、そのすうがく仕立てを開いているブラウザプロファイルに保存される。
- 普段のChrome/Edgeと自動共有されるとは限らない。
- 必要に応じてJSONエクスポート/インポートで移動できる。

---

### 34.1 すうがく仕立て URL解決要件

正式URLを `https://app.sujita.jp/` とする。

直接連携時は次の優先順位で対象ページを解決する。

```text
1. 現在のChatGPTブラウザですうがく仕立てページが既に開いており、
   Site toolsを発見できる
      → そのページを使用

2. 利用者が今回のセッションですうがく仕立て URLを明示している
      → そのURLを開く

3. 開発・自己テスト手順からURLが与えられている
      → そのURLを開く

4. 上記でURLを解決できない
      → 正式URL https://app.sujita.jp/ を使用
```

開発時はVite等のローカル開発サーバーURLを利用できるが、ポート番号をSkillへ固定しない。

本番のdeployment originと許可originは `https://app.sujita.jp` とする。

## 35. UI要件

WebMCP対応時のみ、AI連携状態を表示する。

例:

```text
AI連携: OFF
AI連携: ON
```

許可ダイアログには最低限次を表示する。

- ChatGPTから新規プリントを追加できること
- 既存プリントは変更しないこと
- 許可は現在のページセッションだけであること
- PDF本体をすうがく仕立てへ保存しないこと
- 無効化方法

---

## 36. テスト要件

### 36.1 Skill

既存テストに加えて次を確認する。

- WebMCP経路を利用できる場合にSite toolsを使う。
- Schema不一致で直接取込しない。
- 明示確定前にimport toolを呼ばない。
- WebMCP失敗時にJSONへフォールバックできる。
- Runtime Capability Probeが依存関係の有無を正しく報告する。
- primary crop経路が利用不能な場合に、利用可能な代替経路へ切り替える。
- 代替経路もなく、必須図版がある場合にblockedとなる。
- 図版不要問題では図版runtime不足だけを理由に不必要にblockedにしない。
- 代替経路でも元PDF由来図版であることを維持する。

### 36.2 すうがく仕立て application

- 正常singleデータを候補化できる。
- archiveを拒否する。
- Schema不正を拒否する。
- 画像不正を拒否する。
- IDを再採番する。
- 既存プリントを上書きしない。
- 保存失敗時に候補を完成扱いにしない。
- 保存成功時にAI Import Eventを1回発行する。
- イベントに完成payloadやBase64画像を含めない。

### 36.3 WebMCP

- 非対応ブラウザで登録処理が無害。
- capabilitiesを返せる。
- サイズ超過を拒否する。
- validateでcandidateTokenを返す。
- 許可OFFでimportを拒否する。
- 許可ONでimportできる。
- candidate期限切れを拒否する。
- hash不一致を拒否する。
- **receiptをcandidateより先に確認する。**
- completed receiptがあればcandidate消失後でも成功結果を再構成できる。
- pending receiptかつRepositoryにWorksheetがあればcompletedへ回復できる。
- pending receiptかつRepositoryにWorksheetがなくcandidateも失われた場合、再検証を要求できる。
- 同じrequestIdの再試行で重複作成しない。

### 36.4 React表示同期

- 一覧表示中の直接import成功で自動再読込する。
- 新規Worksheetが一覧へ表示される。
- 成功Toastを表示できる。
- WebMCP非対応時にイベント機構が通常一覧へ悪影響を与えない。
- イベント受信解除が正しく行われる。

### 36.5 Pluginローカルテスト

- portable Pluginをbuildできる。
- verifyできる。
- 開発者本人のローカルMarketplaceへ登録できる。
- Pluginをインストールできる。
- 新規会話からSkillを起動できる。
- 代表PDFでJSONフォールバックを完走できる。
- 対応環境ではWebMCP直接取込を完走できる。

公開Plugin Directoryへの提出テストはv2.1の受け入れ条件にしない。

### 36.6 E2E

- ChatGPTを模したWebMCP呼び出しでプリント追加まで通る。
- 追加後にイベント経由で一覧へ表示される。
- 編集画面を開ける。
- 保存・再読込できる。
- PDF出力できる。
- JSON再エクスポートできる。
- same requestIdを再送しても一覧件数が増えない。

実際のChatGPTまたは公開Plugin DirectoryをCIへ必須依存させない。

## 37. 受け入れ条件

1. OpenAI APIを使わない。
2. APIキー入力を要求しない。
3. 既存Skillをportable Pluginへパッケージできる。
4. Plugin内Skillが正本Skillと一致する。
5. 開発者本人のローカルMarketplaceへPluginを登録・インストールしてテストできる。
6. 公開Plugin Directoryへの提出をv2.1完成条件としない。
7. Skill実行前または必要処理前にRuntime Capability Probeを実施できる。
8. primary図版crop依存関係が不足した場合、利用可能な同等代替経路を自動選択できる。
9. 代替経路もなく必須図版がある場合、不完全な完成品を生成せずblockedにできる。
10. WebMCP非対応でもすうがく仕立て本体が動作する。
11. WebMCP対応時にcapabilitiesを公開できる。
12. 本番URL未指定時に正式URL `https://app.sujita.jp/` を解決できる。
13. 不正な明示URLは拒否し、安全に停止またはJSONへフォールバックできる。
14. Schema hashを比較できる。
15. 不一致時に直接取込しない。
16. 完成候補をすうがく仕立て側Schemaで再検証できる。
17. 画像を既存検証処理で確認できる。
18. 利用者の明示確定前に書き込まない。
19. すうがく仕立て側書込許可OFFでは書き込まない。
20. 許可ONで新規プリントを保存できる。
21. 既存プリントを上書きしない。
22. 保存にはRepositoryを使用する。
23. WebMCP層からDexieへ直接書かない。
24. import時はcandidate確認より先にrequestId receiptを確認する。
25. completed receiptからcandidate消失後でも成功済み結果を返せる。
26. pending receiptとRepositoryを照合してクラッシュ/再読込直後の状態を回復できる。
27. 同一requestIdの通常再試行で二重保存しない。
28. 保存成功後にAI Import Eventを発行できる。
29. Worksheet一覧がイベントを受信してRepositoryを再読込できる。
30. WebMCP層がReact stateを直接変更しない。
31. 直接取込容量超過時にJSONへフォールバックする。
32. WebMCP利用不可時にJSONへフォールバックする。
33. インポート後に既存編集機能を利用できる。
34. PDF本体をすうがく仕立てへ永続保存しない。
35. AI利用量をすうがく仕立て開発者のAPI課金へ集約しない。
36. AIによる新規作問を初期版に含めない。
37. 教科書掲載解答をAI独自解答で上書きしない。
38. 図版をAI画像で置換しない。

## 38. 段階導入

### Phase 1: portable Plugin自己テスト

- `plugin.json`
- build
- verify
- Skill同期
- Runtime Capability Probe
- 開発者本人のローカルMarketplace登録
- Plugin install / uninstall
- 新規会話でSkill起動確認

### Phase 2: WebMCP read/validate

- capabilities
- validate
- Schema hash
- candidate store
- URL解決規則
- UI表示

### Phase 3: WebMCP direct import

- 書込許可
- import tool
- receipt先行のrequestId冪等性
- AI Import Event
- Worksheet一覧再同期
- Toast

### Phase 4: Skill配送統合

- SkillのWebMCP配送規則
- runtime fallback
- JSONフォールバック
- manuals
- E2E

### Phase 5: 将来の公開準備

v2.1完成後、必要になった時点で別要件として次を検討する。

- 第三者配布
- Plugin Directory提出
- 公開審査
- 更新ポリシー
- 組織配布

## 39. 将来機能

- 類題生成
- 問題数指定作問
- 難易度指定
- 単元指定
- 定期テスト生成
- ヒント
- 誤答例
- 学習指導要領対応
- 図版crop座標だけを転送しすうがく仕立て側で元PDFから切り出す方式
- WebMCPの大容量データ転送方式が安定した場合の直接取込上限拡大
- 複数Skillを `sujita-ai` Pluginへ追加
- Pluginの第三者配布
- Plugin Directoryへの提出・公開
- 組織向けPlugin配布・管理
- ブラウザセッション終了後まで保証する永続的な冪等性

将来機能は本要件の受け入れ条件に含めない。

## 40. 設計上の最重要原則

1. 教科書の数学的内容を勝手に変更しない。
2. 教科書掲載解答を優先する。
3. AI結果は利用者確認後だけ確定する。
4. すうがく仕立て既存Schemaを正本とする。
5. AI入力をすうがく仕立て側でも再検証する。
6. WebMCPへ最小権限しか公開しない。
7. WebMCPをすうがく仕立ての必須依存にしない。
8. OpenAI APIとAPIキーを必要としない。
9. Skillの正本を一つに保つ。
10. 直接取込に失敗してもJSON経路を残す。

---

## 41. 参考資料

- すうがく仕立て Repository
  https://github.com/drthomas246/math_editor
- すうがく仕立て Worksheet Schema
  https://github.com/drthomas246/math_editor/blob/master/src/domain/worksheet/worksheet.schema.ts
- すうがく仕立て backup implementation
  https://github.com/drthomas246/math_editor/blob/master/src/application/backup/backup.ts
- OpenAI: Build plugins / local Marketplace  
  https://learn.chatgpt.com/docs/build-plugins
- OpenAI: Build skills  
  https://learn.chatgpt.com/docs/build-skills
- OpenAI: Site tools (WebMCP)  
  https://learn.chatgpt.com/docs/webmcp
- OpenAI: Browser  
  https://learn.chatgpt.com/docs/browser
- OpenAI: ChatGPT / API billing separation  
  https://help.openai.com/en/articles/9039756-managing-billing-settings-on-the-chatgpt-web-and-api-platform

---

## 42. 要点

本AI機能は、利用者自身のChatGPT上で既存 `sujita-textbook-import` Skillを実行し、portable Pluginとしてパッケージする。v2.1では開発者本人のローカルMarketplaceでのインストール・自己テストまでを配布範囲とし、一般公開は行わない。

Skill実行環境は外部コマンドやPythonモジュールの存在を仮定せず、Runtime Capability Probeを行う。既存の図版crop経路が利用できない場合は元PDF由来の同等結果を保証できる代替経路を自動検出し、それも利用できず採用問題に図版が必須であれば完成処理を停止する。

WebMCP対応環境では、すうがく仕立てが提供するSite toolsを使って能力確認、Schema整合確認、候補検証、直接インポートを行う。インポート再試行ではcandidateより先にImport Receiptを確認し、同一タブ/ブラウザセッション内の通常再試行で重複保存を防ぐ。

Repository保存成功後はApplication層のAI Import Eventを発行し、Worksheet一覧がRepositoryを再読込して画面を同期する。WebMCP層からReact stateを直接操作しない。

すうがく仕立ての正式URLは `https://app.sujita.jp/` とする。自己テストでは実行時に指定されたlocalhost等のURLを優先できる。

OpenAI API、APIキー、外部MCPサーバーは使用しない。WebMCPが利用できない、Schemaが一致しない、データが大きすぎる等の場合は、従来の単一プリントJSONへフォールバックする。
