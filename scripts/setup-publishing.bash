#!/usr/bin/env bash

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_header() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

main() {
    print_header "VSCode Extension Publishing Setup"
    
    print_info "This script will help you set up publishing for the SST VSCode Extension"
    print_info "You'll need to configure authentication tokens for both marketplaces"
    echo
    
    # Check if we're in the right directory
    if [[ ! -f "apps/extension/package.json" ]]; then
        print_error "Please run this script from the project root directory"
        exit 1
    fi
    
    print_header "Prerequisites Check"
    
    # Check if required tools are installed
    if ! command -v gh &> /dev/null; then
        print_warning "GitHub CLI (gh) is not installed. You'll need it to set repository secrets."
        print_info "Install it from: https://cli.github.com/"
    else
        print_success "GitHub CLI is available"
    fi
    
    # Check if user is logged in to GitHub CLI
    if command -v gh &> /dev/null && gh auth status &> /dev/null; then
        print_success "Logged in to GitHub CLI"
    else
        print_warning "Not logged in to GitHub CLI. Run 'gh auth login' first."
    fi
    
    print_header "Marketplace Token Setup"
    
    echo "You need to obtain tokens from both marketplaces:"
    echo
    print_info "1. Visual Studio Marketplace Token (VSCE_PAT):"
    echo "   - Go to https://dev.azure.com"
    echo "   - Sign in with your Microsoft account"
    echo "   - User Settings > Personal Access Tokens"
    echo "   - Create token with 'Marketplace: Read & publish' scope"
    echo
    print_info "2. Open VSX Registry Token (OVSX_PAT):"
    echo "   - Go to https://open-vsx.org"
    echo "   - Sign in with your GitHub account"
    echo "   - Profile Settings > Access Tokens"
    echo "   - Generate new token"
    echo
    
    # Prompt for tokens
    read -p "Do you have both tokens ready? (y/N): " -r
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Please obtain the tokens and run this script again."
        exit 0
    fi
    
    # Set secrets using GitHub CLI
    if command -v gh &> /dev/null && gh auth status &> /dev/null; then
        print_header "Setting Repository Secrets"
        
        echo "Enter your Visual Studio Marketplace token (VSCE_PAT):"
        # shellcheck disable=SC2162
        read -s VSCE_PAT
        echo
        
        echo "Enter your Open VSX Registry token (OVSX_PAT):"
        # shellcheck disable=SC2162
        read -s OVSX_PAT
        echo
        
        # Set the secrets
        echo "$VSCE_PAT" | gh secret set VSCE_PAT
        print_success "Set VSCE_PAT secret"
        
        echo "$OVSX_PAT" | gh secret set OVSX_PAT
        print_success "Set OVSX_PAT secret"
        
        print_success "All secrets configured successfully!"
    else
        print_warning "GitHub CLI not available. Please set secrets manually:"
        echo "1. Go to your repository on GitHub"
        echo "2. Settings > Secrets and variables > Actions"
        echo "3. Add these secrets:"
        echo "   - VSCE_PAT: Your Visual Studio Marketplace token"
        echo "   - OVSX_PAT: Your Open VSX Registry token"
    fi
    
    print_header "Publisher Registration"
    print_info "Make sure your publisher 'kairiss' is registered on both marketplaces"
    print_info "If not, register at:"
    echo "- VS Code Marketplace: https://marketplace.visualstudio.com/manage"
    echo "- Open VSX Registry: https://open-vsx.org"
    
    print_header "Testing Setup"
    print_info "To test the publishing setup:"
    echo "1. Create a test tag: git tag extension-v0.0.1-test"
    echo "2. Push the tag: git push origin extension-v0.0.1-test"
    echo "3. Check GitHub Actions for the workflow execution"
    echo "4. Delete the test release and tag if successful"
    
    print_header "Ready to Publish!"
    print_success "Your extension is now ready for automated publishing!"
    print_info "See docs/PUBLISHING.md for detailed publishing instructions"
}

main "$@"
