#!/bin/bash

# Asclepius CDK Setup Script
set -e

echo "🏗️  Setting up Asclepius CDK Infrastructure..."

# Check if CDK is installed
if ! command -v cdk &> /dev/null; then
    echo "Installing AWS CDK..."
    npm install -g aws-cdk
fi

# Create infrastructure directory
echo "📁 Creating infrastructure directory..."
mkdir -p infrastructure
cd infrastructure

# Initialize CDK project
echo "🚀 Initializing CDK project..."
cdk init app --language typescript

# Install required CDK modules
echo "📦 Installing CDK dependencies..."
npm install \
    @aws-cdk/aws-ecs \
    @aws-cdk/aws-ecs-patterns \
    @aws-cdk/aws-ec2 \
    @aws-cdk/aws-stepfunctions \
    @aws-cdk/aws-stepfunctions-tasks \
    @aws-cdk/aws-lambda \
    @aws-cdk/aws-lambda-nodejs \
    @aws-cdk/aws-dynamodb \
    @aws-cdk/aws-iam \
    @aws-cdk/aws-ecr \
    @aws-cdk/aws-ecr-assets \
    @aws-cdk/aws-logs \
    @aws-cdk/aws-applicationautoscaling \
    @aws-cdk/aws-opensearch

# Create environment configuration template
echo "⚙️  Creating configuration templates..."
cat > config/environments.ts << 'EOF'
export interface EnvironmentConfig {
  account?: string;
  region: string;
  stage: string;
  
  // Application settings
  appName: string;
  containerPort: number;
  
  // ECS settings
  ecsClusterName: string;
  ecsServiceName: string;
  taskCpu: number;
  taskMemory: number;
  desiredCount: number;
  
  // DynamoDB settings
  dynamoTables: {
    [key: string]: {
      partitionKey: string;
      sortKey?: string;
      gsiConfigs?: Array<{
        indexName: string;
        partitionKey: string;
        sortKey?: string;
      }>;
    };
  };
  
  // Lambda settings
  lambdaRuntime: string;
  lambdaTimeout: number;
  lambdaMemory: number;
  
  // Bedrock settings
  bedrockModels: string[];
  
  // OpenSearch settings
  openSearchConfig: {
    domainName: string;
    version: string;
    instanceType: string;
    instanceCount: number;
    volumeSize: number;
    volumeType: string;
    dedicatedMasterEnabled: boolean;
    masterInstanceType?: string;
    masterInstanceCount?: number;
  };
}

export const environments: { [key: string]: EnvironmentConfig } = {
  dev: {
    region: 'us-east-1',
    stage: 'dev',
    appName: 'asclepius',
    containerPort: 3000,
    ecsClusterName: 'asclepius-cluster',
    ecsServiceName: 'asclepius-service',
    taskCpu: 512,
    taskMemory: 1024,
    desiredCount: 1,
    dynamoTables: {
      // Add your table configurations here
      patients: {
        partitionKey: 'patientId',
        sortKey: 'timestamp'
      }
    },
    lambdaRuntime: 'nodejs18.x',
    lambdaTimeout: 300,
    lambdaMemory: 512,
    bedrockModels: ['anthropic.claude-v2'],
    openSearchConfig: {
      domainName: 'asclepius-knowledge-base',
      version: 'OpenSearch_2.3',
      instanceType: 't3.small.search',
      instanceCount: 1,
      volumeSize: 20,
      volumeType: 'gp3',
      dedicatedMasterEnabled: false
    }
  },
  prod: {
    region: 'us-east-1',
    stage: 'prod',
    appName: 'asclepius',
    containerPort: 3000,
    ecsClusterName: 'asclepius-cluster',
    ecsServiceName: 'asclepius-service',
    taskCpu: 1024,
    taskMemory: 2048,
    desiredCount: 2,
    dynamoTables: {
      patients: {
        partitionKey: 'patientId',
        sortKey: 'timestamp'
      }
    },
    lambdaRuntime: 'nodejs18.x',
    lambdaTimeout: 300,
    lambdaMemory: 1024,
    bedrockModels: ['anthropic.claude-v2'],
    openSearchConfig: {
      domainName: 'asclepius-knowledge-base',
      version: 'OpenSearch_2.3',
      instanceType: 'm6g.large.search',
      instanceCount: 2,
      volumeSize: 100,
      volumeType: 'gp3',
      dedicatedMasterEnabled: true,
      masterInstanceType: 'm6g.medium.search',
      masterInstanceCount: 3
    }
  }
};
EOF

mkdir -p config

echo "✅ CDK setup complete!"
echo ""
echo "Next steps:"
echo "1. Complete the infrastructure audit (infrastructure-audit.md)"
echo "2. Update config/environments.ts with your actual configuration"
echo "3. Run 'cd infrastructure && cdk bootstrap' to prepare your AWS account"
echo "4. Define your infrastructure stacks"
echo ""
echo "To get started:"
echo "cd infrastructure"
echo "npm run build"
echo "cdk bootstrap"
