# コメント検査の証跡

CIのコメント検査を、検査したコミット・ファイル内容・検査器の版へ結び付けます。証跡形式は `schemaVersion: 1` です。

## CIで保存するもの

`Verify` workflowは次の順序で動作します。

1. checkout後に依存関係を `npm ci` で固定する。
2. `npm run comment:evidence` で全対象のコメント検査を実行し、JSONレポートを保存する。
3. `comment-only` ラベルのあるPRでは、baseコミットと実際のcheckoutコミット間の変更範囲検査も同じレポートへ保存する。それ以外では `skipped` と理由を記録する。
4. 検査器自身のテスト、型、Lint、Schema、マニュアル、アプリテスト、ビルド、E2Eを実行する。
5. アップロード直前に作業ファイルを再読込し、さらにGitのコミット内の全対象blobと照合する。
6. `report.json` と `report.json.sha256` をArtifactへ保存する。検査違反や後続テスト失敗時もアップロードする。

Artifact名は `comment-evidence-<commit SHA>-<run ID>-<run attempt>` です。再実行も区別でき、保存期間は90日です。依存関係のインストールに失敗して検査が開始できなかった場合は生成しません。キャンセルやrunner消失時の保存は保証できません。

実際に検査したコミットは `git rev-parse HEAD` から記録します。PRでは `commitSha` がマージコミット、`headSha` がPRブランチの先頭、`baseSha` が比較元です。pushでは `headSha` はcheckoutコミット、`baseSha` はイベントの `before` です（ブランチ作成時は全桁0の場合があります）。GitHubのイベントSHAも `ci.githubSha` に別途保持し、CIのコミット照合ではこれとの一致を必須にします。

## レポートの内容

| フィールド | 内容 |
| --- | --- |
| `schemaVersion`, `generatedAt`, `hashAlgorithm` | 形式の版、生成開始日時、SHA-256 |
| `repository`, `commitSha`, `ref`, `baseSha`, `headSha` | リポジトリと検査・比較コミット。GitHub以外の実行ではrepositoryはnull |
| `ci` | イベント名、イベントSHA、run ID、再実行回数、workflow、job、実行URL |
| `runtime` | Node.js、TypeScriptの実行バージョン、OS、CPU種別 |
| `targetPolicy` | 拡張子、除外ディレクトリ、fixture除外条件 |
| `files` | 全対象の相対パスと生バイト列のSHA-256 |
| `inputs`, `checkerVersion` | 検査器、全scripts（テスト・fixture含む）、ルール文書、package/lockfile、CI、Vite設定、存在する場合の.gitattributesのハッシュと、それら全体のダイジェスト |
| `checks.rules` | 終了状態、終了コード、従来チェッカーの全レポート（各ファイルの集計・違反含む）、実行エラー |
| `checks.scope` | 変更範囲検査の全レポート、または未実行理由 |
| `commitMatches`, `commitDifferences` | 検査した実体が記録コミットの対象・検査入力と完全一致するか |
| `captureErrors` | 検査中の対象追加・削除・内容変更などの証跡生成エラー |

対象の列挙条件は `scripts/comment-targets.mjs` を検査器と照合コマンドで共用します。ハッシュはUTF-8への再変換や改行正規化をせず、実際に読んだバイト列から計算します。検査前後の対象・入力マニフェストと、チェッカー自身が読んだファイルのハッシュが一致しない場合は証跡生成を失敗にします。リンク先の取り違えを防ぐため、対象ソースと検査入力のシンボリックリンクは拒否します。

## ローカルで生成・再確認する

リポジトリルートで実行します。

```bash
# 証跡生成（既定出力: reports/comment-evidence/report.json）
npm run comment:evidence

# 同じHEADの作業ファイルと照合
npm run comment:evidence:verify

# 比較元を指定し、変更範囲検査も保存
npm run comment:evidence -- --base <base-commit>

# 保存先の変更
npm run comment:evidence -- --report reports/comment-evidence/local.json
npm run comment:evidence:verify -- --report reports/comment-evidence/local.json
```

未コミット変更がある作業ファイルも検査できます。その実体がコミットと異なる場合は `commitMatches: false` と差分を記録します。Windowsの `core.autocrlf` によるLF/CRLF変換も、バイト列の不一致として扱います。作業ファイル照合の成功をコミットとの一致として扱わないでください。

証跡生成の終了コードは、規則合格で0、規則または変更範囲の違反で1、検査器の実行失敗や証跡生成エラーで2です。証跡の同一性照合は一致で0、不一致・破損・未対応形式・未完了検査で1です。**違反を含むレポートでも、その検査対象との同一性は確認できます。** 照合結果に表示される `rules` / `scope` を併せて確認してください。

## Artifactを後から照合する

1. 対象のActions実行ページで、リポジトリ・コミットSHA・実行結果を確認する。
2. その実行のArtifactをダウンロードして展開する。JSONと隣接する `.sha256` ファイルを一緒に保持する。
3. そのコミットを含む信頼できるcloneで、以下を実行する。CI実行ページで確認したSHAを明示して指定する。

```bash
npm run comment:evidence:verify -- --report /path/to/download/report.json --commit <expected-commit>
```

`--commit` モードはGitのツリーを再列挙し、blobの生バイト列を読みます。現在のブランチやOSの改行変換に依存せず、ファイル内容の変更だけでなく、記録の欠落・重複・対象追加・削除・検査入力の違いも検出します。検査器の変更により形式やポリシーが変わった場合は、信頼できる記録コミット側の検証コマンドを使ってください。依存関係はそのcheckoutで `npm ci` により準備します。

記録コミットのGitオブジェクトがない場合は取得が必要です。PRの一時マージコミットなどが将来取得できなくなる場合に備え、長期保管では対象コミットを含むcloneやGit bundleも保管してください。Artifactの90日保存期間を超えて使う証跡は、期限前に別途保管します。

## 証明できる範囲と保守

この証跡が照合するのは、コメント検査の対象・検査器入力・コミット・レポートの同一性です。型チェックやE2Eなどの結果はActions各ステップの成否にあり、コメントレポート自体には含めません。コメントの意味的な正しさや、未検査の実行経路の動作不変を証明するものではありません。

隣接するSHA-256ファイルは破損検出用であり、電子署名ではありません。JSONとダイジェストの両方を書き換えられる相手に対して実行の真正性を保証しません。取得元のActions実行を確認し、ジョブサマリーに保存されるArtifact URL・Artifact全体のSHA-256も参照してください。GitHub Artifactの仕様は[公式ドキュメント](https://docs.github.com/actions/configuring-and-managing-workflows/persisting-workflow-data-using-artifacts)を参照してください。

検査器の版は入力ファイル群のハッシュから自動生成するため、手動の版更新忘れを防げます。証跡の構造や意味を非互換に変える場合は `SCHEMA_VERSION` を更新し、検証コマンド・テスト・この文書も更新します。新しい検査依存ファイルをscripts以外に増やす場合は `REQUIRED_INPUTS` へ追加します。`npm run comment:evidence:test` の回帰テストは `npm run verify` とCIにも含まれています。
