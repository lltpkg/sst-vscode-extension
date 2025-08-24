import type * as ts from "typescript";

export type SSTHandlerType = "function" | "cron" | "queue" | "bucket" | "apigatewayv1";

export type SSTHandlerContext = {
  type: SSTHandlerType;
  position: number;
  expectedPath: string | null;
  node: ts.Node;
  line?: number;
  column?: number;
  contextInfo?: string; // Additional context like function name, route pattern, etc.
};

export type HandlerInfo = {
  filePath: string;
  relativePath: string;
  exportedFunctions: string[];
};

export type ValidationResult = {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
};

export type ValidationError = {
  type: "file-not-found" | "function-not-found" | "invalid-format";
  message: string;
  filePath: string;
  line?: number;
  column?: number;
  handlerPath: string;
  suggestions?: string[];
};

export type ValidationWarning = {
  type: "unused-handler" | "deprecated-syntax";
  message: string;
  filePath: string;
  line?: number;
  column?: number;
};

export type SSTProjectConfig = {
  rootPath: string;
  sstConfigPath?: string;
  tsConfigPath?: string;
  includePatterns: string[];
  excludePatterns: string[];
};

export type HandlerUsage = {
  handlerPath: string;
  usageCount: number;
  locations: HandlerLocation[];
};

export type HandlerLocation = {
  filePath: string;
  line: number;
  column: number;
  contextType: SSTHandlerType;
  contextInfo: string; // e.g., "Function: GenCsv", "Route: GET /"
};

export type UsageStatistics = {
  totalHandlers: number;
  totalUsages: number;
  handlerUsages: HandlerUsage[];
  mostUsedHandlers: HandlerUsage[];
  unusedHandlers: string[]; // Handlers that exist but are never used
};
