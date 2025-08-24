import type * as ts from "typescript";
import type { SSTHandlerContext } from "../types";

export class ASTAnalyzer {
  constructor(protected readonly ts: typeof import("typescript")) {}
  public analyzeHandlerContexts(sourceCode: string, fileName: string): SSTHandlerContext[] {
    const sourceFile = this.ts.createSourceFile(
      fileName,
      sourceCode,
      this.ts.ScriptTarget.Latest,
      true,
    );
    const contexts: SSTHandlerContext[] = [];

    const visit = (node: ts.Node) => {
      // Check for sst.aws.Function calls
      if (this.isSSTFunctionCall(node)) {
        const context = this.extractFunctionContext(node, sourceFile);
        if (context) contexts.push(context);
      }

      // Check for sst.aws.Cron calls
      if (this.isSSTCronCall(node)) {
        const context = this.extractCronContext(node, sourceFile);
        if (context) contexts.push(context);
      }

      // Check for queue.subscribe calls
      if (this.isQueueSubscribeCall(node)) {
        const context = this.extractQueueContext(node, sourceFile);
        if (context) contexts.push(context);
      }

      // Check for bucket.notify calls
      if (this.isBucketNotifyCall(node)) {
        const bucketContexts = this.extractBucketContext(node, sourceFile);
        contexts.push(...bucketContexts);
      }

      // Check for ApiGatewayV1.route calls
      if (this.isApiGatewayV1RouteCall(node)) {
        const context = this.extractApiGatewayV1Context(node, sourceFile);
        if (context) contexts.push(context);
      }

      this.ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return contexts;
  }

  public isWithinHandlerString(
    position: number,
    contexts: SSTHandlerContext[],
  ): SSTHandlerContext | null {
    for (const context of contexts) {
      const start = context.node.getStart();
      const end = context.node.getEnd();
      if (position >= start && position <= end) {
        return context;
      }
    }
    return null;
  }

  protected isSSTFunctionCall(node: ts.Node): node is ts.NewExpression {
    if (!this.ts.isNewExpression(node)) return false;

    const expression = node.expression;
    if (!this.ts.isPropertyAccessExpression(expression)) return false;

    return this.isPropertyChain(expression, ["sst", "aws", "Function"]);
  }

  protected isSSTCronCall(node: ts.Node): node is ts.NewExpression {
    if (!this.ts.isNewExpression(node)) return false;

    const expression = node.expression;
    if (!this.ts.isPropertyAccessExpression(expression)) return false;

    return this.isPropertyChain(expression, ["sst", "aws", "Cron"]);
  }

  protected isQueueSubscribeCall(node: ts.Node): node is ts.CallExpression {
    if (!this.ts.isCallExpression(node)) return false;

    const expression = node.expression;
    if (!this.ts.isPropertyAccessExpression(expression)) return false;

    // Check for *.subscribe pattern
    return this.ts.isIdentifier(expression.name) && expression.name.text === "subscribe";
  }

  protected isApiGatewayV1RouteCall(node: ts.Node): node is ts.CallExpression {
    if (!this.ts.isCallExpression(node)) return false;

    const expression = node.expression;
    if (!this.ts.isPropertyAccessExpression(expression)) return false;

    // Check for *.route pattern
    return this.ts.isIdentifier(expression.name) && expression.name.text === "route";
  }

  protected isPropertyChain(expr: ts.PropertyAccessExpression, chain: string[]): boolean {
    const parts: string[] = [];
    let current: ts.Expression = expr;

    while (this.ts.isPropertyAccessExpression(current)) {
      parts.unshift(current.name.text);
      current = current.expression;
    }

    if (this.ts.isIdentifier(current)) {
      parts.unshift(current.text);
    }

    return parts.length === chain.length && parts.every((part, i) => part === chain[i]);
  }

  protected extractFunctionContext(
    node: ts.NewExpression,
    sourceFile: ts.SourceFile,
  ): SSTHandlerContext | null {
    const args = node.arguments;
    if (!args || args.length < 2) return null;

    const configArg = args[1];
    if (!this.ts.isObjectLiteralExpression(configArg)) return null;

    const handlerProp = configArg.properties.find(
      (prop) =>
        this.ts.isPropertyAssignment(prop) &&
        this.ts.isIdentifier(prop.name) &&
        prop.name.text === "handler",
    ) as ts.PropertyAssignment | undefined;

    if (!handlerProp) return null;

    let expectedPath: string | null = null;
    if (
      this.ts.isStringLiteral(handlerProp.initializer) ||
      this.ts.isTemplateExpression(handlerProp.initializer) ||
      this.ts.isNoSubstitutionTemplateLiteral(handlerProp.initializer)
    ) {
      expectedPath = this.extractStringValue(handlerProp.initializer, sourceFile);
    }

    return {
      type: "function",
      position: handlerProp.getStart(),
      expectedPath,
      node: handlerProp,
    };
  }

  protected extractCronContext(
    node: ts.NewExpression,
    sourceFile: ts.SourceFile,
  ): SSTHandlerContext | null {
    const args = node.arguments;
    if (!args || args.length < 2) return null;

    const configArg = args[1];
    if (!this.ts.isObjectLiteralExpression(configArg)) return null;

    const functionProp = configArg.properties.find(
      (prop) =>
        this.ts.isPropertyAssignment(prop) &&
        this.ts.isIdentifier(prop.name) &&
        prop.name.text === "function",
    ) as ts.PropertyAssignment | undefined;

    if (!functionProp) return null;

    let expectedPath: string | null = null;
    if (
      this.ts.isStringLiteral(functionProp.initializer) ||
      this.ts.isTemplateExpression(functionProp.initializer) ||
      this.ts.isNoSubstitutionTemplateLiteral(functionProp.initializer)
    ) {
      expectedPath = this.extractStringValue(functionProp.initializer, sourceFile);
    }

    return {
      type: "cron",
      position: functionProp.getStart(),
      expectedPath,
      node: functionProp,
    };
  }

  protected extractQueueContext(
    node: ts.CallExpression,
    sourceFile: ts.SourceFile,
  ): SSTHandlerContext | null {
    const args = node.arguments;
    if (!args || args.length < 1) return null;

    const handlerArg = args[0];
    let expectedPath: string | null = null;

    if (
      this.ts.isStringLiteral(handlerArg) ||
      this.ts.isTemplateExpression(handlerArg) ||
      this.ts.isNoSubstitutionTemplateLiteral(handlerArg)
    ) {
      expectedPath = this.extractStringValue(handlerArg, sourceFile);
    }

    return {
      type: "queue",
      position: handlerArg.getStart(),
      expectedPath,
      node: handlerArg,
    };
  }

  protected extractApiGatewayV1Context(
    node: ts.CallExpression,
    sourceFile: ts.SourceFile,
  ): SSTHandlerContext | null {
    const args = node.arguments;
    if (!args || args.length < 2) return null;

    // ApiGatewayV1.route(method, handler) - handler is the second argument
    const handlerArg = args[1];
    let expectedPath: string | null = null;

    if (
      this.ts.isStringLiteral(handlerArg) ||
      this.ts.isTemplateExpression(handlerArg) ||
      this.ts.isNoSubstitutionTemplateLiteral(handlerArg)
    ) {
      expectedPath = this.extractStringValue(handlerArg, sourceFile);
    }

    return {
      type: "apigatewayv1",
      position: handlerArg.getStart(),
      expectedPath,
      node: handlerArg,
    };
  }

  protected extractStringValue(node: ts.Expression, sourceFile?: ts.SourceFile): string | null {
    if (this.ts.isStringLiteral(node)) {
      return node.text;
    }

    if (this.ts.isTemplateExpression(node)) {
      // For template literals with variables like `functions/${pathName}.handler`
      let result = node.head.text;
      for (const span of node.templateSpans) {
        // Try to resolve the expression value
        const expressionValue = this.resolveExpression(span.expression, sourceFile);
        result += expressionValue || ""; // Use resolved value or empty string
        result += span.literal.text;
      }
      return result;
    }

    if (this.ts.isNoSubstitutionTemplateLiteral(node)) {
      // For simple template literals without substitutions like `functions/details.handler`
      return node.text;
    }

    return null;
  }

  protected resolveExpression(expr: ts.Expression, sourceFile?: ts.SourceFile): string | null {
    if (!sourceFile) return null;

    // Handle simple identifier variables
    if (this.ts.isIdentifier(expr)) {
      return this.resolveVariableValue(expr.text, sourceFile);
    }

    // Handle property access like obj.prop
    if (this.ts.isPropertyAccessExpression(expr)) {
      // For now, just return null - could be enhanced to resolve object properties
      return null;
    }

    // Handle string literals in expressions
    if (this.ts.isStringLiteral(expr)) {
      return expr.text;
    }

    return null;
  }

  protected resolveVariableValue(variableName: string, sourceFile: ts.SourceFile): string | null {
    let resolvedValue: string | null = null;

    const visit = (node: ts.Node) => {
      // Look for variable declarations
      if (this.ts.isVariableDeclaration(node)) {
        if (
          this.ts.isIdentifier(node.name) &&
          node.name.text === variableName &&
          node.initializer
        ) {
          if (this.ts.isStringLiteral(node.initializer)) {
            resolvedValue = node.initializer.text;
            return;
          }
        }
      }

      // Look for const assertions
      if (this.ts.isVariableStatement(node)) {
        for (const declaration of node.declarationList.declarations) {
          if (
            this.ts.isIdentifier(declaration.name) &&
            declaration.name.text === variableName &&
            declaration.initializer
          ) {
            if (this.ts.isStringLiteral(declaration.initializer)) {
              resolvedValue = declaration.initializer.text;
              return;
            }
          }
        }
      }

      this.ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return resolvedValue;
  }

  protected isBucketNotifyCall(node: ts.Node): node is ts.CallExpression {
    if (!this.ts.isCallExpression(node)) return false;

    const expression = node.expression;
    if (!this.ts.isPropertyAccessExpression(expression)) return false;

    // Check for *.notify pattern
    return this.ts.isIdentifier(expression.name) && expression.name.text === "notify";
  }

  protected extractBucketContext(
    node: ts.CallExpression,
    sourceFile: ts.SourceFile,
  ): SSTHandlerContext[] {
    const args = node.arguments;
    if (args.length === 0) return [];

    const firstArg = args[0];
    const contexts: SSTHandlerContext[] = [];

    // Pattern 1: bucket.notify("handler/path.handler")
    if (
      this.ts.isStringLiteral(firstArg) ||
      this.ts.isTemplateExpression(firstArg) ||
      this.ts.isNoSubstitutionTemplateLiteral(firstArg)
    ) {
      const expectedPath = this.extractStringValue(firstArg, sourceFile);
      return [
        {
          type: "bucket",
          position: firstArg.getStart(),
          expectedPath,
          node: firstArg,
        },
      ];
    }

    // Pattern 2: bucket.notify({ notifications: [...] })
    if (this.ts.isObjectLiteralExpression(firstArg)) {
      // Look for notifications array
      const notificationsProp = firstArg.properties.find(
        (prop) =>
          this.ts.isPropertyAssignment(prop) &&
          this.ts.isIdentifier(prop.name) &&
          prop.name.text === "notifications",
      ) as ts.PropertyAssignment | undefined;

      if (notificationsProp && this.ts.isArrayLiteralExpression(notificationsProp.initializer)) {
        // Find function property in notification objects
        for (const element of notificationsProp.initializer.elements) {
          if (this.ts.isObjectLiteralExpression(element)) {
            const functionProp = element.properties.find(
              (prop) =>
                this.ts.isPropertyAssignment(prop) &&
                this.ts.isIdentifier(prop.name) &&
                prop.name.text === "function",
            ) as ts.PropertyAssignment | undefined;

            if (functionProp) {
              let expectedPath: string | null = null;

              if (
                this.ts.isStringLiteral(functionProp.initializer) ||
                this.ts.isTemplateExpression(functionProp.initializer) ||
                this.ts.isNoSubstitutionTemplateLiteral(functionProp.initializer)
              ) {
                expectedPath = this.extractStringValue(functionProp.initializer, sourceFile);
              }

              contexts.push({
                type: "bucket",
                position: functionProp.getStart(),
                expectedPath,
                node: functionProp,
              });
            }
          }
        }
      }
    }

    return contexts;
  }
}
