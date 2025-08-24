#!/bin/bash
set -euo pipefail
# prepare script for development environment
# install recommended extensions, husky git hook, and update extensions

function setup_husky() {
    pnpm exec husky || echo "ignored husky git hook setup"
}
function setup_shellcheck() {
    brew install shellcheck || echo "ignored shellcheck installation"
}

function install_recommended_extensions() {
    export ELECTRON_RUN_AS_NODE=1
    local recommended_extensions=(
        esbenp.prettier-vscode
        biomejs.biome
        streetsidesoftware.code-spell-checker
        timonwong.shellcheck
        extensions/sst-vsc-ext-0.0.1.vsix
    )
    local has_vscode=false
    local has_cursor=false
    if command -v code >/dev/null 2>&1; then
        has_vscode=true
        echo "vscode is installed"
    elif command -v cursor >/dev/null 2>&1; then
        has_cursor=true
        echo "cursor is installed"
    fi
    for extension in "${recommended_extensions[@]}"; do
        # must have at least one of code or cursor installed
        if ! $has_vscode && ! $has_cursor; then
            echo "Error: vscode or cursor is not installed"
            exit 0 # not fatal
        fi

        # install extension, prefer cursor
        # check if it's a local file path (contains .vsix)
        if [[ "$extension" == *.vsix ]]; then
            if [ -f "$extension" ]; then
                echo "Installing local extension: $extension"
                # remove .vsix, and -version from extension id
                # shellcheck disable=SC2155
                local extension_id="undefined_publisher.$(basename "$extension" .vsix | sed 's/-[0-9.]*$//')"
                if $has_cursor; then
                    cursor --uninstall-extension "$extension_id" || true
                    cursor --install-extension "$extension" --force
                elif $has_vscode; then
                    code --uninstall-extension "$extension_id" || true
                    code --install-extension "$extension" --force
                fi
            else
                echo "Warning: Local extension file not found: $extension"
            fi
        else
            # marketplace extension
            if $has_cursor; then
                cursor --install-extension "$extension"
            elif $has_vscode; then
                code --install-extension "$extension"
            fi
        fi
    done

    # update extensions, not need to wait for it
    if $has_cursor; then
        cursor --update-extensions &>/dev/null &
    elif $has_vscode; then
        code --update-extensions &>/dev/null &
    fi
    # wait for extensions to be installed
    wait
}
function main() {

    if [ "$(uname -m)" == "arm64" ] && [ -z "${CI:-}" ]; then
        # if arch is macos arm64 and not env.CI, run install recommended extensions

        # running in parallel
        install_recommended_extensions &
        setup_husky &
        setup_shellcheck &
        wait
    fi

}

main
