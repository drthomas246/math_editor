# すうがく仕立て 追加AI詳細設計書

## 1. 文書情報

| 項目 | 内容 |
|---|---|
| 文書名 | すうがく仕立て 追加AI詳細設計書 |
| 文書版 | 2.2 |
| 基準日 | 2026-09-13 |
| 対象システム | `drthomas246/math_editor` |
| 基準ブランチ | `master` |
| 基準コミット | `1ef632ad20d24dbb1e12e0bf022ecc1d6168837d` |
| AI方式 | ChatGPT上のすうがく仕立て Skill |
| 配布 | portable Plugin |
| 直接連携 | WebMCP Site tools |
| 正式URL | `https://app.sujita.jp/` |
| フォールバック | `math-worksheet` single JSON |
| OpenAI API | 使用しない |
| 外部MCPサーバー | 使用しない |
| すうがく仕立て Schema版 | 1 |
| すうがく仕立てファイル形式 | `math-worksheet` / `single` / version 1 |

本書は `追加AI要件定義書.md` 2.2を、実装可能な粒度へ具体化する。

---

### 1.1 変更履歴

| 版 | 基準日 | 主な変更 |
|---|---|---|
| 2.0 | 2026-09-11 | portable Plugin、WebMCP Site tools、candidate、Consent、基本的なrequestId冪等性を設計 |
| 2.1 | 2026-09-11 | Runtime Capability Probeと図版fallback chain、AI Import Event、receipt先行冪等性と再検証、未確定deployment URL、個人ローカルMarketplaceでの自己テストを実装仕様化 |
| 2.2 | 2026-09-13 | 正式URLを `https://app.sujita.jp/`、WebMCPツール名を `sujita_*` に確定 |

## 2. 正本と優先順位

矛盾時は次を優先する。

1. 永続データ構造・相関制約: `src/domain/worksheet/worksheet.schema.ts`
2. 単一プリントファイル生成・復元意味論: `src/application/backup/backup.ts`
3. 既定値・ID生成: `src/domain/worksheet/worksheet.defaults.ts`
4. 構造上限: `src/domain/worksheet/structure-limits.ts`
5. Repository契約: `src/application/repositories/worksheet-repository.ts`
6. IndexedDB実装: `src/infrastructure/indexeddb/`
7. 本書の業務要件: `追加AI要件定義書.md`
8. Skill実行規則: `AI/skills/sugaku-jitate-textbook-import/`
9. Plugin/WebMCP仕様: リリース時点のOpenAI公式ドキュメント
10. 本詳細設計書

OpenAI製品仕様は変更され得るため、外部仕様と本アプリ固有仕様を分離する。

---

## 3. 現行実装から再利用するもの

現行コードから次をそのまま再利用する。

### 3.1 `MathWorksheetFileSchema`

`src/domain/worksheet/worksheet` から公開されている最終ファイルSchemaを、すうがく仕立て側直接取込の最終構造検証に使用する。

### 3.2 `hydrateBackup()`

`src/application/backup/backup.ts` の `hydrateBackup()` は次を既に担当している。

- BackupAssetのBase64復元
- 画像バイト数検証
- `Blob`生成
- 画像実体検証
- Worksheet ID再採番
- 配下ID再採番
- Asset ID再採番
- Worksheet内 `assetId` 置換
- createdAt / updatedAt更新

WebMCP用に同等処理を再実装しない。

### 3.3 `WorksheetRepository.create()`

新規WorksheetとAssetを永続化する最終入口として使用する。

WebMCPツールからDexieへ直接書き込まない。

### 3.4 既存JSONインポート

WebMCP経路のフォールバックとして維持する。

---

## 4. アーキテクチャ決定

| ID | 決定 |
|---|---|
| ADR-AI-101 | OpenAI APIを使用しない。 |
| ADR-AI-102 | 既存Skillをportable Pluginとして配布可能な形へパッケージする。 |
| ADR-AI-103 | Skill正本は `AI/skills/sugaku-jitate-textbook-import/` の1か所とする。 |
| ADR-AI-104 | portable Pluginはビルド時に生成し、Plugin内Skillを手編集しない。 |
| ADR-AI-105 | すうがく仕立て連携は外部MCPサーバーではなくWebMCP Site toolsを第一方式とする。 |
| ADR-AI-106 | WebMCPは追加機能とし、すうがく仕立て起動の必須条件にしない。 |
| ADR-AI-107 | 初期Site toolsは能力確認・候補検証・新規取込の3個に限定する。 |
| ADR-AI-108 | 既存Worksheetの更新・削除はSite toolsへ公開しない。 |
| ADR-AI-109 | WebMCP入力は不信頼としてすうがく仕立て側で再検証する。 |
| ADR-AI-110 | Schema hash完全一致を直接取込の初期互換条件とする。 |
| ADR-AI-111 | WebMCP直接取込上限の初期値を2 MiBとする。これはOpenAI公式上限ではなくアプリ設計値である。 |
| ADR-AI-112 | WebMCP直接取込に失敗した場合は単一プリントJSONへフォールバックする。 |
| ADR-AI-113 | AI書込許可はページセッション限定で、永続保存しない。 |
| ADR-AI-114 | `requestId` とImport Receiptを使って同一ブラウザ/タブセッション内の通常再試行を冪等化する。 |
| ADR-AI-115 | WebMCP検証済みcandidateはページメモリだけに保持し、短時間で失効させる。 |
| ADR-AI-116 | ChatGPT内蔵ブラウザと通常ブラウザのIndexedDB共有を前提にしない。 |
| ADR-AI-117 | SkillはRuntime Capability Probeを行い、依存関係の存在を仮定しない。 |
| ADR-AI-118 | 図版cropのprimary経路が利用不能なら、元PDF由来・検証可能な同等fallbackだけを自動利用する。 |
| ADR-AI-119 | 必須図版を生成できる経路が一つもなければ完成処理をblockedとする。 |
| ADR-AI-120 | WebMCP保存成功後はApplication層のAI Import EventでReact表示へ通知する。 |
| ADR-AI-121 | WebMCP層からReact stateを直接変更しない。 |
| ADR-AI-122 | import再試行時はcandidateより先にImport Receiptを確認する。 |
| ADR-AI-123 | completed receiptはcandidateが消失していても成功済み結果の正本として扱う。 |
| ADR-AI-124 | pending receiptはRepositoryを照合し、保存済みならcompletedへ回復する。 |
| ADR-AI-125 | すうがく仕立ての正式URLを `https://app.sujita.jp/` とし、未指定時の既定接続先にする。 |
| ADR-AI-126 | v2.1のPlugin導入範囲は開発者本人のローカルMarketplaceでの自己テストまでとする。 |
| ADR-AI-127 | 公開Plugin Directoryへの提出・第三者配布はv2.1対象外とする。 |

## 5. 全体構成

```text
┌─────────────────────────────────────────────┐
│ ChatGPT                                     │
│                                             │
│  portable Plugin: sugaku-jitate-ai            │
│   └─ Skill: sugaku-jitate-textbook-import     │
│        ├─ PDF解析                           │
│        ├─ AiWorksheetDraft                  │
│        ├─ 利用者確認                        │
│        ├─ Builder                           │
│        └─ Validator                         │
└───────────────────┬─────────────────────────┘
                    │
                    │ WebMCP Site tools
                    ▼
┌─────────────────────────────────────────────┐
│ すうがく仕立て                                 │
│                                             │
│ infrastructure/webmcp                       │
│   ↓                                         │
│ application/ai-import                       │
│   ↓                                         │
│ MathWorksheetFileSchema                     │
│   ↓                                         │
│ hydrateBackup()                             │
│   ↓                                         │
│ WorksheetRepository.create()                │
│   ↓                                         │
│ IndexedDB                                   │
└─────────────────────────────────────────────┘
```

---

## 6. フォルダ設計

