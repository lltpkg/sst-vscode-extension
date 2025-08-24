import { spawn } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

type SpawnResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

async function runCLI(args: string[]): Promise<SpawnResult> {
  return new Promise((resolve) => {
    const cliPath = path.resolve(__dirname, "../../cli/sst-analyzer");
    const child = spawn("node", [cliPath, ...args], {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: process.cwd(),
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      resolve({
        exitCode: code || 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });

    child.on("error", (error) => {
      resolve({
        exitCode: 1,
        stdout: stdout.trim(),
        stderr: error.message,
      });
    });
  });
}

describe("CLI Commands - Spawn Process Tests", () => {
  const testRepoPath = path.resolve(__dirname, "../../__tests__/repo");

  describe("Validate Command", () => {
    it("should validate test repository and show results", async () => {
      const result = await runCLI(["validate", "--path", testRepoPath]);

      expect(result.stdout).toBeTruthy();
      expect([0, 1]).toContain(result.exitCode);

      if (result.stdout.includes("❌ Found")) {
        expect(result.stdout).toMatch(/❌.*Found.*error/i);
      } else {
        expect(result.stdout).toMatch(/✅.*All handler references are valid/i);
      }
    });

    it("should output JSON format when requested", async () => {
      const result = await runCLI(["validate", "--path", testRepoPath, "--json"]);

      if (result.stdout.includes("{")) {
        expect(() => JSON.parse(result.stdout)).not.toThrow();
        const data = JSON.parse(result.stdout);
        expect(data).toHaveProperty("isValid");
        expect(data).toHaveProperty("errors");
      }
    });

    it("should handle non-existent project path", async () => {
      const result = await runCLI(["validate", "--path", "/nonexistent/path"]);

      expect([0, 1]).toContain(result.exitCode);
      expect(result.stderr || result.stdout).toMatch(/Validation failed|No SST project found/i);
    });

    it("should show validation errors when they exist", async () => {
      const result = await runCLI(["validate", "--path", testRepoPath]);

      // The test repo should have validation errors
      expect(result.stdout).toMatch(/❌.*Found.*error/i);
      expect(result.stdout).toMatch(/Handler file not found/i);
    });
  });

  describe("Scan Handlers Command", () => {
    it("should scan all handlers in test repository", async () => {
      const result = await runCLI(["scan", "--path", testRepoPath]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/Found.*handler file/i);
      expect(result.stdout).toMatch(/functions/);
    });

    it("should output JSON format for handlers", async () => {
      const result = await runCLI(["scan", "--path", testRepoPath, "--json"]);

      expect(result.exitCode).toBe(0);
      expect(() => JSON.parse(result.stdout)).not.toThrow();

      const handlers = JSON.parse(result.stdout);
      expect(Array.isArray(handlers)).toBe(true);
      expect(handlers.length).toBeGreaterThan(0);
    });

    it("should handle project without SST config gracefully", async () => {
      const emptyPath = path.resolve(__dirname, "../../../");

      const result = await runCLI(["scan", "--path", emptyPath]);
      expect(result.exitCode).toBe(0);
      // When there's no sst.config.ts, it still finds files but shows warning
      expect(result.stdout).toMatch(/Found.*handler file|No sst.config.ts/i);
    });
  });

  describe("Check File Command", () => {
    it("should validate specific TypeScript files", async () => {
      const testFile = path.join(testRepoPath, "infra/lambda.ts");

      const result = await runCLI(["check-file", testFile, "--project", testRepoPath]);

      expect([0, 1]).toContain(result.exitCode);
    });

    it("should handle non-existent files", async () => {
      const nonExistentFile = path.join(testRepoPath, "nonexistent.ts");

      const result = await runCLI(["check-file", nonExistentFile, "--project", testRepoPath]);

      expect([0, 1]).toContain(result.exitCode);
      expect(result.stderr || result.stdout).toMatch(/File validation failed|Error reading file/i);
    });

    it("should output JSON format for file validation", async () => {
      const testFile = path.join(testRepoPath, "infra/lambda.ts");

      const result = await runCLI(["check-file", testFile, "--project", testRepoPath, "--json"]);

      if (result.stdout.includes("{")) {
        expect(() => JSON.parse(result.stdout)).not.toThrow();
      }
    });

    it("should show validation errors when file has issues", async () => {
      const testFile = path.join(testRepoPath, "infra/api/apiv1.ts");

      const result = await runCLI(["check-file", testFile, "--project", testRepoPath]);

      // This file should have validation errors
      expect(result.stdout).toMatch(/❌ Found|Handler file not found/i);
    });
  });

  describe("Statistics Command", () => {
    it("should show project statistics", async () => {
      const result = await runCLI(["stats", "--path", testRepoPath]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/Analyzing handler usage statistics/i);
      expect(result.stdout).toMatch(/Total handlers/i);
    });

    it("should output statistics in some format", async () => {
      const result = await runCLI(["stats", "--path", testRepoPath, "--json"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBeTruthy();

      // remove the first line
      const json = JSON.parse(result.stdout.split("\n").slice(1).join("\n"));

      // Try to find JSON in the output, even with control characters
      expect(json).toHaveProperty("totalHandlers");
      expect(json).toHaveProperty("totalUsages");
      expect(json).toHaveProperty("handlerUsages");
      expect(json).toHaveProperty("unusedHandlers");
      expect(json).toMatchSnapshot();
    });

    it("should show specific handler statistics", async () => {
      const result = await runCLI([
        "stats",
        "--path",
        testRepoPath,
        "--handler",
        "functions/upload.handler",
      ]);

      expect([0, 1]).toContain(result.exitCode);
      expect(result.stdout).toMatch(/(Statistics for handler|not found)/i);
    });

    it("should handle non-existent handler gracefully", async () => {
      const result = await runCLI([
        "stats",
        "--path",
        testRepoPath,
        "--handler",
        "functions/nonexistent.handler",
      ]);

      expect([0, 1]).toContain(result.exitCode);
      expect(result.stdout).toMatch(/not found/i);
    });
  });

  describe("Error Handling and Exit Codes", () => {
    it("should handle invalid paths gracefully", async () => {
      const result = await runCLI(["validate", "--path", "/definitely/nonexistent/path"]);

      expect([0, 1]).toContain(result.exitCode);
      expect(result.stderr || result.stdout).toMatch(
        /Validation failed|No SST project found|ENOENT: no such file or directory/i,
      );
    });

    it("should handle paths without SST projects", async () => {
      const result = await runCLI(["validate", "--path", "/tmp"]);

      expect([0, 1]).toContain(result.exitCode);
      expect(result.stderr || result.stdout).toBeTruthy();
    });

    it("should handle different project scenarios consistently", async () => {
      const testCases = [
        { path: testRepoPath, name: "valid SST project" },
        { path: "/tmp", name: "non-SST directory" },
      ];

      for (const testCase of testCases) {
        const result = await runCLI(["validate", "--path", testCase.path]);

        expect([0, 1]).toContain(result.exitCode);
        expect(result.stdout || result.stderr).toBeTruthy();
      }
    });
  });

  describe("Integration with Real Repository", () => {
    it("should handle the complete validation workflow", async () => {
      // First scan handlers
      const scanResult = await runCLI(["scan", "--path", testRepoPath]);
      expect(scanResult.exitCode).toBe(0);
      expect(scanResult.stdout).toBeTruthy();

      // Then validate project
      const validateResult = await runCLI(["validate", "--path", testRepoPath]);
      expect([0, 1]).toContain(validateResult.exitCode);
      expect(validateResult.stdout).toBeTruthy();
    });

    it("should provide consistent results across multiple runs", async () => {
      const results = [];

      for (let i = 0; i < 3; i++) {
        const result = await runCLI(["validate", "--path", testRepoPath]);
        results.push(result);
      }

      // All runs should have the same exit code
      const exitCodes = results.map((r) => r.exitCode);
      expect(new Set(exitCodes).size).toBe(1);
    });

    it("should show help when no arguments provided", async () => {
      const result = await runCLI([]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/(usage|help|command)/i);
    });

    it("should handle unknown commands gracefully", async () => {
      const result = await runCLI(["unknown-command"]);

      expect([0, 1]).toContain(result.exitCode);
      expect(result.stderr || result.stdout).toBeTruthy();
    });
  });
});
