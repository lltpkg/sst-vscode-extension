# SST VSCode Extension

A comprehensive VSCode extension and analyzer toolkit for SST (Serverless Stack) projects.

## Packages

### 📦 [@cute-me-on-repos/sst-analyzer](./packages/analyzer)
Core validation library for SST projects with CLI support.

```bash
npm install -g @cute-me-on-repos/sst-analyzer
```
### 🎯 [VSCode Extension](./apps/extension)  
VSCode extension providing intelligent SST project support with advanced features.

**Features:**
- 🔍 **Go to Definition**: Navigate from handler strings to actual function files
- 📝 **Autocomplete**: Smart suggestions for SST function handlers
- ⚡ **Real-time Validation**: Instant feedback on handler paths
- 🔄 **Auto-refresh**: Automatically updates when project structure changes

**Installation:**
VSCode marketplace:
https://marketplace.visualstudio.com/items?itemName=kairiss.sst-vsc-ext
or 
```bash
code --install-extension kairiss.sst-vsc-ext 
# or
cursor --install-extension kairiss.sst-vsc-ext 
```

**Commands:**
- `SST: Refresh Handlers` - Manually refresh handler cache
## Publishing

### Analyzer Package

The `@cute-me-on-repos/sst-analyzer` package is automatically published to npm when changes are made to the analyzer package on the main branch.

#### Manual Publishing

```bash
# Dry run
./scripts/publish-analyzer.bash --dry-run

# Publish
./scripts/publish-analyzer.bash
```

#### Workflow Triggers

1. **Automatic Release**: Push to `main` branch with changes in `packages/analyzer/`
2. **Manual Release**: Workflow dispatch with version input
3. **Tag Release**: Push tag matching `analyzer-v*`

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm run build

# Run tests
pnpm run test

# Lint
pnpm run lint
```

## Architecture

```
sst-vscode-extension/
├── packages/
│   └── analyzer/          # Core validation library + CLI
└── apps/
    └── extension/         # VSCode extension
```
