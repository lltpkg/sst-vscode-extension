// Core validation classes
export { ASTAnalyzer } from "./lib/astAnalyzer";
export { FileScanner } from "./lib/fileScanner";
export { StatisticsAnalyzer } from "./lib/statisticsAnalyzer";
export { SSTValidator } from "./lib/validator";

// Types
export type {
  HandlerInfo,
  HandlerLocation,
  HandlerUsage,
  SSTHandlerContext,
  SSTHandlerType,
  SSTProjectConfig,
  UsageStatistics,
  ValidationError,
  ValidationResult,
  ValidationWarning,
} from "./types";
