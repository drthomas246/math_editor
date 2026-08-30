import type { ImageMimeType } from "../../domain/worksheet/worksheet";

export const IMAGE_VALIDATION_LIMITS = {
  bytesPerImage: 10 * 1024 * 1024,
  width: 10_000,
  height: 10_000,
  pixels: 40_000_000,
} as const;

const SUPPORTED_IMAGE_MIME_TYPES = new Set<ImageMimeType>([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export class ImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageValidationError";
  }
}

export type ValidatedImageDimensions = {
  width: number;
  height: number;
};

export function assertImageByteSize(byteLength: number): void {
  if (byteLength > IMAGE_VALIDATION_LIMITS.bytesPerImage) {
    throw new ImageValidationError("画像は1点10MiB以下にしてください。");
  }
}

export async function validateImageBlob(
  blob: Blob,
  expectedDimensions?: ValidatedImageDimensions,
): Promise<ValidatedImageDimensions> {
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
  } catch {
    throw new ImageValidationError("画像を読み込めませんでした。");
  }

  try {
    if (
      bitmap.width > IMAGE_VALIDATION_LIMITS.width
      || bitmap.height > IMAGE_VALIDATION_LIMITS.height
      || bitmap.width * bitmap.height > IMAGE_VALIDATION_LIMITS.pixels
    ) {
      throw new ImageValidationError("画像寸法の上限を超えています。");
    }
    if (
      expectedDimensions
      && (bitmap.width !== expectedDimensions.width || bitmap.height !== expectedDimensions.height)
    ) {
      throw new ImageValidationError("画像に記録された寸法と実際の寸法が一致しません。");
    }
    return { width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}

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

function matches(bytes: Uint8Array, signature: readonly number[]): boolean {
  return bytes.length >= signature.length
    && signature.every((value, index) => bytes[index] === value);
}
