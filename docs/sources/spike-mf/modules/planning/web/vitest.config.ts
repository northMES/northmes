import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Tests import the module's source directly. No federation, no shell build: the module is
// an ordinary React package here, and the shell's role is played by createShellRoutes.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@module-styles": new URL("../../../packages/web-build/empty.css", import.meta.url).pathname } },
  test: { environment: "jsdom", include: ["src/**/*.test.tsx"] },
});
