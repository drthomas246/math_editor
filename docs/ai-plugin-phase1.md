# Phase 1: portable PluginとRuntime自己テスト

`追加AI要件定義書.md` / `追加AI詳細設計書.md` v2.1のPhase 1を対象とする。Skillの正本は`AI/skills/math-editor-textbook-import/`。配布物は`dist/math-editor-ai/`へ生成する。

このPhaseの出力は検証済みの単一プリントJSON。WebMCPのread/validate、直接取込、React画面同期、requestIdによる回復は後続Phaseで実装する。

## 生成と検査

```sh
npm run plugin:build
npm run plugin:verify
npm run plugin:test
npm run plugin:runtime -- --input textbook.pdf --output-dir output --figures-required
```

`output`は実際に使用する既存の出力ディレクトリに置き換える。PythonやコマンドがPATHにない場合は、実環境で確認したパスを`--python` / `--pdftoppm` / `--mutool`で渡す。

- buildは既存の`dist/math-editor-ai/`だけを再生成し、Viteの成果物を保持する。
- verifyは修復せず、正本との相対パス・全ファイルSHA-256・Schema/Validatorの整合性を検査する。手編集、不足、余剰、リンク、不正manifestを拒否する。
- ビルド前にSchema同期検査を実行する。保存形式を更新した場合は`npm run schema:generate`を実行し、必要に応じてValidatorを再bundleする。
- Schema manifestの`generatedAt`はSchema hashが同じなら保持する。改行はLFに統一する。
- `npm run build`はViteが`dist/`を空にするため、その後で`plugin:build`を再実行する。個人テスト用インストール元は`dist/`と別の場所へコピーする。

## 自動Runtimeテスト

`plugin:test`は依存をstubして、主経路・代替経路・図版不要・必須図版欠落・Node/Builder/Validator不在・検査失敗・書込み不可を再現する。実環境に偶然あるコマンドだけで合否を決めない。

実際の描画検査は、Python 3.12と`AI/plugin/requirements-test.txt`の固定依存、およびPopplerで行う。利用者環境にこれらを自動インストールしない。

```sh
python -m pip install -r AI/plugin/requirements-test.txt
python scripts/test-plugin-crop.py --backends poppler,pypdfium2
```

自作の検査PDFを一時生成し、CropBox、PDF固有回転、指定回転、色、寸法、元PDF不変を確認する。そのCropを配布Builderへ渡し、画像を含むJSONが配布Validatorで成功することまで検査する。市販教科書や個人のPDFはfixtureへ含めない。PyMuPDF/mutoolを検証する環境では、実際に依存を確認してから`--backends`へ追加できる。

CIのVerifyはNode 24、Python 3.12でPlugin build/verify、stubテスト、Poppler/PDFiumの実描画を実行し、検証した配布フォルダをartifactへ保存する。

## 個人ローカルMarketplace

公式の[Build plugins](https://learn.chatgpt.com/docs/build-plugins)は、ルート`plugin.json`のportable形式と、`.codex-plugin/plugin.json`の互換形式を案内している。リポジトリの配布物はportable形式。Codex用の個人Marketplaceへ追加するときは、plugin-creatorのscaffoldで生成した互換manifestをインストール用コピーだけに保持する。

1. `plugin:build`と`plugin:verify`を成功させる。
2. Codexの`plugin-creator`で、名前`math-editor-ai`の個人Pluginを作成する。標準の個人Marketplaceはユーザーホームの`.agents/plugins/marketplace.json`。既存エントリを保持する。
3. ユーザーホームの`plugins/math-editor-ai/`へ、検証済み配布物の`plugin.json`と`skills/`をコピーする。scaffoldの`.codex-plugin/plugin.json`は保持し、name/version/descriptionをportable manifestに合わせ、`skills`を`./skills/`とする。互換manifestに必要な`author`、`interface.developerName`、`interface.defaultPrompt`、`interface.capabilities`も保持する。App/MCPを追加しない。
4. plugin-creatorの`validate_plugin.py`とskill-creatorの`quick_validate.py`でコピーを検査する。
5. 個人Marketplaceの実際の名前をplugin-creatorの`read_marketplace_name.py`で読み、`codex plugin add math-editor-ai@<取得した名前>`を実行する。標準の個人Marketplaceに`marketplace add`は不要。
6. 新しいタスクで代表プロンプトを実行する。同名の単体Skillが既にある場合は、導入した`math-editor-ai`を明示して取り違えを避ける。

再インストール時はコピーを更新してから、plugin-creatorの`update_plugin_cachebuster.py`をインストール用コピーに実行し、同じMarketplaceから`codex plugin add`で更新する。正本のバージョンはキャッシュ更新目的だけで書き換えない。

個人設定への書込みはワークスペース外への変更になる。Codexが権限確認を出した場合は、その具体的な書込みだけを確認する。一般公開、第三者配布、Plugin Directoryへの提出は行わない。

## 新しいタスクでの確認

PDFなしで起動確認する例：

```text
math-editor-ai Pluginのmath-editor-textbook-importを使い、
現在のRuntime能力を確認してください。PDFはまだありません。
図版を含むプリントを作るために必要な入力を案内してください。
```

次に利用権限のあるPDFで、範囲指定 → 内容確認 → 修正 → 現revisionの明示確定 → JSON生成 → Validator成功 → Math Editorの既存インポートを確認する。図版なしと図版ありの両ケースを行う。必須図版が処理できない場合やValidator不在時に、完成ファイルを提供しないことも確認する。

Math EditorのURLは開発サーバーが実際に表示したURLを使う。公開URLは未定のためSkill・Pluginへ固定しない。導入後のSkill起動・PDF解析品質は、この対話テストで確認する。CLIの自動検査だけで対話確認済みとはしない。

アンインストールは`codex plugin remove math-editor-ai@<取得したMarketplace名>`。必要に応じて再度`plugin add`する。Math Editorの既存一覧・保存・編集・JSONインポートが通常どおり使えることを確認する。

## 実施済みの検証（2026-09-11）

- `npm run verify`、`npm run build`、ビルド後の`plugin:build` / `plugin:verify`に成功。Plugin関連24件、既存アプリ181件のテストに成功。
- Poppler / PDFiumによる実PDFの切り出し、回転、画像付きJSON生成・検証、およびPoppler不在時のPDFiumへの切替に成功。
- 個人Marketplace `personal`で`math-editor-ai` v2.1.0の導入・削除・再導入に成功。導入物19ファイルのSHA-256一致と、導入先でのRuntime検査成功を確認。

新しいタスクからのSkill起動と、実際の教科書PDFを使った対話確認は未実施。上記「新しいタスクでの確認」の手順で行う。CI設定は追加済みだが、GitHub上の実行結果はまだ確認していない。
