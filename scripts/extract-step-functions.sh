#!/bin/bash

# Script to extract Step Functions definitions from AWS Console
set -e

echo "🔍 Extracting Step Functions from AWS Console..."

# Create directory for step functions
mkdir -p infrastructure/step-functions

# List all state machines
echo "📋 Available Step Functions state machines:"
aws stepfunctions list-state-machines --query 'stateMachines[].[name,stateMachineArn]' --output table

echo ""
echo "Enter the Step Functions state machine names you want to extract (space-separated):"
read -r state_machine_input

# Extract each state machine
for state_machine_name in $state_machine_input; do
    echo "📦 Extracting $state_machine_name..."
    
    # Get state machine ARN
    state_machine_arn=$(aws stepfunctions list-state-machines --query "stateMachines[?name=='$state_machine_name'].stateMachineArn" --output text)
    
    if [ -z "$state_machine_arn" ]; then
        echo "❌ State machine '$state_machine_name' not found"
        continue
    fi
    
    # Get state machine definition
    echo "  Getting state machine definition..."
    aws stepfunctions describe-state-machine --state-machine-arn "$state_machine_arn" --query 'definition' --output text > "infrastructure/step-functions/${state_machine_name}.json"
    
    # Get state machine configuration
    echo "  Getting state machine configuration..."
    aws stepfunctions describe-state-machine --state-machine-arn "$state_machine_arn" > "infrastructure/step-functions/${state_machine_name}-config.json"
    
    # Pretty print the JSON definition
    if command -v jq &> /dev/null; then
        jq '.' "infrastructure/step-functions/${state_machine_name}.json" > "infrastructure/step-functions/${state_machine_name}-formatted.json"
        mv "infrastructure/step-functions/${state_machine_name}-formatted.json" "infrastructure/step-functions/${state_machine_name}.json"
    fi
    
    echo "  ✅ $state_machine_name extracted"
done

echo ""
echo "🎉 Step Functions extraction complete!"
echo ""
echo "Extracted files:"
ls -la infrastructure/step-functions/
echo ""
echo "Next steps:"
echo "1. Review the extracted Step Functions definitions"
echo "2. Update any hardcoded ARNs to use CDK references"
echo "3. Update the CDK infrastructure to deploy these state machines"
