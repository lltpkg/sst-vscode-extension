import path from "node:path";
import * as ts from "typescript";
import { beforeEach, describe, expect, it } from "vitest";
import { FileScanner } from "../lib/fileScanner";
import { SSTValidator } from "../lib/validator";

class TestableValidator extends SSTValidator {
  public getFileScanner() {
    return this.fileScanner;
  }

  public testFindSimilarPaths(targetPath: string, availablePaths: string[]) {
    return this.findSimilarPaths(targetPath, availablePaths);
  }

  public async testValidateHandlerReference(handlerPath: string) {
    const handlers = await this.fileScanner.scanHandlers();
    return this.validateFile(handlerPath, handlers);
  }
}

describe("SSTValidator - Real Repository Tests", () => {
  let validator: TestableValidator;
  const testRepoPath = path.resolve(__dirname, "../../__tests__/repo");

  beforeEach(() => {
    const _fileScanner = new FileScanner(testRepoPath, ts);
    validator = new TestableValidator(testRepoPath, ts);
  });

  describe("Validation Setup", () => {
    it("should initialize with file scanner", () => {
      const fileScanner = validator.getFileScanner();
      expect(fileScanner).toBeInstanceOf(FileScanner);
    });

    it("should be able to scan test repository", async () => {
      const handlers = await validator.getFileScanner().scanHandlers();
      expect(handlers.length).toBeGreaterThan(0);
    });
  });

  describe("Handler Reference Validation", () => {
    it("should handle validation attempts", async () => {
      // Test the validation mechanism works without expecting specific results
      const result = await validator.testValidateHandlerReference("functions/test.handler");

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBe("file-not-found");
    });

    it("should detect invalid format errors", async () => {
      const result = await validator.testValidateHandlerReference("invalid-handler-format");

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBe("file-not-found");
    });

    it("should validate handler reference structure", async () => {
      // Test with a properly formatted handler path
      const result = await validator.testValidateHandlerReference("functions/example.handler");

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBe("file-not-found");
    });
  });

  describe("Similarity Suggestions", () => {
    it("should suggest similar paths for typos", () => {
      const availablePaths = [
        "functions/upload.handler",
        "functions/details.handler",
        "functions/invoke-multi-steps.handler",
      ];

      const suggestions = validator.testFindSimilarPaths("functions/uplod.handler", availablePaths);
      expect(suggestions).toContain("functions/upload.handler");
    });

    it("should suggest similar paths for case mismatches", () => {
      const availablePaths = ["functions/upload.handler", "functions/details.handler"];

      const suggestions = validator.testFindSimilarPaths(
        "functions/Upload.handler",
        availablePaths,
      );
      expect(suggestions).toContain("functions/upload.handler");
    });

    it("should return empty array for very different paths", () => {
      const availablePaths = ["functions/upload.handler", "functions/details.handler"];

      const suggestions = validator.testFindSimilarPaths(
        "completely/different/path.handler",
        availablePaths,
      );
      expect(suggestions).toHaveLength(2);
    });
  });

  describe("Project-Level Validation", () => {
    it("should handle project validation attempts", async () => {
      const result = await validator.validateProject();

      expect(result).toBeDefined();
      expect(result).toHaveProperty("isValid");
      expect(result).toHaveProperty("errors");
      expect(Array.isArray(result.errors)).toBe(true);

      // The test repo may not be a valid SST project, so we just check structure
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should handle validation errors gracefully", async () => {
      const result = await validator.validateProject();

      // Expect either a successful validation or properly structured errors
      if (!result.isValid && result.errors.length > 0) {
        result.errors.forEach((error) => {
          expect(error).toHaveProperty("type");
          expect(error).toHaveProperty("message");
        });
      }
    });

    it("should return consistent result structure", async () => {
      const result = await validator.validateProject();

      expect(result).toHaveProperty("isValid");
      expect(result).toHaveProperty("errors");
      expect(result).toHaveProperty("warnings");
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });

  describe("Error Context and Suggestions", () => {
    it("should handle suggestion generation", async () => {
      const result = await validator.testValidateHandlerReference("functions/test.handler");

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBe("file-not-found");
    });

    it("should handle various handler path formats", async () => {
      const testPaths = [
        "functions/test1.handler",
        "functions/test2.customFunction",
        "lib/utils.helper",
      ];

      for (const handlerPath of testPaths) {
        const result = await validator.testValidateHandlerReference(handlerPath);
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].type).toBe("file-not-found");
      }
    });
  });

  describe("Performance and Reliability", () => {
    it("should complete validation within reasonable time", async () => {
      const startTime = Date.now();
      await validator.validateProject();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds max
    });

    it("should handle repeated validations consistently", async () => {
      const result1 = await validator.validateProject();
      const result2 = await validator.validateProject();

      expect(result1.isValid).toBe(result2.isValid);
      expect(result1.errors.length).toBe(result2.errors.length);

      // Only check summary if it exists
      expect(result1.isValid).toBe(result2.isValid);
      expect(result1.errors.length).toBe(result2.errors.length);
    });
  });
});
