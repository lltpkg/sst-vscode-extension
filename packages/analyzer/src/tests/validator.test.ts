import * as fs from "node:fs";
import * as ts from "typescript";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ASTAnalyzer } from "../lib/astAnalyzer";
import { FileScanner } from "../lib/fileScanner";
import { SSTValidator } from "../lib/validator";
import type { HandlerInfo, SSTHandlerContext, ValidationError, ValidationResult } from "../types";

// Mock the dependencies
vi.mock("node:fs", () => ({
  promises: {
    readFile: vi.fn(),
  },
}));
vi.mock("../lib/fileScanner");
vi.mock("../lib/astAnalyzer");

const MockedFileScanner = vi.mocked(FileScanner);
const MockedASTAnalyzer = vi.mocked(ASTAnalyzer);

class MockSSTValidator extends SSTValidator {
  public findSimilarPaths(target: string, availablePaths: string[]): string[] {
    return super.findSimilarPaths(target, availablePaths);
  }
  public validateHandlerPath(
    filePath: string,
    context: SSTHandlerContext,
    availablePaths: Set<string>,
    availableHandlers: HandlerInfo[],
  ): Promise<ValidationError | null> {
    return super.validateHandlerPath(filePath, context, availablePaths, availableHandlers);
  }
  public validateFile(
    filePath: string,
    availableHandlers: HandlerInfo[],
  ): Promise<ValidationError[]> {
    return super.validateFile(filePath, availableHandlers);
  }
  public validateProject(): Promise<ValidationResult> {
    return super.validateProject();
  }
}

