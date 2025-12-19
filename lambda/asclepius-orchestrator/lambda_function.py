import json
import boto3
import os

## Takes care plan as input and invokes NOVA to determine which of 12 healthcare experts should be consulted. Returns JSON with reasoning.

def lambda_handler(event, context):
    print("Received event:", json.dumps(event, indent=2))
    
    # Use environment variable for region
    region = os.environ.get('AWS_REGION', 'us-east-1')
    bedrock_runtime = boto3.client('bedrock-runtime', region_name=region)
    
    # Extract the care plan from the event
    care_plan = event.get('carePlan', {})
    print("Extracted care plan:", json.dumps(care_plan, indent=2))
    
    required_experts = analyze_expert_needs(bedrock_runtime, care_plan)
    
    result = {
        "requiredExperts": required_experts,
        "status": "success"
    }
    
    print("Required Experts:", json.dumps(required_experts, indent=2))
    return result

def analyze_expert_needs(bedrock_runtime, care_plan):
    prompt = f"""Analyze this care plan and determine which specialized healthcare providers should be consulted.

Care Plan:
{json.dumps(care_plan, indent=2)}

Consider the following experts:
1. Certified Diabetes Care and Education Specialist (Focus: diabetes management, education, and support)
2. Allergies Expert (Focus: allergy diagnosis, treatment, and management)
3. National Kidney Foundation Expert (Focus: kidney health, disease prevention, and management)
4. Insurance Expert (Focus: healthcare coverage, claims, and financial planning)
5. Registered Dietitian Nutritionist (RDN) (Focus: nutrition, diet planning, and nutritional therapy)
6. Ophthalmologist Expert (Focus: eye health, vision care, and eye disease management)
7. Podiatrist Expert (Focus: foot and ankle health, particularly for diabetes-related complications)
8. Hospital Care Team (Focus: inpatient care coordination and management)
9. American Diabetes Association (ADA) Expert (Focus: diabetes research, guidelines, and best practices)
10. Social Determinants of Health Expert (Focus: social and environmental factors affecting health)
11. Physical Therapist Expert (Focus: mobility, exercise, and rehabilitation)
12. Pharmacist Expert (Focus: medication management, drug interactions, and adherence)

For each expert:
- Analyze if their expertise would benefit the patient based on the care plan
- Consider both explicit mentions and implicit needs
- Consider potential complications that might need their expertise
- Think about how they could improve patient outcomes

IMPORTANT: For the "needed" field, you must ONLY return a boolean value (true or false). 
Do not use strings, numbers, or any other data type for this field.

Return your analysis in this JSON format:
{{
    "diabetes_specialist": {{
        "needed": true/false,
        "reasons": [
            "Detailed reason 1 explaining why this expert would benefit the patient",
            "Detailed reason 2 with specific references to the care plan"
        ]
    }},
    "allergies_expert": {{ ... }},
    "kidney_expert": {{ ... }},
    "insurance_expert": {{ ... }},
    "nutritionist": {{ ... }},
    "ophthalmologist": {{ ... }},
    "podiatrist": {{ ... }},
    "hospital_care_team": {{ ... }},
    "ada_expert": {{ ... }},
    "social_determinants_expert": {{ ... }},
    "physical_therapist": {{ ... }},
    "pharmacist": {{ ... }}
}}

CRITICAL REQUIREMENTS:
- The "needed" field MUST be a boolean (true or false)
- Do NOT use strings like "true" or "false"
- Do NOT use numbers like 0 or 1
- Do NOT use any other values besides true or false

Ensure you provide an entry for each expert, even if they are not needed."""

    request_body = {
        "schemaVersion": "messages-v1",
        "messages": [
            {
                "role": "user",
                "content": [{"text": prompt}]
            }
        ],
        "system": [
            {
                "text": "You are a medical expert system that analyzes care plans holistically to determine which specialized healthcare providers should be consulted to optimize patient care."
            }
        ],
        "inferenceConfig": {
            "maxTokens": 4000,
            "temperature": 0.7,
            "topP": 0.9,
            "topK": 20
        }
    }

    try:
        bedrock_response = bedrock_runtime.invoke_model(
            modelId='us.amazon.nova-micro-v1:0',
            body=json.dumps(request_body)
        )
        
        response_body = json.loads(bedrock_response['body'].read())
        response_text = response_body['output']['message']['content'][0]['text']
        
        try:
            experts_json = json.loads(response_text)
            return experts_json
        except json.JSONDecodeError:
            print(f"Invalid JSON in response: {response_text}")
            return create_default_response()
            
    except Exception as e:
        print(f"Error analyzing expert needs: {str(e)}")
        return create_default_response()

def create_default_response():
    experts = [
        "diabetes_specialist", "allergies_expert", "kidney_expert", "insurance_expert",
        "nutritionist", "ophthalmologist", "podiatrist", "hospital_care_team",
        "ada_expert", "social_determinants_expert", "physical_therapist", "pharmacist"
    ]
    
    return {expert: {
        "needed": False,
        "reasons": [],
    } for expert in experts}
