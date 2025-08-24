# SST Core

Core validation library for SST (Serverless Stack) projects with CLI support.

## Features

- **Universal Handler Validation**: Supports Function, Cron, Queue, and Bucket handlers
- **Template Literal Support**: Resolves variables in template literals like `` `functions/${pathName}.handler` ``
- **Real-time Error Detection**: Catches invalid file paths and function names
- **Smart Suggestions**: Provides "Did you mean..." suggestions for typos
- **CLI Interface**: Command-line tool for CI/CD integration
- **TypeScript AST Analysis**: Accurate parsing using TypeScript compiler API

## Installation

```bash
# As a dependency
pnpm add sst-analyzer

# Global CLI installation
pnpm add -g sst-analyzer
```

## CLI Usage

### Validate Project

```bash
# Validate current directory
sst-validate validate

# Validate specific project
sst-validate validate --path /path/to/sst-project

# JSON output for CI/CD
sst-validate validate --json
```

### Scan Handlers

```bash
# List all handler files
sst-validate scan

# JSON output
sst-validate scan --json
```

### Check Specific File

```bash
# Validate a single file
sst-validate check-file src/functions/upload.ts

# With custom project path
sst-validate check-file src/functions/upload.ts --project /path/to/project
```

## Programmatic Usage

```typescript
import { SSTValidator } from "sst-analyzer";

// Create validator
const validator = new SSTValidator("/path/to/sst-project");

// Validate entire project
const result = await validator.validateProject();

if (result.isValid) {
  console.log("✅ All handlers are valid!");
} else {
  for (const error of result.errors) {
    console.error(`❌ ${error.message}`);
    if (error.suggestions) {
      console.log(`💡 Suggestions: ${error.suggestions.join(", ")}`);
    }
  }
}
```

## Supported Handler Types

### 1. SST Function Handlers

```typescript
// Static strings
new sst.aws.Function("upload", {
  handler: "functions/upload.handler",
});

// Template literals with variables
const serviceName = "upload";
new sst.aws.Function("upload", {
  handler: `functions/${serviceName}.handler`,
});
```

### 2. SST Cron Handlers

```typescript
// Static strings
new sst.aws.Cron("cleanup", {
  schedule: "rate(1 day)",
  function: "functions/cleanup.handler",
});

// Template literals
const taskName = "cleanup";
new sst.aws.Cron("cleanup", {
  schedule: "rate(1 day)",
  function: `functions/${taskName}.handler`,
});
```

### 3. Queue Subscribe Handlers

```typescript
// Static strings
queue.subscribe("functions/processor.handler");

// Template literals
const processorName = "processor";
queue.subscribe(`functions/${processorName}.handler`);
```

### 4. Bucket Notification Handlers

```typescript
// Static strings
publicBucket.notify({
  notifications: [{
    function: "functions/uploader.handler",
  }],
});

// Template literals
const handlerName = "uploader";
publicBucket.notify({
  notifications: [{
    function: `functions/${handlerName}.handler`,
  }],
});
```

## Error Types

### File Not Found

```
❌ Handler file not found: "functions/nonexistent.ts". Make sure the file exists in your project.
💡 Suggestions: functions/upload, functions/details
```

### Function Not Found

```
❌ Function "wrongFunction" not found in "functions/upload.ts". Available functions: handler, otherFunction
💡 Suggestions: handler, otherFunction
```

### Invalid Format

```
❌ Invalid handler format: "invalid-format". Expected format: "path/to/file.functionName"
```

## Configuration

The validator automatically detects SST projects by looking for `sst.config.ts` and respects `tsconfig.json` include/exclude patterns.

### Example tsconfig.json

```json
{
  "include": ["**/*.ts"],
  "exclude": ["node_modules/**", "dist/**", "**/*.test.ts"]
}
```

## CI/CD Integration

Use in your CI/CD pipeline:

```bash
# GitHub Actions, GitLab CI, etc.
sst-validate validate --json > validation-results.json

# Exit codes:
# 0 = validation passed
# 1 = validation failed
```

## Advanced Features

- **Variable Resolution**: Resolves `const pathName = "details"` in template literals
- **Multiple Variables**: Supports `${dir}/${file}.${func}` patterns
- **Smart Similarity**: Uses advanced algorithms for typo suggestions
- **Performance Optimized**: Efficient AST parsing and file scanning

## Development

```bash
# Install dependencies
pnpm install

# Build the package
pnpm build

# Run tests
pnpm test

# Development mode
pnpm dev
```

