import type { APIGatewayProxyResult } from "aws-lambda";
import { createAWSHandler } from "../lib/handler-factory";

export const handler = await createAWSHandler(
  {
    withDb: true,
  },
  async (_event, _context): Promise<APIGatewayProxyResult> => {
    return {};
  },
);
