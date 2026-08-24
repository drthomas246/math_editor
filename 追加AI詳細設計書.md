# 数学プリント作成ソフト 追加AI詳細設計書

## 1. 文書情報

| 項目 | 内容 |
|---|---|
| 文書名 | 数学プリント作成ソフト 追加AI詳細設計書 |
| 文書版 | 1.0 |
| 基準日 | 2026-08-24 |
| 対象システム | `drthomas246/math_editor` |
| 対象機能 | 教科書PDFからMath Editor単一プリントJSONを作成するAI支援機能 |
| 初期実行方式 | Math Editor Skill |
| ChatGPT Work配布方式 | App / MCPを持たないSkill-only Plugin |
| 将来実行方式 | 同一PluginへMath Editor App / MCP連携を追加 |
| OpenAI API | 使用しない |
| Math Editor Schema版 | 1 |
| Math Editorファイル形式 | `math-worksheet` / `kind: "single"` / `version: 1` |
| 基準コミット | `78aa980c4e43deece17ade866258d35154aae17d` |
| 基準JSON Schema SHA-256 | `83944CCE31048241FE159CC42A14075834B541214DE592BF6B91C12127A2E6DA` |

本書は、`追加AI要件定義書.md`を実装可能な粒度へ具体化する。AIの判断規則、確認フロー、中間データ、Math Editor Worksheetへの変換、図版処理、単一バックアップ生成、Schema検証、Skillパッケージ、テストおよび保守手順を定義する。

### 1.1 参照資料と優先順位

設計・実装・検証で矛盾が生じた場合は、次の優先順位を適用する。

1. 永続データの構造と相関制約は`src/domain/worksheet/worksheet.schema.ts`を正本とする。
2. 単一プリントJSONの生成意味論は`src/application/backup/backup.ts`の`createSingleBackup()`を正本とする。
3. 既定値は`src/domain/worksheet/worksheet.defaults.ts`を正本とする。
4. 構造上限は`src/domain/worksheet/structure-limits.ts`を正本とする。
5. AI機能の業務要件と受け入れ条件は`追加AI要件定義書.md`を正本とする。
6. 既存Math Editorの画面・保存・インポート動作は現行`src/`実装を正本とする。
7. Skill / Pluginの利用可能面とパッケージ仕様は実装・公開時点のOpenAI公式ドキュメントを正本とする。
8. 本書と上記正本が異なる場合は正本を優先し、本書およびSkillパッケージを更新する。

`schemas/math-worksheet.schema.json`は`MathWorksheetFileSchema`から生成される参照用成果物であり、直接編集しない。生成JSON SchemaだけではZodの`superRefine`による全制約を表現できないため、最終検証をJSON Schema検証だけで完了扱いにしてはならない。

### 1.2 OpenAI製品面に関する前提

2026-08-24時点のOpenAI公式ドキュメントでは、Skillは`SKILL.md`、参照資料、任意スクリプトおよびAssetを含められる。単体SkillはChatGPTデスクトップ、Codex CLI、IDE拡張で利用でき、ChatGPTのChat / Workへ配布するSkillはPluginへ内包できる。

このため、初期リリースは次の2形態を同一Skillソースから生成する。

- 開発・ローカル評価：リポジトリスコープの単体Skill
- ChatGPT Work利用：App / MCPを含まないSkill-only Plugin

Skill-only Plugin化はMath Editorへの直接接続を意味しない。初期版の出力は引き続きJSONファイルであり、OpenAI APIキー、Math Editor API、外部MCPサーバーを必要としない。

参考：

- https://learn.chatgpt.com/docs/build-skills
- https://developers.openai.com/plugins/concepts/skills
- https://developers.openai.com/plugins/build/plugins

### 1.3 用語

| 用語 | 定義 |
|---|---|
| PDFページ番号 | PDFファイル先頭を1とする物理ページ番号 |
| 紙面ページ表記 | 教科書紙面に印刷された`148`、`p.148`等の表示 |
| 対象範囲 | 開始ページ・開始ラベルから終了ページ・終了ラベルまでの包含範囲 |
| Draft | 利用者確認前後の中間データ`AiWorksheetDraft` |
| 項目 | 例題または通常問題1件を表すDraft要素 |
| 問題色 | 問題のみ表示でも見える内容 |
| 解答色 | `answerColor`を持ち、解答付き表示で見える内容 |
| 教師用解説 | `ProblemBlock.solution`または`SubQuestion.solution`へ格納する内容 |
| Fatal | 解消するまで最終JSONを生成できないエラー |
| Warning | 利用者確認により採用可能な不確実性 |

---

## 2. 目的と設計範囲

### 2.1 目的

利用者が利用権限を持つ教科書PDFから、指定範囲の例題・問題・小問・数式・図版・教科書解答・教科書解説を抽出し、利用者確認後にMath Editorで再編集可能な単一プリントJSONへ変換する。

AIは変換・編集支援者であり、数学的内容、問題条件、教科書正答の最終決定者ではない。認識不確実性はDraftへ残し、利用者が明示的に確定するまで完成JSONを生成しない。

### 2.2 初期版の成果物

初期版の成果物は次の1ファイルとする。

```text
<worksheet-title>_YYYYMMDD-HHmm.json
```

内容は次の単一バックアップ形式である。

```ts
type MathWorksheetSingleFile = {
  format: "math-worksheet";
  kind: "single";
  version: 1;
  exportedAt: string;
  worksheet: Worksheet;
  assets: BackupAsset[];
};
```

### 2.3 対象外

- AIによる新規問題、類題、誤答例またはヒントの自動生成
- 教科書解答がない問題へのAI独自解答の自動採用
- Math Editorへの直接書き込み
- Math Editor本体からChatGPTまたはOpenAI APIを呼び出す処理
- OpenAI APIキーの登録、保存または利用
- 教科書PDF本体のMath Editor JSONへの格納
- AI画像生成または教科書図版の描き直し
- 専用ドラッグ式トリミングUI
- 教科書ライブラリ、共有、全文検索、複数教科書横断検索
- Skill実行環境の利用可能量、処理時間またはモデル精度の保証

---

## 3. 設計上の主要決定

| ID | 決定 |
|---|---|
| ADR-AI-001 | ChatGPT Work向け初期配布はSkill-only Pluginとし、App / MCP連携は含めない。 |
| ADR-AI-002 | Skill本体とPlugin内Skillを別実装にせず、同一ソースからパッケージする。 |
| ADR-AI-003 | 最終データの正本は`MathWorksheetFileSchema`、生成意味論の正本は`createSingleBackup()`とする。 |
| ADR-AI-004 | 生成JSON Schemaは参照・構造検証に使うが、完成判定にはZod相当の相関検証を必須とする。 |
| ADR-AI-005 | AI認識結果は`AiWorksheetDraft`へ保存し、Draftから直接Math Editor永続Schemaを確定しない。 |
| ADR-AI-006 | 解答は現行エディタの正規形に合わせ、問題本文AST内のノードへ`answerColor`を付与する。互換用`answerDocument` / `answerContent`には空文書を設定する。 |
| ADR-AI-007 | 教師用解説は解答色本文へ混在させず、`solution`へ格納する。 |
| ADR-AI-008 | 図版切り出し座標は回転補正後ページの左上原点・正規化座標で保持し、再切り出しは常に元PDFから行う。 |
| ADR-AI-009 | 利用者の明示的確定、Fatal 0件、最終Schema検証成功の3条件を完成JSON生成ゲートとする。 |
| ADR-AI-010 | Skillは指定範囲外の問題を出力しない。範囲外ページは教科書解答の探索にのみ参照できる。 |

---

## 4. 全体構成

### 4.1 初期構成

```text
ChatGPT / Codex実行環境
├─ Math Editor Skill
│  ├─ PDF解析と範囲解決
│  ├─ 問題・数式・図版・解答・解説の認識
│  ├─ AiWorksheetDraft生成
│  ├─ 確認・修正・確定制御
│  └─ 決定論的スクリプト呼出し
│     ├─ PDF図版切り出し
│     ├─ Worksheet組立て
│     └─ MathWorksheetFileSchema相当検証
└─ 利用者
   ├─ 教科書PDFを添付
   ├─ 範囲・説明スタイルを指定
   ├─ 抽出結果を確認・修正
   ├─ 明示的に確定
   └─ 生成JSONをMath Editorへ手動インポート
```

