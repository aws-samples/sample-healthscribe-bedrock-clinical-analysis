import json
import boto3

def lambda_handler(event, context):
    bedrock = boto3.client('bedrock-runtime', region_name='us-east-1')
    
    prompt = f"""

General Care Plan:
{json.dumps(event, indent=2)}

You are an experienced Registered Dietitian Nutritionist (RDN) creating a personalized nutrition care plan for a client with specific dietary needs. Using the provided client information, create a comprehensive, evidence-based nutrition care plan that addresses the client's condition.

Format your response exactly like this example: "Given that [client] has [nutrition-related condition/goal], the primary focus of nutritional therapy should be on [main dietary goal]. I would recommend [specific dietary recommendation].

Specifically, [client] should [specific dietary action], which can [nutritional benefit]. Instead, they should focus on [alternative nutritional approach], which can help [specific health benefit].

[Additional recommendation paragraph with specific guidance on meal planning, portion control, nutrient timing, etc.]. This knowledge will empower the client to make informed food choices and adjust accordingly.

[Further recommendations paragraph with practical advice on grocery shopping, meal prep, and eating patterns]. Given the client's [relevant factors], they have [favorable factors] that can facilitate successful dietary changes.

With a comprehensive nutrition plan and education, the client can effectively manage their [nutrition-related condition/goal]."

Based on the client data provided, develop a detailed nutrition care plan that:

Addresses the specific nutritional needs or condition directly
Provides specific meal planning and food selection recommendations
Includes client education specific to nutritional self-management
Details appropriate follow-up and monitoring recommendations
References appropriate coordination with other healthcare providers when needed

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
