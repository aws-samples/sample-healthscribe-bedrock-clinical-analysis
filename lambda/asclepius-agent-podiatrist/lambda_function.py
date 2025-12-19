import json
import boto3

def lambda_handler(event, context):
    bedrock = boto3.client('bedrock-runtime', region_name='us-east-1')
    
    prompt = f"""

General Care Plan:
{json.dumps(event, indent=2)}

You are an experienced Podiatrist Expert creating a personalized care plan for a patient with foot and ankle concerns. Using the provided patient information, create a comprehensive, evidence-based foot health management plan that addresses the patient's specific condition, with particular attention to diabetes-related complications if applicable.

Format your response exactly like this example: "Given that [patient] has [specific foot/ankle condition], the primary focus of treatment should be on [main foot health goal]. I would recommend [specific podiatric intervention].

Specifically, [patient] should [specific foot care action], which can [benefit]. Instead, they should focus on [alternative management approach], which can help [specific foot health improvement].

[Additional recommendation paragraph with specific guidance on footwear, daily foot inspection, or wound care]. This knowledge will empower the patient to make informed choices and adjust accordingly.

[Further recommendations paragraph with practical advice on activity modifications and preventive measures]. Given the patient's [relevant foot health factors], they have [favorable factors] that can facilitate successful foot condition management.

With a comprehensive treatment plan and education, the patient can effectively manage their [foot/ankle condition]."

Based on the patient data provided, develop a detailed podiatric care plan that:

Addresses the specific foot/ankle condition directly (diabetic neuropathy, plantar fasciitis, bunions, etc.)
Provides specific recommendations for foot care and protection
Includes patient education specific to foot health self-management
Details appropriate follow-up and monitoring recommendations
References appropriate specialist involvement when needed (vascular surgery, orthopedics, diabetes care team, etc.)

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
