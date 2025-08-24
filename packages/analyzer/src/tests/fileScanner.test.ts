import * as fs from "node:fs";
import * as path from "node:path";
import * as ts from "typescript";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FileScanner } from "../lib/fileScanner";

// Mock fs module
vi.mock("node:fs");
vi.mock("node:path");

const mockedFs = vi.mocked(fs);
const mockedPath = vi.mocked(path);

class MockFileScanner extends FileScanner {
  public findSstRoot(): Promise<string | null> {
    return super.findSstRoot();
  }

  public shouldIncludeFile(filePath: string): boolean {
    return super.shouldIncludeFile(filePath);
  }
}

describe("FileScanner", () => {
  let scanner: MockFileScanner;
  const mockWorkspaceRoot = "/mock/workspace";

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default path mocks
    mockedPath.join.mockImplementation((...args) => args.join("/"));
    mockedPath.resolve.mockImplementation((...args) => "/" + args.join("/"));
    mockedPath.relative.mockImplementation((from, to) => to.replace(from + "/", ""));
    mockedPath.dirname.mockImplementation((p) => {
      const parts = p.split("/");
      if (parts.length <= 2) return p; // Prevent infinite loop for root paths
      return parts.slice(0, -1).join("/");
    });

    // Mock fs.promises.readdir to return empty array by default
    mockedFs.promises = {
      readdir: vi.fn().mockResolvedValue([]),
      readFile: vi.fn().mockResolvedValue("{}"),
    } as any;

    // Mock fs.readFileSync to return empty string by default
    mockedFs.readFileSync = vi.fn().mockReturnValue("");

    scanner = new MockFileScanner(mockWorkspaceRoot, ts);
  });

  describe("findSstRoot", () => {
    it("should find sst.config.ts in workspace root", async () => {
      mockedFs.existsSync.mockImplementation((filePath) => {
        return filePath === "/mock/workspace/sst.config.ts";
      });

      const result = await scanner.findSstRoot();
      expect(result).toBe("/mock/workspace");
    });

    it("should find sst.config.ts in parent directory", async () => {
      mockedFs.existsSync.mockImplementation((filePath) => {
        return filePath === "/mock/sst.config.ts";
      });

      // Mock readdir to return empty array (no subdirectories to search)
      (mockedFs.promises.readdir as any).mockResolvedValue([]);

      const result = await scanner.findSstRoot();
      expect(result).toBe("/mock");
    });

    it("should return null when sst.config.ts not found", async () => {
      mockedFs.existsSync.mockReturnValue(false);

      const result = await scanner.findSstRoot();
      expect(result).toBeNull();
    });
  });

  describe("loadTSConfig", () => {
    it("should load and parse tsconfig.json", async () => {
      const mockTsConfig = {
        include: ["src/**/*"],
        exclude: ["node_modules", "dist"],
      };

      mockedFs.existsSync.mockImplementation((filePath) => {
        return (
          filePath === "/mock/workspace/sst.config.ts" ||
          filePath === "/mock/workspace/tsconfig.json"
        );
      });

      // Mock fs.promises.readFile for tsconfig loading
      mockedFs.promises.readFile = vi.fn().mockResolvedValue(JSON.stringify(mockTsConfig));

      const projectInfo = await scanner.findProjectConfig();

      expect(projectInfo!.includePatterns).toEqual(mockTsConfig.include);
      expect(projectInfo!.excludePatterns).toEqual(mockTsConfig.exclude);
      expect(mockedFs.promises.readFile).toHaveBeenCalledWith(
        "/mock/workspace/tsconfig.json",
        "utf-8",
      );
    });

    it("should return default config when tsconfig.json not found", async () => {
      mockedFs.existsSync.mockImplementation((filePath) => {
        return filePath === "/mock/workspace/sst.config.ts"; // Only sst.config.ts exists
      });

      const projectInfo = await scanner.findProjectConfig();

      expect(projectInfo!.includePatterns).toEqual(["**/*.ts"]);
      expect(projectInfo!.excludePatterns).toEqual(["node_modules/**", "dist/**", "**/*.test.ts"]);
    });
  });

  describe("shouldIncludeFile", () => {
    beforeEach(() => {
      // Mock scanner with tsConfig
      scanner = new MockFileScanner(mockWorkspaceRoot, ts);
      (scanner as any).tsConfig = {
        include: ["src/**/*.ts", "apps/**/*.ts"],
        exclude: ["**/*.test.ts", "node_modules/**/*"],
      };
      (scanner as any).sstRoot = "/mock/project";
    });

    it("should include files matching include patterns", () => {
      const result1 = scanner.shouldIncludeFile("/mock/project/src/functions/handler.ts");
      const result2 = scanner.shouldIncludeFile("/mock/project/apps/api/index.ts");

      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });

    it("should exclude files matching exclude patterns", () => {
      const result1 = scanner.shouldIncludeFile("/mock/project/src/functions/handler.test.ts");
      const result2 = scanner.shouldIncludeFile("/mock/project/node_modules/lib/index.ts");

      expect(result1).toBe(false);
      expect(result2).toBe(false);
    });

    it("should exclude files not matching any include pattern", () => {
      const result = scanner.shouldIncludeFile("/mock/project/docs/readme.md");

      expect(result).toBe(false);
    });
  });

  describe("scanHandlers", () => {
    beforeEach(() => {
      // Setup mock file system structure
      const mockFiles = new Map([
        ["/mock/project/src/functions/handler1.ts", "export const handler = () => {};"],
        ["/mock/project/src/functions/handler2.ts", "export function processor() {}"],
        ["/mock/project/apps/api/index.ts", "export default function main() {}"],
      ]);

      mockedFs.existsSync.mockImplementation((filePath) => {
        return filePath === "/mock/project/sst.config.ts" || mockFiles.has(filePath as string);
      });

      mockedFs.readFileSync.mockImplementation((filePath) => {
        if (filePath === "/mock/project/tsconfig.json") {
          return JSON.stringify({
            include: ["src/**/*.ts", "apps/**/*.ts"],
            exclude: ["**/*.test.ts"],
          });
        }
        return mockFiles.get(filePath as string) || "";
      });

      // Mock glob functionality
      //  vi.spyOn(scanner as any, "matchesPattern").mockImplementation((filePath, pattern) => {
      //   return true;
      //  });
      (scanner as any).globFiles = vi
        .fn()
        .mockResolvedValue([
          "/mock/project/src/functions/handler1.ts",
          "/mock/project/src/functions/handler2.ts",
          "/mock/project/apps/api/index.ts",
        ]);
    });

    it("should scan and return handler information", async () => {
      const result = await scanner.scanHandlers();

      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({
        filePath: "/mock/project/src/functions/handler1.ts",
        relativePath: "src/functions/handler1",
        exportedFunctions: ["handler"],
      });
    });

    it("should filter files based on tsconfig include/exclude", async () => {
      // Should not include test files due to exclude pattern
      vi.spyOn(scanner as any, "globFiles").mockResolvedValue([
        "/mock/project/src/functions/handler1.ts",
        "/mock/project/src/functions/handler1.test.ts",
      ]);

      const result = await scanner.scanHandlers();

      expect(result).toHaveLength(1);
      expect(result[0].filePath).toBe("/mock/project/src/functions/handler1.ts");
    });
  });

  describe("getRelativePath", () => {
    beforeEach(() => {
      (scanner as any).sstRoot = "/mock/project";
    });

    it("should return relative path from SST root", () => {
      const result = scanner.getRelativePath("/mock/project/src/functions/handler.ts");

      expect(result).toBe("src/functions/handler");
    });

    it("should handle nested paths correctly", () => {
      const result = scanner.getRelativePath("/mock/project/apps/api/routes/users.ts");

      expect(result).toBe("apps/api/routes/users");
    });
  });
});
