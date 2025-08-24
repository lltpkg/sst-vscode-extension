# SST Handler Autocomplete Extension

A VSCode extension that provides intelligent autocomplete, validation, and navigation for SST (Serverless Stack) function handlers.

## Features

🔍 **Smart Handler Autocomplete**: Automatically suggests available handler functions when writing SST constructs  
📊 **Usage Statistics**: View handler usage statistics on hover - see where and how often each handler is used  
🔗 **Go-to-Definition**: Navigate directly to handler implementations  
⚠️ **Real-time Validation**: Detect missing files, invalid handler paths, and broken references  
🛠️ **Code Actions**: Quick fixes for common handler issues

## Supported SST Constructs

- `sst.aws.Function` - Lambda functions
- `sst.aws.Cron` - Scheduled functions
- `sst.aws.Queue` - Queue subscribers
- `sst.aws.Bucket` - Bucket notifications
- `sst.aws.ApiGatewayV1` - API routes

## Usage Statistics

Hover over any handler path to see:

- **Usage count** - How many times the handler is referenced
- **Usage locations** - Exact files and lines where it's used
- **Context information** - Type of SST construct using the handler

## Bundle Size Optimization

This extension uses an optimized build strategy:

- **TypeScript External**: Uses VSCode's built-in TypeScript instead of bundling (~36KB vs several MB)
- **Smart Loading**: Dynamically loads TypeScript at runtime from VSCode's environment
- **Efficient Bundling**: Uses esbuild with external dependencies for minimal size

### Bundle Details

- Unminified: ~76KB
- Minified: ~36KB
- Final VSIX: ~14KB
- No TypeScript bundled - uses VSCode's copy

## Development

```bash
# Install dependencies
pnpm install

# Build extension
pnpm build

# Watch mode
pnpm watch

# Run tests
pnpm test
```

## Architecture

The extension is built on top of the `sst-analyzer` library which provides:

- TypeScript AST analysis for handler detection
- File system scanning with tsconfig.json support
- Validation logic and error reporting
- Usage statistics analysis

This modular approach allows the same core logic to be used in both the VSCode extension and CLI tools.
