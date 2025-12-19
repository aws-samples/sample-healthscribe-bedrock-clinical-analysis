#!/bin/bash

# Cleanup script for Asclepius
set -e

STAGE="dev"
REGION="us-east-1"
PROFILE=""

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
    --profile)
      PROFILE="$2"
      shift 2
      ;;
    *)
      echo "Unknown option $1"
      exit 1
      ;;
  esac
done

echo "🧹 Cleaning up Asclepius $STAGE environment in $REGION"

# Set AWS profile if provided
if [ ! -z "$PROFILE" ]; then
  export AWS_PROFILE=$PROFILE
fi

# Destroy infrastructure
echo "💥 Destroying infrastructure..."
cd infrastructure
cdk destroy --all --force
cd ..

echo "✅ Cleanup completed!"
