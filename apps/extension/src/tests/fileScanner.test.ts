import * as fs from "node:fs";
import * as path from "node:path";
import { FileScanner } from "sst-analyzer";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const TEST_WORKSPACE = "/tmp/test-workspace";
const SST_ROOT = path.join(TEST_WORKSPACE, "apps", "sls");
const FUNCTIONS_DIR = path.join(SST_ROOT, "functions");

describe("FileScanner", () => {
  beforeEach(async () => {
    await fs.promises.mkdir(FUNCTIONS_DIR, { recursive: true });

    // Create sst.config.ts to mark this as SST root
    await fs.promises.writeFile(
      path.join(SST_ROOT, "sst.config.ts"),
      `export default $config({
        app() {
          return { name: "test" };
        }
      });`,
    );

    // Create tsconfig.json with includes
    await fs.promises.writeFile(
      path.join(SST_ROOT, "tsconfig.json"),
      JSON.stringify(
        {
          include: ["functions/**/*.ts", "lib/**/*.ts", "infra/**/*.ts"],
          exclude: ["node_modules", ".sst"],
        },
        null,
        2,
      ),
    );

    await fs.promises.writeFile(
      path.join(FUNCTIONS_DIR, "upload.ts"),
      `export const handler = async () => {};
export const otherFunction = () => {};`,
    );

    await fs.promises.writeFile(
      path.join(FUNCTIONS_DIR, "details.ts"),
      `export const handler = async () => {};
export default function defaultHandler() {}`,
    );

    const nestedDir = path.join(FUNCTIONS_DIR, "nested");
    await fs.promises.mkdir(nestedDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(nestedDir, "nested-handler.ts"),
      `export const nestedHandler = () => {};`,
    );

    // Create files in other directories (lib, infra)
    const libDir = path.join(SST_ROOT, "lib");
    await fs.promises.mkdir(libDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(libDir, "utils.ts"),
      `export const utilFunction = () => {};`,
    );

    const infraDir = path.join(SST_ROOT, "infra");
    await fs.promises.mkdir(infraDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(infraDir, "lambda.ts"),
      `export const lambdaConfig = {};`,
    );
  });

  afterEach(async () => {
    await fs.promises.rm(TEST_WORKSPACE, { recursive: true, force: true });
  });

  it("should scan and find all TypeScript files based on tsconfig", async () => {
    const scanner = new FileScanner(TEST_WORKSPACE);
    const handlers = await scanner.scanHandlers();

    expect(handlers).toHaveLength(5);
    expect(handlers.map((h) => h.relativePath)).toContain("functions/upload");
    expect(handlers.map((h) => h.relativePath)).toContain("functions/details");
    expect(handlers.map((h) => h.relativePath)).toContain("functions/nested/nested-handler");
    expect(handlers.map((h) => h.relativePath)).toContain("lib/utils");
    expect(handlers.map((h) => h.relativePath)).toContain("infra/lambda");
  });

  it("should parse exported functions correctly", async () => {
    const scanner = new FileScanner(TEST_WORKSPACE);
    const handlers = await scanner.scanHandlers();

    const uploadHandler = handlers.find((h) => h.relativePath === "functions/upload");
    expect(uploadHandler?.exportedFunctions).toContain("handler");
    expect(uploadHandler?.exportedFunctions).toContain("otherFunction");

    const detailsHandler = handlers.find((h) => h.relativePath === "functions/details");
    expect(detailsHandler?.exportedFunctions).toContain("handler");
    expect(detailsHandler?.exportedFunctions).toContain("default");

    const utilsHandler = handlers.find((h) => h.relativePath === "lib/utils");
    expect(utilsHandler?.exportedFunctions).toContain("utilFunction");
  });

  it("should return empty array when sst.config.ts does not exist", async () => {
    const scanner = new FileScanner("/non-existent-workspace");
    const handlers = await scanner.scanHandlers();

    expect(handlers).toHaveLength(0);
  });
});
