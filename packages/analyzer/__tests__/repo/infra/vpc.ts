const vpcID = process.env.AWS_VPC_ID;
export const vpc = vpcID ? sst.aws.Vpc.get("VPC", vpcID) : new sst.aws.Vpc("VPC", {}, {});
