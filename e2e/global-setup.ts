import type { FullConfig } from "@playwright/test";
import { createServer } from "vite";
/**
 * startViteに必要な処理を実行する。
 *
 * @param _config _configとして使用する値
 * @returns 非同期処理の結果
 */
export default async function startVite(_config: FullConfig): Promise<() => Promise<void>> {
    const server = await createServer({
        configFile: "vite.config.ts",
        server: {
            host: "127.0.0.1",
            port: 4175,
            strictPort: true,
        },
    });
    await server.listen();
    return (/**
     * 呼び出し元から要求された処理を実行する。
     *
     * @returns 非同期処理の結果
     */
    async function commentRuleCallback1() {
        return server.close();
    });
}
