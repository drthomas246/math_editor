# 実行環境の検査と代替経路

環境にNode、Python、PDF描画ツールがあると仮定しない。図版処理前と最終build/validate前に検査する。実行環境を切り替えた場合も再検査する。

## 検査

Skillルートから、元PDFと実際に使う既存出力ディレクトリを指定する。

```text
node scripts/check_runtime_capabilities.mjs --input textbook.pdf --output-dir output
node scripts/check_runtime_capabilities.mjs --input textbook.pdf --output-dir output --figures-required
```

`--python`、`--pdftoppm`、`--mutool`で実行環境から取得した実行ファイルを指定できる。固定の個人パスをSkillへ書き込まない。Node自体が起動できなければ、ホストが提供する同等の実行環境を確認する。実行可能なBuilder/Validatorを確保できなければ、それぞれ`BUILDER_RUNTIME_UNAVAILABLE` / `VALIDATOR_RUNTIME_UNAVAILABLE`で停止する。

出力の`runtime`、`pythonModules`、`commands`、`filesystem`、`scripts`は実測結果。`decision.state`は`ready`または`blocked`、`errors`は停止理由、`warnings`は主経路が利用できない理由。`ready`は環境準備完了を意味し、Draft確定やWorksheet検証の成功を意味しない。検査はネットワークや追加インストールを利用しない。書込み検査は自分で作った一時ファイルだけを除去する。

Nodeは24以上、Pythonは3.10以上を対象とする。検証用バージョンはリポジトリの`AI/plugin/requirements-test.txt`とCIで固定する。モジュールは実際のimport、外部コマンドはタイムアウト付きの起動、Validatorは起動時のSchema整合性まで検査する。実際の図版描画と最終JSON検証は別途必ず実行する。

## 図版の経路

1. **Tier 1 / poppler**：Python + Pillow + pypdf + pdftoppmで既存Cropperを実行。
2. **Tier 2**：利用可能なら、Pillow + PyMuPDF、Pillow + pypdfium2、Pillow + pypdf + mutoolの順に選ぶ。`crop_pdf_figure.py`の既定`backend: "auto"`がこの順で選択する。明示指定は`poppler` / `pymupdf` / `pypdfium2` / `mutool`。検査で明示したコマンドパスはCrop入力の`pdftoppmPath` / `mutoolPath`へ同じ値を渡す。
3. **Tier 3**：同梱経路がなく`requiresHostFigureCheck`がtrueの場合、現在のホストに公開されている元PDFページ取得・切り出しツールを確認する。CLIはホストのツール一覧を読めないため、この能力を利用可能とは推測しない。元PDF由来・指定ページ/回転/矩形・保存可能・画像検証可能の全条件を実測できた場合だけ使用する。
4. **代替不能**：図版不要なら図版をスキップして継続できる。採用問題に図版必須なら`FIGURE_RUNTIME_UNAVAILABLE`で`blocked`にし、必須図版を欠いた完成品を提供しない。

Tier 2/3でも、元PDFからの描画、座標、cropRevision、Preview、MIME・寸法・容量・Assetの制約は[figure-cropping-rules.md](figure-cropping-rules.md)と同じ。描画方式によるアンチエイリアスの差はあり得るが、図の意味や必要領域の変更は許されない。修正時は元PDFから再描画する。AI画像生成、意味的再描画、認識用画像の使い回しを代替手段にしない。

主経路が利用不可なら`FIGURE_PRIMARY_RUNTIME_UNAVAILABLE`をWarningとして示す。代替描画の結果も利用者が確認する。PDF自体の破損、暗号化、範囲不正、出力制約違反は、依存不足と取り違えて無視しない。

## 完成処理

検査不能は`RUNTIME_CAPABILITY_CHECK_FAILED`。ファイル読取/書込先を直すか実行環境を確保して再検査する。ValidatorにSchema driftがあればSkillパッケージを更新する。AIの目視だけで決定論的Validatorを置き換えない。

配送するのは、明示確定したDraftから生成し、Validatorが成功した単一プリントJSON。すうがく仕立てへ配送するときは [webmcp-integration.md](webmcp-integration.md) の対象ページ解決、検証、許可済みdirect import、エラー別routingを使う。接続先が未解決、WebMCP非対応、互換性不一致、直接取込上限超過ならURLや不足能力を捏造せず、同じJSONファイルと既存インポート手順を示す。Runtime fallbackで生成した図版を含む場合も、payloadをWebMCP向けに再圧縮・削除せず、2 MiBを超えた時点でJSONへフォールバックする。
