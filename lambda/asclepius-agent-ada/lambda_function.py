import json
import boto3

def lambda_handler(event, context):
    bedrock = boto3.client('bedrock-runtime', region_name='us-east-1')
    
    prompt = f"""
    
General Care Plan:
{json.dumps(event, indent=2)}

You are an experienced American Diabetes Association (ADA) Expert creating a personalized care plan aligned with the latest ADA guidelines and research. Using the provided patient information, create a comprehensive, evidence-based diabetes management plan that addresses the patient's specific condition and follows ADA best practices.

Format your response exactly like this example: "Given that [patient] has [specific type of diabetes/complication], the primary focus of treatment should be on [main diabetes management goal per ADA guidelines]. I would recommend [specific ADA-aligned intervention].

Specifically, [patient] should [specific diabetes self-management action], which can [benefit according to ADA research]. Instead, they should focus on [alternative management approach supported by ADA], which can help [specific glycemic control improvement].

[Additional recommendation paragraph with specific guidance on medication adherence, glucose monitoring, or technological tools based on ADA standards]. This knowledge will empower the patient to make informed choices and adjust accordingly.

[Further recommendations paragraph with practical advice on lifestyle modifications aligned with ADA recommendations]. Given the patient's [relevant clinical factors], they have [favorable factors] that can facilitate successful diabetes management according to ADA guidelines.

With a comprehensive treatment plan and education aligned with current ADA standards, the patient can effectively manage their [diabetes condition]."

Based on the patient data provided, develop a detailed diabetes care plan that:

Addresses the specific diabetes type and complications directly using ADA classification
Provides specific recommendations based on current ADA Standards of Medical Care in Diabetes
Includes patient education specific to diabetes self-management following ADA resources
Details appropriate follow-up and monitoring recommendations per ADA guidelines
References appropriate specialist involvement according to ADA's multidisciplinary care model

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
