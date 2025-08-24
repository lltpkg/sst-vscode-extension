import { AsyncLocalStorage } from "node:async_hooks";
import { performance } from "node:perf_hooks";
import type { Context as AWSContext } from "aws-lambda";
import { uuidv7 } from "uuidv7";

// async local storage
export const als = {
  db: new AsyncLocalStorage(),
  logger: new AsyncLocalStorage<Console>(),
  traceId: new AsyncLocalStorage(),
};
interface HandlerFactoryOptions {
  withDb?: boolean;
  //   withRedis?: boolean;
}

// db needs to be global to avoid creating a new db client for each request
// only init if withDb was set
let db: any | null = null;

export async function createAWSHandler<TEvent = any, TResult = any>(
  options: HandlerFactoryOptions,
  handler: (event: TEvent, context: AWSContext) => Promise<TResult>,
) {
  return async (event: TEvent, awsCtx: AWSContext): Promise<TResult> => {
    const startTime = performance.now();
    const xRequestId = (event as any)?.body?.["x-request-id"] || uuidv7();

    const logger = console;
    console.error("before als run");

    als.traceId.enterWith({
      requestId: xRequestId,
      awsRequestId: awsCtx.awsRequestId,
    });
    als.logger.enterWith(logger);
    if (options.withDb) {
      db = db || {};
      als.db.enterWith(db);
    }

    try {
      logger.info({ event }, "entering aws function");
      const result = (await handler(event, awsCtx)) as any;
      logger.info(
        {
          result,
        },
        "exiting aws function",
      );

      return result;
    } catch (error) {
      logger.error({ error }, "exiting aws function with error");

      throw error;
    } finally {
      const duration = performance.now() - startTime;
      logger.info({ duration, fn: awsCtx.functionName }, "performance");
    }
  };
}
