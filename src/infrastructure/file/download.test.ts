import { afterEach, describe, expect, it, vi } from "vitest";

import { prepareJsonDownload } from "./download";

describe("prepareJsonDownload", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it("利用者が直接クリックできるJSONのダウンロード情報を生成する", () => {
    const createObjectUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:worksheet-backup");
    const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL");

    const download = prepareJsonDownload(
      { format: "math-worksheet", version: 1 },
      "worksheet.json",
    );

    expect(createObjectUrl).toHaveBeenCalledOnce();
    expect(download).toMatchObject({
      fileName: "worksheet.json",
      url: "blob:worksheet-backup",
    });
    expect(revokeObjectUrl).not.toHaveBeenCalled();

    download.revoke();
    download.revoke();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:worksheet-backup");
    expect(revokeObjectUrl).toHaveBeenCalledOnce();
  });
});