```text
AI/
├─ skills/
│  └─ sugaku-jitate-textbook-import/
│     ├─ SKILL.md
│     ├─ agents/openai.yaml
│     ├─ references/
│     │  ├─ webmcp-integration.md          # 新規
│     │  └─ runtime-fallback-rules.md      # v2.1新規
│     ├─ schemas/
│     └─ scripts/
│        ├─ check_runtime_capabilities.mjs # v2.1新規
│        ├─ crop_pdf_figure.py
│        ├─ build_math_worksheet_file.mjs
│        └─ validate_math_worksheet.mjs
└─ plugin/
   └─ plugin.json                          # 新規

schemas/
├─ math-worksheet.schema.json
└─ math-worksheet.schema-manifest.json     # 新規

scripts/
├─ build-sugaku-jitate-plugin.ts             # 新規
└─ verify-sugaku-jitate-plugin.ts            # 新規

src/application/ai-import/
├─ ai-import-service.ts
├─ ai-import-types.ts
├─ ai-import-errors.ts
├─ ai-import-events.ts                     # v2.1新規
└─ ai-import-service.test.ts

src/infrastructure/webmcp/
├─ webmcp.d.ts
├─ webmcp-session.ts
├─ webmcp-candidate-store.ts
├─ webmcp-import-receipt.ts                # v2.1で責務を明示
├─ sugaku-jitate-capabilities.ts
├─ register-sugaku-jitate-tools.ts
└─ register-sugaku-jitate-tools.test.ts

src/presentation/ai-integration/
├─ AiIntegrationStatus.tsx
├─ AiIntegrationConsentDialog.tsx
└─ AiIntegrationStatus.test.tsx

e2e/
└─ ai-webmcp-import.spec.ts
```

### 6.1 依存方向

```text
presentation
  ↓
application/ai-import
  ↑
infrastructure/webmcp
  ↓
application ports / services
  ↓
WorksheetRepository
```

`application/ai-import` は `document.modelContext`、React、Dexieへ直接依存しない。

`infrastructure/webmcp` はReact componentへ直接依存しない。

### 6.2 v2.1追加ファイルの責務

- `runtime-fallback-rules.md`: Skill実行環境の能力判定と代替経路選択規則。
- `check_runtime_capabilities.mjs`: 利用可能なCLI・runtime・Python module等を機械可読JSONで報告。
- `ai-import-events.ts`: import完了をUIへ通知する小さなApplicationイベントハブ。
- `webmcp-import-receipt.ts`: sessionStorage receiptの読込・保存・昇格・破棄を一か所に集約。

## 7. portable Plugin設計

### 7.1 manifest

`AI/plugin/plugin.json`:

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  "name": "sugaku-jitate-ai",
  "version": "2.1.0",
  "description": "Convert authorized textbook PDF ranges into reviewed すうがく仕立て worksheets and deliver them through WebMCP or JSON fallback."
}
```

### 7.2 生成物

```text
dist/sugaku-jitate-ai/
├─ plugin.json
└─ skills/
   └─ sugaku-jitate-textbook-import/
      └─ ...
```

### 7.3 build script

`build-sugaku-jitate-plugin.ts` の責務:

1. `dist/sugaku-jitate-ai` を安全に再生成
2. `AI/plugin/plugin.json` をコピー
3. Skill正本を再帰コピー
4. シンボリックリンクを配布物へ含めない
5. 不要一時ファイルを除外
6. ファイル一覧を決定論的に並べる
7. ビルド結果を表示

### 7.4 verify script

`verify-sugaku-jitate-plugin.ts` の責務:

- `plugin.json` が存在
- `skills/sugaku-jitate-textbook-import/SKILL.md` が存在
- 正本Skillと配布Skillの相対パス集合が一致
- 各ファイルSHA-256一致
- Schema manifestのhash一致
- ビルド後に手編集された差異を検出

### 7.5 v2.1インストール対象

v2.1では、開発者本人がportable PluginをローカルMarketplaceへ追加し、インストールしてテストする。

受け入れフロー:

```text
npm run plugin:build
  ↓
npm run plugin:verify
  ↓
dist/sugaku-jitate-ai/
  ↓
ローカルMarketplaceへ追加
  ↓
ChatGPT/Codexを更新または再読込
  ↓
Pluginをインストール
  ↓
新規会話
  ↓
代表プロンプトでSkill起動
```

ローカルMarketplace登録の具体的なUI/コマンドは、実装・テスト時点のOpenAI公式仕様に従う。

### 7.6 v2.1対象外

- Plugin Directoryへの提出
- 一般公開
- 第三者向け配布サポート
- 組織一括配布
- 自動更新サービス

portable packageは将来の配布を妨げない構造にする。

## 8. Skill変更設計

### 8.1 `SKILL.md`

既存のPDF解析・確認・確定ゲートを維持する。

追加するのは「完成後の配送ルーティング」の入口のみ。

概念:

```text
Builder / Validator成功
        ↓
WebMCP直接取込を試せる？
  ├─ No  → JSONファイル
  └─ Yes
        ↓
webmcp-integration.mdを読む
```

詳細手順を `SKILL.md` に大量重複させない。

### 8.2 `references/webmcp-integration.md`

推奨内容:

```text
# すうがく仕立て WebMCP連携

1. 現revisionが明示確定済みでなければ書込ツールを呼ばない。
2. sujita_get_capabilities を呼ぶ。
3. worksheetFormat / version / schemaSha256 を確認する。
4. Schema hash不一致ならJSONへフォールバックする。
5. maxDirectImportBytesを超えるならJSONへフォールバックする。
6. sujita_validate_import に完成JSON文字列を渡す。
7. valid=falseなら直接取込を行わない。
8. candidateToken / payloadSha256を受け取る。
9. sujita_import_worksheet を呼ぶ。
10. CONSENT_REQUIREDなら利用者にすうがく仕立て側の「AI連携」をONにしてもらう。
11. 同じrequestIdで再試行する。
12. success=trueなら完成。
13. WebMCP固有障害ではJSONフォールバックを提案する。
```

---

### 8.3 Runtime Capability Probe

Skillは、図版処理または決定論的build/validate前に必要能力を確認する。

新規:

```text
AI/skills/sugaku-jitate-textbook-import/scripts/check_runtime_capabilities.mjs
```

出力例:

```json
{
  "runtime": {
    "node": { "available": true, "version": "..." },
    "python": { "available": true, "version": "..." }
  },
  "pythonModules": {
    "PIL": true,
    "pypdf": true,
    "fitz": false,
    "pypdfium2": false
  },
  "commands": {
    "pdftoppm": true,
    "mutool": false
  },
  "filesystem": {
    "readable": true,
    "writable": true
  }
}
```

値は実環境を検査した結果であり、固定値ではない。

### 8.4 図版fallback chain

`runtime-fallback-rules.md` に次の原則を定義する。

```text
Tier 1: 既存crop_pdf_figure.py + pdftoppm/Poppler
  ↓ unavailable
Tier 2: 実環境で利用可能な同等PDF rasterizer backend
  ↓ unavailable
Tier 3: 実行環境が提供する元PDFページ画像取得/切り出し機能
        ただし出力を保存・検証できる場合だけ使用
  ↓ unavailable
図版必須？
  ├─ No  → 続行
  └─ Yes → blocked
```

Tier 2の例としてPyMuPDF、pypdfium2、mutool等を検出してよいが、インストール済みであることを仮定してはならない。

Tier 3を利用する場合も次を満たす。

- 入力が元PDFである。
- AI画像生成を使わない。
- 図を意味的に再描画しない。
- crop範囲を利用者が確認できる。
- 出力Assetを既存Validatorで検証できる。

### 8.5 runtimeエラー

追加エラー:

```text
RUNTIME_CAPABILITY_CHECK_FAILED
FIGURE_PRIMARY_RUNTIME_UNAVAILABLE
FIGURE_RUNTIME_UNAVAILABLE
BUILDER_RUNTIME_UNAVAILABLE
VALIDATOR_RUNTIME_UNAVAILABLE
```

決定論的Validatorを実行できず、同等Validatorも利用できない場合、AIの自己判断だけで`completed`にしてはならない。

## 9. Schema manifest設計

### 9.1 正本

新規:

```text
schemas/math-worksheet.schema-manifest.json
```

### 9.2 内容

```ts
type MathWorksheetSchemaManifest = {
  format: "math-worksheet";
  schemaVersion: 1;
  source: "src/domain/worksheet/worksheet.schema.ts";
  generatedSchema: "schemas/math-worksheet.schema.json";
  sha256: string;
  generatedAt: string;
};
```

コミットSHAはビルド再現性を損なう場合があるため、必須フィールドとしない。必要であればrelease metadata側に持つ。

### 9.3 同期

`schema:generate` でroot schemaとmanifestを更新する。

`skill:schema:check` ではroot schema/manifestとSkill同梱物の一致を検証する。

---

## 10. WebMCP型定義

`src/infrastructure/webmcp/webmcp.d.ts` は使用するAPIだけを宣言する。

概念例:

```ts
type WebMcpTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: {
    readOnlyHint?: boolean;
  };
  execute: (input: unknown) => Promise<unknown> | unknown;
};

