#!/bin/bash
set -euo pipefail
# shellcheck disable=SC2207
list_files_bash=($(find . -type f -name "*.bash" -not -path "**/node_modules/**" -not -path "**/.sst/**" -not -path "**/_/**"))
# shellcheck disable=SC2207
list_files_sh=($(find . -type f -name "*.sh" -not -path "**/node_modules/**" -not -path "**/.sst/**" -not -path "**/_/**"))
# shellcheck disable=SC2207
list_files_husky=($(find .husky -maxdepth 1 -type f))

list_files=("${list_files_bash[@]}" "${list_files_sh[@]}" "${list_files_husky[@]}")

printf "\t%s\n" "${list_files[@]}"
# shellcheck disable=SC2068
(shellcheck -a -x --rcfile=.shellcheckrc ${list_files[@]} && echo "ShellCheck passed ✅") || (echo "ShellCheck failed ❌" && exit 1)