Math Editor SPA側にはAI処理、ChatGPT起動、OpenAI API呼出し、教科書PDF保存を追加しない。

### 4.2 責務分離

| 構成要素 | 責務 | 禁止事項 |
|---|---|---|
| Skill指示 | 会話フロー、判断基準、確認ゲート、参照ファイルのルーティング | Schema相関検証を文章判断だけで完了すること |
| AIモデル | 紙面理解、問題境界認識、数式転記、説明量調整、不確実性抽出 | 教科書正答の自動上書き、未確認の確定 |
| 図版スクリプト | 元PDFからの決定論的レンダリングと切り出し | 生成画像による置換、切り出し済み画像の再切り出し |
| Builder | ID生成、既定値適用、Worksheet / Asset / envelope組立て | Schema外フィールドの追加 |
| Validator | 構造・相関・上限・Asset整合性の検証 | 警告を自動承認すること |
| Math Editor | JSON再検証、ID再採番、IndexedDB保存、編集、プレビュー、PDF出力 | 教科書PDF本体の保存 |

### 4.3 Plugin移行可能性

将来App / MCPを追加する場合も、教科書解析、Draft、変換、確認ゲートは変更しない。App / MCPは次だけを担当する。

- Math Editorとの認証済みデータ受け渡し
- サーバーまたはMath Editor実装によるSchema検証
- 専用確認UIと図版矩形編集
- 利用者承認後の直接インポート

---

## 5. Skillパッケージ設計

### 5.1 ソース構成

```text
.agents/
└─ skills/
   └─ math-editor-textbook-import/
      ├─ SKILL.md
      ├─ agents/
      │  └─ openai.yaml
      ├─ references/
      │  ├─ workflow-and-confirmation.md
      │  ├─ ai-worksheet-draft.md
      │  ├─ worksheet-mapping.md
      │  ├─ textbook-analysis-rules.md
      │  ├─ math-conversion-rules.md
      │  ├─ explanation-style-rules.md
      │  ├─ figure-cropping-rules.md
      │  ├─ validation-rules.md
      │  └─ error-catalog.md
      ├─ schemas/
      │  ├─ math-worksheet.schema.json
      │  └─ schema-manifest.json
      └─ scripts/
         ├─ crop_pdf_figure.py
         ├─ build_math_worksheet_file.mjs
         └─ validate_math_worksheet.mjs
```

初期Plugin配布物は上記Skillディレクトリを次へ機械的にコピーして生成する。

```text
math-editor-textbook-import-plugin/
├─ .codex-plugin/
│  └─ plugin.json
└─ skills/
   └─ math-editor-textbook-import/
      └─ <単体Skillと同一内容>
```

Plugin内のSkillを手作業で個別編集してはならない。パッケージ時にコピーし、内容ハッシュ一致を検証する。

### 5.2 `SKILL.md`

`SKILL.md`は短い入口とし、次だけを保持する。

- Skillの目的と起動条件
- 対象外条件
- 必須入力の取得順
- PDF外部送信と利用権限の確認
- 状態遷移の概要
- 確認前に最終JSONを生成しない絶対条件
- 作業段階ごとに読むreferenceのルーティング
- Builder / Validator / Cropperを呼ぶ条件
- Fatal時の停止条件

詳細Schema、長い変換規則、エラー一覧、サンプルJSONは`SKILL.md`へ重複させない。

推奨frontmatterは次のとおり。

```yaml
---
name: math-editor-textbook-import
description: 教科書PDFの指定範囲から例題・問題・数式・図版・教科書解答・解説を抽出し、確認後にMath Editor用の単一プリントJSONを作る。新規作問、一般的なPDF要約、Math Editor以外の教材生成には使わない。
---
```

### 5.3 `agents/openai.yaml`

UIメタデータはSkill実装時点で生成する。暗黙起動は既定どおり許可し、`description`の対象境界で誤起動を防ぐ。次は必須としない。

- ブランドアイコン
- ブランド色
- MCP依存
- 外部接続依存

Skillが教科書PDFを処理すること自体を理由に暗黙起動を無効化しない。PDF処理開始前に利用者確認を置く。

### 5.4 `references/`

| ファイル | 読込条件 | 内容 |
|---|---|---|
| `workflow-and-confirmation.md` | 毎回 | 状態遷移、確認表示、確定語、修正ループ |
| `ai-worksheet-draft.md` | Draft生成・更新時 | Draft型、列挙値、不変条件 |
| `worksheet-mapping.md` | Worksheet変換時 | 現行Schemaへのフィールドマッピング、既定値 |
| `textbook-analysis-rules.md` | PDF解析時 | ページ、範囲、問題境界、例題・小問、解答探索 |
| `math-conversion-rules.md` | 数式を含む場合 | LaTeX、inline / block、禁止コマンド、不確実性 |
| `explanation-style-rules.md` | 例題を含む場合 | 普通・ていねい・端的の変換規則 |
| `figure-cropping-rules.md` | 図版を含む場合 | 座標、レンダリング、再切り出し、Asset化 |
| `validation-rules.md` | Draft検証・最終生成時 | Schema、相関制約、上限、完成ゲート |
| `error-catalog.md` | エラー・警告発生時 | コード、severity、利用者表示、復旧方法 |

### 5.5 `schemas/`

`math-worksheet.schema.json`はリポジトリの`npm run schema:generate`で生成されたファイルをそのままコピーする。

`schema-manifest.json`は最低限次を持つ。

```json
{
  "format": "math-worksheet",
  "schemaVersion": 1,
  "source": "src/domain/worksheet/worksheet.schema.ts",
  "generatedSchema": "schemas/math-worksheet.schema.json",
  "sourceCommit": "<git commit>",
  "sha256": "<math-worksheet.schema.json SHA-256>",
  "generatedAt": "<ISO 8601>"
}
```

このmanifestは保守・差分検知用であり、Math Editor JSONへ含めない。

### 5.6 `scripts/`

スクリプトはAIの文章判断を置き換えず、同じ入力から同じ構造を得る必要がある処理を担当する。

- `crop_pdf_figure.py`：元PDF、ページ番号、正規化矩形から画像を生成する。
- `build_math_worksheet_file.mjs`：確定Draftから単一プリントファイル候補を組み立てる。
- `validate_math_worksheet.mjs`：`MathWorksheetFileSchema`と同等の構造・相関検証を行う。

`validate_math_worksheet.mjs`は`worksheet.schema.ts`とZodを単一実行成果物へbundleした生成物とし、手書きでSchemaを再実装しない。実行環境で追加の`npm install`を必要としない形を目標とする。

---

## 6. 実行フローと状態設計

### 6.1 状態

```ts
type DraftState =
  | "collecting-input"
  | "analyzing"
  | "review-required"
  | "confirmed"
  | "building"
  | "completed"
  | "blocked";
```

| 状態 | 意味 | 許可する主要操作 |
|---|---|---|
| `collecting-input` | PDFまたは必須条件が不足 | 入力依頼、PDF利用説明 |
| `analyzing` | PDF解析とDraft構築中 | 解析、警告登録 |
| `review-required` | 確認結果を提示済み | 採用・除外・修正、再切り出し |
| `confirmed` | 利用者が現Draftを明示確定 | Builder起動 |
| `building` | JSON組立て・検証中 | Builder / Validator実行 |
| `completed` | 検証済みJSONを提供済み | 完了報告 |
| `blocked` | Fatalにより進行不能 | 原因説明、修正入力受付 |

### 6.2 状態遷移

```text
collecting-input
      ↓ 必須入力が揃う
analyzing
      ↓ Draft生成
review-required ←──────────────┐
      │ 修正・採否変更           │
      └────────────────────────┘
      ↓ 利用者が明示確定
confirmed
      ↓
building
  ├─ 検証成功 → completed
  ├─ 修正可能 → review-required
  └─ 継続不能 → blocked
```

確定後に利用者が内容修正を指示した場合、確定を取り消して`review-required`へ戻す。古い確定を新しいDraftへ引き継がない。

### 6.3 明示的確定

次のように完成JSON生成の意図が明確な発話だけを確定として扱う。

- 「確定」
- 「この内容でJSONを作成」
- 「採用した問題で出力」

