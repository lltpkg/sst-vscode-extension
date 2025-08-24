import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "./apps/extension/vitest.config.ts",
  "./packages/analyzer/vitest.config.ts",
]);
