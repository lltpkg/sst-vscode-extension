# VSCode Extension Publishing Guide

This document describes how to publish the SST VSCode Extension to both the Visual Studio Marketplace and Open VSX Registry.

## Prerequisites

### Required Secrets

You need to configure the following secrets in your GitHub repository:

1. **VSCE_PAT** - Visual Studio Marketplace Personal Access Token
2. **OVSX_PAT** - Open VSX Registry Personal Access Token

### Setting up Visual Studio Marketplace Token

1. Go to [Azure DevOps](https://dev.azure.com)
2. Sign in with your Microsoft account
3. Click on "User settings" > "Personal access tokens"
4. Create a new token with:
   - **Organization**: All accessible organizations
   - **Scopes**: Custom defined
   - **Marketplace**: Read & publish

### Setting up Open VSX Registry Token

1. Go to [Open VSX Registry](https://open-vsx.org)
2. Sign in with your GitHub account
3. Go to your profile settings
4. Generate a new access token

### Adding Secrets to GitHub

1. Go to your repository on GitHub
2. Navigate to Settings > Secrets and variables > Actions
3. Add the tokens as repository secrets:
   - `VSCE_PAT`: Your Visual Studio Marketplace token
   - `OVSX_PAT`: Your Open VSX Registry token

## Publishing Methods

### Method 1: Automatic Publishing via Git Tags

The most common way to publish is by creating a git tag:

```bash
# Create and push a new tag
git tag extension-v1.0.0
git push origin extension-v1.0.0
```

This will:
1. Run all tests
2. Build the extension
3. Package the VSIX file
4. Publish to both marketplaces
5. Create a GitHub release
6. Upload the VSIX file to the release

### Method 2: Manual Workflow Dispatch

You can manually trigger publishing from GitHub Actions:

1. Go to Actions tab in your repository
2. Select "Publish VSCode Extension" workflow
3. Click "Run workflow"
4. Enter the version number (e.g., 1.0.0)
5. Choose whether it's a pre-release

### Method 3: Release-based Publishing

Create a GitHub release and the extension will be automatically published:

1. Go to Releases in your repository
2. Click "Create a new release"
3. Create a tag like `extension-v1.0.0`
4. Fill in release notes
5. Publish the release

## Version Management

### Semantic Versioning

Follow semantic versioning (semver) for extension versions:

- **MAJOR** (1.0.0): Breaking changes
- **MINOR** (0.1.0): New features, backward compatible
- **PATCH** (0.0.1): Bug fixes, backward compatible

### Pre-release Versions

For pre-release versions, you can:

1. Use the manual workflow with pre-release flag
2. Use version suffixes like `1.0.0-beta.1`

## Publishing Checklist

Before publishing, ensure:

- [ ] All tests pass
- [ ] Extension builds without errors
- [ ] Version number is updated appropriately
- [ ] CHANGELOG is updated
- [ ] Repository URLs are correct in package.json
- [ ] Publisher name is set correctly
- [ ] Icon file exists and is referenced
- [ ] Categories and keywords are appropriate

## Marketplace Information

### Visual Studio Marketplace

- **Publisher**: kairiss
- **Extension ID**: sst-vsc-ext
- **URL**: https://marketplace.visualstudio.com/items?itemName=kairiss.sst-vsc-ext

### Open VSX Registry

- **Publisher**: kairiss
- **Extension ID**: sst-vsc-ext
- **URL**: https://open-vsx.org/extension/kairiss/sst-vsc-ext

## Local Testing

Before publishing, test the extension locally:

```bash
# Build and package
cd apps/extension
pnpm run build
pnpm run package

# Install locally for testing
code --install-extension sst-vsc-ext-*.vsix
```

## Troubleshooting

### Common Issues

1. **Authentication Failed**
   - Check if your PAT tokens are valid and not expired
   - Ensure tokens have correct permissions

2. **Version Already Exists**
   - Increment the version number
   - Use pre-release versions for testing

3. **Build Failures**
   - Ensure all dependencies are installed
   - Check TypeScript compilation errors
   - Verify test suite passes

4. **Package Issues**
   - Check `.vscodeignore` file
   - Ensure main entry point exists
   - Verify all required files are included

### Debug Publishing

To debug publishing issues:

1. Check GitHub Actions logs
2. Verify VSIX package contents:
   ```bash
   unzip -l sst-vsc-ext-*.vsix
   ```
3. Test extension installation locally

## Support

For publishing issues:

1. Check [VS Code Extension Publishing docs](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
2. Check [Open VSX Publishing docs](https://github.com/eclipse/openvsx/wiki/Publishing-Extensions)
3. Review GitHub Actions logs for detailed error messages
