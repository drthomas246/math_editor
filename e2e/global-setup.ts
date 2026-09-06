import type { FullConfig } from "@playwright/test";
import { createServer } from "vite";
/**
 * Playwright専用のViteサーバーを起動し、終了時に確実に停止できる後始末を返す。
 *
 * @param _config コールバックの契約上受け取るが、この処理では参照しないconfig
 * @returns Playwright専用のViteサーバーを起動し、終了時に確実に停止できる後始末を返す処理の完了時に解決するPromise
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
     * 不要になったイベント購読またはブラウザーリソースを解放し、後続画面への影響を防ぐ。
     *
     * @returns 不要になったイベント購読またはブラウザーリソースを解放し、後続画面への影響を防ぐ処理の完了時に解決するPromise
     */
    async function applyDeferredOperation1() {
        return server.close();
    });
}
