import type { ImageMimeType } from "../../domain/worksheet/worksheet";
export const IMAGE_VALIDATION_LIMITS = {
    bytesPerImage: 10 * 1024 * 1024,
    width: 10000,
    height: 10000,
    pixels: 40000000,
} as const;
const SUPPORTED_IMAGE_MIME_TYPES = new Set<ImageMimeType>([
    "image/png",
    "image/jpeg",
    "image/webp",
]);
export class ImageValidationError extends Error {
    /**
     * このインスタンスの生成物または計測項目を識別する名前を「ImageValidationError」へ更新する。
     *
     * @param message 失敗時に表示する説明
     */
    constructor(message: string) {
        super(message);
        this.name = "ImageValidationError";
    }
}
export type ValidatedImageDimensions = {
    width: number;
    height: number;
};
/**
 * assert・画像・Byte・寸法が永続化・表示・テストの制約を満たすか検証する。
 *
 * @param byteLength 許容するバイト数
 */
export function assertImageByteSize(byteLength: number): void {
    if (byteLength > IMAGE_VALIDATION_LIMITS.bytesPerImage) {
        throw new ImageValidationError("画像は1点10MiB以下にしてください。");
    }
}
/**
 * 画像・Blobが永続化または画面表示の制約を満たすか検証する。
 *
 * @param blob 検証または保存するバイナリデータ
 * @param expectedDimensions ファイル情報から期待される画像寸法
 * @returns 要素または列へ適用する幅・要素またはページの高さを持つオブジェクトを一つの結果へまとめる処理の完了時に解決するPromise
 */
export async function validateImageBlob(blob: Blob, expectedDimensions?: ValidatedImageDimensions): Promise<ValidatedImageDimensions> {
    if (!SUPPORTED_IMAGE_MIME_TYPES.has(blob.type as ImageMimeType)) {
        throw new ImageValidationError("PNG、JPEG、WebPの画像を選択してください。");
    }
    assertImageByteSize(blob.size);
    if (!await hasMatchingFileSignature(blob, blob.type as ImageMimeType)) {
        throw new ImageValidationError("画像のMIME型とファイル内容が一致しません。");
    }
    let bitmap: ImageBitmap;
    try {
        bitmap = await createImageBitmap(blob);
    }
    catch {
        throw new ImageValidationError("画像を読み込めませんでした。");
    }
    try {
        if (bitmap.width > IMAGE_VALIDATION_LIMITS.width
            || bitmap.height > IMAGE_VALIDATION_LIMITS.height
            || bitmap.width * bitmap.height > IMAGE_VALIDATION_LIMITS.pixels) {
            throw new ImageValidationError("画像寸法の上限を超えています。");
        }
        if (expectedDimensions
            && (bitmap.width !== expectedDimensions.width || bitmap.height !== expectedDimensions.height)) {
            throw new ImageValidationError("画像に記録された寸法と実際の寸法が一致しません。");
        }
        return { width: bitmap.width, height: bitmap.height };
    }
    finally {
        bitmap.close();
    }
}
/**
 * Matching・ファイル・Signatureが仕様上の条件を満たすか判定する。
 *
 * @param blob 検証または保存するバイナリデータ
 * @param mimeType 画像ファイルのMIME形式
 * @returns matchesの結果が真になるかを判定する処理の完了時に解決するPromise
 */
async function hasMatchingFileSignature(blob: Blob, mimeType: ImageMimeType): Promise<boolean> {
    const bytes = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    switch (mimeType) {
        case "image/png":
            return matches(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        case "image/jpeg":
            return matches(bytes, [0xff, 0xd8, 0xff]);
        case "image/webp":
            return matches(bytes, [0x52, 0x49, 0x46, 0x46])
                && matches(bytes.subarray(8), [0x57, 0x45, 0x42, 0x50]);
    }
}
/**
 * 画像の先頭バイトが期待するファイル署名と一致するか検証する。
 *
 * @param bytes 検証または変換するバイト列
 * @param signature 画像形式を識別する先頭バイト列
 * @returns 検証または変換するバイト列の要素数が画像形式を識別する先頭バイト列の要素数以上であるかつeveryの結果が真になる場合はtrue
 */
function matches(bytes: Uint8Array, signature: readonly number[]): boolean {
    return bytes.length >= signature.length
        && signature.every((/**
         * すべての変換・検証・保存の対象となる値に共通して要求する条件を検証する。
         *
         * @param value is・Matching・Item1で判定または変換する入力値
         * @param index 対象となる位置
         * @returns 検証または変換するバイト列内の指定位置の値が変換・検証・保存の対象となる値と一致する場合はtrue
         */
        function isMatchingItem1(value, index) {
            return bytes[index] === value;
        }));
}
