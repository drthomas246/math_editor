# Worksheetマッピング

最終データの正本は同梱`schemas/math-worksheet.schema.json`と、Validatorへbundleされた`MathWorksheetFileSchema`である。ここでは確定Draftからの生成意味論を定める。

## Worksheet初期値

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

題名を変更するときは`worksheet.title`と`header.title`を同じ値にする。

## IDと日時

Worksheet、Problem、ContentBlock、SubQuestion、RichText内image/table/spacer、TableRow、TableCell、Assetを含む全Entityに1文字以上の一意IDを付ける。Draftの`itemKey`、`figureKey`、既存Draft内IDは永続IDとして流用しない。1つのグローバル集合でファイル全体の重複を防ぐ。

`exportedAt`、Worksheetの`createdAt` / `updatedAt`、Assetの`createdAt`はタイムゾーン付きISO 8601とする。1回のbuildで共通timestampを使ってよい。

## ProblemBlock

accepted itemだけを`order`昇順に変換する。

```ts
{
  id: string;
  type: "problem";
  kind: "problem" | "example";
  numbering: { enabled: true; restartAt: null };
  contents: ContentBlock[];
  solution: SolutionRichTextDocument | null;
  pageBreakBefore: false;
  pageBreakAfter: false;
}
```

原則、先頭に問題本文`RichTextBlock`を1件置く。小問があればその後に`SubQuestionGroupBlock`を置く。独立図版・表は対応する本文または小問の直後へ置く。

## 問題本文と解答

現行エディタの正規形に合わせ、問題色文書とanswerColor付き解答を同じ`document`へ統合し、互換用`answerDocument`は空文書にする。

```ts
{
  id: string;
  type: "richText";
  document: BasicRichTextDocument;
  answerDocument: BasicRichTextDocument; // 空文書
}
```

空文書：

```json
{
  "type": "doc",
  "content": [
    { "type": "paragraph", "attrs": { "textAlign": "left" }, "content": [] }
  ]
}
```

小問も`content`へ問題色＋answerColor付き解答を統合し、`answerContent`は空文書、`answerArea: null`、個別解説は`solution`とする。要件にない生徒用解答欄を自動追加しない。

## 図版

- 問題全体の独立図版：`ImageBlock`
- 本文内の位置関係が重要：`document`内`imageRef`
- 小問固有：該当小問`content`内`imageRef`
- 解答図版：answerColor付き`imageRef`
- 教師用解説：`solution`内`imageRef`（answerColor不要）

`BackupAsset.dataBase64`にdata URL接頭辞を付けない。Assetはaccepted itemから参照される最終Cropだけを含め、PDF本体、未参照Asset、棄却Crop、範囲外画像を含めない。`asset.worksheetId`を参照元Worksheet IDと一致させる。

## 単一バックアップ

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

UTF-8、2スペースインデント、100MiB以下で直列化する。ファイル名は`<sanitize済みWorksheet.title>_YYYYMMDD-HHmm.json`。

## Builder CLI

```text
node scripts/build_math_worksheet_file.mjs \
  --draft confirmed-draft.json \
  --asset-root final-crops \
  --output candidate.json
```

`storageKey`は`asset-root`配下の相対パスとして解決する。絶対パス、`..`でasset-root外へ出る参照、シンボリックリンクによる逸脱を許可しない。Builder成功後も完成扱いにせず、必ずValidatorを実行する。

## 構造上限

Problem 200、Problem内ContentBlock 100、小問100、表20×20、RichText 10,000ノード/深度20、LaTeX 5,000文字、spacer/answerArea 20行。上限超過を黙示的除外や内容削除で解消せず、範囲分割を依頼する。
