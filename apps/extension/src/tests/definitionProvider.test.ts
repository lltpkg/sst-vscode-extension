import { beforeEach, describe, expect, it, vi } from "vitest";
import { SSTDefinitionProvider } from "../definitionProvider";

// Mock FileScanner
vi.mock("../fileScanner", () => ({
  FileScanner: vi.fn().mockImplementation(() => ({
    scanHandlers: vi.fn().mockResolvedValue([
      {
        filePath: "/test-workspace/functions/upload.ts",
        relativePath: "functions/upload",
        exportedFunctions: ["handler", "otherFunction"],
      },
    ]),
  })),
}));

// Mock vscode
vi.mock("vscode", () => ({
  workspace: {
    openTextDocument: vi.fn(),
  },
  Position: vi.fn().mockImplementation((line, character) => ({ line, character })),
  Location: vi.fn().mockImplementation((uri, position) => ({ uri, position })),
  Uri: {
    file: vi.fn().mockImplementation((path) => ({ fsPath: path })),
  },
}));

describe("SSTDefinitionProvider", () => {
  let provider: SSTDefinitionProvider;
  let mockDocument: any;

  beforeEach(async () => {
    provider = new SSTDefinitionProvider("/test-workspace");

    mockDocument = {
      getText: vi.fn(),
      offsetAt: vi.fn(),
      fileName: "test.ts",
      positionAt: vi.fn().mockReturnValue({ line: 10, character: 0 }),
    };

    // Mock the workspace document with handler function content
    const vscode = await import("vscode");
    (vscode.workspace.openTextDocument as any).mockResolvedValue({
      getText: () => `
export const handler = async (event) => {
  return { statusCode: 200 };
};

export function otherFunction() {
  return "test";
}
      `,
      positionAt: vi.fn().mockReturnValue({ line: 1, character: 0 }),
    });
  });

  it("should provide definition for SST Function handler", async () => {
    const position = { line: 0, character: 50 };
    const sourceCode = 'new sst.aws.Function("test", { handler: "functions/upload.handler" });';

    mockDocument.getText.mockReturnValue(sourceCode);
    mockDocument.offsetAt.mockReturnValue(50);

    const definition = await provider.provideDefinition(mockDocument, position, {} as any);

    expect(definition).toBeTruthy();
    const vscode = await import("vscode");
    expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith(
      "/test-workspace/functions/upload.ts",
    );
  });

  it("should provide definition for SST Cron function", async () => {
    const position = { line: 0, character: 45 };
    const sourceCode = 'new sst.aws.Cron("test", { function: "functions/upload.handler" });';

    mockDocument.getText.mockReturnValue(sourceCode);
    mockDocument.offsetAt.mockReturnValue(45);

    const definition = await provider.provideDefinition(mockDocument, position, {} as any);

    expect(definition).toBeTruthy();
    const vscode = await import("vscode");
    expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith(
      "/test-workspace/functions/upload.ts",
    );
  });

  it("should provide definition for Queue subscribe", async () => {
    const position = { line: 0, character: 25 };
    const sourceCode = 'queue.subscribe("functions/upload.handler");';

    mockDocument.getText.mockReturnValue(sourceCode);
    mockDocument.offsetAt.mockReturnValue(25);

    const definition = await provider.provideDefinition(mockDocument, position, {} as any);

    expect(definition).toBeTruthy();
    const vscode = await import("vscode");
    expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith(
      "/test-workspace/functions/upload.ts",
    );
  });

  it("should return null when not in SST context", async () => {
    const position = { line: 0, character: 10 };
    const sourceCode = 'const test = "not sst related";';

    mockDocument.getText.mockReturnValue(sourceCode);
    mockDocument.offsetAt.mockReturnValue(10);

    const definition = await provider.provideDefinition(mockDocument, position, {} as any);

    expect(definition).toBeNull();
  });

  it("should return null when handler file not found", async () => {
    const position = { line: 0, character: 50 };
    const sourceCode = 'new sst.aws.Function("test", { handler: "nonexistent/file.handler" });';

    mockDocument.getText.mockReturnValue(sourceCode);
    mockDocument.offsetAt.mockReturnValue(50);

    const definition = await provider.provideDefinition(mockDocument, position, {} as any);

    expect(definition).toBeNull();
  });
});
