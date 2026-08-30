import { afterEach, describe, expect, it, vi } from "vitest";

import { assertImageByteSize, IMAGE_VALIDATION_LIMITS, validateImageBlob } from "./image-validation";

afterEach(() => vi.unstubAllGlobals());

describe("validateImageBlob", () => {
  it("MIME、シグネチャ、デコード結果、記録寸法が一致する画像を受け入れる", async () => {
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 320, height: 240, close })));
    const blob = new Blob([
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ], { type: "image/png" });

    await expect(validateImageBlob(blob, { width: 320, height: 240 })).resolves.toEqual({ width: 320, height: 240 });
    expect(close).toHaveBeenCalledOnce();
  });

  it("宣言MIMEとファイルシグネチャが違う画像をデコード前に拒否する", async () => {
    const decode = vi.fn();
    vi.stubGlobal("createImageBitmap", decode);
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0x00]);

    await expect(validateImageBlob(new Blob([jpegBytes], { type: "image/png" })))
      .rejects.toThrow("画像のMIME型とファイル内容が一致しません。");
    expect(decode).not.toHaveBeenCalled();
  });

  it("バックアップの記録寸法と実寸が違う画像を拒否してbitmapを解放する", async () => {
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 320, height: 240, close })));
    const blob = new Blob([
      new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]),
    ], { type: "image/webp" });

    await expect(validateImageBlob(blob, { width: 1, height: 1 }))
      .rejects.toThrow("画像に記録された寸法と実際の寸法が一致しません。");
    expect(close).toHaveBeenCalledOnce();
  });

  it("画像1点の容量と画素数の上限を適用する", async () => {
    expect(() => assertImageByteSize(IMAGE_VALIDATION_LIMITS.bytesPerImage + 1))
      .toThrow("画像は1点10MiB以下にしてください。");

    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 10_000, height: 4_001, close })));
    const blob = new Blob([
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ], { type: "image/png" });

    await expect(validateImageBlob(blob)).rejects.toThrow("画像寸法の上限を超えています。");
    expect(close).toHaveBeenCalledOnce();
  });
});
