import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import { MathWorksheetFileSchema } from "../src/domain/worksheet/worksheet.schema";

const outputPath = fileURLToPath(
  new URL("../schemas/math-worksheet.schema.json", import.meta.url),
);

const generated = z.toJSONSchema(MathWorksheetFileSchema, {
  target: "draft-2020-12",
  reused: "ref",
  cycles: "ref",
});

const jsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://example.local/schemas/math-worksheet.schema.json",
  ...generated,
  title: "MathWorksheetFile",
  description:
    "ZodのMathWorksheetFileSchemaから生成した、単一プリントと全体バックアップ共通のJSON Schema。",
  $comment:
    "Entity IDの全体一意性、header.titleの一致、表の論理グリッド、Asset参照整合性、RichTextの総ノード数・深度、LaTeX禁止commandはZodの実行時検証も必要です。",
};

const nextContents = `${JSON.stringify(jsonSchema, null, 2)}\n`;

if (process.argv.includes("--check")) {
  const currentContents = await readFile(outputPath, "utf8").catch(() => "");

  if (currentContents !== nextContents) {
    console.error(
      "math-worksheet.schema.jsonがworksheet.schema.tsと一致しません。npm run schema:generateを実行してください。",
    );
    process.exitCode = 1;
  } else {
    console.log("math-worksheet.schema.jsonはZod Schemaと一致しています。");
  }
} else {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, nextContents, "utf8");
  console.log(`Generated: ${outputPath}`);
}
