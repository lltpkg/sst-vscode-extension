#!/usr/bin/env bash

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_header() { echo -e "\n${BLUE}=== $1 ===${NC}"; }

usage() {
    echo "Usage: $0 <version> [--dry-run]"
    echo "  version: semver version (e.g., 1.0.0, 1.2.3-beta.1)"
    echo "  --dry-run: Show what would be done without making changes"
    echo
    echo "Examples:"
    echo "  $0 1.0.0              # Release version 1.0.0"
    echo "  $0 1.2.0-beta.1       # Pre-release version"
    echo "  $0 1.0.1 --dry-run    # See what would happen"
    exit 1
}

validate_version() {
    local version="$1"
    if [[ ! $version =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?$ ]]; then
        print_error "Invalid version format: $version"
        print_info "Use semantic versioning: MAJOR.MINOR.PATCH[-prerelease]"
        exit 1
    fi
}

check_git_status() {
    if [[ -n $(git status --porcelain) ]]; then
        print_error "Working directory is not clean. Commit or stash changes first."
        git status --short
        exit 1
    fi
    
    if [[ $(git rev-parse --abbrev-ref HEAD) != "main" ]]; then
        print_warning "Not on main branch. Current branch: $(git rev-parse --abbrev-ref HEAD)"
        read -p "Continue anyway? (y/N): " -r
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

check_prerequisites() {
    local missing=()
    
    if ! command -v git &> /dev/null; then
        missing+=("git")
    fi
    
    if ! command -v gh &> /dev/null; then
        missing+=("gh (GitHub CLI)")
    fi
    
    if [[ ${#missing[@]} -gt 0 ]]; then
        print_error "Missing required tools: ${missing[*]}"
        exit 1
    fi
    
    if ! gh auth status &> /dev/null; then
        print_error "Not authenticated with GitHub CLI. Run 'gh auth login'"
        exit 1
    fi
}

main() {
    if [[ $# -eq 0 ]]; then
        usage
    fi
    
    local version="$1"
    local dry_run=false
    
    if [[ $# -gt 1 && "$2" == "--dry-run" ]]; then
        dry_run=true
    fi
    
    validate_version "$version"
    
    print_header "Extension Release Script"
    print_info "Version: $version"
    if $dry_run; then
        print_warning "DRY RUN MODE - No changes will be made"
    fi
    
    # Check prerequisites
    print_header "Checking Prerequisites"
    check_prerequisites
    check_git_status
    print_success "All prerequisites met"
    
    # Check if we're in the right directory
    if [[ ! -f "apps/extension/package.json" ]]; then
        print_error "Please run this script from the project root directory"
        exit 1
    fi
    
    local tag="extension-v$version"
    
    # Check if tag already exists
    if git rev-parse "$tag" >/dev/null 2>&1; then
        print_error "Tag $tag already exists"
        exit 1
    fi
    
    print_header "Building and Testing"
    if ! $dry_run; then
        # Run tests
        print_info "Running tests..."
        pnpm run test --filter=@cute-me-on-repos/sst-analyzer
        
        # Build and package
        print_info "Building extension..."
        cd apps/extension
        pnpm run build
        pnpm run package
        cd ../..
        
        print_success "Build and packaging completed"
    else
        print_info "Would run tests and build extension"
    fi
    
    print_header "Git Operations"
    if ! $dry_run; then
        # Update package version
        print_info "Updating package version..."
        cd apps/extension
        npm version "$version" --no-git-tag-version
        cd ../..
        
        # Commit version bump
        git add apps/extension/package.json
        git commit -m "chore: bump extension version to $version"
        
        # Create and push tag
        git tag "$tag"
        git push origin main
        git push origin "$tag"
        
        print_success "Created and pushed tag: $tag"
    else
        print_info "Would update package.json to version $version"
        print_info "Would commit changes and create tag: $tag"
        print_info "Would push to origin"
    fi
    
    print_header "GitHub Release"
    if ! $dry_run; then
        # Create GitHub release
        print_info "Creating GitHub release..."
        gh release create "$tag" \
            --title "SST VSCode Extension v$version" \
            --generate-notes \
            --latest
        
        print_success "Created GitHub release: $tag"
    else
        print_info "Would create GitHub release with tag: $tag"
    fi
    
    print_header "Publishing Status"
    if ! $dry_run; then
        print_success "Release process completed successfully!"
        echo
        print_info "The extension will be automatically published by GitHub Actions"
        print_info "Monitor the workflow at: https://github.com/$(gh repo view --json owner,name --jq '.owner.login + \"/\" + .name')/actions"
        echo
        print_info "After publishing, the extension will be available at:"
        echo "📦 VS Code Marketplace: https://marketplace.visualstudio.com/items?itemName=kairiss.sst-vsc-ext"
        echo "📦 Open VSX Registry: https://open-vsx.org/extension/kairiss/sst-vsc-ext"
    else
        print_info "This was a dry run. No changes were made."
        print_info "To actually release, run: $0 $version"
    fi
}

main "$@"