「よいと思う」「進めて」「確認した」等、完成JSON生成を一意に示さない表現は確認を求める。Skillが利用者の代わりに`confirmed`へ遷移してはならない。

### 6.4 完成ゲート

Builderを起動できる条件は次のAND条件とする。

1. `draft.state === "confirmed"`
2. 利用権限確認とChatGPT送信理解が記録されている。
3. 開始位置と終了位置が一意に解決されている。
4. 採用項目が1件以上ある。
5. 未解決Fatalが0件である。
6. 全採用項目の採否が`accepted`である。
7. 図版を持つ全採用項目で最終Cropが選択されている。
8. 教科書解答が見つからない項目は、その状態が利用者へ表示済みである。
9. 確定後にDraft内容が変更されていない。

---

## 7. 入力・セッション設計

### 7.1 必須入力

| 入力 | 必須 | 検証 |
|---|---:|---|
| 教科書PDF | 必須 | 読取可能、暗号化で処理不能でない |
| 開始ページ | 必須 | PDFページ番号または紙面ページ表記として解決可能 |
| 開始問題・例題ラベル | 必須 | 開始ページ上の候補と対応 |
| 終了ページ | 必須 | 開始以後、存在するページ |
| 終了問題・例題ラベル | 必須 | 終了ページ上の候補と対応 |
| 説明スタイル | 任意 | `normal` / `detailed` / `concise`、既定`normal` |
| Worksheet題名 | 任意 | 1～100文字、空白以外を含む |

### 7.2 権利・送信確認

解析開始前に次を1回提示し、利用者の確認を得る。

- PDFと必要な内容がChatGPTへ送信されること。
- Math Editor本体のローカル保存とは処理経路が異なること。
- 利用者が入力PDFの利用権限を確認すること。
- Skillは利用許諾取得を代行しないこと。
- 最終JSONには採用内容と採用図版だけを含み、PDF本体を含めないこと。

同一会話内でPDFが差し替えられた場合は、確認状態を引き継がず再確認する。

### 7.3 ページ指定の曖昧性

`p.148`がPDF物理ページ148を意味するか、紙面ページ表記148を意味するかを自動決めできない場合は確認する。

Draftでは次を分離する。

- `pdfPageNumber`：1始まりの物理ページ番号
- `printedPageLabel`：紙面に印刷された任意文字列

最終的な範囲処理は`pdfPageNumber`で行う。利用者向け表示には両方を示す。

### 7.4 セッション内データ

次はセッション内だけで保持し、最終JSONへ含めない。

- 教科書PDF本体
- 指定範囲外のページ画像・抽出テキスト
- Crop候補と棄却Crop
- OCR中間結果
- 認識信頼度の内部値
- 利用者の権利確認記録
- Draftの出典メタデータ

---

## 8. `AiWorksheetDraft`詳細設計

### 8.1 トップレベル

```ts
type AiWorksheetDraft = {
  draftVersion: 1;
  draftId: string;
  revision: number;
  state: DraftState;
  source: DraftSource;
  range: DraftRange;
  options: DraftWorksheetOptions;
  explanationStyle: "normal" | "detailed" | "concise";
  items: DraftItem[];
  issues: DraftIssue[];
  confirmation: DraftConfirmation;
  validationSummary: DraftValidationSummary;
};
```

`AiWorksheetDraft`はSkill内部形式であり、Math Editorへインポートせず、`worksheet`配下にも埋め込まない。

### 8.2 Source

```ts
type DraftSource = {
  sourceFileName: string;
  pdfPageCount: number;
  pdfKind: "text" | "scan" | "mixed" | "unknown";
  rightsConfirmed: boolean;
  externalProcessingAcknowledged: boolean;
};
```

PDFハッシュを計算できる場合はセッション内の差し替え検知に利用できるが、最終JSONへ保存しない。

### 8.3 Range

```ts
type DraftRangeEndpoint = {
  requestedPage: string;
  requestedLabel: string;
  pdfPageNumber: number | null;
  printedPageLabel: string | null;
  resolvedItemKey: string | null;
};

type DraftRange = {
  start: DraftRangeEndpoint;
  end: DraftRangeEndpoint;
  status: "unresolved" | "resolved" | "ambiguous" | "invalid";
};
```

`resolvedItemKey`はページ内掲載順を含むDraft内部キーとする。開始と終了は包含する。

### 8.4 Worksheet options

```ts
type DraftWorksheetOptions = {
  title: string;
  pageSettings: {
    size: "B5";
    orientation: "portrait";
    margin: "normal";
    fontFamily: "biz-udp-gothic";
    problemNumberFormat: "dot";
    subQuestionNumberFormat: "paren";
  };
  header: {
    gradeField: true;
    classField: true;
    numberField: true;
    nameField: true;
    firstPageOnly: true;
  };
};
```

既定値は`createWorksheet()`と一致させる。題名を指定しない場合は`無題のプリント`とする。`header.title`はDraftへ重複保存せず、Builderが必ず`options.title`を設定する。

### 8.5 Item

```ts
type DraftItem = {
  itemKey: string;
  order: number;
  source: {
    pdfPageNumber: number;
    printedPageLabel: string | null;
    sourceLabel: string;
    sourceBounds: NormalizedBounds | null;
  };
  kind: "problem" | "example";
  reviewDecision: "pending" | "accepted" | "excluded";
  recognitionStatus: "resolved" | "needs-review" | "blocked";
  problemDocument: BasicRichTextDocument;
  subQuestionGroup: DraftSubQuestionGroup | null;
  textbookAnswer: DraftSourceContent;
  textbookExplanation: DraftSourceContent;
  finalExplanation: SolutionRichTextDocument | null;
  figures: DraftFigure[];
  issueIds: string[];
};
```

問題本文と小問構造を二重に保持しない。`subQuestionGroup !== null`の場合、共通指示だけを`problemDocument`へ置き、小問本文は`subQuestionGroup.items`へ置く。

### 8.6 小問

```ts
type DraftSubQuestionGroup = {
  format: "paren" | "dot" | "circled" | "kana";
  columns: 1 | 2;
  items: Array<{
    itemKey: string;
    sourceLabel: string;
    content: BasicRichTextDocument;
    answerContent: BasicRichTextDocument;
    solution: SolutionRichTextDocument | null;
    width: "column" | "full";
    issueIds: string[];
  }>;
};
```

列数は次で決定する。

- 短い式・選択肢等で2列でも意味と可読性が保てる：`2`
- 長文、独立数式、図版、表を含む：`1`

個別の`width`は原則`column`とし、その小問だけ長い場合は`full`とする。

### 8.7 出典内容

```ts
type DraftSourceContent = {
  status: "found" | "not-found" | "ambiguous" | "not-applicable";
  sourcePdfPageNumber: number | null;
  sourceLabel: string | null;
  document: BasicRichTextDocument | null;
  verification: "not-run" | "consistent" | "mismatch" | "not-applicable";
};
```

教科書解答とAI検算が異なる場合も`document`は教科書内容を保持し、`verification: "mismatch"`とIssueを登録する。AI計算結果を`document`へ代入しない。

小問を持つ項目では、`textbookAnswer.document`を教科書解答全体の出典記録として保持し、各小問へ対応付けできた部分を`DraftSubQuestionGroup.items[].answerContent`へ分配する。対応付けが曖昧な小問は解答を空のままにしてIssueを付ける。

### 8.8 Figure

```ts
type NormalizedBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

type DraftFigure = {
  figureKey: string;
  sourcePdfPageNumber: number;
  purpose: "problem" | "answer" | "explanation";
  bounds: NormalizedBounds;
  rotationApplied: 0 | 90 | 180 | 270;
  cropRevision: number;
  output: {
    storageKey: string;
    mimeType: "image/png" | "image/jpeg" | "image/webp";
    fileName: string;
    width: number;
    height: number;
    byteLength: number;
    sha256: string;
  } | null;
  placement: "block" | "floatLeft" | "floatRight";
  widthPercent: 25 | 33 | 50 | 66 | 75 | 100;
  alt: string;
  accepted: boolean;
  issueIds: string[];
};
```

座標不変条件は次のとおり。

```text
0 <= left < right <= 1
0 <= top < bottom <= 1
```

`storageKey`は実行セッション内の画像ファイルを指す不透明キーとする。大きなBase64文字列をDraft本文へ保持せず、Builderが最終Cropファイルを読み込んで`BackupAsset.dataBase64`へ変換する。