describe("SSTValidator", () => {
  let validator: MockSSTValidator;
  let mockFileScanner: any;
  let mockASTAnalyzer: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockFileScanner = {
      scanHandlers: vi.fn(),
      findSstRoot: vi.fn(),
    };

    mockASTAnalyzer = {
      analyzeHandlerContexts: vi.fn(),
    };

    MockedFileScanner.mockImplementation(() => mockFileScanner);
    MockedASTAnalyzer.mockImplementation(() => mockASTAnalyzer);

    validator = new MockSSTValidator("/mock/workspace", ts);
  });

  describe("validateFile", () => {
    const mockHandlers: HandlerInfo[] = [
      {
        filePath: "/mock/functions/handler1.ts",
        relativePath: "functions/handler1",
        exportedFunctions: ["handler", "processor"],
      },
      {
        filePath: "/mock/functions/handler2.ts",
        relativePath: "functions/handler2",
        exportedFunctions: ["main", "worker"],
      },
    ];

    beforeEach(() => {
      mockFileScanner.scanHandlers.mockResolvedValue(mockHandlers);
    });

    it("should return no errors for valid handlers", async () => {
      const sourceCode = `
        const api = new sst.aws.Function("Test", {
          handler: "functions/handler1.handler"
        });
      `;

      mockASTAnalyzer.analyzeHandlerContexts.mockReturnValue([
        {
          type: "function",
          expectedPath: "functions/handler1.handler",
          position: 100,
          node: {},
        },
      ]);

      // Mock fs.promises.readFile to return our source code
      vi.mocked(fs.promises.readFile).mockResolvedValueOnce(sourceCode);

      const errors = await validator.validateFile("test.ts", mockHandlers);

      expect(errors).toHaveLength(0);
    });

    it("should detect file not found errors", async () => {
      const sourceCode = `
        const api = new sst.aws.Function("Test", {
          handler: "functions/nonexistent.handler"
        });
      `;

      mockASTAnalyzer.analyzeHandlerContexts.mockReturnValue([
        {
          type: "function",
          expectedPath: "functions/nonexistent.handler",
          position: 100,
          node: {},
        },
      ]);

      // Mock fs.promises.readFile to return our source code
      vi.mocked(fs.promises.readFile).mockResolvedValueOnce(sourceCode);

      const errors = await validator.validateFile("test.ts", mockHandlers);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        type: "file-not-found",
        handlerPath: "functions/nonexistent.handler",
        message: expect.stringContaining("Handler file not found"),
      });
    });

    it("should detect function not found errors", async () => {
      const sourceCode = `
        const api = new sst.aws.Function("Test", {
          handler: "functions/handler1.nonexistent"
        });
      `;

      mockASTAnalyzer.analyzeHandlerContexts.mockReturnValue([
        {
          type: "function",
          expectedPath: "functions/handler1.nonexistent",
          position: 100,
          node: {},
        },
      ]);

      const errors = await validator.validateFile(sourceCode, mockHandlers);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        type: "function-not-found",
        handlerPath: "functions/handler1.nonexistent",
        message: expect.stringContaining('Function "nonexistent" not found'),
      });
    });

    it("should detect invalid format errors", async () => {
      const sourceCode = `
        const api = new sst.aws.Function("Test", {
          handler: "invalid-format"
        });
      `;

      mockASTAnalyzer.analyzeHandlerContexts.mockReturnValue([
        {
          type: "function",
          expectedPath: "invalid-format",
          position: 100,
          node: {},
        },
      ]);

      const errors = await validator.validateFile(sourceCode, mockHandlers);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        type: "invalid-format",
        handlerPath: "invalid-format",
        message: expect.stringContaining("Invalid handler format"),
      });
    });

    it("should provide suggestions for similar paths", async () => {
      const sourceCode = `
        const api = new sst.aws.Function("Test", {
          handler: "functions/handler3.handler"
        });
      `;

      mockASTAnalyzer.analyzeHandlerContexts.mockReturnValue([
        {
          type: "function",
          expectedPath: "functions/handler3.handler",
          position: 100,
          node: {},
        },
      ]);

      const errors = await validator.validateFile(sourceCode, mockHandlers);

      expect(errors).toHaveLength(1);
      expect(errors[0].suggestions).toBeDefined();
      expect(errors[0].suggestions).toContain("functions/handler1");
    });

    it("should handle multiple handlers in same file", async () => {
      const sourceCode = `
        const api = new sst.aws.Function("Test1", {
          handler: "functions/handler1.handler"
        });
        
        const cron = new sst.aws.Cron("Test2", {
          function: "functions/nonexistent.handler"
        });
      `;

      mockASTAnalyzer.analyzeHandlerContexts.mockReturnValue([
        {
          type: "function",
          expectedPath: "functions/handler1.handler",
          position: 100,
          node: {},
        },
        {
          type: "cron",
          expectedPath: "functions/nonexistent.handler",
          position: 200,
          node: {},
        },
      ]);

      const errors = await validator.validateFile(sourceCode, mockHandlers);

      expect(errors).toHaveLength(1);
      expect(errors[0]?.type).toBe("file-not-found");
      expect(errors[0]?.handlerPath).toBe("functions/nonexistent.handler");
    });

    it("should handle bucket notifications array", async () => {
      const sourceCode = `
        bucket.notify({
          notifications: [
            {
              name: "Handler1",
              function: "functions/handler1.handler"
            },
            {
              name: "Handler2",
              function: "functions/invalid.handler"
            }
          ]
        });
      `;

      mockASTAnalyzer.analyzeHandlerContexts.mockReturnValue([
        {
          type: "bucket",
          expectedPath: "functions/handler1.handler",
          position: 100,
          node: {},
        },
        {
          type: "bucket",
          expectedPath: "functions/invalid.handler",
          position: 200,
          node: {},
        },
      ]);

      const errors = await validator.validateFile(sourceCode, mockHandlers);

      expect(errors).toHaveLength(1);
      expect(errors[0]?.handlerPath).toBe("functions/invalid.handler");
    });
  });

  describe("validateProject", () => {
    it("should validate all TypeScript files in project", async () => {
      mockFileScanner.findSstRoot.mockResolvedValue("/mock/project");
      mockFileScanner.scanHandlers.mockResolvedValue([]);

      // Mock file system scanning
      vi.fn().mockResolvedValue([
        "/mock/project/src/infra/lambda.ts",
        "/mock/project/src/infra/cron.ts",
      ]);

      // Mock fs.readFileSync
      const mockReadFileSync = vi
        .fn()
        .mockReturnValueOnce("// lambda file content")
        .mockReturnValueOnce("// cron file content");

      vi.doMock("node:fs", () => ({
        readFileSync: mockReadFileSync,
      }));

      const result = await validator.validateProject();

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should return error when SST root not found", async () => {
      mockFileScanner.findSstRoot.mockResolvedValue(null);

      const result = await validator.validateProject();

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe(
        "SST project root not found. Make sure sst.config.ts exists.",
      );
    });
  });

  describe("findSimilarPaths", () => {
    it("should find similar paths using Levenshtein distance", () => {
      const availablePaths = ["functions/handler1", "functions/handler2", "functions/processor"];

      const result = validator.findSimilarPaths("functions/handler3", availablePaths);

      expect(result).toContain("functions/handler1");
      expect(result).toContain("functions/handler2");
    });

    it("should return empty array for very different paths", () => {
      const availablePaths = ["functions/handler1", "apis/routes"];

      const result = validator.findSimilarPaths("completely/different/path", availablePaths);

      expect(result).toHaveLength(0);
    });
  });
});
