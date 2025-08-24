import { beforeEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";
import { SSTCompletionProvider } from "../completionProvider";

vi.mock("vscode", () => ({
  CompletionItem: class MockCompletionItem {
    label: string;
    kind: number;
    detail?: string;
    documentation?: any;
    insertText?: string;
    command?: any;

    constructor(label: string, kind: number) {
      this.label = label;
      this.kind = kind;
    }
  },
  CompletionItemKind: {
    File: 1,
    Function: 2,
  },
  MarkdownString: class MockMarkdownString {
    value: string;
    constructor(value: string) {
      this.value = value;
    }
  },
  Position: class MockPosition {
    line: number;
    character: number;
    constructor(line: number, character: number) {
      this.line = line;
      this.character = character;
    }
  },
}));

vi.mock("../fileScanner", () => ({
  FileScanner: class MockFileScanner {
    async scanHandlers() {
      return [
        {
          filePath: "/test/functions/upload.ts",
          relativePath: "functions/upload",
          exportedFunctions: ["handler", "otherFunction"],
        },
        {
          filePath: "/test/functions/details.ts",
          relativePath: "functions/details",
          exportedFunctions: ["handler", "default"],
        },
        {
          filePath: "/test/lib/utils.ts",
          relativePath: "lib/utils",
          exportedFunctions: ["utilFunction"],
        },
      ];
    }
  },
}));

vi.mock("../handlerParser", () => ({
  HandlerParser: class MockHandlerParser {
    async parseExportedFunctions(filePath: string) {
      if (filePath.includes("upload.ts")) {
        return ["handler", "otherFunction"];
      }
      if (filePath.includes("details.ts")) {
        return ["handler", "default"];
      }
      return [];
    }
  },
}));

describe("SSTCompletionProvider", () => {
  let provider: SSTCompletionProvider;
  let mockDocument: any;

  beforeEach(async () => {
    provider = new SSTCompletionProvider("/test-workspace");
    await provider.refreshHandlers();

    mockDocument = {
      lineAt: vi.fn(),
      getText: vi.fn(),
      offsetAt: vi.fn(),
      fileName: "test.ts",
    };
  });

  it("should provide file path completions when in handler context", async () => {
    const position = new vscode.Position(0, 41);
    const sourceCode = 'new sst.aws.Function("test", { handler: "" });';

    mockDocument.getText.mockReturnValue(sourceCode);
    mockDocument.offsetAt.mockReturnValue(41);
    mockDocument.lineAt.mockReturnValue({ text: 'new sst.aws.Function("test", { handler: ""' });

    const items = await provider.provideCompletionItems(
      mockDocument,
      position,
      {} as any,
      {} as any,
    );

    expect(items).toHaveLength(3);
    expect(items[0].label).toBe("functions/upload");
    expect(items[1].label).toBe("functions/details");
    expect(items[2].label).toBe("lib/utils");
    expect(items[0].insertText).toBe("functions/upload.");
  });

  it("should provide function completions when file path is specified", async () => {
    const position = new vscode.Position(0, 58);
    const sourceCode = 'new sst.aws.Function("test", { handler: "functions/upload." });';

    mockDocument.getText.mockReturnValue(sourceCode);
    mockDocument.offsetAt.mockReturnValue(58);
    mockDocument.lineAt.mockReturnValue({
      text: 'new sst.aws.Function("test", { handler: "functions/upload.',
    });

    const items = await provider.provideCompletionItems(
      mockDocument,
      position,
      {} as any,
      {} as any,
    );

    expect(items).toHaveLength(2);
    expect(items.map((i) => i.label)).toContain("handler");
    expect(items.map((i) => i.label)).toContain("otherFunction");
  });

  it("should return empty array when not in SST context", async () => {
    const position = new vscode.Position(0, 20);
    const sourceCode = 'const someVariable = "";';

    mockDocument.getText.mockReturnValue(sourceCode);
    mockDocument.offsetAt.mockReturnValue(20);
    mockDocument.lineAt.mockReturnValue({ text: 'const someVariable = "' });

    const items = await provider.provideCompletionItems(
      mockDocument,
      position,
      {} as any,
      {} as any,
    );

    expect(items).toHaveLength(0);
  });

  it("should return empty array when not in handler string", async () => {
    const position = new vscode.Position(0, 30);
    const sourceCode = 'new sst.aws.Function("test", { });';

    mockDocument.getText.mockReturnValue(sourceCode);
    mockDocument.offsetAt.mockReturnValue(30);
    mockDocument.lineAt.mockReturnValue({ text: 'new sst.aws.Function("test", { ' });

    const items = await provider.provideCompletionItems(
      mockDocument,
      position,
      {} as any,
      {} as any,
    );

    expect(items).toHaveLength(0);
  });

  it("should provide completions when cursor is in middle of string", async () => {
    const position = new vscode.Position(0, 20); // Position within 'functions'
    const sourceCode = "queue.subscribe(`functions`);";

    mockDocument.getText.mockReturnValue(sourceCode);
    mockDocument.offsetAt.mockReturnValue(20); // Position within the template literal
    mockDocument.lineAt.mockReturnValue({ text: "queue.subscribe(`functions`);" });

    const items = await provider.provideCompletionItems(
      mockDocument,
      position,
      {} as any,
      {} as any,
    );

    // Should get file path completions filtered by 'functions'
    expect(items.length).toBeGreaterThan(0);
    const paths = items.map((c) => c.label);
    expect(paths).toContain("functions/upload");
    expect(paths).toContain("functions/details");
  });
});
