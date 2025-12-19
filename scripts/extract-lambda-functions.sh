#!/bin/bash

# Script to extract Lambda functions from AWS Console to local project
set -e

echo "🔍 Extracting Lambda functions from AWS Console..."

# Create lambda directory if it doesn't exist
mkdir -p lambda

# Function to extract a single Lambda function
extract_lambda() {
    local function_name=$1
    local target_dir="lambda/$function_name"
    
    echo "📦 Extracting $function_name..."
    
    # Create target directory
    mkdir -p "$target_dir"
    
    # Get function configuration
    echo "  Getting function configuration..."
    aws lambda get-function-configuration --function-name "$function_name" > "$target_dir/config.json"
    
    # Get function code
    echo "  Downloading function code..."
    local download_url=$(aws lambda get-function --function-name "$function_name" --query 'Code.Location' --output text)
    
    # Download and extract code
    curl -s "$download_url" -o "$target_dir/function.zip"
    cd "$target_dir"
    unzip -q function.zip
    rm function.zip
    cd - > /dev/null
    
    # Create package.json if it doesn't exist
    if [ ! -f "$target_dir/package.json" ]; then
        echo "  Creating package.json..."
        cat > "$target_dir/package.json" << EOF
{
  "name": "$function_name",
  "version": "1.0.0",
  "description": "Lambda function extracted from AWS Console",
  "main": "index.js",
  "dependencies": {
    "aws-sdk": "^2.1400.0"
  }
}
EOF
    fi
    
    echo "  ✅ $function_name extracted to $target_dir"
}

# List all Lambda functions and let user select which ones to extract
echo "📋 Available Lambda functions:"
aws lambda list-functions --query 'Functions[].FunctionName' --output table

echo ""
echo "Enter the Lambda function names you want to extract (space-separated):"
echo "Or type 'all' to extract all functions:"
read -r function_input

if [ "$function_input" = "all" ]; then
    # Extract all functions
    functions=$(aws lambda list-functions --query 'Functions[].FunctionName' --output text)
else
    functions=$function_input
fi

# Extract each function
for func in $functions; do
    extract_lambda "$func"
done

echo ""
echo "🎉 Lambda function extraction complete!"
echo ""
echo "Next steps:"
echo "1. Review the extracted code in the lambda/ directory"
echo "2. Update any hardcoded values to use environment variables"
echo "3. Test the functions locally if needed"
echo "4. Update the CDK infrastructure to deploy these functions"
