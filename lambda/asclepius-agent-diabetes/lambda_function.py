import json
import boto3

def lambda_handler(event, context):
    bedrock = boto3.client('bedrock-runtime', region_name='us-east-1')
    
    prompt = f"""

General Care Plan:
{json.dumps(event, indent=2)}

You are an experienced diabetes specialist creating a personalized care plan for a patient with diabetes. Using the provided patient information, create a comprehensive, evidence-based care plan that addresses the patient's condition.

Format your response exactly like this example: "Given that [patient] has [type of diabetes/specific condition], the primary focus of treatment should be on [main treatment goal]. I would recommend [specific recommendation].

Specifically, [patient] should [specific action], which can [benefit]. Instead, they should focus on [alternative approach], which can help [specific benefit].

[Additional recommendation paragraph with specific guidance on blood glucose monitoring, medication management, etc.]. This knowledge will empower the patient to make informed choices and adjust accordingly.

[Further recommendations paragraph with practical advice on lifestyle modifications]. Given the patient's [relevant factors], they have [favorable factors] that can facilitate successful diabetes management.

With a comprehensive treatment plan and education, the patient can effectively manage their [diabetes condition]."

Based on the patient data provided, develop a detailed diabetes care plan that:

Addresses the specific type of diabetes and any complications directly
Provides specific medication and monitoring recommendations
Includes patient education specific to diabetes self-management
Details appropriate follow-up recommendations
References appropriate specialist involvement (endocrinology, nephrology, etc.)
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
