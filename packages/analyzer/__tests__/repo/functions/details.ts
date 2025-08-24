import type { APIGatewayProxyResult } from "aws-lambda";
import { createAWSHandler } from "../lib/handler-factory";

export const handler = await createAWSHandler(
  { withDb: false },
  async (event, _context): Promise<APIGatewayProxyResult> => {
    const body = {
      message: "Hello live (hot reload)",
      event,
    };
    const result = {
      statusCode: 200,
      body: JSON.stringify(body),
    };
    return result;
  },
);

export const handler2 = await createAWSHandler(
  { withDb: false },
  async (event, _context): Promise<APIGatewayProxyResult> => {
    const body = {
      message: "Hello live (hot reload)",
      event,
    };
    const result = {
      statusCode: 200,
      body: JSON.stringify(body),
    };
    return result;
  },
);
