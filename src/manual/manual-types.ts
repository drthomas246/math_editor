export type ManualChapterMetadata = {
  title: string;
  summary: string;
  keywords: readonly string[];
  updatedAt: string;
};

export type ManualChapterManifestItem = ManualChapterMetadata & {
  slug: string;
};

export type ManualMetadata = {
  manualVersion: string;
  targetAppVersion: string;
  updatedAt: string;
};
