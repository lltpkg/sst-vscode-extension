#!/usr/bin/env node
import path from "node:path";
import { program } from "commander";
import { StatisticsAnalyzer } from "../lib/statisticsAnalyzer";
import { SSTValidator } from "../lib/validator";
import type { ValidationError } from "../types";

// @ts-expect-error
const chalk = require("chalk").default as typeof import("chalk").default;

const getLocalTsPath = () => {
  const tsPath = require.resolve("typescript", { paths: [process.cwd()] });
  return tsPath;
};
// Export command functions for testing
export async function validateCommand(options?: { path?: string; json?: boolean }) {
  const opts = options || {};
  const projectPath = path.resolve(opts.path || process.cwd());

  console.log();

  try {
    const validator = new SSTValidator(projectPath, await import(getLocalTsPath()));
    const result = await validator.validateProject();

    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    // Human-readable output
    if (result.isValid) {
      console.log(chalk.green("✅ All handler references are valid!"));
    } else {
      console.log(chalk.red(`❌ Found ${result.errors.length} error(s):`));
      console.log();

      // Group errors by file
      const errorsByFile = new Map<string, ValidationError[]>();
      for (const error of result.errors) {
        if (!errorsByFile.has(error.filePath)) {
          errorsByFile.set(error.filePath, []);
        }
        errorsByFile.get(error.filePath)!.push(error);
      }

      for (const [filePath, errors] of errorsByFile) {
        if (filePath) {
          console.log(chalk.yellow(`📄 ${path.relative(projectPath, filePath)}:`));
        }

        for (const error of errors) {
          console.log(chalk.red(`  ❌ ${error.message}`));

          if (error.suggestions && error.suggestions.length > 0) {
            console.log(chalk.gray(`     💡 Suggestions: ${error.suggestions.join(", ")}`));
          }
        }
        console.log();
      }
    }

    if (result.warnings.length > 0) {
      console.log(chalk.yellow(`⚠️  Found ${result.warnings.length} warning(s):`));
      for (const warning of result.warnings) {
        console.log(chalk.yellow(`  ⚠️  ${warning.message}`));
      }
      console.log();
    }

    // Exit with error code if validation failed (only in CLI mode)
    if (!options) process.exit(result.isValid ? 0 : 1);
  } catch (error) {
    console.error(chalk.red("❌ Validation failed:"), error);
    if (!options) process.exit(1);
  }
}

export async function listHandlersCommand(options?: { path?: string; json?: boolean }) {
  const opts = options || {};
  const projectPath = path.resolve(opts.path || process.cwd());

  try {
    const validator = new SSTValidator(projectPath, await import(getLocalTsPath()));
    // Access the file scanner through the validator
    const fileScanner = (validator as any).fileScanner;
    const handlers = await fileScanner.scanHandlers();

    if (opts.json) {
      console.log(JSON.stringify(handlers, null, 2));
      return;
    }

    console.log(chalk.blue(`📁 Found ${handlers.length} handler file(s):`));
    console.log();

    for (const handler of handlers) {
      console.log(chalk.green(`📄 ${handler.relativePath}.ts`));
      console.log(chalk.gray(`   Functions: ${handler.exportedFunctions.join(", ")}`));
    }
  } catch (error) {
    console.error(chalk.red("❌ Scan failed:"), error);
    if (!options) process.exit(1);
  }
}

export async function validateFileCommand(
  file: string,
  options?: { project?: string; json?: boolean },
) {
  const opts = options || {};
  const projectPath = path.resolve(opts.project || process.cwd());
  const filePath = path.resolve(file);

  try {
    const validator = new SSTValidator(projectPath, await import(getLocalTsPath()));
    const fileScanner = (validator as any).fileScanner;
    const handlers = await fileScanner.scanHandlers();
    const errors = await validator.validateFile(filePath, handlers);

    if (opts.json) {
      console.log(JSON.stringify({ errors }, null, 2));
      return;
    }

    if (errors.length === 0) {
      console.log(chalk.green(`✅ ${path.relative(projectPath, filePath)} is valid!`));
    } else {
      console.log(
        chalk.red(`❌ Found ${errors.length} error(s) in ${path.relative(projectPath, filePath)}:`),
      );
      for (const error of errors) {
        console.log(chalk.red(`  ❌ ${error.message}`));
        if (error.suggestions && error.suggestions.length > 0) {
          console.log(chalk.gray(`     💡 Suggestions: ${error.suggestions.join(", ")}`));
        }
      }
    }

    if (!options) process.exit(errors.length === 0 ? 0 : 1);
  } catch (error) {
    console.error(chalk.red("❌ File validation failed:"), error);
    if (!options) process.exit(1);
  }
}

