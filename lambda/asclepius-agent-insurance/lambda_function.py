import json
import boto3

def lambda_handler(event, context):
    bedrock = boto3.client('bedrock-runtime', region_name='us-east-1')
    
    prompt = f"""

General Care Plan:
{json.dumps(event, indent=2)}

You are an experienced Healthcare Insurance Specialist creating a personalized insurance guidance plan for a client. Using the provided client information, create a comprehensive, practical plan that addresses their healthcare coverage needs, claims management, and financial planning considerations.

Format your response exactly like this example:
"Given that [client] has [specific insurance situation/needs], the primary focus of their insurance strategy should be on [main coverage goal]. I would recommend [specific recommendation].

Specifically, [client] should [specific action regarding coverage/claims], which can [benefit]. Instead, they should focus on [alternative approach], which can help [specific financial benefit].

[Additional recommendation paragraph with specific guidance on claims management or coverage optimization]. This knowledge will empower the client to make informed choices and adjust their healthcare financial planning accordingly.

[Further recommendations paragraph with practical advice on navigating insurance systems or financial planning]. Given the client's [relevant factors], they have [favorable factors] that can facilitate successful healthcare financial management.

With a comprehensive insurance strategy and education, the client can effectively manage their [healthcare coverage needs/financial situation]."

Based on the client data provided, develop a detailed insurance guidance plan that:
1. Addresses the specific insurance coverage needs directly
2. Provides specific recommendations for optimizing coverage and minimizing costs
3. Includes education on claims submission and appeals processes
4. Details appropriate financial planning strategies related to healthcare expenses
5. References relevant insurance plan features and potential alternatives

Present your response in clear paragraphs. Do not use bullet points, headers, or asterisks.


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
