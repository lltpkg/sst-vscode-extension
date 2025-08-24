import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HandlerParser } from "../handlerParser";

const TEST_DIR = "/tmp/test-parser";

describe("HandlerParser", () => {
  beforeEach(async () => {
    await fs.promises.mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await fs.promises.rm(TEST_DIR, { recursive: true, force: true });
  });

  it("should parse exported const functions", async () => {
    const testFile = path.join(TEST_DIR, "test.ts");
    await fs.promises.writeFile(
      testFile,
      `
export const handler = async () => {};
export const anotherFunction = () => {};
const notExported = () => {};
`,
    );

    const parser = new HandlerParser();
    const functions = await parser.parseExportedFunctions(testFile);

    expect(functions).toContain("handler");
    expect(functions).toContain("anotherFunction");
    expect(functions).not.toContain("notExported");
  });

  it("should parse exported function declarations", async () => {
    const testFile = path.join(TEST_DIR, "test.ts");
    await fs.promises.writeFile(
      testFile,
      `
export function handler() {}
export async function asyncHandler() {}
function notExported() {}
`,
    );

    const parser = new HandlerParser();
    const functions = await parser.parseExportedFunctions(testFile);

    expect(functions).toContain("handler");
    expect(functions).toContain("asyncHandler");
    expect(functions).not.toContain("notExported");
  });

  it("should handle default exports", async () => {
    const testFile = path.join(TEST_DIR, "test.ts");
    await fs.promises.writeFile(
      testFile,
      `
export default function defaultHandler() {}
export const namedHandler = () => {};
`,
    );

    const parser = new HandlerParser();
    const functions = await parser.parseExportedFunctions(testFile);

    expect(functions).toContain("default");
    expect(functions).toContain("namedHandler");
  });

  it("should handle complex TypeScript file structure", async () => {
    const testFile = path.join(TEST_DIR, "complex.ts");
    await fs.promises.writeFile(
      testFile,
      `
import { als } from "@repo/shared/common";
import type { APIGatewayProxyResult } from "aws-lambda";
import { createAWSHandler } from "../lib/handler-factory";

export const handler = await createAWSHandler(
  {
    withDb: true,
  },
  async (event, context): Promise<APIGatewayProxyResult> => {
    return { statusCode: 200, body: "OK" };
  },
);

export const helperFunction = () => {
  return "helper";
};
`,
    );

    const parser = new HandlerParser();
    const functions = await parser.parseExportedFunctions(testFile);

    expect(functions).toContain("handler");
    expect(functions).toContain("helperFunction");
  });

  it("should return empty array for non-existent file", async () => {
    const parser = new HandlerParser();
    const functions = await parser.parseExportedFunctions("/non-existent-file.ts");

    expect(functions).toHaveLength(0);
  });
});
