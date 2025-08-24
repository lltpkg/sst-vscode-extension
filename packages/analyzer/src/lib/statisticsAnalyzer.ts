import type { HandlerLocation, HandlerUsage, SSTHandlerContext, UsageStatistics } from "../types";
import { ASTAnalyzer } from "./astAnalyzer";
import { FileScanner } from "./fileScanner";

export class StatisticsAnalyzer {
  protected astAnalyzer: ASTAnalyzer;
  protected fileScanner: FileScanner;

  constructor(
    workspaceRoot: string,
    protected readonly ts: typeof import("typescript"),
  ) {
    this.astAnalyzer = new ASTAnalyzer(this.ts);
    this.fileScanner = new FileScanner(workspaceRoot, this.ts);
  }

  public async analyzeUsageStatistics(): Promise<UsageStatistics | null> {
    try {
      const config = await this.fileScanner.findProjectConfig();
      if (!config) {
        return null;
      }

      const handlers = await this.fileScanner.scanHandlers();
      const tsFiles = await this.findAllTypeScriptFiles(config);

      const handlerUsages = new Map<string, HandlerUsage>();
      const allHandlerPaths = new Set<string>();

      // Initialize handler paths from scanned handlers
      for (const handler of handlers) {
        for (const func of handler.exportedFunctions) {
          const handlerPath = `${handler.relativePath.replace(/\.ts$/, "")}.${func}`;
          allHandlerPaths.add(handlerPath);
          handlerUsages.set(handlerPath, {
            handlerPath,
            usageCount: 0,
            locations: [],
          });
        }
      }

      // Analyze usage in all TypeScript files
      for (const filePath of tsFiles) {
        try {
          const sourceCode = await this.readFile(filePath);
          const contexts = this.astAnalyzer.analyzeHandlerContexts(sourceCode, filePath);

          for (const context of contexts) {
            if (context.expectedPath) {
              // Enhance context with line/column info
              const enhancedContext = this.enhanceContextWithLocation(
                context,
                sourceCode,
                filePath,
              );

              const usage = handlerUsages.get(context.expectedPath);
              if (usage) {
                usage.usageCount++;
                const location = this.getLocationInfo(sourceCode, enhancedContext, filePath);
                usage.locations.push(location);
              } else {
                // Handler is used but not found in scanned handlers (might be external or missing)
                handlerUsages.set(context.expectedPath, {
                  handlerPath: context.expectedPath,
                  usageCount: 1,
                  locations: [this.getLocationInfo(sourceCode, enhancedContext, filePath)],
                });
              }
            }
          }
        } catch (error) {
          console.warn(`Failed to analyze file ${filePath}:`, error);
        }
      }

      const handlerUsageArray = Array.from(handlerUsages.values());
      const mostUsedHandlers = handlerUsageArray
        .filter((h) => h.usageCount > 0)
        .sort((a, b) => b.usageCount - a.usageCount)
        .slice(0, 10);

      const unusedHandlers = Array.from(allHandlerPaths).filter(
        (path) => handlerUsages.get(path)?.usageCount === 0,
      );

      const totalUsages = handlerUsageArray.reduce((sum, h) => sum + h.usageCount, 0);

      return {
        totalHandlers: allHandlerPaths.size,
        totalUsages,
        handlerUsages: handlerUsageArray,
        mostUsedHandlers,
        unusedHandlers,
      };
    } catch (error) {
      console.error("Error analyzing usage statistics:", error);
      return null;
    }
  }

  public getHandlerUsage(handlerPath: string): Promise<HandlerUsage | null> {
    return this.analyzeUsageStatistics().then((stats) => {
      if (!stats) return null;
      return stats.handlerUsages.find((h) => h.handlerPath === handlerPath) || null;
    });
  }

  protected enhanceContextWithLocation(
    context: SSTHandlerContext,
    sourceCode: string,
    filePath: string,
  ): SSTHandlerContext {
    const sourceFile = this.ts.createSourceFile(
      filePath,
      sourceCode,
      this.ts.ScriptTarget.Latest,
      true,
    );
    const position = sourceFile.getLineAndCharacterOfPosition(context.position);

    return {
      ...context,
      line: position.line + 1,
      column: position.character + 1,
      contextInfo: this.getContextDescription(context, sourceCode),
    };
  }

