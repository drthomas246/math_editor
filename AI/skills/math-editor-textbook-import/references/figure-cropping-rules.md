# 図版切り出し

図、グラフ、座標平面、数直線、統計図、幾何図、写真、複雑な表はAI生成や描き直しをせず、元PDFから切り出す。

## 座標

座標は回転補正後ページの左上原点・正規化値とする。

```text
0 <= left < right <= 1
0 <= top < bottom <= 1
```

`pdfPageNumber`は1始まり。`rotationApplied`は`0 / 90 / 180 / 270`の時計回り補正。認識用ページ画像ではなく、必ず元PDFを指定DPIで再レンダリングして1回だけCropする。

## Cropper

入力JSON例：

```json
{
  "pdfPath": "textbook.pdf",
  "pdfPageNumber": 12,
  "bounds": { "left": 0.1, "top": 0.2, "right": 0.8, "bottom": 0.7 },
  "rotationApplied": 0,
  "dpi": 200,
  "outputMimeType": "image/png",
  "outputPath": "figure.png"
}
```

実行：

```text
python scripts/crop_pdf_figure.py --input crop-request.json
```

`pdftoppm`がPATHにない環境では、入力へ任意の`pdftoppmPath`を加えるか、`PDFTOPPM_PATH`環境変数を使う。追加インストールを黙って行わない。

成功時は`ok`、`outputPath`、`mimeType`、`width`、`height`、`byteLength`、`sha256`をJSONで返す。失敗時は`ok: false`、安定した`code`、技術メッセージを返す。

## Previewと修正

初回Cropを利用者へ提示し、問題に必要な領域だけが含まれるか確認する。自然言語修正は正規化座標へ変換する。

| 指示 | 変更 |
|---|---|
| 上を広げる | `top`を小さくする |
| 下を狭くする | `bottom`を小さくする |
| 左を広げる | `left`を小さくする |
| 右を狭くする | `right`を小さくする |
| 図だけにする | 本文を除くよう四辺を再推定 |

変更量が曖昧なら小さく1回変更してPreviewを再提示する。修正ごとに`cropRevision`を増やし、常に元PDFから再Cropする。旧Cropと棄却Cropは最終`assets[]`へ入れない。

## 出力制限

- MIME：`image/png`、`image/jpeg`、`image/webp`
- デコード可能な非空画像
- 1点10MiB以下
- 幅・高さ各10,000px以下
- 40MP以下

線画・透明図はPNG、写真中心はJPEGを既定とする。上限超過時は元PDFから低いDPIで再レンダリングし、JPEGの再圧縮を繰り返さない。

配置の既定は`block / 50%`。`block`は25/33/50/66/75/100%、`floatLeft`と`floatRight`は25/33/50%だけ。回り込みが紙面上明確な小図だけfloatを使う。

`alt`は図の種類と対象を簡潔に示し、問題の答えを暴露しない。
