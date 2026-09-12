# Phase 4: Skill配送統合

Phase 3で完成したMath Editor側のdirect importを、portable Pluginの`math-editor-textbook-import` Skillから安全に利用する配送フローへ統合した。実装範囲はIssue #37と`追加AI詳細設計書.md`のPhase 4である。

## 接続先の解決

`resolve_math_editor_target.mjs`は、能力取得と検証ツールを持つページを実行時の観測値から選ぶ。複数候補では`selectedPageId`を受け取り、同じURLの別タブを一意に選べる。`selectedPageId`と明示URLの競合、存在しない識別子、不正な識別子は別のページへ置換せず拒否する。

選択結果には`directImportToolAvailable`を含める。事前検証だけ可能なページもMath Editor候補として認識するが、import toolがなければJSONフォールバックへ進む。ページ選択後はcapabilities、validate、importを同じページへ固定する。

## 配送状態と安全な再試行

Skillは内容確認の状態と配送状態を分け、Builder / Validator成功後に次の順で処理する。

```text
対象ページ解決
  -> capabilities互換性確認
  -> 完成payloadを再直列化せずvalidate
  -> ローカル計算したpayload SHA-256を照合
  -> 論理配送ごとにrequestIdを1回生成
  -> Consent付きimport
  -> 成功またはJSON fallback
```

Consent待ち、candidate期限切れ・消失、`REVALIDATION_REQUIRED`、応答不明時の安全な再試行では、同じ完成payloadと同じ`requestId`を維持する。再検証時だけ新しい`candidateToken`へ更新する。payload hash不一致ではdirect importを停止し、自動再試行しない。

`plan_webmcp_delivery.mjs`はcapabilities、validation、importの不信頼な応答を次の操作へ決定論的に分類する。WebMCP固有障害は完成JSONを変更せず手動インポートへ戻し、内容不正はfallbackで隠さず確認・修正工程へ戻す。`directImportToolAvailable`は厳密な`true`だけを利用可能とみなす。transport系とcandidate再検証の自動再試行上限は各1回であり、呼出側はplannerが返す`nextValidationRetryAttempts`、`nextImportRetryAttempts`、`nextRevalidationAttempts`を次の配送状態へ保存する。

## Runtime fallbackとの接続

図版のprimary backendが利用できない場合も、Runtime Capability Probeが選んだ元PDF由来の代替backendでBuilder / Validatorまで完了してから配送する。WebMCPの2 MiB上限を超えたときは図版や本文を削除・再圧縮せず、同じ検証済みJSONを手動インポートへ切り替える。

## 利用者向けマニュアル

「AIのSkillとは」を更新し、WebMCP対応時の対象タブ選択、Math Editorページ上のAI連携Consent、直接取込後の確認、ページ再読込でConsentがOFFへ戻ること、既存Worksheetを更新・削除しないこと、JSON fallback手順を案内する。

## 自動検証

- `webmcp-target.test.mjs`: 同一URL複数タブの`selectedPageId`選択、競合拒否、import tool有無
- `webmcp-delivery.test.mjs`: capabilities互換性、Schema・サイズfallback、import toolのfail-closed判定、payload hash照合、Consent待ち、同一`requestId`再検証、再検証・transport再試行の上限、fatal停止、成功判定、CLI
- `ai-webmcp-import.spec.ts`: 実ブラウザーでcapabilities、validate、Consent拒否・許可、import、同一requestId replay、reload後のreceipt回復、一覧反映
- portable Plugin build / verify: 正本からの再生成、新しい配送helperを含む相対パスと全バイトの一致

外部ChatGPTのWebMCPロールアウト状態にはCIを依存させない。実ホスト自己テストでは、ローカルPluginを新しい会話へ読み込み、capabilities、validate、Consent、import、replay、reload recovery、JSON fallbackを順に確認する。
