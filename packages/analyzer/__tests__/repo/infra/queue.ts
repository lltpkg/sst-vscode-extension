const queue = new sst.aws.Queue("MyQueue");

const pathName = "details";
const pathNameWrong = "detailsSx";
queue.subscribe(`functions/${pathName}.handler`);
queue.subscribe(`functions/${pathName}x.handler`);
queue.subscribe(`functions/${pathNameWrong}x.handler`);
queue.subscribe(`functions/${pathNameWrong}.handler`);
queue.subscribe("functions/details.handler");
queue.subscribe("functions/details.handler");

new sst.aws.Function("UploadSomething2", {
  handler: `functions/details.handler`,
});

new sst.aws.Function("UploadSomething2", {
  handler: `functions/s.handler`,
});

new sst.aws.Function("UploadSomething2", {
  handler: `functions/${pathNameWrong}x.handler`,
});

new sst.aws.Cron("UploadSomething2", {
  function: `functions/${pathNameWrong}x.handler`,
  schedule: "rate(12 hours)",
});

new sst.aws.Cron("UploadSomething2", {
  function: `functions/${pathNameWrong}.handler`,
  schedule: "rate(12 hours)",
});

new sst.aws.Cron("UploadSomething2", {
  function: `functions/${pathName}.handler`,
  schedule: "rate(12 hours)",
});

new sst.aws.Cron("UploadSomething2", {
  function: "functions/details.handler2",
  schedule: "rate(12 hours)",
});
