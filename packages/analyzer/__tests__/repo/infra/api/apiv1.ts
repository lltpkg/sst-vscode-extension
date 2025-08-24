/**
 * Descipe serverless api gateway
 */
export const ApiGatewayV1 = new sst.aws.ApiGatewayV1("MOMOS_ApiGatewayV1");
ApiGatewayV1.route("GET /", "functions/upload.handler");
ApiGatewayV1.route("POST /", "functions/upload.handler");
ApiGatewayV1.route("PATCH /", "functions/xx.handler");
ApiGatewayV1.route("PATCH /", `functions/ss.handler`);
ApiGatewayV1.route("PATCH /", `functions/${"upload"}.handler`);

ApiGatewayV1.deploy();
