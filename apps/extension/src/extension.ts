import path from "node:path";
import * as vscode from "vscode";
import { SSTCodeActionProvider } from "./codeActionProvider";
import { SSTCompletionProvider } from "./completionProvider";
import { SSTDefinitionProvider } from "./definitionProvider";
import { SSTDiagnosticProvider } from "./diagnosticProvider";
import { SSTHoverProvider } from "./hoverProvider";

let completionProvider: SSTCompletionProvider;
let definitionProvider: SSTDefinitionProvider;
let hoverProvider: SSTHoverProvider;
let diagnosticProvider: SSTDiagnosticProvider;

export async function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel("SST Extension Log");
  outputChannel.appendLine("starting.. cwd::" + process.cwd());
  try {
    context.subscriptions.push(outputChannel);
    outputChannel.appendLine("SST VSCode Extension is now activating...");

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    if (!workspaceRoot) {
      outputChannel.appendLine("No SST workspace folder found, exiting...");
      return;
    }
    outputChannel.appendLine(`SST workspace folder found: ${workspaceRoot}`);

    let ts: typeof import("typescript");
    try {
      const localTypescriptPath = require.resolve("typescript", { paths: [workspaceRoot] });
      outputChannel.appendLine(`Loading typescript from ${localTypescriptPath}`);
      ts = await import(localTypescriptPath);
    } catch (error) {
      // trying to get typescript from vscode ts extension
      const vscodeTsExt = vscode.extensions.all[0];

      const vscodeTsPath = path.resolve(
        vscodeTsExt.extensionPath,
        "..",
        "node_modules/typescript/lib/typescript.js",
      );
      outputChannel.appendLine(`Loading typescript from vscode vscodeTsPath: ${vscodeTsPath}`);

      if (vscodeTsPath) {
        try {
          ts = await import(vscodeTsPath);
        } catch (error) {
          outputChannel.appendLine("Error loading typescript from vscode extension: " + error);
          return;
        }
      } else {
        outputChannel.appendLine("Error resolving typescript: " + error);
        vscode.window.showInformationMessage(
          `No typescript found, please install typescript in workspace, or try to refresh the extension`,
        );
        return;
      }
    }

    process.on("unhandledRejection", (error) => {
      outputChannel.appendLine("Unhandled rejection: " + error);
    });
    process.on("warning", (warning) => {
      outputChannel.appendLine("Warning: " + warning);
    });
    process.on("exit", (code) => {
      outputChannel.appendLine("Exit: " + code);
    });
    process.on("beforeExit", (code) => {
      outputChannel.appendLine("Before exit: " + code);
    });
    process.on("rejectionHandled", (promise) => {
      outputChannel.appendLine("Rejection handled: " + promise);
    });
    process.on("uncaughtException", (error) => {
      outputChannel.appendLine("Uncaught exception: " + error);
    });
    process.on("unhandledRejection", (error) => {
      outputChannel.appendLine("Unhandled rejection: " + error);
    });

    completionProvider = new SSTCompletionProvider(workspaceRoot, ts);
    definitionProvider = new SSTDefinitionProvider(workspaceRoot, ts);
    hoverProvider = new SSTHoverProvider(workspaceRoot, ts);
    diagnosticProvider = new SSTDiagnosticProvider(workspaceRoot, ts);

    const completionProviderRegistration = vscode.languages.registerCompletionItemProvider(
      { scheme: "file", language: "typescript" },
      completionProvider,
      '"',
      "'",
      "`",
      ".",
    );

    const definitionProviderRegistration = vscode.languages.registerDefinitionProvider(
      { scheme: "file", language: "typescript" },
      definitionProvider,
    );

    const hoverProviderRegistration = vscode.languages.registerHoverProvider(
      { scheme: "file", language: "typescript" },
      hoverProvider,
    );

    const codeActionProvider = new SSTCodeActionProvider();
    const codeActionProviderRegistration = vscode.languages.registerCodeActionsProvider(
      { scheme: "file", language: "typescript" },
      codeActionProvider,
      {
        providedCodeActionKinds: SSTCodeActionProvider.providedCodeActionKinds,
      },
    );

    const refreshCommand = vscode.commands.registerCommand(
      "sst-vsc-ext.refreshHandlers",
      async () => {
        console.log("Refresh command triggered!");
        try {
          await completionProvider.refreshHandlers();
          await diagnosticProvider.refreshValidation();
          vscode.window.showInformationMessage("SST handlers refreshed successfully!");
        } catch (error) {
          console.error("Error refreshing handlers:", error);
          vscode.window.showErrorMessage(`Failed to refresh handlers: ${error}`);
        }
      },
    );

    outputChannel.appendLine("Commands registered successfully");

    // Set up document validation
    const validateDocument = async (document: vscode.TextDocument) => {
      if (document.languageId === "typescript") {
        await diagnosticProvider.validateDocument(document);
      }
    };

    // Validate all currently open documents
    vscode.workspace.textDocuments.forEach(validateDocument);

    // Set up event listeners for document changes
    const onDocumentChange = vscode.workspace.onDidChangeTextDocument(async (event) => {
      await validateDocument(event.document);
    });

    const onDocumentOpen = vscode.workspace.onDidOpenTextDocument(validateDocument);

    const onDocumentSave = vscode.workspace.onDidSaveTextDocument(async (document) => {
      await validateDocument(document);
      // Also refresh handlers when files are saved to catch new exports
      if (document.fileName.endsWith(".ts")) {
        await completionProvider.refreshHandlers();
        await diagnosticProvider.refreshValidation();
      }
    });

    const fileWatcher = vscode.workspace.createFileSystemWatcher("**/*.ts");

    fileWatcher.onDidCreate(async () => {
      await completionProvider.refreshHandlers();
      await diagnosticProvider.refreshValidation();
    });
    fileWatcher.onDidDelete(async () => {
      await completionProvider.refreshHandlers();
      await diagnosticProvider.refreshValidation();
    });
    fileWatcher.onDidChange(async () => {
      await completionProvider.refreshHandlers();
      await diagnosticProvider.refreshValidation();
    });

    context.subscriptions.push(
      completionProviderRegistration,
      definitionProviderRegistration,
      hoverProviderRegistration,
      codeActionProviderRegistration,
      refreshCommand,
      fileWatcher,
      onDocumentChange,
      onDocumentOpen,
      onDocumentSave,
      diagnosticProvider,
    );
  } catch (error) {
    outputChannel.appendLine(`Error activating extension: ${error}`);
  } finally {
    outputChannel.appendLine("finally");
    outputChannel.appendLine(`SST Extension activated`);
  }
}

export function deactivate() {}
