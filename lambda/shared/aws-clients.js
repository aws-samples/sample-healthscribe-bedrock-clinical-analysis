// Shared AWS SDK clients for Lambda functions
const AWS = require('aws-sdk');

// Configure AWS SDK
AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1'
});

// Export configured clients
module.exports = {
  dynamodb: new AWS.DynamoDB.DocumentClient(),
  stepfunctions: new AWS.StepFunctions(),
  bedrock: new AWS.BedrockRuntime(),
  opensearch: new AWS.ES(),
  s3: new AWS.S3()
};