### 8.9 Issue

```ts
type DraftIssue = {
  issueId: string;
  code: string;
  severity: "warning" | "fatal";
  itemKey: string | null;
  sourcePdfPageNumber: number | null;
  path: string | null;
  message: string;
  resolution: "unresolved" | "acknowledged" | "resolved";
};
```

`path`はDraftまたは最終JSON内のJSON Pointer形式を使用する。Warningの`acknowledged`は利用者が内容を見たことを表し、認識が正しいことを自動保証しない。

### 8.10 Confirmationと検証集計

```ts
type DraftConfirmation = {
  status: "not-confirmed" | "confirmed";
  confirmedRevision: number | null;
  confirmedAt: string | null;
};

type DraftValidationSummary = {
  acceptedItems: number;
  excludedItems: number;
  pendingItems: number;
  warningCount: number;
  fatalCount: number;
  lastValidatedRevision: number | null;
};
```

Draftを変更するたびに`revision`を1増やし、`confirmation`を未確定へ戻す。`confirmedRevision !== revision`のDraftから最終JSONを生成してはならない。

---

## 9. PDF解析設計

### 9.1 受付

1. PDFファイルの存在とMIME / 拡張子を確認する。
2. ページ数を取得する。
3. 暗号化・破損・権限不足で読めない場合はFatalとする。
4. ページごとにテキスト取得可否を調べ、`pdfKind`を決定する。
5. 回転情報を適用したページ画像を生成し、紙面レイアウト確認に使う。

### 9.2 PDF種別

| 種別 | 処理 |
|---|---|
| `text` | 埋込テキストを候補にし、ページ画像で式・配置・問題境界を照合 |
| `scan` | ページ画像の視覚解析を中心にし、OCR結果を補助として利用 |
| `mixed` | ページ単位でtext / scan処理を切替え、同一問題内で照合 |
| `unknown` | 解析継続可否を確認し、読めなければFatal |

埋込テキストを無条件に正としない。数式、上付き・下付き、分数、ルビ、段組み、縦書き注記はページ画像と照合する。

### 9.3 ページ画像

- 認識用レンダリングと最終Crop用レンダリングを分離する。
- 認識用は処理効率を優先し、最終Cropは可読性を優先する。
- 回転補正後の表示方向を正規化座標の基準とする。
- 見開きスキャンでもPDF物理ページ単位を維持し、紙面ページ表記を別に記録する。

### 9.4 解答探索

指定範囲外ページを探索できるのは、採用候補に対応する教科書解答・教科書解説の特定に限る。

探索順は次とする。

1. 対象問題と同一ページ
2. 対象範囲内の直後ページ
3. PDF内の解答・答・解説等の明示セクション
4. ラベル、単元、ページ参照が一致する候補

一意に対応付けできない場合は`ambiguous`とし、複数候補を利用者へ示す。見つからない場合は`not-found`とする。

---

## 10. 範囲解決と問題認識

### 10.1 範囲候補列

対象ページ上で、次を掲載順に候補化する。

- 例、例題
- 問、問題、練習
- 丸数字、括弧数字、章内で一貫したラベル
- 見出し・罫線・余白等で明確に区切られた問題単位

各候補へ`pdfPageNumber`とページ内順序を持つ`itemKey`を付ける。

### 10.2 開始・終了の解決

1. 指定ページをPDF物理ページへ解決する。
2. 指定ラベルと候補ラベルを正規化比較する。
3. 同一ラベルが複数ある場合は問題本文冒頭も提示して確認する。
4. 開始候補から終了候補までを掲載順で包含する。
5. 開始が終了より後の場合はFatalとする。
6. 範囲外候補はDraft itemsへ含めない。

ラベル正規化で漢数字・算用数字を自動同一視できるが、別問題へ誤対応する可能性がある場合は確定しない。

### 10.3 例題と問題

| 紙面上の意味 | `ProblemBlock.kind` |
|---|---|
| 解法を示す例、例題、Example | `example` |
| 練習、問、問題、演習 | `problem` |

見出しだけで判定できない場合は、解説付きであることだけを理由に`example`へしない。紙面上の役割を優先し、Warningを付ける。

### 10.4 小問

同一問題の共通指示の下に複数の独立小問がある場合は`SubQuestionGroupBlock`候補とする。

次の場合は無理に小問化しない。

- 番号が段落番号か小問番号か判断できない。
- 小問が前小問の結果を文章的に継承し、分離で意味が失われる。
- 複雑な紙面配置を構造化すると本文・図版対応が失われる。

その場合は通常のRichTextとして順序を保存し、`AI_PROBLEM_STRUCTURE_UNCERTAIN` Warningを付ける。

---

## 11. RichText・数式・表変換

### 11.1 共通原則

- HTML文字列、Markdown、Skill独自ASTを最終Worksheetへ残さない。
- 最終ノードは`BasicRichTextDocumentSchema`または`SolutionRichTextDocumentSchema`に適合させる。
- 未知ノード、未知属性、自由なCSS / style、link、codeを生成しない。
- 紙面の完全再現より数学的意味、掲載順、再編集性を優先する。

### 11.2 段落

通常段落は次を基本形とする。

```json
{
  "type": "paragraph",
  "attrs": { "textAlign": "left" },
  "content": []
}
```

中央揃えまたは右揃えは数学的・表現上必要な場合だけ使用する。改行は段落分割または`hardBreak`で表現し、PDF抽出由来の行末折返しをそのまま改行へしない。

### 11.3 文字mark

許可するmarkは次だけである。

- `bold`
- `underline`
- `italic`
- `answerColor`
- `textSize`の`small` / `large` / `xLarge`

標準文字サイズに`textSize: normal` markを付けない。同種markを重複させない。教科書の色、背景色、フォント名は保存しない。

### 11.4 数式

| 用途 | ノード |
|---|---|
| 文中の短い数式 | `inlineMath` |
| 独立行、式変形、複数段階の主要式 | `blockMath` |

共通属性は次とする。

```json
{
  "latex": "x^2",
  "textSize": "normal"
}
```

LaTeX文字列へ`$...$`、`\(...\)`、`\[...\]`等の区切りを含めない。日本語文章は可能な限りtextノードへ置き、数式ノードには数式意味を保持する内容だけを置く。

### 11.5 LaTeX制約

- 1～5,000文字
- 空白だけを禁止
- MathLiveで再編集可能な標準的LaTeXを使用
- 次の外部参照・HTML / CSS操作コマンドを禁止

```text
\href \url \includegraphics
\htmlClass \htmlId \htmlStyle \htmlData
\cssId \cssClass \class \style
```

符号、指数、添字、根号、分数線、絶対値、角度、図形記号、括弧対応に不確実性があれば`AI_MATH_RECOGNITION_UNCERTAIN`を登録する。

### 11.6 表

論理セルを安全に認識できる表は`richTable`または`TableBlock`へ変換する。

- 問題本文の流れに含まれる表：`richTable`
- 問題内の独立した大きな表：`TableBlock`
- 解答色の表：`richTable.attrs.answerColor = true`
- 図表・グラフ・複雑な結合で論理セルが不確実：元PDFから画像切り出し

表は1～20行、1～20列とし、列幅合計を100±0.01にする。結合範囲の重複、範囲外、未定義セルを禁止する。表セル内に表を入れない。

---

## 12. 教科書解答と説明スタイル

### 12.1 教科書解答

解答の優先順位は次のとおり。

1. PDFに明示された教科書解答
2. PDFに明示された例題の最終結論
3. 利用者が明示的に提示・訂正した解答

AIによる検算は整合性警告のためだけに使用し、教科書解答の置換元にしない。

### 12.2 解答未発見

教科書解答を特定できない場合は次を行う。

- `textbookAnswer.status = "not-found"`
- `AI_TEXTBOOK_ANSWER_NOT_FOUND` Warningを登録
- 解答色ノードを生成しない
- 利用者確認表へ「解答を確認できない」と表示
- AI独自解答を完成データへ入れない

### 12.3 解答不一致

AI検算と教科書解答が一致しない場合は次を行う。

- 教科書解答をDraftへ保持
- `verification = "mismatch"`
- `AI_ANSWER_VERIFICATION_MISMATCH` Warningを登録
- 両者が異なることを利用者へ示す
- 利用者が明示訂正しない限り教科書解答を維持

