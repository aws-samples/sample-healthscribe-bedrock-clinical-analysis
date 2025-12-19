#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

STAGE=${1:-dev}
REGION=${AWS_REGION:-us-east-1}

echo -e "${BLUE}🚀 Deploying Asclepius frontend to S3/CloudFront${NC}"
echo -e "   Stage: ${YELLOW}$STAGE${NC}"
echo -e "   Region: ${YELLOW}$REGION${NC}"
echo ""

# Find the CDK stack
STACK_NAME="Asclepius-$STAGE"
echo -e "${BLUE}📡 Checking CDK stack: $STACK_NAME${NC}"

# Verify stack exists
if ! aws cloudformation describe-stacks --stack-name $STACK_NAME --region $REGION >/dev/null 2>&1; then
    echo -e "${RED}❌ ERROR: CDK stack '$STACK_NAME' not found in region $REGION${NC}"
    echo -e "   Please deploy the CDK stack first:"
    echo -e "   ${YELLOW}cd infrastructure && ./deploy.sh $STAGE --certificate-arn <your-cert-arn>${NC}"
    exit 1
fi

echo -e "${GREEN}✅ CDK stack found${NC}"

# Get stack outputs
echo -e "${BLUE}📋 Fetching stack outputs...${NC}"

FRONTEND_BUCKET=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' \
    --output text)

DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
    --output text)

CLOUDFRONT_DOMAIN=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDomainName`].OutputValue' \
    --output text)

# Get WebSocket endpoint from CDK output (uses custom domain if configured)
WEBSOCKET_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`WebSocketEndpoint`].OutputValue' \
    --output text)

# Get Cognito configuration from CDK outputs
USER_POOL_ID=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
    --output text)

USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' \
    --output text)

IDENTITY_POOL_ID=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`IdentityPoolId`].OutputValue' \
    --output text)

# Validate outputs
if [ -z "$FRONTEND_BUCKET" ] || [ "$FRONTEND_BUCKET" == "None" ]; then
    echo -e "${RED}❌ ERROR: Could not find FrontendBucketName output${NC}"
    echo -e "   Make sure you've deployed the updated CDK stack with S3/CloudFront resources"
    exit 1
fi

if [ -z "$DISTRIBUTION_ID" ] || [ "$DISTRIBUTION_ID" == "None" ]; then
    echo -e "${RED}❌ ERROR: Could not find CloudFrontDistributionId output${NC}"
    exit 1
fi

if [ -z "$WEBSOCKET_ENDPOINT" ] || [ "$WEBSOCKET_ENDPOINT" == "None" ]; then
    echo -e "${RED}❌ ERROR: Could not find WebSocketEndpoint output${NC}"
    echo -e "   Make sure you've deployed the updated CDK stack"
    exit 1
fi

if [ -z "$USER_POOL_ID" ] || [ "$USER_POOL_ID" == "None" ]; then
    echo -e "${RED}❌ ERROR: Could not find UserPoolId output${NC}"
    echo -e "   Make sure you've deployed the updated CDK stack with Cognito resources"
    exit 1
fi

echo -e "${GREEN}✅ Stack outputs retrieved:${NC}"
echo -e "   Frontend Bucket: ${YELLOW}$FRONTEND_BUCKET${NC}"
echo -e "   Distribution ID: ${YELLOW}$DISTRIBUTION_ID${NC}"
echo -e "   CloudFront Domain: ${YELLOW}$CLOUDFRONT_DOMAIN${NC}"
echo -e "   WebSocket Endpoint: ${YELLOW}$WEBSOCKET_ENDPOINT${NC}"
echo ""

# Generate .env file with Vite variables
echo -e "${BLUE}📝 Generating .env file...${NC}"

cat > .env << EOF
VITE_WEBSOCKET_ENDPOINT=$WEBSOCKET_ENDPOINT
VITE_AWS_REGION=$REGION
VITE_PATIENT_TABLE=asclepius-patient-$STAGE
VITE_VISIT_TABLE=asclepius-visit-$STAGE
VITE_VISIT_DATA_TABLE=asclepius-visit-data-$STAGE
VITE_TRANSCRIPT_TABLE=asclepius-transcript-$STAGE
EOF

echo -e "${GREEN}✅ .env file generated${NC}"

# Generate amplify_outputs.json from CDK outputs
echo -e "${BLUE}📝 Generating Cognito configuration...${NC}"

cat > amplify_outputs.json << EOF
{
  "auth": {
    "user_pool_id": "$USER_POOL_ID",
    "aws_region": "$REGION",
    "user_pool_client_id": "$USER_POOL_CLIENT_ID",
    "identity_pool_id": "$IDENTITY_POOL_ID",
    "mfa_methods": [],
    "standard_required_attributes": [
      "email"
    ],
    "username_attributes": [
      "email"
    ],
    "user_verification_types": [
      "email"
    ],
    "groups": [],
    "mfa_configuration": "NONE",
    "password_policy": {
      "min_length": 8,
      "require_lowercase": true,
      "require_numbers": true,
      "require_symbols": true,
      "require_uppercase": true
    },
    "unauthenticated_identities_enabled": true
  },
  "version": "1.4"
}
EOF

echo -e "${GREEN}✅ Cognito configuration generated${NC}"

# Build the frontend
echo -e "${BLUE}📦 Building React application...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ ERROR: Frontend build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build completed${NC}"

# Upload to S3
echo -e "${BLUE}📤 Uploading to S3 bucket: $FRONTEND_BUCKET${NC}"
aws s3 sync dist/ s3://$FRONTEND_BUCKET --delete --region $REGION

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ ERROR: S3 upload failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Files uploaded to S3${NC}"

# Invalidate CloudFront cache
echo -e "${BLUE}🔄 Invalidating CloudFront cache...${NC}"
INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id $DISTRIBUTION_ID \
    --paths "/*" \
    --query 'Invalidation.Id' \
    --output text)

echo -e "${GREEN}✅ CloudFront invalidation created: $INVALIDATION_ID${NC}"

# Final output
echo ""
echo -e "${GREEN}🎉 Frontend deployment completed successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Access your application:${NC}"
echo -e "   CloudFront URL: ${YELLOW}https://$CLOUDFRONT_DOMAIN${NC}"
echo -e "   WebSocket Endpoint: ${YELLOW}$WEBSOCKET_ENDPOINT${NC}"
echo ""
echo -e "${BLUE}💡 Next steps:${NC}"
echo -e "   1. Test authentication and functionality"
echo -e "   2. Verify WebSocket connections work"
echo -e "   3. Check AI agent responses"
echo -e "   4. Environment variables are now in .env file"
echo ""