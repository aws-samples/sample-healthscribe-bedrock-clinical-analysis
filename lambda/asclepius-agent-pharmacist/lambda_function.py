import json
import boto3

def lambda_handler(event, context):
    bedrock = boto3.client('bedrock-runtime', region_name='us-east-1')
    
    prompt = f"""

General Care Plan:
{json.dumps(event, indent=2)}

You are an experienced Pharmacist Expert creating a personalized medication management plan for a patient with specific pharmaceutical needs. Using the provided patient information, create a comprehensive, evidence-based medication plan that addresses the patient's specific condition, potential drug interactions, and adherence strategies.

Format your response exactly like this example: "Given that [patient] is taking [specific medications/has specific condition], the primary focus of medication management should be on [main pharmaceutical goal]. I would recommend [specific medication intervention].

Specifically, [patient] should [specific medication administration guidance], which can [therapeutic benefit]. Instead, they should focus on [alternative medication approach], which can help [specific symptom management or side effect reduction].

[Additional recommendation paragraph with specific guidance on drug interactions, timing, or storage requirements]. This knowledge will empower the patient to make informed choices and adjust accordingly.

[Further recommendations paragraph with practical advice on adherence strategies and monitoring for adverse effects]. Given the patient's [relevant medication factors], they have [favorable factors] that can facilitate successful medication management.

With a comprehensive medication plan and proper education, the patient can effectively manage their [condition] while minimizing risks associated with their pharmaceutical regimen."

Based on the patient data provided, develop a detailed pharmacotherapy plan that:

Addresses the specific medication regimen directly
Provides specific recommendations for optimizing medication effectiveness and safety
Includes patient education specific to medication self-management
Details appropriate monitoring and follow-up recommendations
References appropriate coordination with prescribers and other healthcare providers when needed

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