### 12.4 `normal`

- 教科書解説を意味・順序・正答を変えずに構造化する。
- LaTeX化、段落化、不要な改行除去だけを行う。
- 解説がない場合は新しい解説を追加しない。

### 12.5 `detailed`

- 教科書問題・解答・解説を根拠に途中過程を補足する。
- 使用する考え方、理由、式変形、注意点、結論を必要に応じて追加する。
- 問題条件と教科書正答を変更しない。
- 教科書から直接得た内容とAI補足が識別できるよう、Draft内部で変換モードを保持する。

### 12.6 `concise`

- 教科書解説を根拠に説明量を減らす。
- 数学的成立に必要な条件、主要式変形、最終結論を残す。
- 教科書正答を変更しない。

### 12.7 Solution格納

- 問題全体の共通解説：`ProblemBlock.solution`
- 個別小問の解説：`SubQuestion.solution`
- 共通解説と個別解説が両方ある場合：両方へ役割を分けて格納
- 解説なし：`null`

空段落だけのSolutionを生成せず、可視内容がない場合は`null`とする。

---

## 13. 図版・Asset設計

### 13.1 対象

図、グラフ、座標平面、数直線、統計図、幾何図、写真、複雑で画像保持が適切な表を対象とする。

### 13.2 切り出し

1. 元PDFの対象ページを回転補正してレンダリングする。
2. `NormalizedBounds`を画像座標へ変換する。
3. 境界をページ内へclampする。
4. 元PDFレンダリング結果から1回だけcropする。
5. 透明・線画中心はPNG、写真中心はJPEGを既定とする。
6. 幅・高さ・byteLengthを記録する。
7. Previewを利用者へ提示する。

切り出し済み画像を入力にして再切り出ししてはならない。

### 13.3 修正指示

自然言語修正は正規化座標の変更へ変換する。

| 指示例 | 座標変更例 |
|---|---|
| 上を広げる | `top`を小さくする |
| 下を狭くする | `bottom`を小さくする |
| 左を広げる | `left`を小さくする |
| 右を狭くする | `right`を小さくする |
| 図だけにする | 本文領域を除外するよう四辺を再推定 |

変更量が曖昧な場合は小さな変更を1回行いPreviewを再提示する。`cropRevision`を増やし、旧Cropを最終Assetへ含めない。

### 13.4 画像制限

SkillはMath Editor画像選択時の現行上限に合わせ、各最終画像を次へ収める。

- MIME：`image/png`、`image/jpeg`、`image/webp`
- デコード可能な非空画像であること
- 1点10MiB以下
- 幅10,000px以下
- 高さ10,000px以下
- 40MP以下

上限超過時は、可読性を確認しながら元PDFから低い解像度で再レンダリングする。JPEG再圧縮を繰り返さない。

### 13.5 配置と幅

初期値は`placement: "block"`、`widthPercent: 50`とする。紙面上で小さく、本文回り込みが明確な図だけ`floatLeft`または`floatRight`を使用する。

- `block`：25 / 33 / 50 / 66 / 75 / 100
- `floatLeft` / `floatRight`：25 / 33 / 50だけ

### 13.6 Alt

`alt`は問題を解くために必要な答えを暴露せず、図の種類と対象を簡潔に示す。

例：`「点A、B、Cを含む三角形の図」`、`「xとyの関係を示すグラフ」`

### 13.7 BackupAsset

最終画像は次へ変換する。

```ts
type BackupAsset = {
  id: string;
  worksheetId: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  dataBase64: string;
  width: number;
  height: number;
  createdAt: string;
};
```

`dataBase64`へ`data:image/png;base64,`等のdata URL接頭辞を含めない。

---

## 14. Worksheet変換設計

### 14.1 Worksheet初期化

Builderは`createWorksheet()`相当の次の既定値から開始する。

```json
{
  "schemaVersion": 1,
  "title": "無題のプリント",
  "pageSettings": {
    "size": "B5",
    "orientation": "portrait",
    "margin": "normal",
    "fontFamily": "biz-udp-gothic",
    "problemNumberFormat": "dot",
    "subQuestionNumberFormat": "paren"
  },
  "header": {
    "title": "無題のプリント",
    "gradeField": true,
    "classField": true,
    "numberField": true,
    "nameField": true,
    "firstPageOnly": true
  },
  "deletedAt": null
}
```

`title`を上書きする場合は`header.title`も同じ値へ設定する。

### 14.2 ID

Worksheet、Problem、ContentBlock、SubQuestion、RichText内画像、RichText内表、TableRow、TableCell、Assetのすべてに1文字以上の一意IDを生成する。

- 第一選択：UUID v4相当
- フォールバック：衝突検査付きの時刻・乱数ID
- 1つのグローバル`Set<string>`で最終ファイル全体の重複を防ぐ
- Draftの`itemKey` / `figureKey`を永続IDとして流用しない

Math Editorはインポート時にIDを再生成するが、入力ファイル内の一意性は生成時点で必須である。

### 14.3 ProblemBlock

各accepted itemを掲載順に次へ変換する。

```ts
type ProblemBlock = {
  id: string;
  type: "problem";
  kind: "problem" | "example";
  numbering: {
    enabled: true;
    restartAt: null;
  };
  contents: ContentBlock[];
  solution: SolutionRichTextDocument | null;
  pageBreakBefore: false;
  pageBreakAfter: false;
};
```

原則として問題1件につき先頭に`RichTextBlock`を1件置く。小問がある場合は、その後に`SubQuestionGroupBlock`を置く。独立図版・独立表は対応する本文または小問の直後へ置く。

### 14.4 RichTextBlockの正規形

現行エディタは問題色文書と解答色文書を統合して編集する。AI出力も次を正規形とする。

```ts
type RichTextBlock = {
  id: string;
  type: "richText";
  document: BasicRichTextDocument;       // 問題色＋answerColor付き解答
  answerDocument: BasicRichTextDocument; // 空文書
};
```

空文書は次とする。

```json
{
  "type": "doc",
  "content": [
    {
      "type": "paragraph",
      "attrs": { "textAlign": "left" },
      "content": []
    }
  ]
}
```

### 14.5 解答色

解答として追加するノードへ次を適用する。

| ノード | 解答色表現 |
|---|---|
| `text` | `marks`へ`{ "type": "answerColor" }`を追加 |
| `inlineMath` | `attrs.answerColor = true` |
| `blockMath` | `attrs.answerColor = true` |
| `imageRef` | `attrs.answerColor = true` |
| `richTable` | `attrs.answerColor = true` |

同種markを重複させない。`ImageBlock`と`TableBlock`には`answerColor`属性がないため、解答側画像・表は必ず解答色対応の`imageRef` / `richTable`としてRichTextへ入れる。

### 14.6 小問変換

```ts
type SubQuestion = {
  id: string;
  numbering: { restartAt: null };
  content: BasicRichTextDocument;       // 問題色＋answerColor付き解答
  answerContent: BasicRichTextDocument; // 空文書
  answerArea: null;
  solution: SolutionRichTextDocument | null;
  width: "column" | "full";
};
```

初期AI出力では、要件に指定がない生徒用解答欄を推測で追加しないため`answerArea: null`とする。利用者はインポート後に既存UIで追加できる。

### 14.7 図版配置

- 問題全体の独立図版：`ImageBlock`
- 問題本文中の位置関係が重要：`RichTextBlock.document`内の`imageRef`
- 小問固有図版：該当`SubQuestion.content`内の`imageRef`
- 解答図版：answerColor付き`imageRef`
- 教師用解説図版：`solution`内の`imageRef`。解答色属性は不要

### 14.8 表配置

- 独立した問題色表：`TableBlock`
- 本文と一体の表：`richTable`
- 小問・解答・解説内の表：該当RichText内の`richTable`

### 14.9 構造上限

| 対象 | 上限 |
|---|---:|
| Worksheet内Problem | 200 |
| Problem内ContentBlock | 100 |
| SubQuestionGroup内小問 | 100 |
| 表 | 20行×20列 |
| RichText文書 | 10,000ノード、深度20 |
| LaTeX | 5,000文字 |
| spacer | 20行 |
| answerArea | 20行 |

上限超過を問題の黙示的除外や内容削除で解消しない。Fatalとして利用者へ分割・範囲縮小を依頼する。

