import * as fs from "node:fs";
import * as path from "node:path";
import type * as ts from "typescript";
import type { HandlerInfo, SSTProjectConfig } from "../types";

type TSConfig = {
  include?: string[];
  exclude?: string[];
  compilerOptions?: any;
};

export class FileScanner {
  protected tsConfig: TSConfig | null = null;

  constructor(
    protected workspaceRoot: string = "",
    protected readonly ts: typeof import("typescript"),
  ) {}

  public async findProjectConfig(): Promise<SSTProjectConfig | null> {
    const workspaceRoot = await this.findworkspaceRoot();
    if (!workspaceRoot) return null;

    await this.loadTSConfig();

    const sstConfigPath = path.join(workspaceRoot, "sst.config.ts");
    const tsConfigPath = path.join(workspaceRoot, "tsconfig.json");

    return {
      rootPath: workspaceRoot,
      sstConfigPath: fs.existsSync(sstConfigPath) ? sstConfigPath : undefined,
      tsConfigPath: fs.existsSync(tsConfigPath) ? tsConfigPath : undefined,
      includePatterns: this.tsConfig?.include || ["**/*.ts"],
      excludePatterns: this.tsConfig?.exclude || ["node_modules/**", "dist/**", "**/*.test.ts"],
    };
  }

  protected async findworkspaceRoot(): Promise<string | null> {
    // should revalidate the workspace root
    const findSstConfig = async (dir: string): Promise<string | null> => {
      const configPath = path.join(dir, "sst.config.ts");
      if (fs.existsSync(configPath)) {
        return dir;
      }

      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
          const subPath = path.join(dir, entry.name);
          const result = await findSstConfig(subPath);
          if (result) return result;
        }
      }