interface ModelContext {
  registerTool(tool: WebMcpTool): Promise<void> | void;
}

declare global {
  interface Document {
    modelContext?: ModelContext;
  }
}
```

OpenAI/ブラウザ側で標準型が提供された場合は独自宣言を縮小または削除する。

---

## 11. WebMCP bootstrap設計

### 11.1 登録場所

React `StrictMode` のEffectに直接登録処理を置かない。

`main.tsx` をcomposition rootとして利用する。

概念:

```ts
ReactDOM.createRoot(...).render(...);

void bootstrapWebMcp({
  aiImportService,
  session: webMcpSession,
});
```

### 11.2 feature detection

```ts
if (typeof document.modelContext?.registerTool !== "function") {
  return;
}
```

非対応をエラーとしない。

### 11.3 トップレベル

Site toolsはトップレベルページで登録する。

iframeへ依存しない。

---

## 12. WebMCP Session設計

```ts
type WebMcpSessionSnapshot = {
  supported: boolean;
  writeConsentGranted: boolean;
  registered: boolean;
};
```

API:

```ts
grantWriteConsent(): void
revokeWriteConsent(): void
isWriteConsentGranted(): boolean
subscribe(listener: () => void): () => void
getSnapshot(): WebMcpSessionSnapshot
```

書込許可はメモリ保持とする。

ページ再読込でOFFへ戻る。

---

## 13. Candidate Store設計

### 13.1 型

```ts
type ValidatedImportCandidate = {
  token: string;
  payloadSha256: string;
  item: WorksheetWithAssets;
  worksheetId: string;
  title: string;
  problemCount: number;
  assetCount: number;
  createdAtMs: number;
  expiresAtMs: number;
  consumed: boolean;
};
```

### 13.2 保存

```ts
Map<string, ValidatedImportCandidate>
```

を利用する。

### 13.3 TTL

初期値10分。

期限切れcandidateを利用しない。

### 13.4 消費

インポート成功後 `consumed = true` とし、再利用不可にする。

ただし同じ `requestId` の成功済み再試行はimport receiptから同じ成功結果を返す。

---

## 14. AI Import Application Service

### 14.1 インターフェース

概念:

```ts
export interface AiImportService {
  validateCandidate(input: ValidateAiImportInput): Promise<ValidatedCandidateSummary>;
  importCandidate(input: ImportAiCandidateInput): Promise<AiImportResult>;
}
```

### 14.2 `ValidateAiImportInput`

```ts
type ValidateAiImportInput = {
  payloadText: string;
  skillSchemaSha256: string;
};
```

### 14.3 `ImportAiCandidateInput`

```ts
type ImportAiCandidateInput = {
  candidateToken: string;
  requestId: string;
  expectedPayloadSha256: string;
};
```

WebMCP固有の `document.modelContext` をapplication層へ持ち込まない。

---

## 15. payloadサイズ検査

### 15.1 定数

```ts
export const MAX_WEBMCP_DIRECT_IMPORT_BYTES = 2 * 1024 * 1024;
```

2 MiBはアプリ独自の初期値。

### 15.2 バイト長

文字数ではなくUTF-8 byte lengthで判定する。

```ts
new TextEncoder().encode(payloadText).byteLength
```

### 15.3 通常JSON上限

既存 `MAX_BACKUP_FILE_BYTES = 100 * 1024 * 1024` を変更しない。

WebMCP上限と通常バックアップ上限を混同しない。

---

## 16. payload SHA-256

`crypto.subtle.digest("SHA-256", ...)` で計算する。

用途:

- validate時とimport時の候補一致
- requestId再試行の整合確認
- Schema hashとは別物

概念:

```ts
async function sha256Utf8(text: string): Promise<string>
```

返却は小文字16進文字列で統一する。

---

## 17. `sujita_get_capabilities`

### 17.1 性質

読取専用。

`annotations.readOnlyHint = true` を付ける。

### 17.2 inputSchema

```json
{
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

### 17.3 output

```ts
type SugakuJitateCapabilities = {
  app: "sujita";
  integrationVersion: 1;
  worksheetFormat: "math-worksheet";
  worksheetFileVersion: 1;
  schemaSha256: string;
  directImportAvailable: boolean;
  maxDirectImportBytes: number;
  writeConsentGranted: boolean;
};
```

### 17.4 注意

WebMCP対応そのものは既にツールが見えているため暗黙に分かるが、すうがく仕立て側のSchema・上限・許可状態の確認に必要。

---

## 18. `sujita_validate_import`

### 18.1 性質

永続データを書き換えない。

一時candidateをメモリへ保持するが、Worksheet/IndexedDBへ副作用を起こさない。

### 18.2 inputSchema

概念:

```json
{
  "type": "object",
  "required": ["payloadText", "skillSchemaSha256"],
  "properties": {
    "payloadText": { "type": "string" },
    "skillSchemaSha256": { "type": "string" }
  },
  "additionalProperties": false
}
```

### 18.3 実行手順

```text
input
 ↓
UTF-8 byte length
 ↓
skillSchemaSha256 == app schemaSha256 ?
 ↓
JSON.parse
 ↓
MathWorksheetFileSchema.parse
 ↓
kind == single ?
 ↓
hydrateBackup
 ↓
画像検証
 ↓
payload SHA-256
 ↓
candidate store
 ↓
summary返却
```

### 18.4 返却

成功:

```json
{
  "valid": true,
  "candidateToken": "uuid",
  "payloadSha256": "sha256",
  "worksheetId": "uuid",
  "title": "一次方程式",
  "problemCount": 8,
  "assetCount": 2,
  "expiresAt": "2026-09-11T..."
}
```

失敗:

```json
{
  "valid": false,
  "error": {
    "code": "INVALID_WORKSHEET_FILE",
    "message": "..."
  }
}
```

例外をそのまま利用者向けへ露出させない。

---

## 19. `sujita_import_worksheet`

### 19.1 性質

新規プリント保存という副作用を持つ。

### 19.2 inputSchema

```json
{
  "type": "object",
  "required": [
    "candidateToken",
    "requestId",
    "expectedPayloadSha256"
  ],
  "properties": {
    "candidateToken": { "type": "string" },
    "requestId": { "type": "string" },
    "expectedPayloadSha256": { "type": "string" }
  },
  "additionalProperties": false
}
```

`candidateToken` は初回importでは必須とする。completed receipt回復時は、実装内部ではcandidateを参照せずに成功結果を返せる。

### 19.3 実行順序

v2.1ではImport Receiptをcandidateより先に確認する。

```text
write consent?
 ↓ No → CONSENT_REQUIRED

request receipt exists?
 ├ completed
 │   ├ hash一致 → previous result
 │   └ hash不一致 → PAYLOAD_HASH_MISMATCH
 │
 ├ pending
 │   ↓
 │ repository.get(receipt.worksheetId)
 │   ├ exists
 │   │   ├ hash一致 → receiptをcompletedへ昇格 → previous result
 │   │   └ hash不一致 → PAYLOAD_HASH_MISMATCH
 │   └ none
 │       ↓
 │     stale pendingを整理
 │     ↓
 │     candidate確認へ
 │
 └ none
     ↓
   candidate確認へ

candidate exists?
 ↓ No
  ├ 過去にstale pendingあり → REVALIDATION_REQUIRED
  └ それ以外 → CANDIDATE_NOT_FOUND

candidate not expired?
 ↓ No → CANDIDATE_EXPIRED

payload hash match?
 ↓ No → PAYLOAD_HASH_MISMATCH

candidate not consumed?
 ↓ No → CANDIDATE_ALREADY_CONSUMED

sessionStorageへpending receipt
 ↓
WorksheetRepository.create(candidate.item)
 ↓
sessionStorageをcompleted
 ↓
candidate consumed
 ↓
AI Import Event発行
 ↓
success
```

### 19.4 書込とreceiptの順序

新規保存前にpending receiptを書き、保存成功後にcompletedへ昇格する。

Repository保存成功後・completed receipt確定後にAI Import Eventを発行する。

イベント発行失敗を理由にWorksheet保存を失敗扱いへ巻き戻さない。保存結果はRepository/receiptを正本とし、画面側は必要なら再読込で回復する。

## 20. Import Receipt設計

### 20.1 保存先

`sessionStorage`

キー例:

```text
sugaku-jitate:webmcp-import:<requestId>
```

### 20.2 値

```ts
type ImportReceipt = {
  requestId: string;
  payloadSha256: string;
  worksheetId: string;
  title: string;
  status: "pending" | "completed";
  createdAt: string;
  completedAt?: string;
};
```

### 20.3 receipt-first原則

import request受信時、candidate storeより先にreceiptを読む。

理由:

- candidateはページメモリなのでreloadで消失する。
- receiptはsessionStorageなので同一タブ/ブラウザセッションのreload後も残り得る。
- Repositoryへの保存直後にページreload/crashしても、pending receipt + Worksheet実体から成功状態を回復できる。

### 20.4 completed

completed receiptが存在し、`expectedPayloadSha256` と一致する場合:

- candidate存在確認を要求しない。
- Repositoryへの再保存を行わない。
- receiptのWorksheet ID/題名から成功結果を返す。

必要に応じてRepositoryで存在確認を行ってもよいが、再作成してはならない。

### 20.5 pending

pending receiptの場合:

1. hash一致確認
2. `repository.get(receipt.worksheetId)` を実行
3. 存在すればcompletedへ昇格
4. 存在しなければstale pendingとして整理
5. 同じrequestのcandidateが残っていれば再試行
6. candidateがなければ `REVALIDATION_REQUIRED`

### 20.6 再検証

`REVALIDATION_REQUIRED` を受けたSkillは同じpayloadを再度validateし、新candidateを得る。

再import時の`requestId`は変更しない。

payload SHA-256が元receiptと異なる場合、同一requestIdを再利用してはならない。

### 20.7 理由

- DB migrationを初期版で増やさない。
- 通常のtool retryを吸収できる。
- タブ内再読込にも対応できる。
- AI書込許可とは分離できる。

### 20.8 保証限界

v2.1では同一ブラウザ/タブセッション内の通常再試行を対象とする。

ブラウザセッション完全終了後までの厳密なExactly-once保証ではない。

将来、厳密な永続冪等性が必要なら専用IndexedDB tableを追加する。

### 20.9 AI Import Event設計

新規:

```text
src/application/ai-import/ai-import-events.ts
```

WebMCPやReactに依存しない小さなイベントハブとする。

概念:

```ts
export type AiImportCompletedEvent = {
  type: "ai-import-completed";
  worksheetId: string;
  title: string;
  requestId: string;
};

export function publishAiImportCompleted(
  event: AiImportCompletedEvent,
): void;

export function subscribeAiImportCompleted(
  listener: (event: AiImportCompletedEvent) => void,
): () => void;
```

実装は`EventTarget`等のブラウザ標準機能でよく、外部状態管理ライブラリを追加しない。

発行条件:

```text
Repository.create成功
  ↓
completed receipt確定
  ↓
publishAiImportCompleted
```

イベントには次を含めない。

- 教科書PDF
- problem本文全文
- Base64 Asset
- payloadText
- candidate object

イベントはUI同期通知であり、永続データの正本ではない。

## 21. 書込許可UI

### 21.1 表示条件

```ts
typeof document.modelContext?.registerTool === "function"
```

のときだけAI連携UIを表示する。

### 21.2 表示位置

推奨はWorksheet一覧画面のheader actions。

通常利用者の邪魔になる場合は、WebMCP対応時だけ表示する。

### 21.3 Consent Dialog

文言要件:

```text
ChatGPTから、このタブのすうがく仕立てへ
新しいプリントを追加できるようにします。

・既存プリントは変更しません。
・許可はこのページセッションだけです。
・教科書PDF本体はすうがく仕立てへ保存しません。

[キャンセル] [許可]
```

### 21.4 解除

ON状態のボタンを再度押して解除可能とする。

---

## 22. 状態設計

既存Skillの主要状態は維持する。

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

配送だけを別状態で管理する。

```ts
type DeliveryState =
  | "not-started"
  | "checking-webmcp"
  | "validating-target"
  | "awaiting-consent"
  | "importing"
  | "fallback-json"
  | "completed";
```

これにより既存Draft状態機械を大きく変更しない。

---

## 23. 直接取込シーケンス

```text
利用者
  │ 「この内容で確定し、すうがく仕立てへ追加」
  ▼
Skill
  │ confirmedRevision確認
  │ Runtime Capability確認
  │ Builder
  │ Validator
  ▼
完成payloadText
  │
  ├─ すうがく仕立て target URL / Site tools解決
  │
  ├─ get_capabilities
  │      ↓
  │   schema hash一致?
  │
  ├─ validate_import(payloadText)
  │      ↓
  │   candidateToken
  │
  ├─ import_worksheet(candidateToken, requestId)
  │      ↓
  │   CONSENT_REQUIRED?
  │      ├ Yes → 利用者がすうがく仕立てでAI連携ON
  │      └ No
  │
  ▼
すうがく仕立て
  │ receipt-first判定
  │ Repository.create
  │ completed receipt
  │ AI Import Event
  ▼
IndexedDB / WorksheetListScreen
  │
  ├─ 永続保存
  └─ repository.list() 再読込
  │
  ▼
success
  │ worksheetId / editorPath
  ▼
利用者
```

再試行時はcompleted/pending receiptを先に確認するため、candidateがページreloadで失われていても保存済みWorksheetの二重作成を避ける。

## 24. JSONフォールバックシーケンス

```text
Skill Validator成功
       ↓
Site toolsなし / Schema不一致 / 容量超過 / 直接取込失敗
       ↓
fallback-json
       ↓
既存単一プリントJSONを生成
       ↓
利用者がダウンロード
       ↓
すうがく仕立て既存ImportModal
       ↓
parseBackup
       ↓
hydrateBackup
       ↓
Repository
```

直接取込失敗を理由にSchema検証を省略してはならない。

---

## 25. Schema mismatch

Skill同梱manifest:

```text
skillSchemaSha256
```

すうがく仕立て capabilities:

```text
schemaSha256
```

を比較する。

不一致:

```json
{
  "valid": false,
  "error": {
    "code": "SCHEMA_MISMATCH",
    "message": "Skillとすうがく仕立てのSchemaが一致しません。JSON方式を使用してください。"
  }
}
```

初期版でSchema migrationや自動変換は行わない。

---

## 26. Error型

```ts
type AiImportErrorCode =
  | "WEBMCP_UNAVAILABLE"
  | "TARGET_URL_REQUIRED"
  | "SCHEMA_MISMATCH"
  | "DIRECT_IMPORT_TOO_LARGE"
  | "CONSENT_REQUIRED"
  | "CANDIDATE_NOT_FOUND"
  | "CANDIDATE_EXPIRED"
  | "CANDIDATE_ALREADY_CONSUMED"
  | "REVALIDATION_REQUIRED"
  | "PAYLOAD_HASH_MISMATCH"
  | "INVALID_JSON"
  | "INVALID_WORKSHEET_FILE"
  | "INVALID_ASSET"
  | "WORKSHEET_LIMIT_REACHED"
  | "IMPORT_FAILED"
  | "RUNTIME_CAPABILITY_CHECK_FAILED"
  | "FIGURE_PRIMARY_RUNTIME_UNAVAILABLE"
  | "FIGURE_RUNTIME_UNAVAILABLE"
  | "BUILDER_RUNTIME_UNAVAILABLE"
  | "VALIDATOR_RUNTIME_UNAVAILABLE";
```

公開結果:

```ts
type AiImportErrorResult = {
  success: false;
  error: {
    code: AiImportErrorCode;
    message: string;
    recoverable: boolean;
    fallbackRecommended: boolean;
  };
};
```

内部stack traceやライブラリ内部情報をそのままChatGPTへ返さない。

### エラー分類

- `REVALIDATION_REQUIRED`: 同じpayloadでvalidateを再実行して回復可能。
- `TARGET_URL_REQUIRED`: 利用者がすうがく仕立て URLを指定すれば回復可能。
- `FIGURE_PRIMARY_RUNTIME_UNAVAILABLE`: fallback経路探索へ進む内部/警告状態。
- `FIGURE_RUNTIME_UNAVAILABLE`: 必須図版がある場合はSkillの完成をblocked。
- `VALIDATOR_RUNTIME_UNAVAILABLE`: 同等の決定論的Validatorがなければ完成をblocked。

## 27. セキュリティ設計

### 27.1 最小ツール

初期公開:

```text
get_capabilities
validate_import
import_worksheet
```

のみ。

### 27.2 禁止ツール

以下を登録しない。

```text
execute_script
run_javascript
read_all_indexeddb
write_indexeddb
delete_worksheet
update_worksheet
empty_trash
read_local_file
upload_pdf
```

### 27.3 入力サイズ

JSON parse前にbyte lengthを確認する。

### 27.4 Schema validation

TypeScript型だけで信頼しない。

Zod実行時検証を通す。

### 27.5 画像

`hydrateBackup()` の既存画像検証を通す。

### 27.6 書込許可

アプリ独自Consentを必須にする。

ChatGPT内蔵ブラウザ側の安全確認だけへ依存しない。

### 27.7 CSP等

すうがく仕立てにCSPを導入する場合も、WebMCPを理由に `unsafe-eval` や任意外部スクリプト許可を追加しない。

---

## 28. privacy設計

すうがく仕立てへ永続保存するのは:

- Worksheet
- 採用Asset
- 既存すうがく仕立てが通常保存する情報

のみ。

すうがく仕立てへ永続保存しないもの:

- 教科書PDF本体
- OCR中間テキスト
- 範囲外本文
- 棄却問題
- 棄却Crop
- ChatGPT会話全文
- APIキー
- ChatGPT認証情報
- WebMCP candidate
- AI書込許可

Import receiptはsessionStorageに一時保持する。

---

## 29. ブラウザプロファイル設計上の注意

ChatGPT内蔵ブラウザは普段のブラウザと別プロファイルである場合がある。

したがって:

```text
通常Chromeのすうがく仕立て IndexedDB
≠
ChatGPT内蔵Browserのすうがく仕立て IndexedDB
```

となり得る。

アプリは両者の自動共有を実装しない。

利用者が別プロファイルへ移動したい場合は既存JSON export/importを利用する。

---

## 30. UI設計

### 30.1 非対応環境

WebMCP非対応時:

- AI連携ボタンを非表示、または
- 設定画面で「この環境では直接AI連携を利用できません」と表示

通常機能には影響させない。

### 30.2 対応環境

```text
AI連携: OFF
```

→ consent後

```text
AI連携: ON
```

### 30.3 インポート成功

Repository保存成功後、`ai-import-completed` eventを発行する。

一覧画面はevent受信時に、既存の一覧load処理を再実行する。

```text
AI Import Event
  ↓
WorksheetListScreen
  ↓
repository.list()
  ↓
setWorksheets(latest)
  ↓
Toast
```

Toast:

```text
「一次方程式」をAI連携から追加しました
[開く]
```

### 30.4 表示同期失敗

イベント購読側で再読込に失敗しても、Repository保存成功を取り消さない。

利用者へ一覧再読込を案内し、次回loadでRepositoryの正本へ収束させる。

### 30.5 ルート非表示時

WorksheetListScreenがmountされていない時はイベントを無理に保持しなくてよい。

後で一覧画面へ遷移した際、通常の初期loadで保存済みWorksheetを取得する。

## 31. application service擬似コード

```ts
export async function validateAiImport(
  input: ValidateAiImportInput,
): Promise<ValidatedCandidateSummary> {
  const bytes = new TextEncoder().encode(input.payloadText).byteLength;
  if (bytes > MAX_WEBMCP_DIRECT_IMPORT_BYTES) {
    throw new AiImportError("DIRECT_IMPORT_TOO_LARGE");
  }

  if (input.skillSchemaSha256 !== APP_SCHEMA_SHA256) {
    throw new AiImportError("SCHEMA_MISMATCH");
  }

  let raw: unknown;
  try {
    raw = JSON.parse(input.payloadText);
  } catch {
    throw new AiImportError("INVALID_JSON");
  }

  const file = MathWorksheetFileSchema.parse(raw);

  if (file.kind !== "single") {
    throw new AiImportError("INVALID_WORKSHEET_FILE");
  }

  const [item] = await hydrateBackup(file);
  if (!item) {
    throw new AiImportError("INVALID_WORKSHEET_FILE");
  }

  const payloadSha256 = await sha256Utf8(input.payloadText);
  return candidateStore.create({
    payloadSha256,
    item,
  });
}
```

---

## 32. import擬似コード

```ts
export async function importAiCandidate(
  input: ImportAiCandidateInput,
): Promise<AiImportResult> {
  if (!webMcpSession.isWriteConsentGranted()) {
    return failure("CONSENT_REQUIRED");
  }

  // v2.1: candidateより先にreceiptを確認する。
  const previous = readImportReceipt(input.requestId);

  if (previous) {
    if (previous.payloadSha256 !== input.expectedPayloadSha256) {
      return failure("PAYLOAD_HASH_MISMATCH");
    }

    if (previous.status === "completed") {
      return successFromReceipt(previous);
    }

    const saved = await repository.get(previous.worksheetId);
    if (saved) {
      const recovered = writeCompletedReceipt(previous);
      return successFromReceipt(recovered);
    }

    // 保存実体がないpendingはstaleとみなす。
    clearImportReceipt(input.requestId);
  }

  const candidate = candidateStore.get(input.candidateToken);

  if (!candidate) {
    return previous
      ? failure("REVALIDATION_REQUIRED")
      : failure("CANDIDATE_NOT_FOUND");
  }

  if (candidate.expiresAtMs < Date.now()) {
    return failure("CANDIDATE_EXPIRED");
  }

  if (candidate.payloadSha256 !== input.expectedPayloadSha256) {
    return failure("PAYLOAD_HASH_MISMATCH");
  }

  if (candidate.consumed) {
    return failure("CANDIDATE_ALREADY_CONSUMED");
  }

  writePendingReceipt({
    requestId: input.requestId,
    payloadSha256: candidate.payloadSha256,
    worksheetId: candidate.worksheetId,
    title: candidate.title,
  });

  try {
    await repository.create(candidate.item);
  } catch (error) {
    // Repositoryに保存されていないことを確認できる通常失敗では
    // pending receiptを整理して再試行可能にする。
    clearImportReceipt(input.requestId);
    return normalizeRepositoryFailure(error);
  }

  const receipt = writeCompletedReceipt({
    requestId: input.requestId,
    payloadSha256: candidate.payloadSha256,
    worksheetId: candidate.worksheetId,
    title: candidate.title,
  });

  candidateStore.consume(candidate.token);

  publishAiImportCompleted({
    type: "ai-import-completed",
    worksheetId: receipt.worksheetId,
    title: receipt.title,
    requestId: receipt.requestId,
  });

  return successFromReceipt(receipt);
}
```

### 32.1 Repository失敗の注意

例外が発生した時に「保存されたか不明」な種類の障害が存在する実装へ変更する場合、pending receiptを即座に消してはならない。

その場合はRepositoryを`worksheetId`で照合してからreceipt状態を決定する。

現在のDexie transactionを利用するRepository実装では、そのトランザクション意味論をテストで固定する。

## 33. WebMCP tool登録擬似コード

```ts
export async function registerSugakuJitateTools(deps: Dependencies) {
  const context = document.modelContext;
  if (!context?.registerTool) return;

  await context.registerTool({
    name: "sujita_get_capabilities",
    description: "Read すうがく仕立て direct-import capabilities.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    execute: () => deps.capabilities.get(),
  });

  await context.registerTool({
    name: "sujita_validate_import",
    description:
      "Validate a reviewed すうがく仕立て single-worksheet payload without saving it.",
    inputSchema: validateInputSchema,
    annotations: { readOnlyHint: true },
    execute: (input) => deps.aiImport.validateCandidate(input),
  });

  await context.registerTool({
    name: "sujita_import_worksheet",
    description:
      "Save a previously validated candidate as a new すうがく仕立て worksheet. Requires in-page user consent.",
    inputSchema: importInputSchema,
    execute: (input) => deps.aiImport.importCandidate(input),
  });
}
```

ツールdescriptionには副作用と前提を明示する。

---

## 34. `main.tsx`変更案

現在:

```ts
ReactDOM.createRoot(...).render(...);
```

変更概念:

```ts
ReactDOM.createRoot(...).render(...);

void bootstrapAiWebMcp();
```

`bootstrapAiWebMcp()` 内で必要依存を組み立てる。

`App.tsx` の `supportsRequiredApis()` へWebMCPを追加しない。

---

## 35. `WorksheetListScreen`変更案

既存header actionsへWebMCP対応時のみ状態UIを追加する。

例:

```tsx
<div className="header-actions">
  <AiIntegrationStatus />
  <ManualContextLink ... />
  <button ...>設定・バックアップ</button>
</div>
```

AI連携ON/OFFは一覧コンポーネントのローカルuseStateへ閉じず、`webmcp-session` の外部ストアを購読する。

### 35.1 一覧再読込

一覧データを取得する既存処理を、初期表示とAI Import Eventの両方から呼べる関数へ整理する。

概念:

```ts
const loadWorksheets = useCallback(async () => {
  const latest = await worksheetRepository.list();
  setWorksheets(latest);
}, []);

useEffect(() => {
  void loadWorksheets();
}, [loadWorksheets]);

useEffect(() => {
  return subscribeAiImportCompleted((event) => {
    void loadWorksheets().then(() => {
      showToast(`「${event.title}」をAI連携から追加しました`);
    });
  });
}, [loadWorksheets]);
```

実際には既存のエラー処理・mounted判定・Toast APIへ合わせる。

### 35.2 依存方向

`WorksheetListScreen` は `application/ai-import/ai-import-events` を購読してよい。

`infrastructure/webmcp/register-sugaku-jitate-tools.ts` から `WorksheetListScreen` またはReactのsetterをimportしてはならない。

## 36. StrictMode対策

React StrictModeは開発時にEffectを再実行する場合がある。

Site tool登録をReact component Effectから行わず、module/composition rootから一度だけ呼ぶ。

登録関数にもmodule-scope guardを設ける。

```ts
let registered = false;

export async function registerSugakuJitateTools(...) {
  if (registered) return;
  ...
  registered = true;
}
```

HMR時の挙動は開発環境テストで確認する。

---

### 36.1 すうがく仕立て target URL設計

正式URLは `https://app.sujita.jp/` とする。

次を禁止する。

```text
正式URL以外の本番URLを固定
localhostのポートを本番契約として固定
不正な明示URLを正式URLへ黙って置換
```

Skillの対象ページ解決順序:

```text
A. 現在開いているページからすうがく仕立て Site toolsを発見
   → 使用

B. 同一会話で利用者がすうがく仕立て URLを明示
   → そのURLを使用

C. 自己テスト手順がlocalhost URLを指定
   → そのURLを使用

D. どれもない
   → 正式URL https://app.sujita.jp/ を使用
```

開発サーバーについても`localhost:5173`等を固定契約にしない。Viteが別ポートへフォールバックする可能性を考慮し、実際に起動したURLを使用する。

本番のdeployment originと許可originは `https://app.sujita.jp` とする。

## 37. Plugin buildのpackage scripts

例:

```json
{
  "scripts": {
    "plugin:build": "tsx scripts/build-sugaku-jitate-plugin.ts",
    "plugin:verify": "tsx scripts/verify-sugaku-jitate-plugin.ts",
    "verify": "npm run typecheck && npm run lint && npm run schema:check && npm run skill:schema:check && npm run plugin:verify && npm run schema:test && npm run manual:check && npm run test"
  }
}
```

既存verifyの順序を壊さないよう調整する。

---

## 38. 単体テスト

### 38.1 `ai-import-service.test.ts`

ケース:

1. 正常single
2. archive
3. invalid JSON
4. invalid Schema
5. size limit
6. schema mismatch
7. invalid Base64
8. invalid image
9. ID remap
10. candidate expiry
11. candidate consumed
12. repository failure
13. completed receipt + candidateなし
14. pending receipt + RepositoryにWorksheetあり
15. pending receipt + Repositoryなし + candidateあり
16. pending receipt + Repositoryなし + candidateなし → REVALIDATION_REQUIRED
17. receipt hash mismatch
18. import成功時のAI Import Event
19. save failure時にsuccess eventを出さない

### 38.2 `register-sugaku-jitate-tools.test.ts`

- `document.modelContext` undefined
- registerTool存在
- 3ツールだけ登録
- 読取annotation
- input passthrough
- error normalization
- WebMCP層がReact moduleへ依存しない

### 38.3 `AiIntegrationStatus.test.tsx`

- unsupported時非表示
- OFF表示
- consent dialog
- 許可
- 解除
- reload相当でOFF

### 38.4 `ai-import-events` test

- subscribe
- publish
- unsubscribe
- payload全文をeventへ渡さない設計
- listener例外が永続保存結果を壊さない

### 38.5 Runtime Capability Probe test

代表環境をstubして次を検査する。

- primary dependencies全部あり
- `pdftoppm`なし + 代替backendあり
- Python module不足 + 代替backendあり
- 全crop backendなし + 図版不要
- 全crop backendなし + 図版必須
- Validator runtimeなし
- capability probe自体の失敗

実際のCI環境に偶然インストールされているコマンドだけにテスト結果を依存させず、検出ロジックをstub可能にする。

## 39. E2Eテスト

実際のChatGPTへ接続せず、テストページへ `document.modelContext` mockを注入する。

テスト:

```text
1. アプリ起動
2. Site tools登録を捕捉
3. capabilitiesを直接invoke
4. 正常payloadでvalidate
5. consent OFFのimport失敗
6. UIからconsent ON
7. 同candidateをimport
8. IndexedDBに1件追加
9. AI Import Event発行
10. 一覧が自動再読込
11. 同requestIdで再invoke
12. 件数が1件のまま
13. 一覧に題名表示
14. 編集画面を開く
```

追加reload回復ケース:

```text
1. pending receiptを書いた状態を作る
2. WorksheetをRepositoryへ保存
3. candidate storeを空にしてreload相当
4. same requestIdでimport
5. receipt-first処理でWorksheetを検出
6. completedへ回復
7. 重複Worksheetを作らない
```

URL解決はfixtureで明示URLを注入し、本番URLへ依存させない。

Playwright側のテスト用fixtureで実装する。

## 40. Pluginテスト

Plugin packageについて次を自動検査する。

- root `plugin.json`
- `skills/`
- Skill frontmatter
- `agents/openai.yaml`
- references
- runtime fallback rules
- runtime capability probe
- scripts
- schemas
- source/package hash一致
- 不要秘密情報なし
- APIキー文字列なし
- 正式URL以外の本番URLと固定localhostの混入なし
- 絶対ローカルパスなし

### 40.1 手動自己テスト

v2.1では開発者本人が次を行う。

```text
1. portable Plugin build
2. verify
3. ローカルMarketplaceへ登録
4. Plugin install
5. 新規会話を開始
6. Skillを明示または適切なプロンプトで起動
7. 図版なし代表PDFを処理
8. 図版あり代表PDFを処理
9. WebMCP非対応/未接続時のJSON fallback確認
10. WebMCP対応時のdirect import確認
11. same requestId回復確認
12. Pluginを無効化/削除して通常すうがく仕立てが影響を受けないことを確認
```

### 40.2 v2.1で行わないテスト

- Plugin Directory公開審査
- 第三者アカウントでの一般配布
- Enterprise/Edu組織配布
- 公開Pluginの自動更新

これらは公開方針決定後に追加する。

## 41. CI

既存 `Verify` に追加する。

```text
typecheck
lint
schema:check
skill:schema:check
plugin:verify
schema:test
manual:check
unit tests
E2E
```

WebMCP実ブラウザ機能はロールアウト依存のため、CIの必須成功条件を外部ChatGPT接続へ依存させない。

---

## 42. エラー時フォールバック規則

### JSONフォールバック可

- WEBMCP_UNAVAILABLE
- TARGET_URL_REQUIRED（利用者が直接取込を継続しない場合）
- SCHEMA_MISMATCH
- DIRECT_IMPORT_TOO_LARGE
- CANDIDATE_EXPIRED
- Site tool transport failure

### 再検証してWebMCP再試行

- REVALIDATION_REQUIRED

同じpayloadをvalidateし、同じ`requestId`を再使用する。payload hashが変わる場合は新しいrequestIdが必要。

### 図版runtime fallback

- FIGURE_PRIMARY_RUNTIME_UNAVAILABLE

元PDF由来の同等代替backendを探索する。

### 原則blockedまたは修正

- FIGURE_RUNTIME_UNAVAILABLE かつ採用問題に必須図版あり
- BUILDER_RUNTIME_UNAVAILABLE かつ同等build経路なし
- VALIDATOR_RUNTIME_UNAVAILABLE かつ同等validatorなし
- INVALID_WORKSHEET_FILE
- INVALID_ASSET
- Skill Validator failure

これらはJSONへ切り替えるだけで正しくなる問題ではない。

### 利用者操作待ち

- CONSENT_REQUIRED
- WORKSHEET_LIMIT_REACHED
- TARGET_URL_REQUIRED（直接取込を継続する場合）

## 43. すうがく仕立て側の能力情報

`sugaku-jitate-capabilities.ts`:

```ts
export const SUGAKU_JITATE_AI_INTEGRATION_VERSION = 1;
export const MAX_WEBMCP_DIRECT_IMPORT_BYTES = 2 * 1024 * 1024;

export function getSugakuJitateCapabilities(): SugakuJitateCapabilities {
  return {
    app: "sujita",
    integrationVersion: SUGAKU_JITATE_AI_INTEGRATION_VERSION,
    worksheetFormat: "math-worksheet",
    worksheetFileVersion: 1,
    schemaSha256: SCHEMA_MANIFEST.sha256,
    directImportAvailable: true,
    maxDirectImportBytes: MAX_WEBMCP_DIRECT_IMPORT_BYTES,
    writeConsentGranted: webMcpSession.isWriteConsentGranted(),
  };
}
```

app versionも必要なら追加できるが、互換判定はSchemaとintegrationVersionを主に使う。

---

## 44. Skill側配送アルゴリズム

擬似アルゴリズム:

```text
run Runtime Capability Probe

if required deterministic builder/validator unavailable:
    try equivalent verified runtime path
    if none:
        blocked

for each accepted item requiring a figure:
    if primary crop available:
        use primary
    else:
        try verified PDF-derived fallback
        if none:
            blocked

if draft.confirmedRevision != draft.revision:
    stop

build candidate
run skill validator

if validator invalid:
    return review-required or blocked

resolve すうがく仕立て target:
    if Site tools already visible:
        continue
    else if user/session/test supplied target URL:
        open that URL and discover tools
    else:
        TARGET_URL_REQUIRED
        user may provide URL or choose JSON fallback

if WebMCP tool unavailable:
    deliver JSON

cap = get_capabilities()

if cap.worksheetFormat != "math-worksheet":
    deliver JSON

if cap.worksheetFileVersion != 1:
    deliver JSON

if cap.schemaSha256 != skill.schemaSha256:
    deliver JSON with schema mismatch notice

if payloadBytes > cap.maxDirectImportBytes:
    deliver JSON

validation = validate_import(payloadText, skill.schemaSha256)

if not validation.valid:
    if validation error is transport/path limitation:
        deliver JSON
    else:
        fix candidate before delivery

requestId = new UUID for this logical delivery attempt

result = import_worksheet(
    validation.candidateToken,
    requestId,
    validation.payloadSha256
)

if result == CONSENT_REQUIRED:
    ask user to enable AI integration in すうがく仕立て
    retry SAME requestId

if result == REVALIDATION_REQUIRED:
    validation = validate_import(SAME payloadText, SAME schema hash)
    retry import with SAME requestId and NEW candidateToken

if success:
    report title + editorPath
else:
    classify and either retry safely or fall back
```

`requestId` は1回のtool呼び出しではなく、「同じ完成payloadをすうがく仕立てへ1回だけ追加する」という論理操作を識別する。

## 45. 図版転送

初期版は完成 `MathWorksheetFile` にBase64 Assetを含む現在の方式を維持する。

ただし2 MiB直接取込上限を超えた場合、JSONへフォールバックする。

初期版で次を実装しない。

- WebMCP chunk upload
- Blob streaming
- PDFをすうがく仕立てへ送るSite tool
- PDFのIndexedDB保存

将来の候補:

```text
ChatGPT側
  └ crop座標のみ生成

すうがく仕立て側
  └ 利用者が同じPDFを選択
      ↓
     browser-side crop
```

この方式は将来設計とし、初期版へ含めない。

---

## 46. 既存ImportModalとの関係

既存ImportModalは削除しない。

役割:

- 通常利用者のJSON復元
- WebMCPフォールバック
- 別ブラウザプロファイル間移動
- バックアップ復元

AI直接取込と通常ImportModalは同じSchema・hydrate処理へ収束させる。

---

## 47. 既存Repositoryとの関係

初期版では `WorksheetRepository` にWebMCP専用メソッドを追加しない。

理由:

- AIはapplication concern。
- Repositoryは永続化の一般契約に保つ。
- 新規プリント保存は既存 `create()` で表現できる。

将来、永続Import ReceiptをIndexedDBへ保存する場合は別Portを検討する。

---

## 48. ロギング

サーバーログは存在しない。

開発時console logへ教科書本文や完成payload全文を出力しない。

必要なログは次程度に限定する。

- Tool登録成功/失敗
- エラーコード
- runtime capability名とavailability
- 選択したcrop backend名
- payload byte length
- problemCount
- assetCount
- worksheetId
- requestId
- receipt state transition
- AI Import Event発行成否
- timing

ログへ次を出さない。

- PDF本体
- Base64 Asset
- 問題本文全文
- ChatGPT会話全文
- APIキー
- 認証情報

本番ではdebug logを抑制する。

## 49. アクセシビリティ

AI連携UI:

- buttonとして実装
- ON/OFFを色だけで表現しない
- `aria-pressed` 等で状態表現
- Consent Dialogは既存 `Modal` を再利用
- Escape/フォーカストラップ等は既存Modal仕様に従う

---

## 50. マニュアル更新

アプリ内マニュアル「AI Skillsの使い方」を更新する。

追加内容:

- portable Pluginの位置付け
- v2.1では開発者本人のローカルMarketplace自己テストが対象であること
- Pluginのローカルインストール/削除手順
- ChatGPTでPDFを処理すること
- Runtime Capability Probe
- 図版primary/fallback/blockedの意味
- WebMCP直接取込
- AI連携ON
- 正式URLが `https://app.sujita.jp/` であること
- 自己テストでは実際に起動したlocalhost URLを使うこと
- 保存されるブラウザプロファイル
- WebMCPが使えない場合のJSON方式
- Schema mismatch時の対処
- 容量超過時の対処
- REVALIDATION_REQUIRED時の自動再検証
- APIキー不要
- 利用者自身のChatGPT利用枠を使うこと

一般公開Pluginのインストール手順はv2.1マニュアルへ含めない。

## 51. 移行方針

既存Skill利用者を破壊しない。

旧利用:

```text
Skill → JSON → すうがく仕立て
```

は引き続き使用可能。

新利用:

```text
Plugin/Skill → WebMCP → すうがく仕立て
```

を追加する。

Skillの既存入力・確認ルールは可能な限り維持する。

---

## 52. 実装フェーズ

### Phase 1: portable Plugin + Runtime自己テスト

- manifest
- build script
- verify script
- schema manifest
- Runtime Capability Probe
- runtime fallback rules
- Skill package CI
- ローカルMarketplace登録
- 開発者本人によるPlugin install

### Phase 2: WebMCP read/validate

- webmcp types
- capabilities
- candidate store
- validate tool
- application service
- target URL解決
- 正式URL既定値と開発URL優先順位の確認

### Phase 3: WebMCP direct import

- consent session
- UI
- import tool
- receipt module
- receipt-first回復
- `REVALIDATION_REQUIRED`
- AI Import Event
- Worksheet一覧自動再読込
- Toast

### Phase 4: Skill配送統合

- Skill `webmcp-integration.md`
- runtime fallback連携
- JSON fallback routing
- manuals
- unit tests
- E2E
- ChatGPTローカルPlugin自己テスト

### Phase 5: 将来の公開設計

v2.1完成条件には含めない。

- 第三者配布
- Plugin Directory提出
- 組織配布
- version/update policy

## 53. 実装時に再確認する外部仕様

リリースまたは自己テスト直前にOpenAI公式文書で次を確認する。

- portable Plugin manifest schema
- ローカルMarketplaceへのPlugin追加方法
- Plugin install / reload / disable / remove方法
- Skill package仕様
- `agents/openai.yaml` の現行仕様
- WebMCP `registerTool` API
- Site toolsの対応画面
- Site toolsの対応モデル
- Site toolsの対応プラン/Workspace
- WebMCP input/output制約
- セキュリティ確認仕様
- ChatGPT内蔵ブラウザのlocalhost対応
- ブラウザプロファイル仕様

v2.1では公開Plugin Directoryへの提出仕様は実装ブロッカーではない。

外部仕様が変わった場合でも、`application/ai-import` と `ai-import-events` はWebMCPから独立しているため、接続層だけを変更できる構造を維持する。

## 54. 受け入れテスト一覧

| ID | 条件 | 期待結果 |
|---|---|---|
| AI-PLG-001 | plugin build | portable package生成 |
| AI-PLG-002 | plugin verify | Skill正本と一致 |
| AI-PLG-003 | local Marketplace | 開発者本人が登録・install可能 |
| AI-RUN-001 | primary runtimeあり | 既存crop経路使用 |
| AI-RUN-002 | primaryなし・fallbackあり | fallback使用 |
| AI-RUN-003 | crop backendなし・図版不要 | 処理続行 |
| AI-RUN-004 | crop backendなし・図版必須 | blocked |
| AI-RUN-005 | validator runtimeなし | 同等validatorがなければblocked |
| AI-WEB-001 | WebMCPなし | すうがく仕立て通常起動 |
| AI-WEB-002 | capabilities | Schema hash等を返す |
| AI-WEB-003 | Skill hash不一致 | validate拒否 |
| AI-WEB-004 | payload > 2 MiB | direct import拒否・fallback可能 |
| AI-WEB-005 | invalid JSON | 保存なし |
| AI-WEB-006 | invalid Schema | 保存なし |
| AI-WEB-007 | invalid image | 保存なし |
| AI-WEB-008 | valid payload | candidate生成 |
| AI-WEB-009 | consent OFF | import拒否 |
| AI-WEB-010 | consent ON | import成功 |
| AI-WEB-011 | import成功 | 新規ID |
| AI-WEB-012 | 既存データあり | 上書きしない |
| AI-WEB-013 | same requestId retry | 重複しない |
| AI-WEB-014 | candidate期限切れ | 保存なし |
| AI-WEB-015 | hash mismatch | 保存なし |
| AI-WEB-016 | completed receipt + candidateなし | 既存成功結果を返す |
| AI-WEB-017 | pending receipt + DBにWorksheetあり | completedへ回復 |
| AI-WEB-018 | pending receipt + DBなし + candidateなし | REVALIDATION_REQUIRED |
| AI-WEB-019 | revalidation後same requestId | 1件だけ保存 |
| AI-WEB-020 | import成功 | AI Import Event発行 |
| AI-UI-001 | event受信 | 一覧をrepository.listで更新 |
| AI-UI-002 | event受信 | 成功Toast |
| AI-URL-001 | Site tools既発見 | URL指定不要 |
| AI-URL-002 | 明示URLあり | そのURLを使用 |
| AI-URL-003 | URL未指定 | 正式URL `https://app.sujita.jp/` を使用 |
| AI-WEB-021 | repository error | successを返さない |
| AI-WEB-022 | success | 編集・保存可能 |
| AI-WEB-023 | success | PDF出力可能 |
| AI-WEB-024 | direct unavailable | JSON import可能 |

## 55. 利点と欠点

### 利点

- APIキー不要
- OpenAI API従量課金なし
- 外部MCPサーバー不要
- 既存Skill再利用
- 既存Schema再利用
- 既存Repository再利用
- 利用者自身のChatGPT利用環境を利用
- すうがく仕立てのローカル保存を維持
- JSON手動インポートを省略可能
- WebMCP非対応でも従来方式が残る
- runtime依存不足を事前検知できる
- 元PDF由来の安全な代替crop経路を利用できる
- reload直後の再試行でもreceiptから二重作成を避けやすい
- WebMCP保存結果をReact一覧へ自動反映できる
- 正式URLを既定値としつつlocalhost自己テストも進められる
- 公開審査を待たず個人ローカルMarketplaceでPlugin検証できる

### 欠点

- ChatGPTのWebMCP提供状況に依存
- 対応モデル・プラン等が変わり得る
- Skill実行環境によって利用可能runtimeが異なる
- すべての図版backendが使えない環境では図版必須処理を完成できない
- ChatGPT内蔵ブラウザと普段のブラウザの保存領域が異なり得る
- 大容量画像を含むWorksheetは直接取込しにくい
- WebMCP仕様変更時に接続層の保守が必要
- v2.1ではPluginの一般公開・第三者配布を完成条件にしていない
- deployment時に `https://app.sujita.jp` のDNS・TLS・origin設定が必要
- sessionStorage冪等性はブラウザセッション終了後までのExactly-once保証ではない

## 56. 要点

最終設計は次とする。

```text
既存Skill
  ↓
Runtime Capability Probe
  ├─ primary実行可能
  └─ 不可 → 元PDF由来の検証可能fallback
               └─ 必須能力なし → blocked
  ↓
portable Pluginとしてbuild/verify
  ↓
開発者本人のローカルMarketplaceでinstall
  ↓
利用者本人のChatGPTで実行
  ↓
利用者が内容を明示確定
  ↓
Skill Builder / Validator
  ↓
すうがく仕立て targetを解決
  ↓
WebMCP Site tools
  ↓
すうがく仕立て再検証
  ↓
hydrateBackup()
  ↓
receipt-first冪等性判定
  ↓
WorksheetRepository.create()
  ↓
completed receipt
  ↓
AI Import Event
  ├─ IndexedDB: 永続正本
  └─ WorksheetListScreen: repository.list()で再同期
```

WebMCPが使えない場合:

```text
Skill
 ↓
検証済み単一プリントJSON
 ↓
既存すうがく仕立て ImportModal
```

すうがく仕立ての正式URLは `https://app.sujita.jp/` とする。自己テスト時は実際に起動したlocalhost等のURLを優先できる。

v2.1のPlugin配布範囲は開発者本人のローカルMarketplaceへの登録・インストール・テストまでとし、一般公開は将来要件とする。

OpenAI API、APIキー、外部MCPサーバーは不要とする。

## 57. 参考資料

- すうがく仕立て Repository
  https://github.com/drthomas246/math_editor
- すうがく仕立て Worksheet Schema
  https://github.com/drthomas246/math_editor/blob/master/src/domain/worksheet/worksheet.schema.ts
- すうがく仕立て Backup implementation
  https://github.com/drthomas246/math_editor/blob/master/src/application/backup/backup.ts
- すうがく仕立て WorksheetRepository
  https://github.com/drthomas246/math_editor/blob/master/src/application/repositories/worksheet-repository.ts
- OpenAI: Build plugins / local Marketplace  
  https://learn.chatgpt.com/docs/build-plugins
- OpenAI: Build skills  
  https://learn.chatgpt.com/docs/build-skills
- OpenAI: Site tools (WebMCP)  
  https://learn.chatgpt.com/docs/webmcp
- OpenAI: Browser  
  https://learn.chatgpt.com/docs/browser
- WebMCP specification  
  https://webmachinelearning.github.io/webmcp/