export async function statisticsCommand(options?: {
  path?: string;
  json?: boolean;
  handler?: string;
}) {
  const opts = options || {};
  const projectPath = path.resolve(opts.path || process.cwd());

  try {
    const analyzer = new StatisticsAnalyzer(projectPath, await import(getLocalTsPath()));

    if (opts.handler) {
      // Show specific handler statistics
      const usage = await analyzer.getHandlerUsage(opts.handler);
      if (!usage) {
        console.log(chalk.yellow(`📊 Handler "${opts.handler}" not found or never used`));
        if (!options) process.exit(1);
        return;
      }

      if (opts.json) {
        console.log(JSON.stringify(usage, null, 2));
        return;
      }

      console.log(chalk.blue(`📊 Statistics for handler: ${chalk.bold(usage.handlerPath)}`));
      console.log();
      console.log(chalk.green(`🔢 Usage count: ${usage.usageCount}`));
      console.log();

      if (usage.locations.length > 0) {
        console.log(chalk.cyan("📍 Used in:"));
        for (const location of usage.locations) {
          console.log(
            chalk.gray(`  📄 ${location.filePath}:${location.line}:${location.column}`) +
              chalk.white(` - ${location.contextInfo}`),
          );
        }
      }
    } else {
      // Show overall statistics
      console.log(chalk.blue(`📊 Analyzing handler usage statistics for: ${projectPath}`));
      console.log();

      const stats = await analyzer.analyzeUsageStatistics();
      if (!stats) {
        console.log(chalk.red("❌ Failed to analyze project. Make sure sst.config.ts exists."));
        if (!options) process.exit(1);
        return;
      }

      if (opts.json) {
        console.log(JSON.stringify(stats, null, 2));
        return;
      }

      // Summary
      console.log(chalk.green("📋 Summary:"));
      console.log(`  🎯 Total handlers: ${stats.totalHandlers}`);
      console.log(`  🔄 Total usages: ${stats.totalUsages}`);
      console.log(
        `  📈 Average usage per handler: ${(stats.totalUsages / Math.max(stats.totalHandlers, 1)).toFixed(1)}`,
      );
      console.log();

      // Most used handlers
      if (stats.mostUsedHandlers.length > 0) {
        console.log(chalk.cyan("🔥 Most used handlers:"));
        for (const handler of stats.mostUsedHandlers.slice(0, 5)) {
          console.log(
            chalk.white(`  ${handler.handlerPath}`) +
              chalk.green(
                ` (${handler.usageCount} ${handler.usageCount === 1 ? "usage" : "usages"})`,
              ),
          );
        }
        console.log();
      }

      // Unused handlers
      if (stats.unusedHandlers.length > 0) {
        console.log(chalk.yellow("⚠️  Unused handlers:"));
        for (const handler of stats.unusedHandlers.slice(0, 10)) {
          console.log(chalk.gray(`  📄 ${handler}`));
        }
        if (stats.unusedHandlers.length > 10) {
          console.log(chalk.gray(`  ... and ${stats.unusedHandlers.length - 10} more`));
        }
        console.log();
      }

      // Tip
      console.log(
        chalk.blue("💡 Tip: Use --handler <path> to see detailed usage for a specific handler"),
      );
    }

    if (!options) process.exit(0);
  } catch (error) {
    console.error(chalk.red("❌ Statistics analysis failed:"), error);
    if (!options) process.exit(1);
  }
}

program
  .name("sst-validate")
  .description("Validate SST project handler references")
  .version("0.1.0");

program
  .command("validate")
  .description("Validate SST handler references in the current project")
  .option("-p, --path <path>", "Path to SST project", process.cwd())
  .option("--json", "Output results in JSON format")
  .option("--fix", "Auto-fix common issues (coming soon)")
  .action(validateCommand);

program
  .command("scan")
  .description("Scan and list all handler files in the project")
  .option("-p, --path <path>", "Path to SST project", process.cwd())
  .option("--json", "Output results in JSON format")
  .action(listHandlersCommand);

program
  .command("check-file")
  .description("Validate a specific TypeScript file")
  .argument("<file>", "Path to TypeScript file to validate")
  .option("-p, --project <path>", "Path to SST project", process.cwd())
  .option("--json", "Output results in JSON format")
  .action(validateFileCommand);

program
  .command("stats")
  .alias("statistics")
  .description("Show handler usage statistics")
  .option("-p, --path <path>", "Path to SST project", process.cwd())
  .option("-h, --handler <handler>", "Show statistics for a specific handler")
  .option("--json", "Output results in JSON format")
  .action(statisticsCommand);

// Default command
program.action(() => {
  program.help();
});

program.parse();
