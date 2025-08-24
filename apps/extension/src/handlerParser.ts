import * as fs from "node:fs";
import type * as ts from "typescript";

export class HandlerParser {
  constructor(private readonly ts: typeof import("typescript")) {}
  public async parseExportedFunctions(filePath: string): Promise<string[]> {
    try {
      const sourceCode = await fs.promises.readFile(filePath, "utf-8");
      const sourceFile = this.ts.createSourceFile(
        filePath,
        sourceCode,
        this.ts.ScriptTarget.Latest,
        true,
      );

      const exports: string[] = [];

      const visit = (node: ts.Node) => {
        if (this.ts.isExportAssignment(node)) {
          if (this.ts.isIdentifier(node.expression)) {
            exports.push("default");
          }
        }

        if (this.ts.isVariableStatement(node)) {
          const hasExportModifier = node.modifiers?.some(
            (modifier) => modifier.kind === this.ts.SyntaxKind.ExportKeyword,
          );

          if (hasExportModifier) {
            node.declarationList.declarations.forEach((declaration) => {
              if (this.ts.isIdentifier(declaration.name) && declaration.initializer) {
                // Only include if it's a function (arrow function or function expression)
                if (this.isFunction(declaration.initializer)) {
                  exports.push(declaration.name.text);
                }
              }
            });
          }
        }

        if (this.ts.isFunctionDeclaration(node)) {
          const hasExportModifier = node.modifiers?.some(
            (modifier) => modifier.kind === this.ts.SyntaxKind.ExportKeyword,
          );
          const hasDefaultModifier = node.modifiers?.some(
            (modifier) => modifier.kind === this.ts.SyntaxKind.DefaultKeyword,
          );

          if (hasExportModifier) {
            if (hasDefaultModifier) {
              exports.push("default");
            } else if (node.name) {
              exports.push(node.name.text);
            }
          }
        }

        this.ts.forEachChild(node, visit);
      };

      visit(sourceFile);
      return [...new Set(exports)];
    } catch (error) {
      console.error(`Error parsing TypeScript file ${filePath}:`, error);
      return [];
    }
  }

  private isFunction(node: ts.Expression): boolean {
    // Check for arrow functions: () => {}, async () => {}, etc.
    if (this.ts.isArrowFunction(node)) {
      return true;
    }

    // Check for function expressions: function() {}, async function() {}
    if (this.ts.isFunctionExpression(node)) {
      return true;
    }

    // Check for method definitions or other function-like expressions
    if (
      this.ts.isMethodDeclaration(node) ||
      this.ts.isGetAccessorDeclaration(node) ||
      this.ts.isSetAccessorDeclaration(node)
    ) {
      return true;
    }

    // Check for call expressions - but be more selective
    if (this.ts.isCallExpression(node)) {
      return this.isValidFunctionCall(node);
    }

    // Check for await expressions (like await createHandler())
    if (this.ts.isAwaitExpression(node) && this.ts.isCallExpression(node.expression)) {
      return this.isValidFunctionCall(node.expression);
    }

    // Explicitly reject new expressions (these create objects, not functions)
    if (this.ts.isNewExpression(node)) {
      return false;
    }

    // Reject conditional expressions (ternary operators) as they're usually not functions
    if (this.ts.isConditionalExpression(node)) {
      return false;
    }

    // Be conservative: reject other expressions that are likely not functions
    return false;
  }

  private isValidFunctionCall(callExpression: ts.CallExpression): boolean {
    // Allow calls that are likely to return functions (common handler patterns)
    if (this.ts.isIdentifier(callExpression.expression)) {
      const functionName = callExpression.expression.text;
      // Common function patterns that return handlers
      if (
        [
          "handle",
          "middleware",
          "withMiddleware",
          "createHandler",
          "wrap",
          "createAWSHandler",
        ].includes(functionName)
      ) {
        return true;
      }
    }

    // Check for property access calls like module.someFunction()
    if (this.ts.isPropertyAccessExpression(callExpression.expression)) {
      const propertyName = callExpression.expression.name.text;
      // Specific known handler creation patterns
      if (["handle", "handler", "create", "build", "configure"].includes(propertyName)) {
        return true;
      }
    }

    // Don't allow SST/AWS resource creation calls (these return instances, not functions)
    if (this.ts.isPropertyAccessExpression(callExpression.expression)) {
      const expressionText = callExpression.expression.getText();
      if (expressionText.includes("sst.aws.") || expressionText.includes(".get(")) {
        return false;
      }
    }

    // For other call expressions, be conservative and reject them
    return false;
  }
}
