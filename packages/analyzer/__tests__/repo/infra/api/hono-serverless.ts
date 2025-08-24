/// <reference path="../../env.d.ts" />

/**
 * Descipe serverless api gateway
 */
export const HonoServerlessBucket = new sst.aws.Bucket("HonoServerlessBucket");
export const HonoServerlessFunction = new sst.aws.Function("Hono", {
  url: true,
  link: [HonoServerlessBucket],
  handler: "functions/hono-serverless.handler",
});
