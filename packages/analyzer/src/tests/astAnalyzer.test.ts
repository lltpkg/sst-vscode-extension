import * as ts from "typescript";
import { beforeEach, describe, expect, it } from "vitest";
import { ASTAnalyzer } from "../lib/astAnalyzer";

describe("ASTAnalyzer", () => {
  let analyzer: ASTAnalyzer;

  beforeEach(() => {
    analyzer = new ASTAnalyzer(ts);
  });

  describe("analyzeHandlerContexts", () => {
    it("should detect SST Function handler", () => {
      const sourceCode = `
        import * as sst from "sst/constructs";
        
        const api = new sst.aws.Function("GenCsv", {
          handler: "functions/gen-csv.handler"
        });
      `;

      const contexts = analyzer.analyzeHandlerContexts(sourceCode, "test.ts");

      expect(contexts).toHaveLength(1);
      expect(contexts[0]).toMatchObject({
        type: "function",
        expectedPath: "functions/gen-csv.handler",
      });
    });

    it("should detect SST Cron handler", () => {
      const sourceCode = `
        import * as sst from "sst/constructs";
        
        const cron = new sst.aws.Cron("MyCron", {
          schedule: "rate(1 hour)",
          function: "functions/cron-job.handler"
        });
      `;

      const contexts = analyzer.analyzeHandlerContexts(sourceCode, "test.ts");

      expect(contexts).toHaveLength(1);
      expect(contexts[0]).toMatchObject({
        type: "cron",
        expectedPath: "functions/cron-job.handler",
      });
    });

    it("should detect Queue subscribe handler", () => {
      const sourceCode = `
        import * as sst from "sst/constructs";
        
        const queue = new sst.aws.Queue("MyQueue");
        queue.subscribe("functions/queue-processor.handler");
      `;

      const contexts = analyzer.analyzeHandlerContexts(sourceCode, "test.ts");

      expect(contexts).toHaveLength(1);
      expect(contexts[0]).toMatchObject({
        type: "queue",
        expectedPath: "functions/queue-processor.handler",
      });
    });

    it("should detect Bucket notify handler", () => {
      const sourceCode = `
        import * as sst from "sst/constructs";
        
        const bucket = new sst.aws.Bucket("MyBucket");
        bucket.notify("functions/bucket-handler.handler");
      `;

      const contexts = analyzer.analyzeHandlerContexts(sourceCode, "test.ts");

      expect(contexts).toHaveLength(1);
      expect(contexts[0]).toMatchObject({
        type: "bucket",
        expectedPath: "functions/bucket-handler.handler",
      });
    });

    it("should detect Bucket notify with notifications array", () => {
      const sourceCode = `
        import * as sst from "sst/constructs";
        
        const bucket = new sst.aws.Bucket("MyBucket");
        bucket.notify({
          notifications: [
            {
              name: "Handler1",
              function: "functions/handler1.handler"
            },
            {
              name: "Handler2", 
              function: "functions/handler2.handler"
            }
          ]
        });
      `;

      const contexts = analyzer.analyzeHandlerContexts(sourceCode, "test.ts");

      expect(contexts).toHaveLength(2);
      expect(contexts[0]).toMatchObject({
        type: "bucket",
        expectedPath: "functions/handler1.handler",
      });
      expect(contexts[1]).toMatchObject({
        type: "bucket",
        expectedPath: "functions/handler2.handler",
      });
    });

    it("should handle template literals with variables", () => {
      const sourceCode = `
        import * as sst from "sst/constructs";
        
        const pathName = "details";
        const queue = new sst.aws.Queue("MyQueue");
        queue.subscribe(\`functions/\${pathName}.handler\`);
      `;

      const contexts = analyzer.analyzeHandlerContexts(sourceCode, "test.ts");

      expect(contexts).toHaveLength(1);
      expect(contexts[0]).toMatchObject({
        type: "queue",
        expectedPath: "functions/details.handler",
      });
    });

    it("should handle nested template literal variables", () => {
      const sourceCode = `
        import * as sst from "sst/constructs";
        
        const basePath = "functions";
        const handlerName = "processor";
        const api = new sst.aws.Function("GenCsv", {
          handler: \`\${basePath}/\${handlerName}.handler\`
        });
      `;

      const contexts = analyzer.analyzeHandlerContexts(sourceCode, "test.ts");

      expect(contexts).toHaveLength(1);
      expect(contexts[0]).toMatchObject({
        type: "function",
        expectedPath: "functions/processor.handler",
      });
    });

    it("should detect multiple handlers in same file", () => {
      const sourceCode = `
        import * as sst from "sst/constructs";
        
        const api = new sst.aws.Function("GenCsv", {
          handler: "functions/gen-csv.handler"
        });
        
        const cron = new sst.aws.Cron("MyCron", {
          schedule: "rate(1 hour)",
          function: "functions/cron-job.handler"
        });
        
        const queue = new sst.aws.Queue("MyQueue");
        queue.subscribe("functions/queue-processor.handler");
      `;

      const contexts = analyzer.analyzeHandlerContexts(sourceCode, "test.ts");

      expect(contexts).toHaveLength(3);
      expect(contexts.map((c) => c.type)).toEqual(["function", "cron", "queue"]);
    });
  });

  describe("isWithinHandlerString", () => {
    it("should detect cursor within string literal", () => {
      const sourceCode = `
        const api = new sst.aws.Function("GenCsv", {
          handler: "functions/gen-csv.handler"
        });
      `;

      const contexts = analyzer.analyzeHandlerContexts(sourceCode, "test.ts");
      const position = sourceCode.indexOf("gen-csv") + 3; // Middle of "gen-csv"

      const result = analyzer.isWithinHandlerString(position, contexts);
      expect(result).toBeTruthy();
      expect(result?.type).toBe("function");
    });

    it("should detect cursor within template literal", () => {
      const sourceCode = `
        const pathName = "details";
        queue.subscribe(\`functions/\${pathName}.handler\`);
      `;

      const contexts = analyzer.analyzeHandlerContexts(sourceCode, "test.ts");
      const position = sourceCode.indexOf("functions/") + 5; // Middle of "functions/"

      const result = analyzer.isWithinHandlerString(position, contexts);
      expect(result).toBeTruthy();
      expect(result?.type).toBe("queue");
    });

    it("should return null when cursor is outside handler string", () => {
      const sourceCode = `
        const api = new sst.aws.Function("GenCsv", {
          handler: "functions/gen-csv.handler"
        });
      `;

      const contexts = analyzer.analyzeHandlerContexts(sourceCode, "test.ts");
      const position = sourceCode.indexOf("GenCsv") + 2; // Inside constructor name

      const result = analyzer.isWithinHandlerString(position, contexts);
      expect(result).toBeNull();
    });
  });

  describe("ApiGatewayV1 Route handlers", () => {
    it("should detect ApiGatewayV1 route handler", () => {
      const sourceCode = `
        export const ApiGatewayV1 = new sst.aws.ApiGatewayV1("ApiGatewayV1");
        ApiGatewayV1.route("GET /", "functions/upload.handler");
      `;

      const contexts = analyzer.analyzeHandlerContexts(sourceCode, "test.ts");

      expect(contexts).toHaveLength(1);
      expect(contexts[0]).toMatchObject({
        type: "apigatewayv1",
        expectedPath: "functions/upload.handler",
      });
    });

    it("should detect multiple ApiGatewayV1 routes", () => {
      const sourceCode = `
        export const ApiGatewayV1 = new sst.aws.ApiGatewayV1("ApiGatewayV1");
        ApiGatewayV1.route("GET /", "functions/upload.handler");
        ApiGatewayV1.route("POST /users", "functions/users.create");
        ApiGatewayV1.route("DELETE /users/:id", "functions/users.delete");
      `;

      const contexts = analyzer.analyzeHandlerContexts(sourceCode, "test.ts");

      expect(contexts).toHaveLength(3);
      expect(contexts[0]).toMatchObject({
        type: "apigatewayv1",
        expectedPath: "functions/upload.handler",
      });
      expect(contexts[1]).toMatchObject({
        type: "apigatewayv1",
        expectedPath: "functions/users.create",
      });
      expect(contexts[2]).toMatchObject({
        type: "apigatewayv1",
        expectedPath: "functions/users.delete",
      });
    });

    it("should handle template literals in ApiGatewayV1 routes", () => {
      const sourceCode = `
        const pathName = "details";
        export const ApiGatewayV1 = new sst.aws.ApiGatewayV1("ApiGatewayV1");
        ApiGatewayV1.route("GET /api", \`functions/\${pathName}.handler\`);
      `;

      const contexts = analyzer.analyzeHandlerContexts(sourceCode, "test.ts");

      expect(contexts).toHaveLength(1);
      expect(contexts[0]).toMatchObject({
        type: "apigatewayv1",
        expectedPath: "functions/details.handler",
      });
    });

    it("should handle variable substitution in ApiGatewayV1 template literals", () => {
      const sourceCode = `
        const serviceName = "upload";
        const handlerName = "process";
        export const ApiGatewayV1 = new sst.aws.ApiGatewayV1("ApiGatewayV1");
        ApiGatewayV1.route("POST /upload", \`functions/\${serviceName}.\${handlerName}\`);
      `;

      const contexts = analyzer.analyzeHandlerContexts(sourceCode, "test.ts");

      expect(contexts).toHaveLength(1);
      expect(contexts[0]).toMatchObject({
        type: "apigatewayv1",
        expectedPath: "functions/upload.process",
      });
    });

    it("should ignore ApiGatewayV1 routes with insufficient arguments", () => {
      const sourceCode = `
        export const ApiGatewayV1 = new sst.aws.ApiGatewayV1("ApiGatewayV1");
        ApiGatewayV1.route("GET /"); // Missing handler argument
      `;

      const contexts = analyzer.analyzeHandlerContexts(sourceCode, "test.ts");

      expect(contexts).toHaveLength(0);
    });

    it("should handle different variable names for ApiGatewayV1", () => {
      const sourceCode = `
        export const myApi = new sst.aws.ApiGatewayV1("CustomApi");
        export const anotherGateway = new sst.aws.ApiGatewayV1("AnotherApi");
        
        myApi.route("GET /health", "functions/health.check");
        anotherGateway.route("POST /webhook", "functions/webhook.handle");
      `;

      const contexts = analyzer.analyzeHandlerContexts(sourceCode, "test.ts");

      expect(contexts).toHaveLength(2);
      expect(contexts[0]).toMatchObject({
        type: "apigatewayv1",
        expectedPath: "functions/health.check",
      });
      expect(contexts[1]).toMatchObject({
        type: "apigatewayv1",
        expectedPath: "functions/webhook.handle",
      });
    });
  });
});