### 14.10 最小生成例

画像を含まない例題1件の最小的な完成形は次の構造とする。実際のIDと日時はBuilderが生成する。

```json
{
  "format": "math-worksheet",
  "kind": "single",
  "version": 1,
  "exportedAt": "2026-08-24T00:00:00.000Z",
  "worksheet": {
    "schemaVersion": 1,
    "id": "worksheet-ai-1",
    "title": "一次方程式",
    "pageSettings": {
      "size": "B5",
      "orientation": "portrait",
      "margin": "normal",
      "fontFamily": "biz-udp-gothic",
      "problemNumberFormat": "dot",
      "subQuestionNumberFormat": "paren"
    },
    "header": {
      "title": "一次方程式",
      "gradeField": true,
      "classField": true,
      "numberField": true,
      "nameField": true,
      "firstPageOnly": true
    },
    "problems": [
      {
        "id": "problem-ai-1",
        "type": "problem",
        "kind": "example",
        "numbering": {
          "enabled": true,
          "restartAt": null
        },
        "contents": [
          {
            "id": "content-ai-1",
            "type": "richText",
            "document": {
              "type": "doc",
              "content": [
                {
                  "type": "paragraph",
                  "attrs": { "textAlign": "left" },
                  "content": [
                    { "type": "text", "text": "方程式 " },
                    {
                      "type": "inlineMath",
                      "attrs": { "latex": "2x+1=7", "textSize": "normal" }
                    },
                    { "type": "text", "text": " を解きなさい。" }
                  ]
                },
                {
                  "type": "paragraph",
                  "attrs": { "textAlign": "left" },
                  "content": [
                    {
                      "type": "text",
                      "text": "答え ",
                      "marks": [{ "type": "answerColor" }]
                    },
                    {
                      "type": "inlineMath",
                      "attrs": {
                        "latex": "x=3",
                        "textSize": "normal",
                        "answerColor": true
                      }
                    }
                  ]
                }
              ]
            },
            "answerDocument": {
              "type": "doc",
              "content": [
                {
                  "type": "paragraph",
                  "attrs": { "textAlign": "left" },
                  "content": []
                }
              ]
            }
          }
        ],
        "solution": {
          "type": "doc",
          "content": [
            {
              "type": "paragraph",
              "attrs": { "textAlign": "left" },
              "content": [
                { "type": "text", "text": "両辺から1を引き、2で割る。" }
              ]
            }
          ]
        },
        "pageBreakBefore": false,
        "pageBreakAfter": false
      }
    ],
    "createdAt": "2026-08-24T00:00:00.000Z",
    "updatedAt": "2026-08-24T00:00:00.000Z",
    "deletedAt": null
  },
  "assets": []
}
```

---

## 15. 単一バックアップ生成設計

### 15.1 `createSingleBackup()`との同等性

Builderは次の順序で`createSingleBackup()`と同じ意味の処理を行う。

1. 確定DraftからWorksheetを作る。
2. Worksheet内の全`assetId`を再帰走査して参照ID集合を作る。
3. `asset.worksheetId === worksheet.id`かつ参照されるAssetだけを選択する。
4. 画像バイトをdata URL接頭辞なしのBase64へ変換する。
5. `BackupAsset`へ`id`、`worksheetId`、MIME、寸法、作成日時を設定する。
6. 単一ファイルenvelopeを作る。
7. `MathWorksheetFileSchema`相当Validatorを実行する。

### 15.2 Envelope

```json
{
  "format": "math-worksheet",
  "kind": "single",
  "version": 1,
  "exportedAt": "2026-08-24T00:00:00.000Z",
  "worksheet": {},
  "assets": []
}
```

`exportedAt`、Worksheetの`createdAt` / `updatedAt`、Assetの`createdAt`はタイムゾーンを含むISO 8601日時とする。Builderは1回の生成処理で共通の`buildTimestamp`を使ってよい。

### 15.3 Asset選択

完成ファイルへ含めるAssetは参照される最終Cropだけとする。

- 未参照Assetを含めない。
- 棄却Cropを含めない。
- 指定範囲外のページ画像を含めない。
- PDF本体を含めない。
- Asset所有Worksheetと参照元Worksheetを一致させる。

### 15.4 JSON直列化

- 文字コード：UTF-8
- インデント：2スペース
- MIME：`application/json`
- data URLではなくダウンロード可能ファイルとして提供
- UTF-8直列化後の出力ファイルは100MiB以下

ファイル名は既存単一エクスポートに合わせる。

```text
<sanitize済みWorksheet.title>_YYYYMMDD-HHmm.json
```

### 15.5 生成失敗

BuilderまたはValidatorが失敗した場合、候補JSONを完成ファイルとして提供しない。検証エラーを`DraftIssue`へ変換し、修正可能なら`review-required`、継続不能なら`blocked`へ遷移する。

---

## 16. 検証設計

### 16.1 検証段階

```text
Draft invariants
      ↓
Worksheet構造検証
      ↓
MathWorksheetFileSchema相当検証
      ↓
直列化後サイズ・Base64検証
      ↓
Math Editor実インポート試験
```

### 16.2 Draft検証

- rangeがresolved
- item orderが一意で昇順
- itemKey / figureKey / issueIdがDraft内で一意
- accepted itemが対象範囲内
- excluded itemをBuilder対象にしない
- 図版座標が正規化範囲内
- confirmedRevisionとrevisionが一致
- Fatal 0件

### 16.3 構造検証

生成JSON Schemaで次を検証する。

- strict object相当の未知フィールド拒否
- 必須フィールド
- 列挙値
- 数値・配列・文字列上限
- RichText許可ノード
- MIMEとBase64形式
- `single` envelope

### 16.4 Zod相当の意味・相関検証

完成判定では、生成JSON Schemaだけでなく次を検証する。

- `header.title === worksheet.title`
- Worksheet配下およびファイル全体のEntity ID一意性
- mark種別重複なし
- RichText総ノード数と深度
- LaTeXが空白だけでない
- LaTeX禁止コマンドなし
- 表列幅合計100±0.01
- 表の結合がグリッド外へ出ない
- 表の結合が重複しない
- 表グリッドに未定義セルがない
- すべての`assetId`に対応Assetがある
- Assetの`worksheetId`と参照元Worksheetが一致
- 未参照余剰Assetがない
- Asset IDを含む全IDが重複しない

### 16.5 Validator出力

```ts
type ValidationResult = {
  valid: boolean;
  schemaVersion: 1;
  errors: Array<{
    code: string;
    path: string;
    message: string;
  }>;
  summary: {
    worksheetCount: 1;
    problemCount: number;
    assetCount: number;
    referencedAssetCount: number;
  };
};
```

成功時は終了コード0、失敗時は非0とする。成功ログだけを根拠にせず、`valid === true`と`errors.length === 0`を確認する。

### 16.6 Schema drift検知

Skillのリリース前に次を実行する。

1. `npm run schema:check`
2. `npm run schema:test`
3. 最新Schemaからvalidator bundleを再生成
4. `schemas/math-worksheet.schema.json`をSkillへコピー
5. `schema-manifest.json`を更新
6. リポジトリ版とSkill版のSHA-256一致を確認
7. 代表JSONをMath Editorの`parseBackup()`へ通す

Schema hash不一致時はSkillパッケージを公開しない。

---

## 17. 確認表示と修正ループ

### 17.1 確認表示

項目ごとに次を提示する。

| 項目 | 表示 |
|---|---|
| 採否 | 未確認 / 採用 / 除外 |
| 種別 | 例題 / 問題 |
| 出典 | PDFページ番号、紙面ページ表記、元ラベル |
| 問題文 | 変換後本文。数式は可読表示とLaTeXを確認可能にする |
| 小問 | ラベル、本文、列配置 |
| 図版 | 現Crop Preview、ページ、修正履歴 |
| 解答 | 教科書解答、出典、発見状態 |
| 解説 | 説明スタイル、変換後内容 |
| 警告 | 未解決Issueのseverityと内容 |

長いJSON全体を確認画面として先に提示しない。利用者が数学的内容と採否を確認しやすい表示を優先する。

### 17.2 修正種別

