import path from "node:path";
import * as vscode from "vscode";
import { SSTCodeActionProvider } from "./codeActionProvider";
import { SSTCompletionProvider } from "./completionProvider";
import { SSTDefinitionProvider } from "./definitionProvider";
import { SSTDiagnosticProvider } from "./diagnosticProvider";
import { SSTHoverProvider } from "./hoverProvider";

type Providers = {
  completion: SSTCompletionProvider;
  definition: SSTDefinitionProvider;
  hover: SSTHoverProvider;
  diagnostic: SSTDiagnosticProvider;
  codeAction: SSTCodeActionProvider;
};

type ExtensionContext = {
  workspaceRoot: string;
  typescript: typeof import("typescript");
  outputChannel: vscode.OutputChannel;
  providers: Providers;
};

let extensionContext: ExtensionContext | null = null;

export async function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel("SST Extension Log");

  try {
    context.subscriptions.push(outputChannel);
    logInfo(outputChannel, "SST VSCode Extension is now activating...", { cwd: process.cwd() });

    const workspaceRoot = await validateWorkspace(outputChannel);
    if (!workspaceRoot) return;

    const typescript = await loadTypeScript(workspaceRoot, outputChannel);
    if (!typescript) return;

    setupProcessEventHandlers(outputChannel);

    const providers = createProviders(workspaceRoot, typescript);
    extensionContext = { workspaceRoot, typescript, outputChannel, providers };

    const registrations = registerLanguageProviders(providers);
    const commands = registerCommands(providers, outputChannel);
    const eventHandlers = setupEventHandlers(providers);

    context.subscriptions.push(
      ...registrations,
      ...commands,
      ...eventHandlers,
      providers.diagnostic,
    );

    await initializeDocumentValidation(providers.diagnostic);
    logInfo(outputChannel, "SST Extension activated successfully");
  } catch (error) {
    logError(outputChannel, "Failed to activate extension", error);
  }
}

async function validateWorkspace(outputChannel: vscode.OutputChannel): Promise<string | null> {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  if (!workspaceRoot) {
    logError(outputChannel, "No SST workspace folder found, exiting");
    return null;
  }

  logInfo(outputChannel, "SST workspace folder found", { path: workspaceRoot });
  return workspaceRoot;
}

async function loadTypeScript(
  workspaceRoot: string,
  outputChannel: vscode.OutputChannel,
): Promise<typeof import("typescript") | null> {
  try {
    const localTypescriptPath = require.resolve("typescript", { paths: [workspaceRoot] });
    logInfo(outputChannel, "Loading TypeScript from workspace", { path: localTypescriptPath });
    return await import(localTypescriptPath);
  } catch (error) {
    logInfo(outputChannel, "Local TypeScript not found, trying VSCode extension");
    return await loadTypeScriptFromVSCode(outputChannel);
  }
}

async function loadTypeScriptFromVSCode(
  outputChannel: vscode.OutputChannel,
): Promise<typeof import("typescript") | null> {
  try {
    const vscodeTsExt = vscode.extensions.all[0];
    const vscodeTsPath = path.resolve(
      vscodeTsExt.extensionPath,
      "..",
      "node_modules/typescript/lib/typescript.js",
    );

    logInfo(outputChannel, "Loading TypeScript from VSCode", { path: vscodeTsPath });
    return await import(vscodeTsPath);
  } catch (error) {
    logError(outputChannel, "Failed to load TypeScript from VSCode extension", error);
    vscode.window.showErrorMessage(
      "No TypeScript found. Please install TypeScript in workspace or refresh the extension",
    );
    return null;
  }
}

function setupProcessEventHandlers(outputChannel: vscode.OutputChannel) {
  const events = [
    "unhandledRejection",
    "warning",
    "exit",
    "beforeExit",
    "rejectionHandled",
    "uncaughtException",
  ] as const;

  events.forEach((event) => {
    process.on(event, (data) => {
      logInfo(outputChannel, `Process ${event}`, { data: String(data) });
    });
  });
}

