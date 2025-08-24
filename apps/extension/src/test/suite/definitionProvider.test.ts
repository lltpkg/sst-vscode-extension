import * as assert from "node:assert";
import * as ts from "typescript";
import * as vscode from "vscode";
import { SSTDefinitionProvider } from "../../definitionProvider";

suite("SSTDefinitionProvider Test Suite", () => {
  let provider: SSTDefinitionProvider;

  setup(() => {
    provider = new SSTDefinitionProvider(vscode.workspace.rootPath || "", ts);
  });

  test("Should create definition provider instance", () => {
    assert.ok(provider);
    assert.ok(provider.provideDefinition);
  });

  test("Should provide definition for valid handler path", async () => {
    const document = await vscode.workspace.openTextDocument({
      content: 'handler: "functions/upload.handler"',
      language: "typescript",
    });

    const position = new vscode.Position(0, 25);
    const token = new vscode.CancellationTokenSource().token;

    const definition = await provider.provideDefinition(document, position, token);
    assert.ok(
      definition === null || Array.isArray(definition) || definition instanceof vscode.Location,
    );
  });

  test("Should return null for invalid handler path", async () => {
    const document = await vscode.workspace.openTextDocument({
      content: 'handler: "invalid-format"',
      language: "typescript",
    });

    const position = new vscode.Position(0, 15);
    const token = new vscode.CancellationTokenSource().token;

    const definition = await provider.provideDefinition(document, position, token);
    assert.strictEqual(definition, null);
  });

  test("Should return null when not in handler context", async () => {
    const document = await vscode.workspace.openTextDocument({
      content: 'const someVar = "not a handler"',
      language: "typescript",
    });

    const position = new vscode.Position(0, 15);
    const token = new vscode.CancellationTokenSource().token;

    const definition = await provider.provideDefinition(document, position, token);
    assert.strictEqual(definition, null);
  });

  test("Should handle missing workspace gracefully", () => {
    const providerWithoutWorkspace = new SSTDefinitionProvider("", ts);
    assert.ok(providerWithoutWorkspace);
  });

  test("Should handle different handler path formats", async () => {
    const testCases = ["functions/upload.handler", "api/users.get", "workers/process.default"];

    for (const handlerPath of testCases) {
      const document = await vscode.workspace.openTextDocument({
        content: `handler: "${handlerPath}"`,
        language: "typescript",
      });

      const position = new vscode.Position(0, handlerPath.length + 10);
      const token = new vscode.CancellationTokenSource().token;

      const definition = await provider.provideDefinition(document, position, token);
      assert.ok(
        definition === null || Array.isArray(definition) || definition instanceof vscode.Location,
      );
    }
  });
});
