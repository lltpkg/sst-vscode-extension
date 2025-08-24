#!/bin/bash
# script to run generate graphs of the turbo processes

# go to root of the project
echo "pwd:
    $(pwd)"
echo "make sure you are in the root of the project"

# mode=generate | check
# usage: bash scripts/gen-deps-graphs.sh generate
# usage: bash scripts/gen-deps-graphs.sh check
mode=$1

# check if mode is valid
if [ "$mode" != "generate" ] && [ "$mode" != "check" ]; then
    echo "--------------------------------"
    echo "Invalid mode! Please use 'generate' or 'check'"
    echo "Usage: "
    echo "    bash scripts/gen-deps-graphs.sh generate # generate the graphs"
    echo "    bash scripts/gen-deps-graphs.sh check # check if there are any changes"
    exit 1
fi

if [ "$mode" == "generate" ]; then
    rm -rf graphs/* # debug
    # create folder if it doesn't exist
    mkdir -p graphs

    graph_header="---
title: {{title}}
displayMode: compact
config:
    theme: forest
    look: handDrawn
    layout: elk
    elk:
        nodePlacementStrategy: SIMPLE
---
    "

    # run build graph
    pnpm exec turbo run build --graph=graphs/build.mermaid &
    pnpm exec turbo run test --graph=graphs/test.mermaid &

    wait

    # add header to the graphs
    for file in graphs/*.mermaid; do
        runner() {
            echo "$graph_header" | sed "s/{{title}}/$(basename "$file" .mermaid)/" | cat - "$file" >"$file\_tmp" && mv "$file\_tmp" "$file"
            # cat "$file"
            echo "$file"

            pnpm --package=@mermaid-js/mermaid-cli dlx mmdc -i "$file" -o "${file%.mermaid}.svg" -c .mermaidrc.json
            # rm -rf "$file"
        }
        runner &
    done
    wait

    echo "graphs generated successfully"

elif [ "$mode" == "check" ]; then
    # check if there are any changes
    if git diff --quiet graphs; then
        exit 0
    else
        echo "It seems like you have made changes to the turbo config"
        echo "Please re-generate the graphs and commit the changes"
        exit 1
    fi
fi
