import { verifyPlugin } from "./math-editor-plugin";

try {
  console.log(`Plugin検証成功: ${await verifyPlugin()} filesが正本と一致しています。`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
