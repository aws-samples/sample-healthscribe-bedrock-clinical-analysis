#!/bin/bash

# Asclepius CDK Deployment Script
set -e

# Initialize default values
STAGE="dev"
REGION="us-east-1"
CERTIFICATE_ARN=""
DOMAIN_NAME=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --stage)
      STAGE="$2"
      shift 2
      ;;
    --region)
      REGION="$2"
      shift 2
      ;;
    --certificate-arn)
      CERTIFICATE_ARN="$2"
      shift 2
      ;;
    --domain-name)
      DOMAIN_NAME="$2"
      shift 2
      ;;
    *)
      # If it's the first positional argument, treat as stage
      if [ -z "$STAGE_SET" ]; then
        STAGE="$1"
        STAGE_SET=true
      # If it's the second positional argument, treat as region  
      elif [ -z "$REGION_SET" ]; then
        REGION="$1"
        REGION_SET=true
      fi
      shift
      ;;
  esac
done

echo "🚀 Deploying Asclepius Healthcare AI System"
echo "   Stage: $STAGE"
echo "   Region: $REGION"
echo "   Certificate ARN: ${CERTIFICATE_ARN:-'Not provided'}"
echo "   Domain Name: ${DOMAIN_NAME:-'Will use ALB DNS'}"
echo ""

# Configure container runtime for CDK
if command -v finch &> /dev/null; then
    echo "🐳 Using Finch as container runtime"
    export CDK_DOCKER=finch
elif command -v docker &> /dev/null; then
    echo "🐳 Using Docker as container runtime"
    export CDK_DOCKER=docker
else
    echo "❌ ERROR: No container runtime found"
    echo "   Please install either Finch or Docker:"
    echo "   - Finch (recommended): brew install finch"
    echo "   - Docker Desktop: brew install --cask docker"
    exit 1
fi

# Validate required certificate
if [ -z "$CERTIFICATE_ARN" ]; then
    echo "❌ ERROR: Certificate ARN is required for HealthScribe HTTPS support"
    echo ""
    echo "📋 To get a certificate:"
    echo "   1. Request from ACM: aws acm request-certificate --domain-name yourdomain.com"
    echo "   2. List certificates: aws acm list-certificates"
    echo "   3. Use the ARN in deployment:"
    echo ""
    echo "Usage: $0 [stage] [--certificate-arn <arn>] [--domain-name <domain>] [--region <region>]"
    echo ""
    echo "Examples:"
    echo "  $0 dev --certificate-arn arn:aws:acm:us-east-1:123456789:certificate/abc123"
    echo "  $0 prod --certificate-arn arn:aws:acm:us-east-1:123456789:certificate/abc123 --domain-name api.yourdomain.com"
    echo "  $0 --stage dev --certificate-arn arn:aws:acm:us-east-1:123456789:certificate/abc123 --region us-west-2"
    exit 1
fi

# Build the CDK project
echo "📦 Building CDK project..."
npm run build

# Bootstrap CDK if needed (only run once per account/region)
echo "🔧 Checking CDK bootstrap..."
if ! aws cloudformation describe-stacks --stack-name CDKToolkit --region $REGION > /dev/null 2>&1; then
    echo "   Bootstrapping CDK for region $REGION..."
    npx cdk bootstrap --region $REGION
else
    echo "   CDK already bootstrapped for region $REGION"
fi

# Prepare deployment parameters
DEPLOY_PARAMS="--context stage=$STAGE --context region=$REGION"
DEPLOY_PARAMS="$DEPLOY_PARAMS --parameters CertificateArn=$CERTIFICATE_ARN"

if [ -n "$DOMAIN_NAME" ]; then
    DEPLOY_PARAMS="$DEPLOY_PARAMS --parameters DomainName=$DOMAIN_NAME"
fi

# Deploy the stack
echo "🏗️  Deploying Asclepius stack..."
echo "   Parameters: Certificate ARN provided, Domain: ${DOMAIN_NAME:-'ALB DNS'}"
npx cdk deploy Asclepius-$STAGE \
    $DEPLOY_PARAMS \
    --require-approval never

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Stack outputs:"
aws cloudformation describe-stacks \
    --stack-name Asclepius-$STAGE \
    --region $REGION \
    --query 'Stacks[0].Outputs' \
    --output table

echo ""
echo "🎉 Asclepius Healthcare AI System is now deployed!"
echo "   Stack: Asclepius-$STAGE"
echo "   Region: $REGION"
echo ""
echo "📝 Next Steps:"
echo "   Deploy frontend!"