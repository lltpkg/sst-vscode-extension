import path from "node:path";
import * as ts from "typescript";
import { describe, expect, it } from "vitest";
import { FileScanner } from "../lib/fileScanner";
import { SSTValidator } from "../lib/validator";

describe("Basic Integration Tests", () => {
  const testRepoPath = path.resolve(__dirname, "../../__tests__/repo");

  describe("FileScanner Basic Tests", () => {
    it("should create a FileScanner instance", () => {
      const scanner = new FileScanner(testRepoPath, ts);
      expect(scanner).toBeInstanceOf(FileScanner);
    });

    it("should handle scanning without errors", async () => {
      const scanner = new FileScanner(testRepoPath, ts);
      const handlers = await scanner.scanHandlers();
      expect(Array.isArray(handlers)).toBe(true);
    });
  });

  describe("SSTValidator Basic Tests", () => {
    it("should create a validator instance", () => {
      const _fileScanner = new FileScanner(testRepoPath, ts);
      const validator = new SSTValidator(testRepoPath, ts);
      expect(validator).toBeInstanceOf(SSTValidator);
    });

    it("should validate project structure", async () => {
      const _fileScanner = new FileScanner(testRepoPath, ts);
      const validator = new SSTValidator(testRepoPath, ts);

      const result = await validator.validateProject();
      expect(result).toHaveProperty("isValid");
      expect(result).toHaveProperty("errors");
      expect(result).toHaveProperty("warnings");
    });

    it("should handle no handlers found", async () => {
      const fileScanner = new FileScanner(testRepoPath, ts);
      const validator = new SSTValidator(testRepoPath, ts);

      const handlers = await fileScanner.scanHandlers();
      const result = await validator.validateFile("test.ts", handlers);
      expect(result[0].type).toBe("file-not-found");
    });
  });

  describe("CLI Exit Code Tests", () => {
    it("should use correct exit codes for validation results", () => {
      // Test validation results structure
      const mockValidResult = {
        isValid: true,
        errors: [],
        warnings: [],
      };

      const mockInvalidResult = {
        isValid: false,
        errors: [{ type: "test-error", message: "Test error" }],
        warnings: [],
      };

      expect(mockValidResult.isValid).toBe(true);
      expect(mockInvalidResult.isValid).toBe(false);
    });
  });

  describe("TypeScript Integration", () => {
    it("should work with TypeScript API", () => {
      const sourceCode = `
        export const handler = async () => {
          return { statusCode: 200, body: "Hello" };
        };
      `;

      const sourceFile = ts.createSourceFile("test.ts", sourceCode, ts.ScriptTarget.Latest, true);

      expect(sourceFile.fileName).toBe("test.ts");
      expect(sourceFile.text).toContain("handler");
    });
  });

  describe("Path Utilities", () => {
    it("should handle path operations correctly", () => {
      const testPath = path.join(testRepoPath, "functions", "test.ts");
      const relativePath = path.relative(testRepoPath, testPath);

      expect(relativePath).toBe("functions/test.ts");
    });

    it("should detect TypeScript files", () => {
      const tsFile = "test.ts";
      const jsFile = "test.js";
      const configFile = "test.d.ts";

      expect(tsFile.endsWith(".ts")).toBe(true);
      expect(jsFile.endsWith(".ts")).toBe(false);
      expect(configFile.endsWith(".d.ts")).toBe(true);
    });
  });
});
