/**
 * define lambda functions
 */

/**
 * Not need to export, once loaded, it will be created as a lambda
 */
new sst.aws.Function("UploadSomething", {
  handler: "functions/upload.handler",
});

/**
 * we DO NEED export his lambda, since it used as an entrypoint for step functions
 */
export const InvokeMultiStepsFunction = new sst.aws.Function("InvokeMultiSteps", {
  handler: "functions/invoke-multi-steps.handler",
});

new sst.aws.Function("UploadSomething2", {
  handler: `functions/details.handler`,
});

new sst.aws.Function("UploadSomething2", {
  handler: `functions/s.handler`,
});

new sst.aws.Function("UploadSomething2", {
  handler: `functions/s.handler`,
});
