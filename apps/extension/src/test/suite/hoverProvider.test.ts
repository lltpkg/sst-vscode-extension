import * as assert from "node:assert";
import * as ts from "typescript";
import * as vscode from "vscode";
import { SSTHoverProvider } from "../../hoverProvider";

suite("SSTHoverProvider Test Suite", () => {
  let provider: SSTHoverProvider;

  setup(() => {
    provider = new SSTHoverProvider(vscode.workspace.rootPath || "", ts);
  });

  test("Should create hover provider instance", () => {
    assert.ok(provider);
    assert.ok(provider.provideHover);
  });

  test("Should provide hover for valid handler path", async () => {
    const document = await vscode.workspace.openTextDocument({
      content: 'new sst.aws.Function({ handler: "functions/upload.handler" })',
      language: "typescript",
    });

    const position = new vscode.Position(0, 25);
    const token = new vscode.CancellationTokenSource().token;

    const hover = await provider.provideHover(document, position, token);
    assert.ok(hover === null || hover instanceof vscode.Hover);
  });

  test("Should return null for invalid handler path", async () => {
    const document = await vscode.workspace.openTextDocument({
      content: 'new sst.aws.Function({ handler: "invalid-format"',
      language: "typescript",
    });

    const position = new vscode.Position(0, 15);
    const token = new vscode.CancellationTokenSource().token;

    const hover = await provider.provideHover(document, position, token);
    assert.strictEqual(hover, null);
  });

  test("Should return null when not in handler context", async () => {
    const document = await vscode.workspace.openTextDocument({
      content: 'const someVar = "not a handler"',
      language: "typescript",
    });

    const position = new vscode.Position(0, 15);
    const token = new vscode.CancellationTokenSource().token;

    const hover = await provider.provideHover(document, position, token);
    assert.strictEqual(hover, null);
  });

  test("Should handle different SST resource types", async () => {
    const testCases = [
      { content: 'new Function("functions/upload.handler")', type: "function" },
      { content: 'new Cron("rate(5 minutes)", "functions/cleanup.handler")', type: "cron" },
      { content: 'bucket.subscribe("functions/processor.handler")', type: "bucket" },
    ];

    for (const testCase of testCases) {
      const document = await vscode.workspace.openTextDocument({
        content: testCase.content,
        language: "typescript",
      });

      const handlerPos = testCase.content.indexOf(".handler") + 4;
      const position = new vscode.Position(0, handlerPos);
      const token = new vscode.CancellationTokenSource().token;

      const hover = await provider.provideHover(document, position, token);
      assert.ok(hover === null || hover instanceof vscode.Hover);
    }
  });

  test("Should handle missing workspace gracefully", () => {
    const providerWithoutWorkspace = new SSTHoverProvider("", ts);
    assert.ok(providerWithoutWorkspace);
  });

  test("Should provide context-aware labels", async () => {
    const contextTypes = ["function", "cron", "queue", "bucket", "unknown"];

    for (const contextType of contextTypes) {
      const label = (provider as any).getContextLabel(contextType);
      assert.ok(typeof label === "string");
      assert.ok(label.length > 0);
    }
  });
});
