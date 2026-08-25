# AiWorksheetDraft

Draftは認識・確認用の内部形式であり、Math Editorへインポートせず、最終`worksheet`にも埋め込まない。

## 型

```ts
type DraftState =
  | "collecting-input" | "analyzing" | "review-required"
  | "confirmed" | "building" | "completed" | "blocked";

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

type DraftSource = {
  sourceFileName: string;
  pdfPageCount: number;
  pdfKind: "text" | "scan" | "mixed" | "unknown";
  rightsConfirmed: boolean;
  externalProcessingAcknowledged: boolean;
};

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

`header.title`はDraftへ重複保存せず、Builderが`options.title`と同じ値を設定する。

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

type DraftSourceContent = {
  status: "found" | "not-found" | "ambiguous" | "not-applicable";
  sourcePdfPageNumber: number | null;
  sourceLabel: string | null;
  document: BasicRichTextDocument | null;
  verification: "not-run" | "consistent" | "mismatch" | "not-applicable";
};
```

問題本文と小問本文を二重保持しない。小問がある場合、`problemDocument`には共通指示だけを置き、各小問本文は`subQuestionGroup.items[].content`へ置く。小問解答は対応が一意な部分だけを`answerContent`へ分配し、曖昧なものは空文書とIssueにする。

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

## 不変条件

- `draftVersion === 1`、`revision`は0以上の整数。
- `itemKey`、`figureKey`、`issueId`はDraft内でそれぞれ一意。
- `order`は一意の昇順で、accepted itemは解決済みの包含範囲内だけ。
- `0 <= left < right <= 1`かつ`0 <= top < bottom <= 1`。
- `storageKey`はセッション内ファイルへの不透明キーとし、Base64をDraftへ格納しない。
- 教科書解答と検算が不一致でも`textbookAnswer.document`をAI計算結果で上書きしない。
- 解答未発見では`status: "not-found"`、解答文書なし、Warningあり。
- 可視内容がない`finalExplanation`または小問`solution`は`null`。
- 修正のたびに`revision += 1`、`confirmation.status = "not-confirmed"`、`confirmedRevision = null`とする。
- `validationSummary`はitemsと未解決Issueから再計算し、`lastValidatedRevision`を現revisionに合わせる。
- 最終生成時は`confirmedRevision === revision`が必須。
