import {
  beforeEach,
  describe,
  expect,
  it,
  type MockedFunction,
  type MockInstance,
  vi,
} from "vitest";
import { SSTValidator } from "../lib/validator";

// Mock the validator
vi.mock("../lib/validator");

const MockedSSTValidator = vi.mocked(SSTValidator);

describe("CLI", () => {
  let mockValidator: any;
  let mockConsoleLog: MockInstance<typeof console.log>;
  let mockConsoleError: MockInstance<typeof console.error>;
  let mockProcessExit: MockInstance<typeof process.exit>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockValidator = {
      validateProject: vi.fn(),
      validateFile: vi.fn(),
    };

    MockedSSTValidator.mockImplementation(() => mockValidator);

    mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
    mockConsoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockProcessExit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
  });

  describe("validate command", () => {
    it("should validate project successfully with no errors", async () => {
      mockValidator.validateProject.mockResolvedValue({
        files: [
          { file: "test1.ts", errors: [] },
          { file: "test2.ts", errors: [] },
        ],
        totalErrors: 0,
      });

      // Import and run CLI command
      const { validateCommand } = await import("../cli/index");
      await validateCommand();

      expect(mockValidator.validateProject).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith("✅ Project validation completed successfully!");
      expect(mockConsoleLog).toHaveBeenCalledWith("📄 Files validated: 2");
      expect(mockConsoleLog).toHaveBeenCalledWith("🐛 Total errors: 0");
    });

    it("should display validation errors", async () => {
      mockValidator.validateProject.mockResolvedValue({
        files: [
          {
            file: "test1.ts",
            errors: [
              {
                type: "file-not-found",
                handlerPath: "functions/missing.handler",
                message: "Handler file not found",
                suggestions: ["functions/existing"],
              },
            ],
          },
        ],
        totalErrors: 1,
      });

      const { validateCommand } = await import("../cli/index");
      await validateCommand();

      expect(mockConsoleError).toHaveBeenCalledWith("❌ Found 1 validation error(s):");
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining("test1.ts"));
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("Handler file not found"),
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it("should handle project validation errors", async () => {
      mockValidator.validateProject.mockResolvedValue({
        error: "SST project root not found. Make sure sst.config.ts exists.",
      });

      const { validateCommand } = await import("../cli/index");
      await validateCommand();

      expect(mockConsoleError).toHaveBeenCalledWith(
        "❌ SST project root not found. Make sure sst.config.ts exists.",
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it("should handle unexpected errors", async () => {
      mockValidator.validateProject.mockRejectedValue(new Error("Unexpected error"));

      const { validateCommand } = await import("../cli/index");
      await validateCommand();

      expect(mockConsoleError).toHaveBeenCalledWith(
        "❌ Error during validation:",
        expect.any(Error),
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe("validate-file command", () => {
    it("should validate single file successfully", async () => {
      mockValidator.validateFile.mockResolvedValue([]);

      // Mock fs.readFileSync
      vi.doMock("node:fs", () => ({
        readFileSync: vi.fn().mockReturnValue("// test file content"),
      }));

      const { validateFileCommand } = await import("../cli/index");
      await validateFileCommand("test.ts");

      expect(mockValidator.validateFile).toHaveBeenCalledWith("// test file content", "test.ts");
      expect(mockConsoleLog).toHaveBeenCalledWith("✅ File validation completed successfully!");
      expect(mockConsoleLog).toHaveBeenCalledWith("🐛 Errors found: 0");
    });

    it("should display file validation errors", async () => {
      mockValidator.validateFile.mockResolvedValue([
        {
          type: "function-not-found",
          handlerPath: "functions/test.missing",
          message: "Function not found",
          suggestions: ["handler"],
        },
      ]);

      vi.doMock("node:fs", () => ({
        readFileSync: vi.fn().mockReturnValue("// test file content"),
      }));

      const { validateFileCommand } = await import("../cli/index");
      await validateFileCommand("test.ts");

      expect(mockConsoleError).toHaveBeenCalledWith("❌ Found 1 validation error(s) in test.ts:");
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining("Function not found"));
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it("should handle file read errors", async () => {
      vi.doMock("node:fs", () => ({
        readFileSync: vi.fn().mockImplementation(() => {
          throw new Error("File not found");
        }),
      }));

      const { validateFileCommand } = await import("../cli/index");
      await validateFileCommand("nonexistent.ts");

      expect(mockConsoleError).toHaveBeenCalledWith(
        "❌ Error reading file nonexistent.ts:",
        expect.any(Error),
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe("list-handlers command", () => {
    it("should list all available handlers", async () => {
      mockValidator.fileScanner = {
        scanHandlers: vi.fn().mockResolvedValue([
          {
            filePath: "/project/functions/handler1.ts",
            relativePath: "functions/handler1",
            exportedFunctions: ["handler", "processor"],
          },
          {
            filePath: "/project/functions/handler2.ts",
            relativePath: "functions/handler2",
            exportedFunctions: ["main"],
          },
        ]),
      };

      const { listHandlersCommand } = await import("../cli/index");
      await listHandlersCommand();

      expect(mockConsoleLog).toHaveBeenCalledWith("📋 Available SST Handlers:");
      expect(mockConsoleLog).toHaveBeenCalledWith("📁 functions/handler1.ts");
      expect(mockConsoleLog).toHaveBeenCalledWith("   • functions/handler1.handler");
      expect(mockConsoleLog).toHaveBeenCalledWith("   • functions/handler1.processor");
      expect(mockConsoleLog).toHaveBeenCalledWith("📁 functions/handler2.ts");
      expect(mockConsoleLog).toHaveBeenCalledWith("   • functions/handler2.main");
    });

    it("should handle no handlers found", async () => {
      mockValidator.fileScanner = {
        scanHandlers: vi.fn().mockResolvedValue([]),
      };

      const { listHandlersCommand } = await import("../cli/index");
      await listHandlersCommand();

      expect(mockConsoleLog).toHaveBeenCalledWith("📋 Available SST Handlers:");
      expect(mockConsoleLog).toHaveBeenCalledWith("No handlers found in the project.");
    });

    it("should handle scanner errors", async () => {
      const err = new Error("Scanner error");
      mockValidator.fileScanner = {
        scanHandlers: vi.fn().mockRejectedValue(err),
      };

      const { listHandlersCommand } = await import("../cli/index");
      await listHandlersCommand();

      expect(mockConsoleError).toHaveBeenCalledWith("❌ Scan failed:", expect.any(err));
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });
});