| 修正 | 再処理範囲 |
|---|---|
| 誤字・数式訂正 | 対象ノードと関連Warning |
| 種別変更 | 対象itemの`kind` |
| 小問構造変更 | 対象itemだけ再構築 |
| 採用・除外 | `reviewDecision`だけ変更 |
| 説明スタイル変更 | 例題の`finalExplanation`を再生成 |
| 図版境界変更 | 対象figureを元PDFから再Crop |
| 範囲変更 | 候補列とitemsを再構築し、全体を再確認 |
| PDF差し替え | Draftを新規作成し、権利・送信確認から再開 |

### 17.3 Revision

修正後は次を行う。

1. `draft.revision += 1`
2. `confirmation.status = "not-confirmed"`
3. `confirmedRevision = null`
4. 影響Issueをresolvedまたは再評価
5. validationSummaryを再計算
6. 修正箇所と残存Warningを再提示

---

## 18. スクリプトインターフェース

### 18.1 `crop_pdf_figure.py`

入力概念：

```json
{
  "pdfPath": "<attached.pdf>",
  "pdfPageNumber": 12,
  "bounds": { "left": 0.1, "top": 0.2, "right": 0.8, "bottom": 0.7 },
  "rotationApplied": 0,
  "dpi": 200,
  "outputMimeType": "image/png",
  "outputPath": "<figure.png>"
}
```

成功出力：

```json
{
  "ok": true,
  "outputPath": "<figure.png>",
  "mimeType": "image/png",
  "width": 1400,
  "height": 900,
  "byteLength": 123456
}
```

失敗時は`ok: false`、安定したエラーコード、利用者向けでない技術メッセージを返す。暗号化PDF、ページ不存在、不正座標、デコード失敗を区別する。

### 18.2 `build_math_worksheet_file.mjs`

入力：確定済み`AiWorksheetDraft`と採用Cropファイル群。

出力：候補JSONパス、生成統計、Builderエラー。Builderは未確定Draftを終了コード非0で拒否する。

### 18.3 `validate_math_worksheet.mjs`

入力：候補JSONファイルパス。

出力：`ValidationResult`。Validatorはファイルを書き換えない。

### 18.4 一時ファイル

- 作業ごとに専用一時ディレクトリを使用する。
- 元PDFを上書きしない。
- 完成JSONを検証前の一時パスへ書く。
- 完成後、利用者に提供するJSONと必要な最終Previewだけを残す。
- セッション終了時に一時Crop、OCR結果、棄却JSONを削除対象とする。

---

## 19. エラー・警告設計

### 19.1 コード体系

| Code | Severity | 条件 | 処理 |
|---|---|---|---|
| `AI_PDF_MISSING` | fatal | PDF未添付 | 添付を依頼 |
| `AI_PDF_UNREADABLE` | fatal | 破損・非対応 | 別PDFを依頼 |
| `AI_PDF_ENCRYPTED` | fatal | 復号できない | 処理停止 |
| `AI_RANGE_PAGE_NOT_FOUND` | fatal | 指定ページなし | 範囲訂正を依頼 |
| `AI_RANGE_ORDER_INVALID` | fatal | 開始が終了より後 | 範囲訂正を依頼 |
| `AI_RANGE_LABEL_AMBIGUOUS` | warning | ラベル候補複数 | 候補を提示 |
| `AI_PROBLEM_KIND_UNCERTAIN` | warning | 例題・問題を判定不能 | 利用者選択 |
| `AI_PROBLEM_STRUCTURE_UNCERTAIN` | warning | 小問構造を安全に決定不能 | RichText保持または利用者修正 |
| `AI_MATH_RECOGNITION_UNCERTAIN` | warning | 数式認識不確実 | 該当式と出典画像を提示 |
| `AI_FIGURE_BOUNDS_UNCERTAIN` | warning | Crop境界不確実 | Preview修正 |
| `AI_FIGURE_OUTPUT_INVALID` | fatal | 画像生成・寸法・MIME不正 | 再Cropまたは処理停止 |
| `AI_TEXTBOOK_ANSWER_NOT_FOUND` | warning | 教科書解答なし | 解答なしで確認 |
| `AI_TEXTBOOK_ANSWER_AMBIGUOUS` | warning | 対応候補複数 | 候補選択 |
| `AI_ANSWER_VERIFICATION_MISMATCH` | warning | 教科書解答と検算不一致 | 教科書解答を維持し警告 |
| `AI_DRAFT_NOT_CONFIRMED` | fatal | 確定前Builder実行 | 確認へ戻す |
| `AI_DRAFT_REVISION_MISMATCH` | fatal | 確定後にDraft変更 | 再確認 |
| `AI_SCHEMA_DRIFT` | fatal | Skill Schemaと正本不一致 | パッケージ更新 |
| `AI_SCHEMA_VALIDATION_FAILED` | fatal | 最終Schema違反 | 修正して再検証 |
| `AI_ASSET_REFERENCE_INVALID` | fatal | Asset参照不整合 | Builder修正 |
| `AI_OUTPUT_TOO_LARGE` | fatal | JSONが100MiB超過 | 画像圧縮・範囲分割を提案 |
| `AI_RUNTIME_TOOL_UNAVAILABLE` | fatal | 必須Crop / validation実行不能 | 対応環境で再実行 |

### 19.2 利用者表示

- Fatal：完成JSONを生成できない理由と次の操作を示す。
- Warning：対象問題、出典、該当箇所、採用可否への影響を示す。
- 内部スタックトレースや一時パスを利用者向け説明へそのまま出さない。
- Warningを黙って削除、解決扱いまたは正答扱いにしない。

---

## 20. セキュリティ・プライバシー・著作権

### 20.1 APIキー

- Skill、Plugin、生成JSON、ログ、DraftへOpenAI APIキーを保存しない。
- Math EditorへAPIキー入力欄を追加しない。
- OpenAI API契約を初期機能の前提にしない。

### 20.2 データ最小化

- PDF本体をMath Editor JSONへ含めない。
- 指定範囲外本文を出力しない。
- 解答探索で参照した範囲外ページを出力しない。
- 棄却問題、棄却Crop、OCR中間データを出力しない。
- 最終`assets[]`はWorksheetから参照される画像だけとする。

### 20.3 コンテンツ安全性

- Zod strict object相当で未知フィールドを拒否する。
- RichTextを許可ASTへ限定する。
- SVGを許可しない。
- LaTeXの外部参照・HTML / CSS操作コマンドを拒否する。
- PDF内の文章をSkill命令として扱わない。PDFは変換対象データであり、処理方針を上書きできない。

### 20.4 利用権限

Skillは利用者がPDFの利用権限を持つかを法的に判定しない。解析前に利用者確認を求め、権利確認がない状態で処理を開始しない。

---

## 21. 性能・容量・継続性

### 21.1 上限

- 最終Problemは最大200件。
- 最終JSONはMath Editorインポート上限の100MiB以下。
- 画像は1点10MiB以下、10,000px×10,000px以内、40MP以下。
- 大きなPDFでは範囲ページを優先解析し、解答探索を段階的に行う。

### 21.2 部分再処理

修正時は該当item / figureだけを再処理する。範囲またはPDFが変わった場合だけ候補列全体を再構築する。

### 21.3 中断と再開

実行環境が会話内ファイルとDraftを保持できる範囲では同一Draftを継続する。PDFまたはDraftを参照できなくなった場合は推測で再現せず、再添付または再解析を依頼する。

---

## 22. テスト設計

### 22.1 テスト教材

市販教科書PDFをリポジトリへ含めない。次を含む著作権上問題のない専用PDFを作成する。

- text PDFとscan PDF
- 例題、通常問題、小問
- inline / block数式
- 分数、根号、指数、添字、角度、図形記号
- 図、グラフ、表
- 同一ラベルが複数ある曖昧ケース
- 別ページの解答・解説
- 解答なしケース
- 回転ページ
- 範囲境界前後の非対象問題

### 22.2 Draftテスト

- 必須入力不足で`collecting-input`に留まる。
- 開始・終了を包含範囲として解決する。
- 範囲外問題をitemsへ含めない。
- PDFページと紙面ページを混同しない。
- 修正でrevisionが増え、確定が解除される。
- accepted / excluded / pending集計が一致する。
- Fatal存在時に確定できない。

### 22.3 認識・変換テスト

