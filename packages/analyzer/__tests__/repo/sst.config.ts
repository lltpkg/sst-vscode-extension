/**
 * @warning
 * This file cannot have top level imports
 * pls use await import() to import the dependencies
 */

export default $config({
  async app(input) {
    console.log("Input stage", input.stage);
    const isProd = input.stage === "production";
    const isStg = input.stage === "staging";

    return {
      name: isProd ? "sst-prod" : "sst",
      protect: isProd,
      /**
       * Configure how your resources are handled when they have to be removed.
       * remove: Removes the underlying resource.
       * retain: Retains resources like S3 buckets and DynamoDB tables. Removes everything else.
       * retain-all: Retains all resources
       *
       * on dev, we remove all resources
       */
      // removal: input.stage === "production" ? "retain" : "remove",
      removal: isProd || isStg ? "retain" : "remove",
      home: "aws",
      providers: {
        aws: {
          region: process.env.AWS_REGION as aws.Region,
          accessKey: process.env.AWS_ACCESS_KEY,
          secretKey: process.env.AWS_SECRET_KEY,
          token: process.env.AWS_SESSION_TOKEN,
        }, // default provider with env
      },
    };
  },

  async run() {
    await import("./infra/vpc");
    await import("./infra/bucket");
    await import("./infra/lambda");
    await import("./infra/api/apiv1");
    await import("./infra/api/hono-serverless");
    await import("./infra/step-functions");
    await import("./infra/cron");
    return {};
  },
});
