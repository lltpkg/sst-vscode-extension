import * as fs from "node:fs";
import * as path from "node:path";
import type {
  HandlerInfo,
  SSTHandlerContext,
  SSTProjectConfig,
  ValidationError,
  ValidationResult,
  ValidationWarning,
} from "../types";
import { ASTAnalyzer } from "./astAnalyzer";
import { FileScanner } from "./fileScanner";

export class SSTValidator {
  protected astAnalyzer: ASTAnalyzer;
  protected fileScanner: FileScanner;

  constructor(
    workspaceRoot: string,
    protected readonly ts: typeof import("typescript"),
  ) {
    this.astAnalyzer = new ASTAnalyzer(this.ts);
    this.fileScanner = new FileScanner(workspaceRoot, this.ts);
  }

  public async validateProject(): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      const config = await this.fileScanner.findProjectConfig();
      if (!config) {
        errors.push({
          type: "file-not-found",
          message: "No SST project found. Make sure sst.config.ts exists in your project.",
          filePath: "",
          handlerPath: "",
        });
        return {
          isValid: false,
          errors,
          warnings,
          handlers: [],
          sstProjectConfigPath: "",
          tsConfigPath: "",
        };
      }

      const handlers = await this.fileScanner.scanHandlers();
      const tsFiles = await this.findAllTypeScriptFiles(config);

      for (const tsFile of tsFiles) {
        const fileErrors = await this.validateFile(tsFile, handlers);
        errors.push(...fileErrors);
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        handlers,
        sstProjectConfigPath: config.sstConfigPath || "",
        tsConfigPath: config.tsConfigPath || "",
      };
    } catch (error) {
      errors.push({
        type: "file-not-found",
        message: `Validation failed: ${error}`,
        filePath: "",
        handlerPath: "",
      });
      return {
        isValid: false,
        errors,
        warnings,
        handlers: [],
        sstProjectConfigPath: "",
        tsConfigPath: "",
      };
    }
  }

  public async validateFile(
    filePath: string,
    availableHandlers: HandlerInfo[],
  ): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    try {
      const sourceCode = await fs.promises.readFile(filePath, "utf-8");
      const contexts = this.astAnalyzer.analyzeHandlerContexts(sourceCode, filePath);

      if (contexts.length === 0) {
        return errors;
      }

      const availablePaths = new Set(availableHandlers.map((h) => h.relativePath));

      for (const context of contexts) {
        if (context.expectedPath) {
          const error = await this.validateHandlerPath(
            filePath,
            context,
            availablePaths,
            availableHandlers,
          );
          if (error) {
            errors.push(error);
          }
        }
      }
    } catch (error) {
      errors.push({
        type: "file-not-found",
        message: `Error reading file: ${error}`,
        filePath,
        handlerPath: "",
      });
    }

    return errors;
  }

  protected async validateHandlerPath(
    filePath: string,
    context: SSTHandlerContext,
    availablePaths: Set<string>,
    availableHandlers: HandlerInfo[],
  ): Promise<ValidationError | null> {
    const handlerPath = context.expectedPath!;
    const lastDotIndex = handlerPath.lastIndexOf(".");

    if (lastDotIndex === -1) {
      return {
        type: "invalid-format",
        message: `Invalid handler format: "${handlerPath}". Expected format: "path/to/file.functionName"`,
        filePath,
        handlerPath,
      };
    }

    const filePathPart = handlerPath.substring(0, lastDotIndex);
    const functionName = handlerPath.substring(lastDotIndex + 1);

    // Check if file exists
    if (!availablePaths.has(filePathPart)) {
      const suggestions = this.findSimilarPaths(filePathPart, Array.from(availablePaths));
      return {
        type: "file-not-found",
        message: `Handler file not found: "${filePathPart}.ts". Make sure the file exists in your project.`,
        filePath,
        handlerPath,
        suggestions: suggestions.slice(0, 3),
      };
    }

    // Check if function exists in the file
    const handler = availableHandlers.find((h) => h.relativePath === filePathPart);
    if (handler && !handler.exportedFunctions.includes(functionName)) {
      return {
        type: "function-not-found",
        message: `Function "${functionName}" not found in "${filePathPart}.ts". Available functions: ${handler.exportedFunctions.join(", ")}`,
        filePath,
        handlerPath,
        suggestions: handler.exportedFunctions.slice(0, 5),
      };
    }

    return null;
  }

  protected findSimilarPaths(target: string, availablePaths: string[]): string[] {
    const targetLower = target.toLowerCase();

    return availablePaths
      .map((pathStr) => ({
        path: pathStr,
        similarity: this.calculateSimilarity(targetLower, pathStr.toLowerCase()),
      }))
      .filter((item) => item.similarity > 0.4)
      .sort((a, b) => b.similarity - a.similarity)
      .map((item) => item.path);
  }

  protected calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;
    if (str1.length === 0 || str2.length === 0) return 0;

    // Check if one string contains the other
    if (str1.includes(str2) || str2.includes(str1)) {
      return Math.max(str2.length / str1.length, str1.length / str2.length) * 0.8;
    }

    // Count common characters
    const set1 = new Set(str1.split(""));
    const set2 = new Set(str2.split(""));
    const commonChars = [...set1].filter((char) => set2.has(char)).length;
    const maxChars = Math.max(set1.size, set2.size);

    return commonChars / maxChars;
  }

  protected async findAllTypeScriptFiles(config: SSTProjectConfig): Promise<string[]> {
    const files: string[] = [];

    const scanDir = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
              await scanDir(fullPath);
            }
          } else if (entry.isFile() && entry.name.endsWith(".ts")) {
            const relativePath = path.relative(config.rootPath, fullPath).replace(/\\/g, "/");

            // Check if file should be included based on patterns
            let shouldInclude = true;

            // Check exclude patterns
            for (const excludePattern of config.excludePatterns) {
              if (this.matchesGlob(relativePath, excludePattern)) {
                shouldInclude = false;
                break;
              }
            }

            // Check include patterns
            if (shouldInclude && config.includePatterns.length > 0) {
              shouldInclude = config.includePatterns.some((pattern) =>
                this.matchesGlob(relativePath, pattern),
              );
            }

            if (shouldInclude) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        console.error(`Error scanning directory ${dir}:`, error);
      }
    };

    await scanDir(config.rootPath);
    return files;
  }

  protected matchesGlob(filePath: string, pattern: string): boolean {
    // Simple glob matching - could be enhanced with a proper glob library
    const regex = pattern.replace(/\./g, "\\.").replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*");

    return new RegExp(`^${regex}$`).test(filePath);
  }
}
