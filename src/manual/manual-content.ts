import answers from "./content/answers.md?raw";
import backupAndTrash from "./content/backup-and-trash.md?raw";
import editorBasics from "./content/editor-basics.md?raw";
import formulas from "./content/formulas.md?raw";
import gettingStarted from "./content/getting-started.md?raw";
import imagesAndTables from "./content/images-and-tables.md?raw";
import overview from "./content/overview.md?raw";
import previewAndPdf from "./content/preview-and-pdf.md?raw";
import savingAndHistory from "./content/saving-and-history.md?raw";
import troubleshooting from "./content/troubleshooting.md?raw";
import worksheetList from "./content/worksheet-list.md?raw";
import type { ManualChapterSlug } from "./manual-manifest";

export const MANUAL_CONTENT = {
  overview,
  "getting-started": gettingStarted,
  "worksheet-list": worksheetList,
  "editor-basics": editorBasics,
  formulas,
  "images-and-tables": imagesAndTables,
  answers,
  "preview-and-pdf": previewAndPdf,
  "saving-and-history": savingAndHistory,
  "backup-and-trash": backupAndTrash,
  troubleshooting,
} satisfies Record<ManualChapterSlug, string>;
