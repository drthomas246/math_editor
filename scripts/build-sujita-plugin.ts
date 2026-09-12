import { buildPlugin } from "./sujita-plugin";

try {
  const result = await buildPlugin();
  console.log(`Plugin生成: ${result.output} (${result.fileCount} files)`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
