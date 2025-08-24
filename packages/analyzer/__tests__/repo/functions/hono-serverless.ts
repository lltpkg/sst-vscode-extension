import { Hono } from "hono";
import { handle } from "hono/aws-lambda";

const app = new Hono();

app.route("/api/demo", (c) => c.json({ message: "Hello World" }));

export const handler = handle(app);
