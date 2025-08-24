import path from "node:path";
import { defineConfig } from "@vscode/test-cli";

export default defineConfig({
  files: "dist/test/**/*.test.js",
  workspaceFolder: path.resolve("../../packages/analyzer/__tests__/repo"),
  extensionDevelopmentPath: path.resolve("."),
  mocha: {
    ui: "tdd",
    timeout: 20000,
  },
});
