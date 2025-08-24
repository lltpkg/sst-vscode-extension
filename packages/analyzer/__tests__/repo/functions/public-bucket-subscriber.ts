import { createAWSHandler } from "../lib/handler-factory";

export const handler = await createAWSHandler(
  {
    withDb: false,
  },
  async () => {
    console.log("public bucket subscriber");
  },
);
