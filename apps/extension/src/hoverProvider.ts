import { ASTAnalyzer, FileScanner, StatisticsAnalyzer } from "@cute-me-on-repos/sst-analyzer";
import type * as ts from "typescript";
import * as vscode from "vscode";

export class SSTHoverProvider implements vscode.HoverProvider {
  private astAnalyzer: ASTAnalyzer;
  private fileScanner: FileScanner;
  private statisticsAnalyzer: StatisticsAnalyzer;

  constructor(
    workspaceRoot: string,
    private readonly ts: typeof import("typescript"),
  ) {
    this.astAnalyzer = new ASTAnalyzer(ts);
    this.fileScanner = new FileScanner(workspaceRoot, ts);
    this.statisticsAnalyzer = new StatisticsAnalyzer(workspaceRoot, ts);
  }

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
  ): Promise<vscode.Hover | null> {
    const sourceCode = document.getText();
    const offset = document.offsetAt(position);

    // Use AST to analyze the context
    const contexts = this.astAnalyzer.analyzeHandlerContexts(sourceCode, document.fileName);
    const currentContext = this.astAnalyzer.isWithinHandlerString(offset, contexts);

    if (!currentContext || !currentContext.expectedPath) {
      return null;
    }

    // Parse the handler path
    const handlerPath = currentContext.expectedPath;
    const lastDotIndex = handlerPath.lastIndexOf(".");
    if (lastDotIndex === -1) return null;

    const filePath = handlerPath.substring(0, lastDotIndex);
    const functionName = handlerPath.substring(lastDotIndex + 1);

    // Find the handler file
    const handlers = await this.fileScanner.scanHandlers();
    const handler = handlers.find((h) => h.relativePath === filePath);

    if (!handler) {
      return null;
    }

    try {
      // Get the handler implementation preview
      const functionInfo = await this.getFunctionImplementation(handler.filePath, functionName);
      if (!functionInfo) {
        return null;
      }

      const contextLabel = this.getContextLabel(currentContext.type);
      const markdown = new vscode.MarkdownString();
      markdown.isTrusted = true;

      markdown.appendMarkdown(`**${contextLabel} Handler**\n\n`);
      markdown.appendMarkdown(`📁 \`${handler.relativePath}.ts\`\n\n`);
      markdown.appendCodeblock(functionInfo.signature, "typescript");

      if (functionInfo.documentation) {
        markdown.appendMarkdown(`\n**Documentation:**\n${functionInfo.documentation}`);
      }

      // Add usage statistics
      try {
        const usage = await this.statisticsAnalyzer.getHandlerUsage(currentContext.expectedPath);
        if (usage) {
          markdown.appendMarkdown(`\n---\n**📊 Usage Statistics**\n\n`);
          markdown.appendMarkdown(
            `🔢 **Used ${usage.usageCount} time${usage.usageCount === 1 ? "" : "s"}**\n\n`,
          );

          if (usage.locations.length > 0) {
            markdown.appendMarkdown(`📍 **Locations:**\n`);
            const maxLocations = 5; // Limit to avoid too much content
            for (const [index, location] of usage.locations.slice(0, maxLocations).entries()) {
              markdown.appendMarkdown(
                `${index + 1}. \`${location.filePath}:${location.line}\` - ${location.contextInfo}\n`,
              );
            }
            if (usage.locations.length > maxLocations) {
              markdown.appendMarkdown(
                `   *...and ${usage.locations.length - maxLocations} more*\n`,
              );
            }
          }
        } else {
          markdown.appendMarkdown(`\n---\n📊 **Not used in project** (or analysis failed)\n`);
        }
      } catch (error) {
        // Don't fail hover if statistics fail
        console.warn("Failed to get usage statistics:", error);
      }

      return new vscode.Hover(markdown);
    } catch (error) {
      console.error("Error providing hover:", error);
      return null;
    }
  }

  private async getFunctionImplementation(
    filePath: string,
    functionName: string,
  ): Promise<{ signature: string; documentation?: string } | null> {
    try {
      const document = await vscode.workspace.openTextDocument(filePath);
      const sourceCode = document.getText();

      // Use TypeScript AST to find the function
      const sourceFile = this.ts.createSourceFile(
        "temp.ts",
        sourceCode,
        this.ts.ScriptTarget.Latest,
        true,
      );

      let functionInfo: { signature: string; documentation?: string } | null = null;

      const visit = (node: ts.Node) => {
        // Check for export const functionName = ...
        if (this.ts.isVariableStatement(node) && this.hasExportModifier(node)) {
          for (const declaration of node.declarationList.declarations) {
            if (this.ts.isIdentifier(declaration.name) && declaration.name.text === functionName) {
              const nodeText = node.getFullText();
              const lines = nodeText.split("\n").slice(0, 10); // First 10 lines
              functionInfo = {
                signature: lines.join("\n").trim() + (lines.length === 10 ? "\n// ..." : ""),
                documentation: this.extractJSDocComment(node),
              };
              return;
            }
          }
        }

        // Check for export function functionName() { ... }
        if (this.ts.isFunctionDeclaration(node) && this.hasExportModifier(node)) {
          if (node.name && this.ts.isIdentifier(node.name) && node.name.text === functionName) {
            const nodeText = node.getFullText();
            const lines = nodeText.split("\n").slice(0, 10); // First 10 lines for functions
            functionInfo = {
              signature: lines.join("\n").trim() + (lines.length === 10 ? "\n// ..." : ""),
              documentation: this.extractJSDocComment(node),
            };
            return;
          }
        }

        // Check for export default
        if (this.ts.isExportAssignment(node) && functionName === "default") {
          const nodeText = node.getFullText();
          const lines = nodeText.split("\n").slice(0, 5);
          functionInfo = {
            signature: lines.join("\n").trim() + (lines.length === 5 ? "\n// ..." : ""),
            documentation: this.extractJSDocComment(node),
          };
          return;
        }

        if (!functionInfo) {
          this.ts.forEachChild(node, visit);
        }
      };

      visit(sourceFile);
      return functionInfo;
    } catch (error) {
      console.error("Error getting function implementation:", error);
      return null;
    }
  }

  private extractJSDocComment(node: ts.Node): string | undefined {
    const sourceFile = node.getSourceFile();
    const fullText = sourceFile.getFullText();
    const nodeStart = node.getFullStart();

    // Look for JSDoc comment before the node
    const commentRanges = this.ts.getLeadingCommentRanges(fullText, nodeStart);
    if (commentRanges) {
      for (const range of commentRanges) {
        const commentText = fullText.substring(range.pos, range.end);
        if (commentText.startsWith("/**")) {
          // Clean up JSDoc comment
          return commentText
            .replace(/\/\*\*|\*\//g, "")
            .split("\n")
            .map((line) => line.replace(/^\s*\*\s?/, "").trim())
            .filter((line) => line.length > 0)
            .join("\n");
        }
      }
    }

    return undefined;
  }

  private hasExportModifier(node: ts.Node): boolean {
    return (
      (this.ts.canHaveModifiers(node) &&
        this.ts.getModifiers(node)?.some((mod) => mod.kind === this.ts.SyntaxKind.ExportKeyword)) ||
      false
    );
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
      default:
        return "Handler";
    }
  }
}