- 例題と問題を`kind`へ正しく対応する。
- 安全な小問だけを`SubQuestionGroupBlock`へ変換する。
- inline / block数式を区別する。
- 禁止LaTeXコマンドを出力しない。
- `normal`で教科書解説の意味・順序を変えない。
- `detailed` / `concise`で正答を変えない。
- 教科書解答不明時にAI解答を挿入しない。
- 解答不一致時に教科書解答を上書きしない。

### 22.4 図版テスト

- 元PDFから指定矩形を切り出す。
- 回転ページの座標を正しく扱う。
- 上下左右の修正指示が反映される。
- 修正のたびに元PDFから再Cropする。
- 棄却Cropが`assets[]`へ入らない。
- MIME、寸法、容量上限を満たす。
- 解答図版がanswerColor付き`imageRef`になる。

### 22.5 Builder / Validatorテスト

- `format: "math-worksheet"`、`kind: "single"`、`version: 1`を生成する。
- `createWorksheet()`既定値と一致する。
- `header.title === worksheet.title`を維持する。
- accepted itemだけを掲載順で生成する。
- 全Entity IDが一意である。
- 参照Assetだけを出力する。
- `dataBase64`へdata URL接頭辞を付けない。
- 未参照Asset、欠落Asset、所有Worksheet不一致を拒否する。
- 表相関、RichText深度、mark重複、LaTeX禁止コマンドを拒否する。
- 未確定Draftを拒否する。
- 100MiB超過を拒否する。

### 22.6 Math Editor連携テスト

生成JSONについて次を確認する。

1. `parseBackup()`が受理する。
2. `hydrateBackup()`が全IDとAsset参照を再採番できる。
3. Math Editorへインポートできる。
4. 問題・例題の`kind`が保持される。
5. 数式をMathLiveで再編集できる。
6. 問題のみ表示で解答色内容が非表示になる。
7. 解答付き表示で解答色と教師用解説が表示される。
8. 図版・表が表示される。
9. 保存・再読込・再エクスポートできる。
10. PDF出力できる。

### 22.7 回帰コマンド

```text
npm run schema:check
npm run schema:test
npm run verify
npm run test:e2e
npm run build
```

Skill実装後はSkill validatorテスト、Cropperテスト、代表プロンプトによる動作評価を追加する。

---

## 23. パッケージ・公開・保守

### 23.1 開発

1. リポジトリスコープSkillとして実装する。
2. 著作権上問題のないPDFで前向きテストする。
3. Math Editor実インポートを確認する。
4. Skill validatorとリポジトリSchemaの一致を確認する。

### 23.2 Plugin化

1. `.codex-plugin/plugin.json`を持つPluginを作成する。
2. 同一Skillを`skills/math-editor-textbook-import/`へ機械コピーする。
3. 初期版では`.app.json`、`.mcp.json`を含めない。
4. ChatGPT WorkでPDF添付、確認、JSONダウンロードを試験する。
5. Workspace管理者によるSkill / Plugin利用制御がある場合は公開前に確認する。

### 23.3 Schema変更時

1. `worksheet.schema.ts`を変更する。
2. 必要に応じて`structure-limits.ts`、defaults、backup、testsを変更する。
3. `npm run schema:generate`を実行する。
4. `npm run schema:check`と`npm run schema:test`を通す。
5. Skill validator bundleを再生成する。
6. SkillのJSON Schemaとmanifestを更新する。
7. Draft→Worksheet mappingを再確認する。
8. Math Editor連携テストを実行する。
9. Skill / Pluginのversionを更新する。

SchemaだけをコピーしてValidator bundleまたはmapping referenceを更新しない状態を許可しない。

### 23.4 OpenAI仕様変更時

実装・公開時にOpenAI公式ドキュメントを確認し、次を再評価する。

- 単体SkillとPlugin内Skillの利用可能面
- Skillパッケージ構造
- Plugin manifest要件
- Script実行環境と利用可能ツール
- ChatGPT Workの管理者制御
- ファイル入力・出力制限

製品仕様を固定値として永久保証しない。

---

## 24. 将来App / MCP設計境界

### 24.1 追加可能な機能

- Draftまたは検証済み単一JSONの直接受け渡し
- Math Editor側Schemaによるサーバー境界検証
- 問題一覧、採用・除外、数式編集の専用UI
- 図版矩形ドラッグUI
- Math Editorへの利用者承認付き直接インポート

### 24.2 変更しない機能

- 教科書内容を勝手に変更しない原則
- 教科書解答優先
- 説明スタイル3種
- 元PDFからの図版切り出し
- AiWorksheetDraft
- 明示的確定ゲート
- Worksheet Schema正本
- OpenAI APIキーをMath Editorへ保存しない方針

### 24.3 App / MCP責務

App / MCPはデータ、認証、認可、操作を担当し、Skillはワークフローと判断規則を担当する。Skill内にMath Editor認証情報を埋め込まない。

---

## 25. 要件トレーサビリティ

| `追加AI要件定義書.md` | 本書 |
|---|---|
| 3 基本方針 | 3、4、5 |
| 4 対象範囲 | 2、6、9～17 |
| 5 利用条件 | 7、20 |
| 6 全体利用フロー | 6 |
| 7 PDF入力 | 7、9 |
| 8 範囲指定 | 7、8、10 |
| 9 問題・例題 | 10、14 |
| 10 問題本文 | 11、14 |
| 11 数式 | 11、16 |
| 12 教科書解答 | 12、14 |
| 13 解答色 | 14 |
| 14 説明スタイル | 12 |
| 15 図版 | 13、18 |
| 16 確認・確定 | 6、17 |
| 17 中間データ | 8 |
| 18 JSON出力 | 14～16 |
| 19 Skillパッケージ | 5、18、23 |
| 20 エラー・警告 | 19 |
| 21 品質 | 9～17、22 |
| 22 セキュリティ・プライバシー | 20 |
| 23 既存Math Editor整合 | 14～16 |
| 24 テスト | 22 |
| 25 受け入れ条件 | 26 |
| 26 Plugin移行 | 4、23、24 |
| 27 将来機能 | 24 |
| 28 最重要原則 | 3、26 |

---

## 26. 完了条件

### 26.1 Skill実装完了

- `SKILL.md`が対象と対象外を明確に識別する。
- referencesが作業段階に応じて選択的に読み込まれる。
- PDF解析結果が`AiWorksheetDraft`へ保持される。
- 指定範囲外問題がDraftおよび最終JSONへ入らない。
- 例題・問題・小問・数式・図版・解答・解説を設計どおり変換できる。
- 教科書解答をAI解答で自動上書きしない。
- 3説明スタイルで問題条件と正答を変更しない。
- 図版を元PDFから切り出し、修正時も元PDFから再切り出しする。
- 明示的確定前にBuilderが実行されない。
- 確定後の変更で再確認が必要になる。

### 26.2 JSON完了

- `format: "math-worksheet"`
- `kind: "single"`
- `version: 1`
- `MathWorksheetFileSchema`相当検証成功
- Entity ID一意
- Asset参照完全一致
- 余剰Assetなし
- 100MiB以下
- Math Editorへインポート可能
- インポート後に編集、再読込、プレビュー、PDF、再エクスポートが可能

### 26.3 リリース完了

- SkillソースとPlugin内Skillの内容が一致する。
- Schema manifestがリポジトリの生成Schemaと一致する。
- 著作権上問題のないテストPDFで回帰テストが成功する。
- OpenAI公式仕様に照らして対象ChatGPT Work環境で利用できる。
- PDF外部送信、利用権限、API非使用の説明が確認できる。

---

## 27. 実装開始時の確認事項

次は本詳細設計の成立を妨げないため既定値で設計したが、実装開始時に製品方針として確定する。

| 項目 | 本書の既定 | 変更時の影響 |
|---|---|---|
| ChatGPT Work配布範囲 | Skill-only Plugin | 公開・Workspace限定の配布設定 |
| Worksheet題名未指定時 | `無題のプリント` | 入力フローとテスト期待値 |
| 生徒用解答欄 | 自動追加しない | Worksheet mappingと紙面レイアウト |
| 図版既定幅 | block / 50% | Crop確認とプレビュー |
| 図版既定形式 | 線画PNG、写真JPEG | 容量と画質 |
| Skill暗黙起動 | 許可 | `agents/openai.yaml` policy |

これらを変更しても、Schema正本、明示的確定、教科書解答優先、元PDFからの図版切り出し、最終Zod相当検証は変更しない。
