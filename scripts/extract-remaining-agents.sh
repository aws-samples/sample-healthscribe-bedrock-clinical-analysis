#!/bin/bash

# Script to extract remaining specialist agent Lambda functions
set -e

echo "🔍 Extracting remaining specialist agent Lambda functions..."

# List of remaining agents to extract
agents=(
    "asclepius-agent-allergies"
    "asclepius-agent-insurance"
    "asclepius-agent-ophthalmologist"
    "asclepius-agent-podiatrist"
    "asclepius-agent-hospital-care-team"
    "asclepius-agent-ada"
    "asclepius-agent-social-determinants"
    "asclepius-agent-physical-therapist"
)

# Function to extract a single agent
extract_agent() {
    local agent_name=$1
    local target_dir="lambda/$agent_name"
    
    echo "📦 Extracting $agent_name..."
    
    # Create target directory
    mkdir -p "$target_dir"
    cd "$target_dir"
    
    # Get function code and extract
    aws lambda get-function --function-name "$agent_name" --query 'Code.Location' --output text | xargs curl -s -o function.zip
    
    if [ -f function.zip ]; then
        unzip -q function.zip
        rm function.zip
        
        # Create package.json
        cat > package.json << EOF
{
  "name": "$agent_name",
  "version": "1.0.0",
  "description": "Specialist healthcare agent for $agent_name",
  "main": "lambda_function.py",
  "runtime": "python3.9",
  "dependencies": {
    "boto3": "^1.26.0"
  },
  "handler": "lambda_function.lambda_handler"
}
EOF
        
        echo "  ✅ $agent_name extracted successfully"
    else
        echo "  ❌ Failed to download $agent_name"
    fi
    
    cd - > /dev/null
}

# Extract each agent
for agent in "${agents[@]}"; do
    extract_agent "$agent"
done

echo ""
echo "🎉 Specialist agent extraction complete!"
echo ""
echo "Extracted agents:"
find lambda -name "asclepius-agent-*" -type d | sort
