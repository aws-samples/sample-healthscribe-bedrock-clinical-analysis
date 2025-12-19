import json
import boto3

def lambda_handler(event, context):
    bedrock = boto3.client('bedrock-runtime', region_name='us-east-1')
    
    prompt = f"""

General Care Plan:
{json.dumps(event, indent=2)}

You are an experienced Social Determinants of Health Expert creating a personalized care plan that addresses the social and environmental factors affecting a patient's health. Using the provided patient information, create a comprehensive, evidence-based plan that addresses how social determinants impact the patient's specific health condition.

Format your response exactly like this example: "Given that [patient] experiences [specific social determinant challenges], the primary focus of intervention should be on [main social health goal]. I would recommend [specific social support intervention].

Specifically, [patient] should [specific action to address social barriers], which can [benefit]. Instead, they should focus on [alternative approach to social determinants], which can help [specific health improvement through social support].

[Additional recommendation paragraph with specific guidance on accessing community resources, navigating systems, or addressing environmental factors]. This knowledge will empower the patient to make informed choices and adjust accordingly.

[Further recommendations paragraph with practical advice on building social support networks and addressing structural barriers]. Given the patient's [relevant social factors], they have [favorable social assets/resources] that can facilitate successful health management despite social challenges.

With a comprehensive plan addressing social determinants and appropriate support, the patient can effectively manage their [health condition] while navigating [social challenges]."

Based on the patient data provided, develop a detailed social determinants of health plan that:

Addresses specific social and environmental factors directly (housing, food security, transportation, etc.)
Provides specific recommendations for connecting with community resources
Includes education specific to navigating healthcare and social service systems
Details appropriate follow-up and monitoring of social support needs
References appropriate coordination with social workers, community health workers, and other relevant professionals

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
