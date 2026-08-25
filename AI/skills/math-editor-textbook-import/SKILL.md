---
name: math-editor-textbook-import
description: 教科書PDFの指定範囲から例題・問題・小問・数式・図版・教科書解答・解説を抽出し、確認後にMath Editor用の単一プリントJSONを作る。新規作問、一般的なPDF要約、Math Editor以外の教材生成には使わない。
---

# Math Editor 教科書取込

利用権限のある教科書PDFを、再編集可能なMath Editor単一プリントへ変換する。AIは転記・構造化・編集支援だけを行い、教科書の数学的内容や正答を独断で変更しない。

## 対象外

- 新規問題、類題、誤答例、ヒント、教科書にない解答の自動生成
- 一般的なPDF要約、Math Editor以外の教材作成
- Math Editorへの直接書込み、OpenAI APIまたは外部MCPの利用
- PDF本体の最終JSON格納、AI画像生成、教科書図版の描き直し

## 毎回の開始手順

1. 最初に [workflow-and-confirmation.md](references/workflow-and-confirmation.md) を全文読む。
2. 教科書PDF、開始ページ、開始ラベル、終了ページ、終了ラベルを集める。説明スタイルは`normal`、`detailed`、`concise`から選び、未指定は`normal`とする。題名未指定は`無題のプリント`とする。
3. PDF解析前に、PDFと必要内容がChatGPTへ送信されること、Math Editorのローカル保存とは経路が異なること、利用者が利用権限を確認すること、最終JSONにPDF本体を含めないことを説明し、確認を得る。PDF差替え時は再確認する。
4. 必須入力または確認が不足する間は`collecting-input`に留まり、PDF解析を始めない。

## 段階別ルーティング

- PDF解析と範囲解決を始める前に [textbook-analysis-rules.md](references/textbook-analysis-rules.md) を読む。
- Draftを作成・更新・検証するときは [ai-worksheet-draft.md](references/ai-worksheet-draft.md) を読む。
- 数式または表を含むときだけ [math-conversion-rules.md](references/math-conversion-rules.md) を読む。
- 例題または説明スタイルの処理時だけ [explanation-style-rules.md](references/explanation-style-rules.md) を読む。
- 図版を含むときだけ [figure-cropping-rules.md](references/figure-cropping-rules.md) を読み、`scripts/crop_pdf_figure.py`で元PDFから切り出す。
- 確定DraftをWorksheetへ変換する前に [worksheet-mapping.md](references/worksheet-mapping.md) を読む。
- Draft確認時と最終生成時に [validation-rules.md](references/validation-rules.md) を読む。
- Issueを登録・表示・復旧するときだけ [error-catalog.md](references/error-catalog.md) を読む。

必要なreferenceだけを上記の時点で読み、同じ規則を会話やDraftへ重複コピーしない。

## 状態と絶対ゲート

`collecting-input → analyzing → review-required → confirmed → building → completed`で進める。修正後は`revision`を増やして確定を解除し、`review-required`へ戻す。継続不能なFatalは`blocked`とする。

最終JSONを生成できるのは、利用者が現revisionに対して「確定」「この内容でJSONを作成」「採用した問題で出力」など完成JSON生成を明示し、権利・送信確認済み、範囲解決済み、採用1件以上、保留0件、未解決Fatal 0件、確認対象Warning提示済み、採用図版の最終Crop選択済み、`confirmedRevision === revision`をすべて満たす場合だけである。「進めて」「確認した」など曖昧な表現を確定扱いにしない。

確認前は長い候補JSONを生成・提示しない。問題ごとに採否、種別、PDFページと紙面ページ、元ラベル、本文、数式とLaTeX、小問、図版Preview、教科書解答、解説、Issueを示す。教科書解答がない場合は明記し、AI解答を補わない。

## 決定論的スクリプト

- 図版：`crop_pdf_figure.py --input <request.json>`。元PDF、1始まりのPDFページ、回転補正後左上原点の正規化矩形から毎回切り出す。
- 組立て：`node build_math_worksheet_file.mjs --draft <draft.json> --output <candidate.json> --asset-root <crop-dir>`。未確定またはrevision不一致のDraftは拒否させる。
- 最終検証：`node validate_math_worksheet.mjs <candidate.json>`。終了コードだけでなく、標準出力JSONの`valid === true`かつ`errors.length === 0`を確認する。

BuilderまたはValidatorが失敗した候補を完成ファイルとして提供しない。修正可能ならIssueへ変換して`review-required`へ戻し、必須ツール不在、Schema drift、読取不能PDFなど継続不能なFatalでは停止して復旧方法を示す。
