# エラー・警告カタログ

Fatalは解消するまで完成JSON生成を停止する。Warningは対象、出典、該当箇所、採用への影響を示し、利用者確認後に`acknowledged`または修正後`resolved`とする。Warningを黙って削除・解決・正答扱いにしない。

| Code | Severity | 条件 | 復旧 |
|---|---|---|---|
| `AI_PDF_MISSING` | fatal | PDF未添付 | 添付を依頼 |
| `AI_PDF_UNREADABLE` | fatal | 破損・非対応・読取不能 | 別PDFを依頼 |
| `AI_PDF_ENCRYPTED` | fatal | 復号不能 | 処理停止、利用可能なPDFを依頼 |
| `AI_RANGE_PAGE_NOT_FOUND` | fatal | 指定ページなし | 範囲訂正 |
| `AI_RANGE_ORDER_INVALID` | fatal | 開始が終了より後 | 範囲訂正 |
| `AI_RANGE_LABEL_AMBIGUOUS` | warning | ラベル候補複数 | 本文冒頭付き候補から選択 |
| `AI_PROBLEM_KIND_UNCERTAIN` | warning | 例題・問題を判定不能 | 利用者選択 |
| `AI_PROBLEM_STRUCTURE_UNCERTAIN` | warning | 小問構造を安全に決定不能 | RichText保持または修正 |
| `AI_MATH_RECOGNITION_UNCERTAIN` | warning | 数式認識不確実 | 式・LaTeX・出典画像を確認 |
| `AI_FIGURE_BOUNDS_UNCERTAIN` | warning | Crop境界不確実 | Previewを元PDFから再Crop |
| `AI_FIGURE_OUTPUT_INVALID` | fatal | 画像生成、寸法、MIME不正 | DPI・矩形・形式を修正して再Crop |
| `AI_TEXTBOOK_ANSWER_NOT_FOUND` | warning | 教科書解答なし | 解答なしを明示して確認 |
| `AI_TEXTBOOK_ANSWER_AMBIGUOUS` | warning | 解答候補複数 | 候補選択 |
| `AI_ANSWER_VERIFICATION_MISMATCH` | warning | 教科書解答と検算不一致 | 教科書解答を保持し、利用者訂正を待つ |
| `AI_DRAFT_NOT_CONFIRMED` | fatal | 確定前Builder実行 | 確認へ戻る |
| `AI_DRAFT_REVISION_MISMATCH` | fatal | 確定後にDraft変更 | 再確認・再確定 |
| `AI_SCHEMA_DRIFT` | fatal | Schema/manifest/bundle不整合 | Skillパッケージ更新 |
| `AI_SCHEMA_VALIDATION_FAILED` | fatal | 最終Schema違反 | DraftまたはBuilderを修正し再検証 |
| `AI_ASSET_REFERENCE_INVALID` | fatal | Asset参照・所有・パス不整合 | Builder入力またはCropを修正 |
| `AI_OUTPUT_TOO_LARGE` | fatal | JSONが100MiB超過 | 元PDFから低DPI再Cropまたは範囲分割 |
| `AI_RUNTIME_TOOL_UNAVAILABLE` | fatal | Crop/Builder/Validator実行不能 | 対応ランタイムで再実行 |

利用者向け表示には内部スタックトレース、一時パス、長い技術ログをそのまま出さない。`code`、人が理解できる説明、対象問題・ページ、次の操作を示す。
