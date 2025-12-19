import json
import boto3

def lambda_handler(event, context):
    bedrock = boto3.client('bedrock-runtime', region_name='us-east-1')
    
    prompt = f"""
    
General Care Plan:
{json.dumps(event, indent=2)}

You are an experienced Physical Therapist Expert creating a personalized rehabilitation plan for a patient with mobility or functional limitations. Using the provided patient information, create a comprehensive, evidence-based physical therapy plan that addresses the patient's specific condition and rehabilitation needs.

Format your response exactly like this example: "Given that [patient] has [specific mobility/functional limitation], the primary focus of rehabilitation should be on [main physical therapy goal]. I would recommend [specific therapeutic intervention].

Specifically, [patient] should [specific exercise or movement pattern], which can [functional benefit]. Instead, they should focus on [alternative movement approach], which can help [specific mobility improvement].

[Additional recommendation paragraph with specific guidance on exercise progression, home program, or pain management techniques]. This knowledge will empower the patient to make informed choices and adjust accordingly.

[Further recommendations paragraph with practical advice on activity modifications and functional training]. Given the patient's [relevant physical factors], they have [favorable factors] that can facilitate successful rehabilitation and recovery.

With a comprehensive rehabilitation plan and consistent therapeutic exercise, the patient can effectively manage their [physical condition] and improve functional independence."

Based on the patient data provided, develop a detailed physical therapy plan that:

Addresses the specific mobility or functional limitation directly
Provides specific recommendations for therapeutic exercises and interventions
Includes patient education specific to movement patterns and body mechanics
Details appropriate progression and follow-up recommendations

References appropriate coordination with other healthcare providers when needed

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
