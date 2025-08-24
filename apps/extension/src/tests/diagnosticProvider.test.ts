import { beforeEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";
import { SSTDiagnosticProvider } from "../diagnosticProvider";

// Mock FileScanner
vi.mock("../fileScanner", () => ({
  FileScanner: vi.fn().mockImplementation(() => ({
    scanHandlers: vi.fn().mockResolvedValue([
      {
        filePath: "/test-workspace/functions/upload.ts",
        relativePath: "functions/upload",
        exportedFunctions: ["handler", "otherFunction"],
      },
      {
        filePath: "/test-workspace/functions/details.ts",
        relativePath: "functions/details",
        exportedFunctions: ["handler"],
      },
    ]),
  })),
}));

// Mock vscode
vi.mock("vscode", () => ({
  languages: {
    createDiagnosticCollection: vi.fn().mockReturnValue({
      set: vi.fn(),
      dispose: vi.fn(),
    }),
  },
  workspace: {
    textDocuments: [],
  },
  DiagnosticSeverity: {
    Error: 0,
    Warning: 1,
    Information: 2,
    Hint: 3,
  },
  Diagnostic: vi.fn().mockImplementation((range, message, severity) => ({
    range,
    message,
    severity,
    source: undefined,
    code: undefined,
  })),
  Range: vi.fn().mockImplementation((start, end) => ({ start, end })),
  Position: vi.fn().mockImplementation((line, character) => ({ line, character })),
}));

describe("SSTDiagnosticProvider", () => {
  let _provider: SSTDiagnosticProvider;
  let mockDocument: any;

  beforeEach(() => {
    _provider = new SSTDiagnosticProvider("/test-workspace");

    mockDocument = {
      languageId: "typescript",
      fileName: "test.ts",
      getText: vi.fn(),
      uri: { path: "/test/path" },
    };
  });

  it("should create diagnostic for non-existent file", async () => {
    const sourceCode = `
      new sst.aws.Function("test", {
        handler: "functions/nonexistent.handler",
      });
    `;

    mockDocument.getText.mockReturnValue(sourceCode);

    // Mock the diagnostic collection set method to capture calls
    const mockSet = vi.fn();
    (vscode.languages.createDiagnosticCollection as any).mockReturnValue({
      set: mockSet,
      dispose: vi.fn(),
    });

    // Create a new provider to get the fresh mock
    const testProvider = new SSTDiagnosticProvider("/test-workspace");
    await testProvider.validateDocument(mockDocument);

    expect(mockSet).toHaveBeenCalled();
    const [_uri, diagnostics] = mockSet.mock.calls[0];
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain("Handler file not found");
    expect(diagnostics[0].message).toContain("functions/nonexistent");
  });

  it("should create diagnostic for non-existent function", async () => {
    const sourceCode = `
      new sst.aws.Function("test", {
        handler: "functions/upload.nonexistentFunction",
      });
    `;

    mockDocument.getText.mockReturnValue(sourceCode);

    const mockSet = vi.fn();
    (vscode.languages.createDiagnosticCollection as any).mockReturnValue({
      set: mockSet,
      dispose: vi.fn(),
    });

    const testProvider = new SSTDiagnosticProvider("/test-workspace");
    await testProvider.validateDocument(mockDocument);

    expect(mockSet).toHaveBeenCalled();
    const [_uri, diagnostics] = mockSet.mock.calls[0];
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain('Function "nonexistentFunction" not found');
    expect(diagnostics[0].message).toContain("Available functions: handler, otherFunction");
  });

  it("should create diagnostic for invalid handler format", async () => {
    const sourceCode = `
      new sst.aws.Function("test", {
        handler: "invalid-format",
      });
    `;

    mockDocument.getText.mockReturnValue(sourceCode);

    const mockSet = vi.fn();
    (vscode.languages.createDiagnosticCollection as any).mockReturnValue({
      set: mockSet,
      dispose: vi.fn(),
    });

    const testProvider = new SSTDiagnosticProvider("/test-workspace");
    await testProvider.validateDocument(mockDocument);

    expect(mockSet).toHaveBeenCalled();
    const [_uri, diagnostics] = mockSet.mock.calls[0];
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain("Invalid handler format");
    expect(diagnostics[0].message).toContain('Expected format: "path/to/file.functionName"');
  });

  it("should not create diagnostics for valid handlers", async () => {
    const sourceCode = `
      new sst.aws.Function("test", {
        handler: "functions/upload.handler",
      });
    `;

    mockDocument.getText.mockReturnValue(sourceCode);

    const mockSet = vi.fn();
    (vscode.languages.createDiagnosticCollection as any).mockReturnValue({
      set: mockSet,
      dispose: vi.fn(),
    });

    const testProvider = new SSTDiagnosticProvider("/test-workspace");
    await testProvider.validateDocument(mockDocument);

    expect(mockSet).toHaveBeenCalled();
    const [_uri, diagnostics] = mockSet.mock.calls[0];
    expect(diagnostics).toHaveLength(0);
  });

  it("should handle bucket notifications", async () => {
    const sourceCode = `
      publicBucket.notify({
        notifications: [
          {
            function: "functions/nonexistent.handler",
          },
        ],
      });
    `;

    mockDocument.getText.mockReturnValue(sourceCode);

    const mockSet = vi.fn();
    (vscode.languages.createDiagnosticCollection as any).mockReturnValue({
      set: mockSet,
      dispose: vi.fn(),
    });

    const testProvider = new SSTDiagnosticProvider("/test-workspace");
    await testProvider.validateDocument(mockDocument);

    expect(mockSet).toHaveBeenCalled();
    const [_uri, diagnostics] = mockSet.mock.calls[0];
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain("Handler file not found");
  });

  it("should provide suggestions for similar paths", async () => {
    const sourceCode = `
      new sst.aws.Function("test", {
        handler: "functions/uplod.handler",
      });
    `;

    mockDocument.getText.mockReturnValue(sourceCode);

    const mockSet = vi.fn();
    (vscode.languages.createDiagnosticCollection as any).mockReturnValue({
      set: mockSet,
      dispose: vi.fn(),
    });

    const testProvider = new SSTDiagnosticProvider("/test-workspace");
    await testProvider.validateDocument(mockDocument);

    expect(mockSet).toHaveBeenCalled();
    const [_uri, diagnostics] = mockSet.mock.calls[0];
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain("Did you mean");
    expect(diagnostics[0].message).toContain("functions/upload");
  });

  it("should detect unknown exported function names", async () => {
    const sourceCode = `
      new sst.aws.Function("test", {
        handler: "functions/details.notFoundHandler",
      });
    `;

    mockDocument.getText.mockReturnValue(sourceCode);

    const mockSet = vi.fn();
    (vscode.languages.createDiagnosticCollection as any).mockReturnValue({
      set: mockSet,
      dispose: vi.fn(),
    });

    const testProvider = new SSTDiagnosticProvider("/test-workspace");
    await testProvider.validateDocument(mockDocument);

    expect(mockSet).toHaveBeenCalled();
    const [_uri, diagnostics] = mockSet.mock.calls[0];
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain('Function "notFoundHandler" not found');
    expect(diagnostics[0].message).toContain("functions/details.ts");
    expect(diagnostics[0].message).toContain("Available functions: handler");
  });

  it("should validate template literal variables", async () => {
    const sourceCode = `
      const pathName = "nonexistent";
      new sst.aws.Function("test", {
        handler: \`functions/\${pathName}.handler\`,
      });
    `;

    mockDocument.getText.mockReturnValue(sourceCode);

    const mockSet = vi.fn();
    (vscode.languages.createDiagnosticCollection as any).mockReturnValue({
      set: mockSet,
      dispose: vi.fn(),
    });

    const testProvider = new SSTDiagnosticProvider("/test-workspace");
    await testProvider.validateDocument(mockDocument);

    expect(mockSet).toHaveBeenCalled();
    const [_uri, diagnostics] = mockSet.mock.calls[0];
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain("Handler file not found");
    expect(diagnostics[0].message).toContain("functions/nonexistent");
  });

  it("should validate resolved template literal variables with wrong function", async () => {
    const sourceCode = `
      const pathName = "details";
      new sst.aws.Function("test", {
        handler: \`functions/\${pathName}.wrongFunction\`,
      });
    `;

    mockDocument.getText.mockReturnValue(sourceCode);

    const mockSet = vi.fn();
    (vscode.languages.createDiagnosticCollection as any).mockReturnValue({
      set: mockSet,
      dispose: vi.fn(),
    });

    const testProvider = new SSTDiagnosticProvider("/test-workspace");
    await testProvider.validateDocument(mockDocument);

    expect(mockSet).toHaveBeenCalled();
    const [_uri, diagnostics] = mockSet.mock.calls[0];
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain('Function "wrongFunction" not found');
    expect(diagnostics[0].message).toContain("functions/details.ts");
    expect(diagnostics[0].message).toContain("Available functions: handler");
  });

  it("should not create diagnostics for valid template literal variables", async () => {
    const sourceCode = `
      const pathName = "upload";
      new sst.aws.Function("test", {
        handler: \`functions/\${pathName}.handler\`,
      });
    `;

    mockDocument.getText.mockReturnValue(sourceCode);

    const mockSet = vi.fn();
    (vscode.languages.createDiagnosticCollection as any).mockReturnValue({
      set: mockSet,
      dispose: vi.fn(),
    });

    const testProvider = new SSTDiagnosticProvider("/test-workspace");
    await testProvider.validateDocument(mockDocument);

    expect(mockSet).toHaveBeenCalled();
    const [_uri, diagnostics] = mockSet.mock.calls[0];
    expect(diagnostics).toHaveLength(0);
  });

  it("should validate template literal variables in Cron handlers", async () => {
    const sourceCode = `
      const pathName = "nonexistent";
      new sst.aws.Cron("test", {
        schedule: "rate(1 day)",
        function: \`functions/\${pathName}.handler\`,
      });
    `;

    mockDocument.getText.mockReturnValue(sourceCode);

    const mockSet = vi.fn();
    (vscode.languages.createDiagnosticCollection as any).mockReturnValue({
      set: mockSet,
      dispose: vi.fn(),
    });

    const testProvider = new SSTDiagnosticProvider("/test-workspace");
    await testProvider.validateDocument(mockDocument);

    expect(mockSet).toHaveBeenCalled();
    const [_uri, diagnostics] = mockSet.mock.calls[0];
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain("Handler file not found");
    expect(diagnostics[0].message).toContain("functions/nonexistent");
  });

  it("should validate template literal variables in Bucket notifications", async () => {
    const sourceCode = `
      const pathName = "details";
      publicBucket.notify({
        notifications: [
          {
            function: \`functions/\${pathName}.wrongFunction\`,
          },
        ],
      });
    `;

    mockDocument.getText.mockReturnValue(sourceCode);

    const mockSet = vi.fn();
    (vscode.languages.createDiagnosticCollection as any).mockReturnValue({
      set: mockSet,
      dispose: vi.fn(),
    });

    const testProvider = new SSTDiagnosticProvider("/test-workspace");
    await testProvider.validateDocument(mockDocument);

    expect(mockSet).toHaveBeenCalled();
    const [_uri, diagnostics] = mockSet.mock.calls[0];
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain('Function "wrongFunction" not found');
    expect(diagnostics[0].message).toContain("functions/details.ts");
    expect(diagnostics[0].message).toContain("Available functions: handler");
  });

  it("should handle multiple template literal variables in different contexts", async () => {
    const sourceCode = `
      const fileName = "upload";
      const nonExistentFile = "missing";
      
      new sst.aws.Function("test1", {
        handler: \`functions/\${fileName}.handler\`,  // Valid
      });
      
      new sst.aws.Cron("test2", {
        schedule: "rate(1 hour)",
        function: \`functions/\${nonExistentFile}.handler\`,  // Invalid file
      });
      
      queue.subscribe(\`functions/\${fileName}.wrongFunc\`);  // Invalid function
    `;

    mockDocument.getText.mockReturnValue(sourceCode);

    const mockSet = vi.fn();
    (vscode.languages.createDiagnosticCollection as any).mockReturnValue({
      set: mockSet,
      dispose: vi.fn(),
    });

    const testProvider = new SSTDiagnosticProvider("/test-workspace");
    await testProvider.validateDocument(mockDocument);

    expect(mockSet).toHaveBeenCalled();
    const [_uri, diagnostics] = mockSet.mock.calls[0];
    expect(diagnostics).toHaveLength(2); // Two errors: missing file and wrong function

    // Check that we have both types of errors
    const messages = diagnostics.map((d) => d.message);
    expect(
      messages.some((m) => m.includes("Handler file not found") && m.includes("missing")),
    ).toBe(true);
    expect(messages.some((m) => m.includes('Function "wrongFunc" not found'))).toBe(true);
  });
});