function createProviders(
  workspaceRoot: string,
  typescript: typeof import("typescript"),
): Providers {
  return {
    completion: new SSTCompletionProvider(workspaceRoot, typescript),
    definition: new SSTDefinitionProvider(workspaceRoot, typescript),
    hover: new SSTHoverProvider(workspaceRoot, typescript),
    diagnostic: new SSTDiagnosticProvider(workspaceRoot, typescript),
    codeAction: new SSTCodeActionProvider(),
  };
}

function registerLanguageProviders(providers: Providers): vscode.Disposable[] {
  const typeScriptSelector = { scheme: "file", language: "typescript" };

  return [
    vscode.languages.registerCompletionItemProvider(
      typeScriptSelector,
      providers.completion,
      '"',
      "'",
      "`",
      ".",
    ),
    vscode.languages.registerDefinitionProvider(typeScriptSelector, providers.definition),
    vscode.languages.registerHoverProvider(typeScriptSelector, providers.hover),
    vscode.languages.registerCodeActionsProvider(typeScriptSelector, providers.codeAction, {
      providedCodeActionKinds: SSTCodeActionProvider.providedCodeActionKinds,
    }),
  ];
}

function registerCommands(
  providers: Providers,
  outputChannel: vscode.OutputChannel,
): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand("sst-vsc-ext.refreshHandlers", async () => {
      try {
        logInfo(outputChannel, "Refresh command triggered");
        await Promise.all([
          providers.completion.refreshHandlers(),
          providers.diagnostic.refreshValidation(),
        ]);
        vscode.window.showInformationMessage("SST handlers refreshed successfully!");
      } catch (error) {
        logError(outputChannel, "Failed to refresh handlers", error);
        vscode.window.showErrorMessage(`Failed to refresh handlers: ${error}`);
      }
    }),
  ];
}

function setupEventHandlers(providers: Providers): vscode.Disposable[] {
  const validateDocument = async (document: vscode.TextDocument) => {
    if (document.languageId === "typescript") {
      await providers.diagnostic.validateDocument(document);
    }
  };

  const refreshHandlers = async () => {
    await Promise.all([
      providers.completion.refreshHandlers(),
      providers.diagnostic.refreshValidation(),
    ]);
  };

  const onDocumentSave = vscode.workspace.onDidSaveTextDocument(async (document) => {
    await validateDocument(document);
    if (document.fileName.endsWith(".ts")) {
      await refreshHandlers();
    }
  });

  const fileWatcher = vscode.workspace.createFileSystemWatcher("**/*.ts");
  fileWatcher.onDidCreate(refreshHandlers);
  fileWatcher.onDidDelete(refreshHandlers);
  fileWatcher.onDidChange(refreshHandlers);

  return [
    vscode.workspace.onDidChangeTextDocument(async (event) => {
      await validateDocument(event.document);
    }),
    vscode.workspace.onDidOpenTextDocument(validateDocument),
    onDocumentSave,
    fileWatcher,
  ];
}

async function initializeDocumentValidation(diagnosticProvider: SSTDiagnosticProvider) {
  const validateDocument = async (document: vscode.TextDocument) => {
    if (document.languageId === "typescript") {
      await diagnosticProvider.validateDocument(document);
    }
  };

  await Promise.all(vscode.workspace.textDocuments.map(validateDocument));
}

function logInfo(
  outputChannel: vscode.OutputChannel,
  message: string,
  data?: Record<string, unknown>,
) {
  const timestamp = new Date().toISOString();
  const logData = data ? ` | ${JSON.stringify(data)}` : "";
  outputChannel.appendLine(`[${timestamp}] INFO: ${message}${logData}`);
}

function logError(outputChannel: vscode.OutputChannel, message: string, error?: unknown) {
  const timestamp = new Date().toISOString();
  const errorDetails = error ? ` | Error: ${String(error)}` : "";
  outputChannel.appendLine(`[${timestamp}] ERROR: ${message}${errorDetails}`);
}

export function deactivate() {}