  protected getLocationInfo(
    sourceCode: string,
    context: SSTHandlerContext,
    filePath: string,
  ): HandlerLocation {
    return {
      filePath: filePath.replace(/^.*\//, ""), // Get relative path
      line: context.line || 1,
      column: context.column || 1,
      contextType: context.type,
      contextInfo: context.contextInfo || this.getContextDescription(context, sourceCode),
    };
  }

  protected getContextDescription(context: SSTHandlerContext, sourceCode: string): string {
    switch (context.type) {
      case "function":
        return this.extractFunctionName(context, sourceCode) || "Lambda Function";
      case "cron":
        return this.extractCronName(context, sourceCode) || "Cron Job";
      case "queue":
        return "Queue Subscriber";
      case "bucket":
        return "Bucket Notification";
      case "apigatewayv1":
        return this.extractRouteInfo(context, sourceCode) || "API Gateway V1 Route";
      default:
        return "Handler";
    }
  }

  protected extractFunctionName(context: SSTHandlerContext, sourceCode: string): string | null {
    // Extract function name from patterns like: new sst.aws.Function("FunctionName", ...)
    const lines = sourceCode.split("\n");
    const lineNumber = (context.line || 1) - 1;
    const _contextLine = lines[lineNumber] || "";

    // Look for the pattern in the current line and nearby lines
    for (
      let i = Math.max(0, lineNumber - 2);
      i <= Math.min(lines.length - 1, lineNumber + 2);
      i++
    ) {
      const line = lines[i];
      const match = line.match(/new\s+sst\.aws\.Function\s*\(\s*["']([^"']+)["']/);
      if (match) {
        return `Function: ${match[1]}`;
      }
    }
    return null;
  }

  protected extractCronName(context: SSTHandlerContext, sourceCode: string): string | null {
    // Extract cron name from patterns like: new sst.aws.Cron("CronName", ...)
    const lines = sourceCode.split("\n");
    const lineNumber = (context.line || 1) - 1;

    for (
      let i = Math.max(0, lineNumber - 2);
      i <= Math.min(lines.length - 1, lineNumber + 2);
      i++
    ) {
      const line = lines[i];
      const match = line.match(/new\s+sst\.aws\.Cron\s*\(\s*["']([^"']+)["']/);
      if (match) {
        return `Cron: ${match[1]}`;
      }
    }
    return null;
  }

  protected extractRouteInfo(context: SSTHandlerContext, sourceCode: string): string | null {
    // Extract route info from patterns like: ApiGatewayV1.route("GET /", ...)
    const lines = sourceCode.split("\n");
    const lineNumber = (context.line || 1) - 1;

    for (
      let i = Math.max(0, lineNumber - 1);
      i <= Math.min(lines.length - 1, lineNumber + 1);
      i++
    ) {
      const line = lines[i];
      const match = line.match(/\.route\s*\(\s*["']([^"']+)["']/);
      if (match) {
        return `Route: ${match[1]}`;
      }
    }
    return null;
  }

  protected async findAllTypeScriptFiles(config: any): Promise<string[]> {
    const fs = await import("node:fs");
    const path = await import("node:path");

    const filePaths = new Set<string>();

    const scanDirectory = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            // Skip node_modules, dist, .git, etc.
            if (
              !entry.name.startsWith(".") &&
              entry.name !== "node_modules" &&
              entry.name !== "dist" &&
              entry.name !== "build"
            ) {
              await scanDirectory(fullPath);
            }
          } else if (
            entry.isFile() &&
            entry.name.endsWith(".ts") &&
            !entry.name.endsWith(".d.ts")
          ) {
            filePaths.add(fullPath);
          }
        }
      } catch (_error) {
        // Ignore permission errors, etc.
      }
    };

    // Start from the SST root directory
    await scanDirectory(config.rootPath);

    return Array.from(filePaths);
  }

  protected async readFile(filePath: string): Promise<string> {
    const fs = await import("node:fs");
    return fs.promises.readFile(filePath, "utf-8");
  }
}
