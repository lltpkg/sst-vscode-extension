import { als, createAWSHandler } from "../lib/handler-factory";

export const handler = await createAWSHandler(
  {
    withDb: false,
  },
  async (event: { body: string }, context) => {
    const logger = als.logger.getStore()!;
    logger.info(
      "invoke-multi-steps 444: this is a long time as a test for the long and to see if it wraps and here cool wow",
    );
    return {
      statusCode: 200,
      body: `good invoke-multi-steps here .` + event.body + context.awsRequestId,
      event,
    };
  },
);
