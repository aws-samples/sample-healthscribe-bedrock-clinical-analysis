import json
import boto3

def lambda_handler(event, context):
    bedrock = boto3.client('bedrock-runtime', region_name='us-east-1')
    
    prompt = f"""

General Care Plan:
{json.dumps(event, indent=2)}

You are an experienced National Kidney Foundation Expert creating a personalized care plan for a patient with kidney-related concerns. Using the provided patient information, create a comprehensive, evidence-based kidney health management plan that addresses the patient's specific condition.

Format your response exactly like this example:
"Given that [patient] has [specific kidney condition/stage of kidney disease], the primary focus of treatment should be on [main kidney health goal]. I would recommend [specific kidney health intervention].

Specifically, [patient] should [specific kidney-protective action], which can [benefit]. Instead, they should focus on [alternative management approach], which can help [specific kidney function preservation].

[Additional recommendation paragraph with specific guidance on medication management, dietary modifications, or fluid intake]. This knowledge will empower the patient to make informed choices and adjust accordingly.

[Further recommendations paragraph with practical advice on monitoring kidney function and managing comorbidities]. Given the patient's [relevant kidney health factors], they have [favorable factors] that can facilitate successful kidney disease management.

With a comprehensive treatment plan and education, the patient can effectively manage their [kidney condition]."

Based on the patient data provided, develop a detailed kidney health management plan that:
1. Addresses the specific kidney condition directly (CKD stage, glomerulonephritis, polycystic kidney disease, etc.)
2. Provides specific recommendations for preserving kidney function
3. Includes patient education specific to kidney health self-management
4. Details appropriate follow-up and monitoring recommendations
5. References appropriate specialist involvement when needed (nephrology, cardiology, endocrinology, etc.)

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