      return null;
    };

    // First try searching from workspace root and its subdirectories
    this.workspaceRoot = (await findSstConfig(this.workspaceRoot)) || "";

    // If not found, try searching parent directories
    if (!this.workspaceRoot) {
      let currentDir = this.workspaceRoot;
      while (currentDir !== path.dirname(currentDir)) {
        currentDir = path.dirname(currentDir);
        const configPath = path.join(currentDir, "sst.config.ts");
        if (fs.existsSync(configPath)) {
          this.workspaceRoot = currentDir;
          break;
        }
      }
    }

    if (this.workspaceRoot) {
      await this.loadTSConfig();
    }
    return this.workspaceRoot;
  }

  protected async loadTSConfig(): Promise<void> {
    if (!this.workspaceRoot) return;

    const findTsConfig = async (dir: string): Promise<string | null> => {
      try {
        const tsConfigPath = path.join(dir, "tsconfig.json");
        if (fs.existsSync(tsConfigPath)) {
          return tsConfigPath;
        }

        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
            const subPath = path.join(dir, entry.name);
            const result = await findTsConfig(subPath);
            if (result) return result;
          }
        }
      } catch (error) {
        console.error(`Error searching for tsconfig.json in ${dir}:`, error);
      }
      return null;
    };

    try {
      const tsConfigPath = await findTsConfig(this.workspaceRoot);
      if (tsConfigPath) {
        const tsConfigContent = await fs.promises.readFile(tsConfigPath, "utf-8");
        this.tsConfig = JSON.parse(tsConfigContent);
      }
    } catch (error) {
      console.error("Error loading tsconfig.json:", error);
      this.tsConfig = null;
    }

    if (!this.tsConfig) {
      console.log("No tsconfig.json found");
    }
  }

  public async scanHandlers(): Promise<HandlerInfo[]> {
    const workspaceRoot = await this.findworkspaceRoot();
    if (!workspaceRoot) {
      return [];
    }

    const handlers: HandlerInfo[] = [];
    await this.scanDirectory(workspaceRoot, handlers);
    return handlers;
  }

  protected async scanDirectory(dir: string, handlers: HandlerInfo[]): Promise<void> {
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
            await this.scanDirectory(fullPath, handlers);
          }
        } else if (entry.isFile() && entry.name.endsWith(".ts")) {
          // Skip TypeScript declaration files (.d.ts)
          if (entry.name.endsWith(".d.ts")) {
            continue;
          }

          if (this.shouldIncludeFile(fullPath)) {
            const relativePath = this.getRelativePath(fullPath);
            const exportedFunctions = await this.parseExportedFunctions(fullPath);

            // Only include files that have at least one exported function
            if (exportedFunctions.length > 0) {
              handlers.push({
                filePath: fullPath,
                relativePath,
                exportedFunctions,
              });
            }
          }
        }
      }
    } catch (error) {
      // throw error;
    }
  }

  protected shouldIncludeFile(filePath: string): boolean {
    if (!this.workspaceRoot) return false;

    const relativePath = path.relative(this.workspaceRoot, filePath).replace(/\\/g, "/");

    // check is declaration file
    if (relativePath.endsWith(".d.ts")) {
      return false;
    }

    // check if not a ts file
    if (!relativePath.endsWith(".ts")) {
      return false;
    }

    // Check exclude patterns first
    if (this.tsConfig?.exclude) {
      for (const excludePattern of this.tsConfig.exclude) {
        if (this.matchesPattern(relativePath, excludePattern)) {
          return false;
        }
      }
    }

    // Check include patterns
    if (this.tsConfig?.include) {
      for (const includePattern of this.tsConfig.include) {
        if (this.matchesPattern(relativePath, includePattern)) {
          return true;
        }
      }
      return false; // If include patterns exist but none match, exclude the file
    }

    return true; // Include by default if no include patterns specified
  }

  protected matchesPattern(filePath: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const normalizedPattern = pattern.replace(/\\/g, "/");
    const parts = normalizedPattern.split("/");
    const fileParts = filePath.split("/");

    return this.matchParts(fileParts, parts, 0, 0);
  }

  protected matchParts(
    fileParts: string[],
    patternParts: string[],
    fileIndex: number,
    patternIndex: number,
  ): boolean {
    // Base cases
    if (patternIndex === patternParts.length) {
      return fileIndex === fileParts.length;
    }

    if (fileIndex === fileParts.length) {
      // Check if remaining pattern parts are all **
      for (let i = patternIndex; i < patternParts.length; i++) {
        if (patternParts[i] !== "**") {
          return false;
        }
      }
      return true;
    }

    const currentPattern = patternParts[patternIndex];

    if (currentPattern === "**") {
      // ** can match zero or more directories
      // Try matching with current position (consuming **)
      if (this.matchParts(fileParts, patternParts, fileIndex, patternIndex + 1)) {
        return true;
      }
      // Try advancing file position and keeping **
      return this.matchParts(fileParts, patternParts, fileIndex + 1, patternIndex);
    } else {
      // Regular pattern matching
      if (this.matchSinglePart(fileParts[fileIndex], currentPattern)) {
        return this.matchParts(fileParts, patternParts, fileIndex + 1, patternIndex + 1);
      }
      return false;
    }
  }

  protected matchSinglePart(filePart: string, pattern: string): boolean {
    if (pattern === "*") {
      return true;
    }

    if (pattern.includes("*")) {
      // Handle patterns like *.ts
      const regex = new RegExp(pattern.replace(/\*/g, ".*"));
      return regex.test(filePart);
    }

    return filePart === pattern;
  }

  public getRelativePath(filePath: string): string {
    if (!this.workspaceRoot) return filePath;

    const relativePath = path.relative(this.workspaceRoot, filePath);
    const withoutExtension = relativePath.replace(/\.ts$/, "");
    return withoutExtension.replace(/\\/g, "/");
  }

  protected async parseExportedFunctions(filePath: string): Promise<string[]> {
    try {
      const sourceCode = await fs.promises.readFile(filePath, "utf-8");
      const sourceFile = this.ts.createSourceFile(
        filePath,
        sourceCode,
        this.ts.ScriptTarget.Latest,
        true,
      );

      const exports: string[] = [];

      const visit = (node: ts.Node) => {
        if (this.ts.isExportAssignment(node)) {
          if (this.ts.isIdentifier(node.expression)) {
            exports.push("default");
          }
        }

        if (this.ts.isVariableStatement(node)) {
          const hasExportModifier = node.modifiers?.some(
            (modifier) => modifier.kind === this.ts.SyntaxKind.ExportKeyword,
          );

          if (hasExportModifier) {
            node.declarationList.declarations.forEach((declaration) => {
              if (this.ts.isIdentifier(declaration.name) && declaration.initializer) {
                // Only include if it's a function (arrow function or function expression)
                if (this.isFunction(declaration.initializer)) {
                  exports.push(declaration.name.text);
                }
              }
            });
          }
        }

        if (this.ts.isFunctionDeclaration(node)) {
          const hasExportModifier = node.modifiers?.some(
            (modifier) => modifier.kind === this.ts.SyntaxKind.ExportKeyword,
          );
          const hasDefaultModifier = node.modifiers?.some(
            (modifier) => modifier.kind === this.ts.SyntaxKind.DefaultKeyword,
          );

          if (hasExportModifier) {
            if (hasDefaultModifier) {
              exports.push("default");
            } else if (node.name) {
              exports.push(node.name.text);
            }
          }
        }

        this.ts.forEachChild(node, visit);
      };

      visit(sourceFile);
      return [...new Set(exports)];
    } catch (error) {
      console.error(`Error parsing TypeScript file ${filePath}:`, error);
      return [];
    }
  }

  protected isFunction(node: ts.Expression): boolean {
    // Check for arrow functions: () => {}, async () => {}, etc.
    if (this.ts.isArrowFunction(node)) {
      return true;
    }

    // Check for function expressions: function() {}, async function() {}
    if (this.ts.isFunctionExpression(node)) {
      return true;
    }

    // Check for method definitions or other function-like expressions
    if (
      this.ts.isMethodDeclaration(node) ||
      this.ts.isGetAccessorDeclaration(node) ||
      this.ts.isSetAccessorDeclaration(node)
    ) {
      return true;
    }

    // Check for call expressions - but be more selective
    if (this.ts.isCallExpression(node)) {
      return this.isValidFunctionCall(node);
    }

    // Check for await expressions (like await createHandler())
    if (this.ts.isAwaitExpression(node) && this.ts.isCallExpression(node.expression)) {
      return this.isValidFunctionCall(node.expression);
    }

    // Explicitly reject new expressions (these create objects, not functions)
    if (this.ts.isNewExpression(node)) {
      return false;
    }

    // Reject conditional expressions (ternary operators) as they're usually not functions
    if (this.ts.isConditionalExpression(node)) {
      return false;
    }

    // Be conservative: reject other expressions that are likely not functions
    return false;
  }

  protected isValidFunctionCall(callExpression: ts.CallExpression): boolean {
    // Allow calls that are likely to return functions (common handler patterns)
    if (this.ts.isIdentifier(callExpression.expression)) {
      const functionName = callExpression.expression.text;
      // Common function patterns that return handlers
      if (
        [
          "handle",
          "middleware",
          "withMiddleware",
          "createHandler",
          "wrap",
          "createAWSHandler",
        ].includes(functionName)
      ) {
        return true;
      }
    }

    // Check for property access calls like module.someFunction()
    if (this.ts.isPropertyAccessExpression(callExpression.expression)) {
      const propertyName = callExpression.expression.name.text;
      // Specific known handler creation patterns
      if (["handle", "handler", "create", "build", "configure"].includes(propertyName)) {
        return true;
      }
    }

    // Don't allow SST/AWS resource creation calls (these return instances, not functions)
    if (this.ts.isPropertyAccessExpression(callExpression.expression)) {
      const expressionText = callExpression.expression.getText();
      if (expressionText.includes("sst.aws.") || expressionText.includes(".get(")) {
        return false;
      }
    }

    // For other call expressions, be conservative and reject them
    return false;
  }
}
