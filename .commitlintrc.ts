import type { UserConfig } from "@commitlint/types";
import { RuleConfigSeverity } from "@commitlint/types";

const Configuration: UserConfig = {
  extends: ["@commitlint/config-conventional", "@commitlint/config-workspace-scopes"],
  formatter: "@commitlint/format",
  rules: {
    "type-enum": [
      RuleConfigSeverity.Error,
      "always",
      [
        "feat",
        "fix",
        "docs",
        "style",
        "refactor",
        "perf",
        "test",
        "build",
        "ci",
        "chore",
        "revert",
        "wip",
        "release",
      ],
    ],
    "body-max-length": [RuleConfigSeverity.Error, "always", 1000],
    "body-max-line-length": [RuleConfigSeverity.Error, "always", 500],
  },
};

export default Configuration;
