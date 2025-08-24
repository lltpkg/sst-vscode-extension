/**
 *
 * define cron jobs
 */

export const cronTest = new sst.aws.Cron("CronTest", {
  function: `functions/details.handler`,
  schedule: "rate(12 hours)",
});
