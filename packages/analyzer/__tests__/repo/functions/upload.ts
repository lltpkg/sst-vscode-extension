import type { APIGatewayProxyResult } from "aws-lambda";
import { createAWSHandler } from "../lib/handler-factory";

export const handler = await createAWSHandler(
  {
    withDb: true,
  },
  async (event, context): Promise<APIGatewayProxyResult> => {
    return {};
  },
);
