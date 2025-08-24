import { ASTAnalyzer, SSTValidator, type ValidationError } from "@cute-me-on-repos/sst-analyzer";
import * as vscode from "vscode";

export class SSTDiagnosticProvider {
  private sstValidator: SSTValidator;
  private diagnosticCollection: vscode.DiagnosticCollection;

  constructor(
    workspaceRoot: string,
    private readonly ts: typeof import("typescript"),
  ) {
    this.sstValidator = new SSTValidator(workspaceRoot, this.ts);
    this.diagnosticCollection =
      vscode.languages.createDiagnosticCollection("sst-handler-validation");
  }

  public async validateDocument(document: vscode.TextDocument): Promise<void> {
    if (document.languageId !== "typescript") {
      return;
    }

    try {
      // Use the core validator to get validation errors
      const fileScanner = (this.sstValidator as any).fileScanner;
      const availableHandlers = await fileScanner.scanHandlers();
      const validationErrors = await this.sstValidator.validateFile(
        document.fileName,
        availableHandlers,
      );

      // Convert validation errors to VS Code diagnostics
      const diagnostics: vscode.Diagnostic[] = [];
      for (const error of validationErrors) {
        const diagnostic = this.convertValidationErrorToDiagnostic(document, error);
        if (diagnostic) {
          diagnostics.push(diagnostic);
        }
      }

      this.diagnosticCollection.set(document.uri, diagnostics);
    } catch (error) {
      console.error("Error validating document:", error);
      this.diagnosticCollection.set(document.uri, []);
    }
  }

  private convertValidationErrorToDiagnostic(
    document: vscode.TextDocument,
    error: ValidationError,
  ): vscode.Diagnostic | null {
    try {
      // Find the handler string in the document
      const sourceCode = document.getText();
      const astAnalyzer = new ASTAnalyzer(this.ts);
      const contexts = astAnalyzer.analyzeHandlerContexts(sourceCode, document.fileName);

      // Find the context that matches this error
      const matchingContext = contexts.find((ctx) => ctx.expectedPath === error.handlerPath);
      if (!matchingContext) {
        return null;
      }

      const range = this.getStringRange(document, matchingContext.node);
      let severity = vscode.DiagnosticSeverity.Error;

      if (error.type === "function-not-found" || error.type === "file-not-found") {
        severity = vscode.DiagnosticSeverity.Error;
      } else if (error.type === "invalid-format") {
        severity = vscode.DiagnosticSeverity.Warning;
      }

      const diagnostic = new vscode.Diagnostic(range, error.message, severity);

      if (error.suggestions && error.suggestions.length > 0) {
        diagnostic.message += ` Did you mean: ${error.suggestions.slice(0, 3).join(", ")}?`;
      }

      return diagnostic;
    } catch (err) {
      console.error("Error converting validation error to diagnostic:", err);
      return null;
    }
  }

  private getStringRange(document: vscode.TextDocument, node: any): vscode.Range {
    try {
      const start = node.getStart();
      const end = node.getEnd();
      const startPos = document.positionAt(start);
      const endPos = document.positionAt(end);
      return new vscode.Range(startPos, endPos);
    } catch (error) {
      console.error("Error getting string range:", error);
      return new vscode.Range(0, 0, 0, 0);
    }
  }

  public async refreshValidation(): Promise<void> {
    // Re-validate all open TypeScript documents
    for (const document of vscode.workspace.textDocuments) {
      if (document.languageId === "typescript") {
        await this.validateDocument(document);
      }
    }
  }

  public dispose(): void {
    this.diagnosticCollection.dispose();
  }
}
