import * as assert from "node:assert";
import * as ts from "typescript";
import * as vscode from "vscode";
import { SSTDiagnosticProvider } from "../../diagnosticProvider";

suite("SSTDiagnosticProvider Test Suite", () => {
  let provider: SSTDiagnosticProvider;

  setup(() => {
    provider = new SSTDiagnosticProvider(vscode.workspace.rootPath || "", ts);
  });

  teardown(() => {
    provider.dispose();
  });

  test("Should create diagnostic provider instance", () => {
    assert.ok(provider);
    assert.ok(provider.validateDocument);
    assert.ok(provider.refreshValidation);
    assert.ok(provider.dispose);
  });

  test("Should validate TypeScript documents", async () => {
    const document = await vscode.workspace.openTextDocument({
      content: 'handler: "functions/upload.handler"',
      language: "typescript",
    });

    await provider.validateDocument(document);
  });

  test("Should skip non-TypeScript documents", async () => {
    const document = await vscode.workspace.openTextDocument({
      content: 'handler: "functions/upload.handler"',
      language: "javascript",
    });

    await provider.validateDocument(document);
  });

  test("Should handle validation errors gracefully", async () => {
    const document = await vscode.workspace.openTextDocument({
      content: 'handler: "invalid/path.nonexistent"',
      language: "typescript",
    });

    await provider.validateDocument(document);
  });

  test("Should refresh validation for all documents", async () => {
    await provider.refreshValidation();
  });

  test("Should dispose resources properly", () => {
    provider.dispose();
  });

  test("Should handle empty documents", async () => {
    const document = await vscode.workspace.openTextDocument({
      content: "",
      language: "typescript",
    });

    await provider.validateDocument(document);
  });

  test("Should handle documents with syntax errors", async () => {
    const document = await vscode.workspace.openTextDocument({
      content: 'const invalid = { handler: "functions/upload.handler"',
      language: "typescript",
    });

    await provider.validateDocument(document);
  });

  test("Should validate multiple handler references", async () => {
    const document = await vscode.workspace.openTextDocument({
      content: `
        const lambda1 = new Function("functions/upload.handler")
        const lambda2 = new Function("functions/download.handler")
        const cron = new Cron("rate(5 minutes)", "functions/cleanup.handler")
      `,
      language: "typescript",
    });

    await provider.validateDocument(document);
  });

  test("Should handle workspace changes", async () => {
    const document1 = await vscode.workspace.openTextDocument({
      content: 'handler: "functions/test.handler"',
      language: "typescript",
    });

    const document2 = await vscode.workspace.openTextDocument({
      content: 'handler: "functions/other.handler"',
      language: "typescript",
    });

    await provider.validateDocument(document1);
    await provider.validateDocument(document2);
    await provider.refreshValidation();
  });
});
