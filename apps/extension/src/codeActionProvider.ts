import * as vscode from "vscode";

export class SSTCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  public provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    _token: vscode.CancellationToken,
  ): vscode.CodeAction[] | undefined {
    const codeActions: vscode.CodeAction[] = [];

    // Look for our diagnostic messages and provide quick fixes
    for (const diagnostic of context.diagnostics) {
      if (diagnostic.source === "SST Handler Validation") {
        if (diagnostic.code === "handler-file-not-found") {
          codeActions.push(...this.createFileNotFoundFixes(document, range, diagnostic));
        } else if (diagnostic.code === "handler-function-not-found") {
          codeActions.push(...this.createFunctionNotFoundFixes(document, range, diagnostic));
        } else if (diagnostic.code === "invalid-handler-format") {
          codeActions.push(...this.createFormatFixes(document, range, diagnostic));
        }
      }
    }

    return codeActions;
  }

  private createFileNotFoundFixes(
    document: vscode.TextDocument,
    range: vscode.Range,
    diagnostic: vscode.Diagnostic,
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    // Extract suggestions from diagnostic message
    const suggestionMatch = diagnostic.message.match(/Did you mean: ([^?]+)\?/);
    if (suggestionMatch) {
      const suggestions = suggestionMatch[1].split(", ");

      for (const suggestion of suggestions.slice(0, 3)) {
        // Limit to 3 suggestions
        const currentText = document.getText(range);
        const match = currentText.match(/["'`]([^"'`]+)\.([^"'`]+)["'`]/);

        if (match) {
          const functionName = match[2];
          const newPath = `${suggestion.trim()}.${functionName}`;
          const newText = currentText.replace(match[0], `"${newPath}"`);

          const fix = new vscode.CodeAction(
            `Change to "${newPath}"`,
            vscode.CodeActionKind.QuickFix,
          );
          fix.edit = new vscode.WorkspaceEdit();
          fix.edit.replace(document.uri, range, newText);
          fix.diagnostics = [diagnostic];
          fix.isPreferred = suggestions.indexOf(suggestion.trim()) === 0; // First suggestion is preferred

          actions.push(fix);
        }
      }
    }

    return actions;
  }

  private createFunctionNotFoundFixes(
    document: vscode.TextDocument,
    range: vscode.Range,
    diagnostic: vscode.Diagnostic,
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    // Extract available functions from diagnostic message
    const functionsMatch = diagnostic.message.match(/Available functions: ([^"]+)/);
    if (functionsMatch) {
      const availableFunctions = functionsMatch[1].split(", ");

      for (const functionName of availableFunctions.slice(0, 5)) {
        // Limit to 5 suggestions
        const currentText = document.getText(range);
        const match = currentText.match(/["'`]([^"'`]+)\.([^"'`]+)["'`]/);

        if (match) {
          const filePath = match[1];
          const newPath = `${filePath}.${functionName.trim()}`;
          const newText = currentText.replace(match[0], `"${newPath}"`);

          const fix = new vscode.CodeAction(
            `Change to "${newPath}"`,
            vscode.CodeActionKind.QuickFix,
          );
          fix.edit = new vscode.WorkspaceEdit();
          fix.edit.replace(document.uri, range, newText);
          fix.diagnostics = [diagnostic];
          fix.isPreferred = functionName.trim() === "handler"; // "handler" is usually preferred

          actions.push(fix);
        }
      }
    }

    return actions;
  }

  private createFormatFixes(
    document: vscode.TextDocument,
    range: vscode.Range,
    diagnostic: vscode.Diagnostic,
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];
    const currentText = document.getText(range);

    // Try to suggest a proper format
    const match = currentText.match(/["'`]([^"'`]+)["'`]/);
    if (match) {
      const invalidPath = match[1];

      // Common fixes for invalid formats
      const fixes = [
        `"functions/${invalidPath}.handler"`,
        `"${invalidPath}.handler"`,
        `"functions/${invalidPath.replace(/[^a-zA-Z0-9_/-]/g, "")}.handler"`,
      ];

      fixes.forEach((fixedPath, index) => {
        const newText = currentText.replace(match[0], fixedPath);

        const fix = new vscode.CodeAction(`Change to ${fixedPath}`, vscode.CodeActionKind.QuickFix);
        fix.edit = new vscode.WorkspaceEdit();
        fix.edit.replace(document.uri, range, newText);
        fix.diagnostics = [diagnostic];
        fix.isPreferred = index === 0; // First suggestion is preferred

        actions.push(fix);
      });
    }

    return actions;
  }
}
