import { ASTAnalyzer } from "sst-analyzer";
import { beforeEach, describe, expect, it } from "vitest";

describe("ASTAnalyzer", () => {
  let analyzer: ASTAnalyzer;

  beforeEach(() => {
    analyzer = new ASTAnalyzer();
  });

  it("should detect SST Function handler contexts", () => {
    const sourceCode = `
      new sst.aws.Function("TestFunc", {
        handler: "functions/upload.handler",
        runtime: "nodejs18.x"
      });
    `;

    const contexts = analyzer.analyzeHandlerContexts(sourceCode, "test.ts");

    expect(contexts).toHaveLength(1);
    expect(contexts[0].type).toBe("function");
    expect(contexts[0].expectedPath).toBe("functions/upload.handler");
  });

  it("should detect SST Cron handler contexts", () => {
    const sourceCode = `
      export const cronTest = new sst.aws.Cron("CronTest", {
        function: "functions/details.handler",
        schedule: "rate(12 hours)",
      });
    `;

    const contexts = analyzer.analyzeHandlerContexts(sourceCode, "test.ts");

    expect(contexts).toHaveLength(1);
    expect(contexts[0].type).toBe("cron");
    expect(contexts[0].expectedPath).toBe("functions/details.handler");
  });

  it("should detect Queue subscribe contexts", () => {
    const sourceCode = `
      const queue = new sst.aws.Queue("MyQueue");
      queue.subscribe("src/subscriber.handler");
    `;

    const contexts = analyzer.analyzeHandlerContexts(sourceCode, "test.ts");

    expect(contexts).toHaveLength(1);
    expect(contexts[0].type).toBe("queue");
    expect(contexts[0].expectedPath).toBe("src/subscriber.handler");
  });

  it("should handle template literals in Cron function property", () => {
    const sourceCode = `
      new sst.aws.Cron("CronTest", {
        function: \`functions/details.handler\`,
        schedule: "rate(12 hours)",
      });
    `;

    const contexts = analyzer.analyzeHandlerContexts(sourceCode, "test.ts");

    expect(contexts).toHaveLength(1);
    expect(contexts[0].type).toBe("cron");
    expect(contexts[0].expectedPath).toBe("functions/details.handler");
  });

  it("should return empty array for non-SST code", () => {
    const sourceCode = `
      const someFunction = () => {
        console.log("hello");
      };
    `;

    const contexts = analyzer.analyzeHandlerContexts(sourceCode, "test.ts");

    expect(contexts).toHaveLength(0);
  });

  it("should detect multiple handler contexts in same file", () => {
    const sourceCode = `
      new sst.aws.Function("Func1", {
        handler: "functions/func1.handler"
      });
      
      new sst.aws.Cron("Cron1", {
        function: "functions/cron1.handler",
        schedule: "rate(1 hour)"
      });
      
      const queue = new sst.aws.Queue("Queue1");
      queue.subscribe("functions/queue1.handler");
    `;

    const contexts = analyzer.analyzeHandlerContexts(sourceCode, "test.ts");

    expect(contexts).toHaveLength(3);
    expect(contexts[0].type).toBe("function");
    expect(contexts[1].type).toBe("cron");
    expect(contexts[2].type).toBe("queue");
  });

  it("should detect bucket notification handler contexts", () => {
    const sourceCode = `
      publicBucket.notify({
        notifications: [
          {
            name: "MyPublicBucketSubscriber",
            function: "functions/public-bucket-subscriber.handler",
          },
        ],
      });
    `;

    const contexts = analyzer.analyzeHandlerContexts(sourceCode, "test.ts");

    expect(contexts).toHaveLength(1);
    expect(contexts[0].type).toBe("bucket");
    expect(contexts[0].expectedPath).toBe("functions/public-bucket-subscriber.handler");
  });

  it("should handle bucket notifications with template literals", () => {
    const sourceCode = `
      publicBucket.notify({
        notifications: [
          {
            name: "MyPublicBucketSubscriber",
            function: \`functions/bucket-subscriber.handler\`,
          },
        ],
      });
    `;

    const contexts = analyzer.analyzeHandlerContexts(sourceCode, "test.ts");

    expect(contexts).toHaveLength(1);
    expect(contexts[0].type).toBe("bucket");
    expect(contexts[0].expectedPath).toBe("functions/bucket-subscriber.handler");
  });

  it("should resolve template literal variables", () => {
    const sourceCode = `
      const pathName = "details";
      new sst.aws.Function("test", {
        handler: \`functions/\${pathName}.handler\`,
      });
    `;

    const contexts = analyzer.analyzeHandlerContexts(sourceCode, "test.ts");
    expect(contexts).toHaveLength(1);
    expect(contexts[0].type).toBe("function");
    expect(contexts[0].expectedPath).toBe("functions/details.handler");
  });

  it("should resolve template literal variables in queue subscribe", () => {
    const sourceCode = `
      const pathName = "upload";
      queue.subscribe(\`functions/\${pathName}.handler\`);
    `;

    const contexts = analyzer.analyzeHandlerContexts(sourceCode, "test.ts");
    expect(contexts).toHaveLength(1);
    expect(contexts[0].type).toBe("queue");
    expect(contexts[0].expectedPath).toBe("functions/upload.handler");
  });

  it("should handle multiple variables in template literals", () => {
    const sourceCode = `
      const dir = "functions";
      const file = "details";
      const func = "handler";
      new sst.aws.Function("test", {
        handler: \`\${dir}/\${file}.\${func}\`,
      });
    `;

    const contexts = analyzer.analyzeHandlerContexts(sourceCode, "test.ts");
    expect(contexts).toHaveLength(1);
    expect(contexts[0].type).toBe("function");
    expect(contexts[0].expectedPath).toBe("functions/details.handler");
  });

  it("should resolve template literal variables in Cron handlers", () => {
    const sourceCode = `
      const pathName = "cleanup";
      new sst.aws.Cron("dailyCleanup", {
        schedule: "rate(1 day)",
        function: \`functions/\${pathName}.handler\`,
      });
    `;

    const contexts = analyzer.analyzeHandlerContexts(sourceCode, "test.ts");
    expect(contexts).toHaveLength(1);
    expect(contexts[0].type).toBe("cron");
    expect(contexts[0].expectedPath).toBe("functions/cleanup.handler");
  });

  it("should resolve template literal variables in Bucket notifications", () => {
    const sourceCode = `
      const pathName = "processor";
      publicBucket.notify({
        notifications: [
          {
            function: \`functions/\${pathName}.handler\`,
          },
        ],
      });
    `;

    const contexts = analyzer.analyzeHandlerContexts(sourceCode, "test.ts");
    expect(contexts).toHaveLength(1);
    expect(contexts[0].type).toBe("bucket");
    expect(contexts[0].expectedPath).toBe("functions/processor.handler");
  });

  it("should handle mixed static and variable template literals", () => {
    const sourceCode = `
      const fileName = "upload";
      new sst.aws.Function("test1", {
        handler: \`functions/\${fileName}.handler\`,
      });
      
      new sst.aws.Cron("test2", {
        schedule: "rate(1 hour)",
        function: "functions/static.handler",
      });
      
      queue.subscribe(\`functions/\${fileName}.processor\`);
    `;

    const contexts = analyzer.analyzeHandlerContexts(sourceCode, "test.ts");
    expect(contexts).toHaveLength(3);

    // Function with variable
    expect(contexts[0].type).toBe("function");
    expect(contexts[0].expectedPath).toBe("functions/upload.handler");

    // Cron with static string
    expect(contexts[1].type).toBe("cron");
    expect(contexts[1].expectedPath).toBe("functions/static.handler");

    // Queue with variable
    expect(contexts[2].type).toBe("queue");
    expect(contexts[2].expectedPath).toBe("functions/upload.processor");
  });
});
