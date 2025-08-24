import * as assert from "node:assert";
import * as ts from "typescript";
import * as vscode from "vscode";
import { SSTCompletionProvider } from "../../completionProvider";

suite("SSTCompletionProvider Test Suite", () => {
  let provider: SSTCompletionProvider;

  setup(() => {
    provider = new SSTCompletionProvider(vscode.workspace.rootPath || "", ts);
  });

  test("Should create completion provider instance", () => {
    assert.ok(provider);
    assert.ok(provider.refreshHandlers);
    assert.ok(provider.provideCompletionItems);
  });

  test("Should provide completion items for handler context", async () => {
    const document = await vscode.workspace.openTextDocument({
      content: 'handler: "functions/"',
      language: "typescript",
    });

    const position = new vscode.Position(0, 20);
    const token = new vscode.CancellationTokenSource().token;
    const context = {
      triggerKind: vscode.CompletionTriggerKind.Invoke,
      triggerCharacter: undefined,
    };

    const items = await provider.provideCompletionItems(document, position, token, context);
    assert.ok(Array.isArray(items));
  });

  test("Should return empty array when not in handler context", async () => {
    const document = await vscode.workspace.openTextDocument({
      content: 'const someVar = "not a handler"',
      language: "typescript",
    });

    const position = new vscode.Position(0, 15);
    const token = new vscode.CancellationTokenSource().token;
    const context = {
      triggerKind: vscode.CompletionTriggerKind.Invoke,
      triggerCharacter: undefined,
    };

    const items = await provider.provideCompletionItems(document, position, token, context);
    assert.strictEqual(items.length, 0);
  });

  test("Should handle refresh handlers without error", async () => {
    await provider.refreshHandlers();
  });

  test("Should provide function completions after dot", async () => {
    const document = await vscode.workspace.openTextDocument({
      content: 'handler: "functions/upload."',
      language: "typescript",
    });

    const position = new vscode.Position(0, 27);
    const token = new vscode.CancellationTokenSource().token;
    const context = {
      triggerKind: vscode.CompletionTriggerKind.TriggerCharacter,
      triggerCharacter: ".",
    };

    const items = await provider.provideCompletionItems(document, position, token, context);
    assert.ok(Array.isArray(items));
  });

  test("Should handle different quote types", async () => {
    const testCases = [
      'handler: "functions/upload"',
      "handler: 'functions/upload'",
      "handler: `functions/upload`",
    ];

    for (const content of testCases) {
      const document = await vscode.workspace.openTextDocument({
        content,
        language: "typescript",
      });

      const position = new vscode.Position(0, content.length - 1);
      const token = new vscode.CancellationTokenSource().token;
      const context = {
        triggerKind: vscode.CompletionTriggerKind.Invoke,
        triggerCharacter: undefined,
      };

      const items = await provider.provideCompletionItems(document, position, token, context);
      assert.ok(Array.isArray(items));
    }
  });
});
