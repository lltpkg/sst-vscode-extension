import { ASTAnalyzer, FileScanner } from "@cute-me-on-repos/sst-analyzer";
import type * as tsNP from "typescript";
import * as vscode from "vscode";

export class SSTDefinitionProvider implements vscode.DefinitionProvider {
  private astAnalyzer: ASTAnalyzer;
  private fileScanner: FileScanner;

  constructor(
    private readonly workspaceRoot: string,
    private readonly ts: typeof import("typescript"),
  ) {
    this.astAnalyzer = new ASTAnalyzer(this.ts);
    this.fileScanner = new FileScanner(this.workspaceRoot, this.ts);
  }

  public async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
  ): Promise<vscode.Definition | vscode.LocationLink[] | null> {
    const sourceCode = document.getText();
    const offset = document.offsetAt(position);

    // Use AST to analyze the context
    const contexts = this.astAnalyzer.analyzeHandlerContexts(sourceCode, document.fileName);
    const currentContext = this.astAnalyzer.isWithinHandlerString(offset, contexts);

    if (!currentContext || !currentContext.expectedPath) {
      return null;
    }

    const handlerPath = currentContext.expectedPath;
    const location = await this.resolveHandlerLocation(handlerPath);

    if (!location) {
      return null;
    }

    return location;
  }

  private async resolveHandlerLocation(handlerPath: string): Promise<vscode.Location | null> {
    // Parse handler path (e.g., "functions/upload.handler")
    const parts = handlerPath.split(".");
    if (parts.length < 2) {
      return null;
    }

    const filePath = parts[0]; // "functions/upload"
    const functionName = parts[1]; // "handler"

    // Find the SST root and resolve file path
    const handlers = await this.fileScanner.scanHandlers();
    const handler = handlers.find((h) => h.relativePath === filePath);

    if (!handler) {
      return null;
    }

    // Check if the function exists in the file
    if (!handler.exportedFunctions.includes(functionName)) {
      return null;
    }

    const uri = vscode.Uri.file(handler.filePath);

    // Try to find the exact position of the function definition
    const functionPosition = await this.findFunctionPosition(handler.filePath, functionName);

    return new vscode.Location(uri, functionPosition || new vscode.Position(0, 0));
  }

  private async findFunctionPosition(
    filePath: string,
    functionName: string,
  ): Promise<vscode.Position | null> {
    try {
      const document = await vscode.workspace.openTextDocument(filePath);
      const sourceCode = document.getText();

      // Use TypeScript AST to find the function definition
      const position = this.findExportPosition(sourceCode, functionName);

      if (position !== null) {
        return document.positionAt(position);
      }

      return null;
    } catch (error) {
      console.error("Error finding function position:", error);
      return null;
    }
  }

  private findExportPosition(sourceCode: string, functionName: string): number | null {
    // Use TypeScript AST to find the exact position of the function definition
    const sourceFile = this.ts.createSourceFile(
      "temp.ts",
      sourceCode,
      this.ts.ScriptTarget.Latest,
      true,
    );

    let foundPosition: number | null = null;

    const visit = (node: tsNP.Node) => {
      // Check for export const functionName = ...
      if (this.ts.isVariableStatement(node) && this.hasExportModifier(node)) {
        for (const declaration of node.declarationList.declarations) {
          if (this.ts.isIdentifier(declaration.name) && declaration.name.text === functionName) {
            foundPosition = node.getStart();
            return;
          }
        }
      }

      // Check for export function functionName() { ... }
      if (this.ts.isFunctionDeclaration(node) && this.hasExportModifier(node)) {
        if (node.name && this.ts.isIdentifier(node.name) && node.name.text === functionName) {
          foundPosition = node.getStart();
          return;
        }
      }

      // Check for export default function
      if (this.ts.isExportAssignment(node) && functionName === "default") {
        foundPosition = node.getStart();
        return;
      }

      // Check for export default (arrow function, function expression, etc.)
      if (this.ts.isVariableStatement(node) && this.hasExportModifier(node)) {
        for (const declaration of node.declarationList.declarations) {
          if (this.ts.isIdentifier(declaration.name) && declaration.name.text === "default") {
            if (functionName === "default") {
              foundPosition = node.getStart();
              return;
            }
          }
        }
      }

      // Check for export { functionName }
      if (
        this.ts.isExportDeclaration(node) &&
        node.exportClause &&
        this.ts.isNamedExports(node.exportClause)
      ) {
        for (const element of node.exportClause.elements) {
          if (this.ts.isIdentifier(element.name) && element.name.text === functionName) {
            foundPosition = element.getStart();
            return;
          }
        }
      }

      if (!foundPosition) {
        this.ts.forEachChild(node, visit);
      }
    };

    visit(sourceFile);
    return foundPosition;
  }

  private hasExportModifier(node: tsNP.Node): boolean {
    return (
      (this.ts.canHaveModifiers(node) &&
        this.ts.getModifiers(node)?.some((mod) => mod.kind === this.ts.SyntaxKind.ExportKeyword)) ||
      false
    );
  }
}
