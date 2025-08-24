import { ASTAnalyzer, FileScanner, type HandlerInfo } from "@cute-me-on-repos/sst-analyzer";
import * as vscode from "vscode";
import { HandlerParser } from "./handlerParser";

export class SSTCompletionProvider implements vscode.CompletionItemProvider {
  private fileScanner: FileScanner;
  private handlerParser: HandlerParser;
  private astAnalyzer: ASTAnalyzer;
  private cachedHandlers: HandlerInfo[] = [];

  constructor(
    workspaceRoot: string,
    private readonly ts: typeof import("typescript"),
  ) {
    this.fileScanner = new FileScanner(workspaceRoot, this.ts);
    this.handlerParser = new HandlerParser(this.ts);
    this.astAnalyzer = new ASTAnalyzer(this.ts);
    this.refreshHandlers();
  }

  public async refreshHandlers(): Promise<void> {
    this.cachedHandlers = await this.fileScanner.scanHandlers();

    for (const handler of this.cachedHandlers) {
      handler.exportedFunctions = await this.handlerParser.parseExportedFunctions(handler.filePath);
    }
  }

  public async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
    _context: vscode.CompletionContext,
  ): Promise<vscode.CompletionItem[]> {
    const sourceCode = document.getText();
    const offset = document.offsetAt(position);

    // Use AST to analyze the context
    const contexts = this.astAnalyzer.analyzeHandlerContexts(sourceCode, document.fileName);
    const currentContext = this.astAnalyzer.isWithinHandlerString(offset, contexts);

    if (!currentContext) {
      return [];
    }

    const completionItems: vscode.CompletionItem[] = [];

    // Get current input from the string at cursor position
    const currentInput = this.getCurrentInputFromAST(document, position, currentContext);

    if (currentInput.includes(".")) {
      // User is typing function name after file path
      const [filePath] = currentInput.split(".");
      completionItems.push(...this.getFunctionCompletions(filePath));
    } else {
      // User is typing file path - provide completions even for partial input
      const filteredCompletions = this.getFilteredFilePathCompletions(
        currentContext.type,
        currentInput,
      );
      completionItems.push(...filteredCompletions);
    }

    return completionItems;
  }

  private getCurrentInputFromAST(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: any,
  ): string {
    const line = document.lineAt(position.line).text;
    const beforeCursor = line.substring(0, position.character);
    const afterCursor = line.substring(position.character);

    // First try: string starting from a quote (normal case)
    const stringMatch = beforeCursor.match(/["'`]([^"'`]*)$/);
    if (stringMatch) {
      return stringMatch[1];
    }

    // Second try: partial string in the middle (for cases like `fun|ctions`)
    // Look for opening quote somewhere before cursor and closing quote after cursor
    const openQuoteMatch = beforeCursor.match(/.*["'`]([^"'`]*)$/);
    const closeQuoteMatch = afterCursor.match(/^([^"'`]*)["'`]/);

    if (openQuoteMatch && closeQuoteMatch) {
      // We're in the middle of a string
      return openQuoteMatch[1] + closeQuoteMatch[1];
    }

    // Third try: just the part after the opening quote
    const partialMatch = beforeCursor.match(/["'`]([^"'`]*)$/);
    if (partialMatch) {
      return partialMatch[1];
    }

    return "";
  }

  private getFilteredFilePathCompletions(
    contextType: string,
    filterText: string,
  ): vscode.CompletionItem[] {
    const contextIcon = this.getContextIcon(contextType);
    return this.cachedHandlers
      .filter((handler) => {
        // Filter handlers based on partial input
        return (
          filterText === "" || handler.relativePath.toLowerCase().includes(filterText.toLowerCase())
        );
      })
      .map((handler) => {
        const item = new vscode.CompletionItem(handler.relativePath, contextIcon);

        const contextLabel = this.getContextLabel(contextType);
        item.detail = `${contextLabel} handler (${handler.exportedFunctions.length} exports)`;
        item.documentation = new vscode.MarkdownString(
          `**${contextLabel} Handler**\n\nAvailable exports: ${handler.exportedFunctions.join(", ")}`,
        );

        item.insertText = `${handler.relativePath}.`;
        item.filterText = handler.relativePath;
        item.sortText = handler.relativePath;
        item.command = {
          command: "editor.action.triggerSuggest",
          title: "Trigger function suggestions",
        };

        return item;
      });
  }

  private getContextLabel(contextType: string): string {
    switch (contextType) {
      case "function":
        return "Lambda Function";
      case "cron":
        return "Cron Job";
      case "queue":
        return "Queue Subscriber";
      case "bucket":
        return "Bucket Notification";
      case "apigatewayv1":
        return "API Gateway V1 Route";
      default:
        return "Handler";
    }
  }

  private getContextIcon(contextType: string) {
    switch (contextType) {
      case "function":
        return vscode.CompletionItemKind.Function;
      case "cron":
        return vscode.CompletionItemKind.Event;
      case "queue":
        return vscode.CompletionItemKind.Interface;
      case "bucket":
        return vscode.CompletionItemKind.Folder;
      case "apigatewayv1":
        return vscode.CompletionItemKind.Method;
      default:
        return vscode.CompletionItemKind.File;
    }
  }

  private getFunctionCompletions(filePath: string) {
    const handler = this.cachedHandlers.find((h) => h.relativePath === filePath);

    if (!handler) {
      return [];
    }

    return handler.exportedFunctions.map((func) => {
      const item = new vscode.CompletionItem(func, vscode.CompletionItemKind.Function);
      item.detail = `Exported function from ${handler.relativePath}`;
      item.insertText = func;

      return item;
    });
  }
}
