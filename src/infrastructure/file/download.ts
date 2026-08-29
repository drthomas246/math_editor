export function localTimestamp(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

export function sanitizeFileNamePart(value: string): string {
  const normalized = value
    .trim()
    .replace(/[\p{Cc}<>:"/\\|?*]/gu, "_")
    .replace(/_+/gu, "_")
    .replace(/[ .]+$/gu, "")
    .slice(0, 80);
  return normalized || "無題のプリント";
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.style.display = "none";

  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    // Keep the object URL alive until the browser has started reading it.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}

export type PreparedDownload = {
  fileName: string;
  url: string;
  revoke: () => void;
};

export function prepareJsonDownload(value: unknown, fileName: string): PreparedDownload {
  return prepareJsonTextDownload(JSON.stringify(value, null, 2), fileName);
}

export function prepareJsonTextDownload(json: string, fileName: string): PreparedDownload {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  let revoked = false;

  return {
    fileName,
    url,
    revoke: () => {
      if (revoked) return;
      revoked = true;
      URL.revokeObjectURL(url);
    },
  };
}
