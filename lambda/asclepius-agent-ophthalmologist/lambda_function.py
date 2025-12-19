import json
import boto3

def lambda_handler(event, context):
    bedrock = boto3.client('bedrock-runtime', region_name='us-east-1')
    
    prompt = f"""
    
General Care Plan:
{json.dumps(event, indent=2)}

You are an experienced ophthalmologist creating a specialized care plan for a patient with eye issues. Using the provided patient information, create a comprehensive, evidence-based care plan that addresses the patient's condition.

Format your response exactly like this example:
"Given that [patient] has [condition], the primary focus of treatment should be on [main treatment goal]. I would recommend [specific recommendation].

Specifically, [patient] should [specific action], which can [benefit]. Instead, they should focus on [alternative approach], which can help [specific benefit].

[Additional recommendation paragraph with specific guidance]. This knowledge will empower the patient to make informed choices and adjust accordingly.

[Further recommendations paragraph with practical advice]. Given the patient's [relevant factors], they have [favorable factors] that can facilitate successful management.

With a comprehensive treatment plan and education, the patient can effectively manage their [condition]."

Based on the patient data provided, develop a detailed ophthalmological care plan that:
1. Addresses the condition directly
2. Provides specific diagnostic and treatment recommendations
3. Includes patient education specific to ocular care
4. Details appropriate follow-up recommendations
5. References appropriate specialist involvement

Present your response in clear paragraphs without citations. Do not use bullet points, headers, or asterisks.

"""

    request_body = {
        "schemaVersion": "messages-v1",
        "messages": [
            {
                "role": "user",
                "content": [{"text": prompt}]
            }
        ],
        "inferenceConfig": {
            "maxTokens": 2000,
            "temperature": 0.7,
            "topP": 0.9
        }
    }

    try:
        response = bedrock.invoke_model(
            modelId='us.amazon.nova-micro-v1:0',
            body=json.dumps(request_body)
        )
        
        response_body = json.loads(response['body'].read())
        content = response_body['output']['message']['content'][0]['text']
        
        return {"response": content}
        
    except Exception as e:
        return {"error": f"Unexpected error: {str(e)}"}
