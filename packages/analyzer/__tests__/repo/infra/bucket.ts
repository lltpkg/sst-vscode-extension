export const publicBucket = new sst.aws.Bucket("MyPublicBucket", {
  access: "public",
});

publicBucket.notify({
  notifications: [
    {
      name: "MyPublicBucketSubscriber", //
      function: "functions/hono-serverless.handler", //validated
    },
    {
      name: "MyPublicBucketSubscriber2",
      function: "functions/hono-serverless.handler", //not validated
    },
    {
      name: "MyPublicBucketSubscriber2",
      function: `functions/hono-serverless.handler`, //not validated
    },
    {
      name: "MyPublicBucketSubscriber2",
      function: `functions/hosno-${"serverless"}.handler`, //not validated
    },
    {
      name: "MyPublicBucketSubscriber2",
      function: `functions/`, //not validated
    },
    {
      name: "MyPublicBucketSubscriber3",
      function: "infra/bucket.publicBucket", //not validated
    },
    {
      name: "MyPublicBucketSubscriber4",
      function: "infra/vpc.vpc", //not validated, it is a class instance
    },
  ],
});
