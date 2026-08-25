# 検証規則

## 段階

```text
Draft invariants
  -> Worksheet構造
  -> bundle済みZod Schema
  -> Base64・画像・直列化サイズ
  -> Math Editor実インポート
```

生成JSON Schemaだけでは`superRefine`相関制約を表現できない。JSON Schema検証だけで完成扱いにしない。

## Draft検証

- rangeが`resolved`
- item order、itemKey、figureKey、issueIdが一意
- accepted itemが包含範囲内、excluded itemをBuilder対象にしない
- pending itemが0、accepted itemが1件以上
- 図版座標が正規化範囲内、accepted figureに最終outputがある
- 権利確認・外部送信理解がtrue
- 未解決Fatalが0
- accepted itemに関係するWarningが提示・acknowledgedまたはresolved
- `confirmation.status === "confirmed"`
- `confirmedRevision === revision`
- `validationSummary.lastValidatedRevision === revision`

## 最終構造・相関

- strict object相当の未知フィールド拒否
- 必須フィールド、列挙値、文字列・配列・数値上限
- `format: "math-worksheet"`、`kind: "single"`、`version: 1`
- `header.title === worksheet.title`
- Asset IDを含む全Entity IDがファイル全体で一意
- RichText許可ノード、総ノード数、深度、同種mark重複なし
- LaTeXが空白のみでなく、禁止コマンドなし
- 表列幅合計100±0.01、結合範囲外・重複・未定義セルなし
- 全`assetId`にAssetがあり、`worksheetId`が参照元と一致
- 未参照余剰Assetなし
- Base64がdata URL接頭辞なしで復号可能、画像MIMEと実体が一致
- 画像1点10MiB以下、各辺10,000px以下、40MP以下
- UTF-8直列化後100MiB以下

## Validator CLI

```text
node scripts/validate_math_worksheet.mjs candidate.json
```

Validatorは入力を書き換えず、標準出力に次を返す。

```ts
type ValidationResult = {
  valid: boolean;
  schemaVersion: 1;
  errors: Array<{ code: string; path: string; message: string }>;
  summary: {
    worksheetCount: 1;
    problemCount: number;
    assetCount: number;
    referencedAssetCount: number;
  };
};
```

成功は終了コード0、`valid === true`、`errors.length === 0`のAND条件。失敗候補を完成ファイルとして渡さない。

## Schema drift

`schemas/schema-manifest.json`のSHA-256と同梱`schemas/math-worksheet.schema.json`が一致しない場合、`AI_SCHEMA_DRIFT` Fatalとする。更新時はMath Editor側で次を行う。

1. `npm run schema:check`
2. `npm run schema:test`
3. 最新`worksheet.schema.ts`とZodからValidatorをbundleし直す
4. 生成SchemaをSkillへコピー
5. manifestのcommit、hash、generatedAtを更新
6. リポジトリ版とSkill版のSHA-256一致を確認
7. 代表JSONをMath Editorの`parseBackup()`へ通す

Schemaだけ、Validatorだけ、mappingだけを単独更新しない。

## リリース前回帰

Math Editorリポジトリで`npm run schema:check`、`npm run schema:test`、`npm run verify`、`npm run test:e2e`、`npm run build`を実行する。市販教科書をテストデータへ含めず、権利上問題のないtext/scan PDFで範囲、数式、図版、解答、回転、曖昧ケースを確認する。
