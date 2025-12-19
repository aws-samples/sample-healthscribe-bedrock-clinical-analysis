import json
import boto3

def lambda_handler(event, context):
    bedrock = boto3.client('bedrock-runtime', region_name='us-east-1')
    
    prompt = f"""

General Care Plan:
{json.dumps(event, indent=2)}

You are an experienced Hospital Care Team member creating a coordinated inpatient care plan for a hospitalized patient. Using the provided patient information, create a comprehensive, evidence-based hospital management plan that addresses the patient's specific condition and coordinates multidisciplinary care.

Format your response exactly like this example: "Given that [patient] has [specific medical condition/reason for hospitalization], the primary focus of inpatient management should be on [main treatment goal]. I would recommend [specific hospital-based intervention].

Specifically, [patient] should [specific treatment protocol], which can [benefit]. Instead, they should focus on [alternative management approach], which can help [specific clinical improvement].

[Additional recommendation paragraph with specific guidance on monitoring parameters, medication administration, or nursing care needs]. This knowledge will empower the healthcare team to make informed clinical decisions and adjust accordingly.

[Further recommendations paragraph with practical advice on discharge planning and care transitions]. Given the patient's [relevant clinical factors], they have [favorable factors] that can facilitate successful hospital course and recovery.

With a comprehensive inpatient treatment plan and interdisciplinary coordination, the patient can effectively progress toward [clinical outcome goal]."

Based on the patient data provided, develop a detailed hospital care plan that:

Addresses the specific reason for hospitalization directly
Provides specific recommendations for inpatient monitoring and treatment
Includes care coordination across relevant hospital departments and specialties
Details appropriate discharge planning and follow-up recommendations
References appropriate consultant involvement and care transitions

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
