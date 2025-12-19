# Asclepius Healthcare AI System - Infrastructure Deployment

This directory contains the AWS CDK infrastructure code for deploying the complete Asclepius Healthcare AI System.

## 🏥 System Overview

Asclepius is a sophisticated healthcare AI system featuring:
- **20 Lambda Functions**: Core pipeline + 12 specialist AI agents
- **Step Functions Workflows**: Complex multi-agent orchestration
- **Real-time Audio Processing**: WebSocket streaming with HealthScribe
- **Knowledge Base**: OpenSearch domain for medical context
- **Secure Architecture**: VPC, DynamoDB, ECS with HTTPS/WSS

## 📋 Prerequisites

### Required: Container Runtime
Since Asclepius uses ECS with container images, you need a container runtime:

#### Option 1: Finch (Recommended - AWS's open-source tool)
```bash
# Install Finch
brew install finch

# Initialize and start Finch VM
finch vm init
finch vm start

# Verify installation
finch version
finch ps
```

#### Option 2: Docker Desktop
```bash
# Install Docker Desktop
brew install --cask docker

# Start Docker Desktop and verify
docker --version
docker ps
```

### Required: SSL Certificate
Since Asclepius uses AWS HealthScribe API which requires HTTPS, you **MUST** provide an SSL certificate.

#### Option 1: Request Certificate from AWS Certificate Manager
```bash
# Request a certificate for your domain
aws acm request-certificate \
    --domain-name yourdomain.com \
    --validation-method DNS \
    --region us-east-1

# List certificates to get the ARN
aws acm list-certificates --region us-east-1
```

#### Option 2: Import Existing Certificate
```bash
aws acm import-certificate \
    --certificate fileb://certificate.pem \
    --private-key fileb://private-key.pem \
    --region us-east-1
```

#### Option 3: Use Self-Signed for Development
```bash
# Generate self-signed certificate (development only)
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
aws acm import-certificate --certificate fileb://cert.pem --private-key fileb://key.pem
```

### Required: AWS CLI and CDK
```bash
# Install AWS CDK
npm install -g aws-cdk

# Configure AWS credentials
aws configure
```

## 🚀 Deployment

### Basic Deployment (Development)
```bash
# Deploy to development environment
./deploy.sh dev --certificate-arn arn:aws:acm:us-east-1:123456789:certificate/your-cert-id
```

### Production Deployment with Custom Domain
```bash
# Deploy to production with custom domain
./deploy.sh prod \
    --certificate-arn arn:aws:acm:us-east-1:123456789:certificate/your-cert-id \
    --domain-name api.yourdomain.com \
    --region us-west-2
```

### Deployment Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `stage` | No | Environment stage (dev/prod). Default: `dev` |
| `--certificate-arn` | **Yes** | ACM certificate ARN for HTTPS/WSS |
| `--domain-name` | No | Custom domain name. Uses ALB DNS if not provided |
| `--region` | No | AWS region. Default: `us-east-1` |

## 📊 Stack Outputs

After deployment, the stack provides these outputs:

- **WebSocketEndpoint**: WSS endpoint for frontend configuration
- **LoadBalancerDNS**: ALB DNS name
- **VpcId**: VPC ID for reference
- **VisitDataTableName**: DynamoDB table name
- **OpenSearchDomainEndpoint**: Knowledge base endpoint
- **MainWorkflowArn**: Step Functions workflow ARN

## 🔧 Post-Deployment Configuration

### 1. Configure DNS (if using custom domain)
```bash
# Point your domain to the ALB DNS name
# Example: api.yourdomain.com -> Asclepius-dev-123456789.us-east-1.elb.amazonaws.com
```

### 2. Update Frontend Configuration
```bash
# Get the WebSocket endpoint from stack outputs
WEBSOCKET_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name Asclepius-dev \
    --query 'Stacks[0].Outputs[?OutputKey==`WebSocketEndpoint`].OutputValue' \
    --output text)

# Configure Amplify environment variable
amplify env update --envName dev --config "REACT_APP_WEBSOCKET_ENDPOINT=$WEBSOCKET_ENDPOINT"
amplify push
```

## 🏗️ Architecture Components

### Core Infrastructure
- **VPC**: Multi-AZ with public/private subnets
- **ALB**: Application Load Balancer with HTTPS/WSS support
- **ECS**: Fargate cluster for backend services
- **DynamoDB**: Visit data storage with encryption
- **OpenSearch**: Medical knowledge base

### AI Pipeline
- **Lambda Functions**: 20 functions including specialist agents
- **Step Functions**: Complex workflow orchestration
- **IAM Roles**: Least-privilege security model

### Networking
- **Security Groups**: Restricted access patterns
- **NAT Gateway**: Outbound internet for private subnets
- **Route Tables**: Proper traffic routing

## 🔍 Troubleshooting

### Container Runtime Issues
```bash
# Check if Finch is running
finch version
finch ps

# If Finch VM is not started
finch vm start

# Check if Docker is running
docker --version
docker ps

# Manually set container runtime for CDK
export CDK_DOCKER=finch  # or 'docker'
```

### Log Group Conflicts
The CDK stack now automatically manages log groups with proper removal policies. If you still encounter "already exists" errors:

```bash
# Clean up specific log group
aws logs delete-log-group --log-group-name "/aws/lambda/asclepius-agent-podiatrist-dev"

# Clean up all Asclepius log groups
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/asclepius" \
  --query 'logGroups[].logGroupName' --output text | \
  xargs -I {} aws logs delete-log-group --log-group-name {}
```

### Failed Stack Recovery
```bash
# Check stack status
aws cloudformation describe-stacks --stack-name Asclepius-dev

# If stack is in ROLLBACK_COMPLETE or failed state
aws cloudformation delete-stack --stack-name Asclepius-dev
aws cloudformation wait stack-delete-complete --stack-name Asclepius-dev

# Then retry deployment
./deploy.sh dev --certificate-arn <your-cert-arn>
```

### Certificate Issues
```bash
# Verify certificate exists and is valid
aws acm describe-certificate --certificate-arn your-cert-arn

# Check certificate validation status
aws acm list-certificates --certificate-statuses ISSUED
```

### Deployment Failures
```bash
# Check CloudFormation events
aws cloudformation describe-stack-events --stack-name Asclepius-dev

# View CDK diff before deployment
npx cdk diff Asclepius-dev --parameters CertificateArn=your-cert-arn
```

### WebSocket Connection Issues
1. Verify certificate is valid and trusted
2. Check ALB security groups allow port 443
3. Ensure ECS tasks are healthy
4. Verify frontend uses correct WSS endpoint

## 🧹 Cleanup

```bash
# Destroy the stack (be careful in production!)
npx cdk destroy Asclepius-dev --force
```

## 📞 Support

For issues with deployment or configuration, check:
1. AWS CloudFormation console for stack events
2. ECS console for service health
3. ALB target group health checks
4. Lambda function logs in CloudWatch

---

**Note**: This system handles sensitive healthcare data. Ensure compliance with HIPAA and other relevant regulations in your deployment.
