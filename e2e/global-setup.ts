import type { FullConfig } from "@playwright/test";
import { createServer } from "vite";

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
  return async () => server.close();
}
