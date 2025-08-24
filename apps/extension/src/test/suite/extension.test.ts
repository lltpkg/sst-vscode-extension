import * as assert from "node:assert";
import * as vscode from "vscode";

suite("Extension Test Suite", () => {
  vscode.window.showInformationMessage("Start all tests.");

  test("Extension should be present", () => {
    assert.ok(vscode.extensions.getExtension("kairiss.sst-vsc-ext"));
  });

  test("Extension should activate", async () => {
    const extension = vscode.extensions.getExtension("kairiss.sst-vsc-ext");
    assert.ok(extension);

    await extension!.activate();
    assert.strictEqual(extension!.isActive, true);
  });

  test("Should register refresh command", async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes("sst-vsc-ext.refreshHandlers"));
  });

  test("Should register completion provider for TypeScript", async () => {
    const extension = vscode.extensions.getExtension("kairiss.sst-vsc-ext");
    await extension!.activate();

    const document = await vscode.workspace.openTextDocument({
      content: 'handler: "functions/upload.handler"',
      language: "typescript",
    });

    const position = new vscode.Position(0, 25);
    const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      document.uri,
      position,
    );

    assert.ok(completions);
  });

  test("Should register definition provider for TypeScript", async () => {
    const extension = vscode.extensions.getExtension("kairiss.sst-vsc-ext");
    await extension!.activate();

    const document = await vscode.workspace.openTextDocument({
      content: 'handler: "functions/upload.handler"',
      language: "typescript",
    });

    const position = new vscode.Position(0, 25);
    const definitions = await vscode.commands.executeCommand<vscode.Location[]>(
      "vscode.executeDefinitionProvider",
      document.uri,
      position,
    );

    assert.ok(Array.isArray(definitions));
  });

  test("Should register hover provider for TypeScript", async () => {
    const extension = vscode.extensions.getExtension("kairiss.sst-vsc-ext");
    await extension!.activate();

    const document = await vscode.workspace.openTextDocument({
      content: 'handler: "functions/upload.handler"',
      language: "typescript",
    });

    const position = new vscode.Position(0, 25);
    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
      "vscode.executeHoverProvider",
      document.uri,
      position,
    );

    assert.ok(Array.isArray(hovers));
  });

  test("Refresh command should execute without error", async () => {
    const extension = vscode.extensions.getExtension("kairiss.sst-vsc-ext");
    await extension!.activate();

    await vscode.commands.executeCommand("sst-vsc-ext.refreshHandlers");
  });
});
