import json
import boto3
import re

def lambda_handler(event, context):
    bedrock_runtime = boto3.client('bedrock-runtime', region_name='us-east-1')
    
    clinical_summary = event['summary']
    visitId = event['visitId']  
    care_plan = generate_care_plan(bedrock_runtime, clinical_summary)
    

    # Only log the suggested care plan part
    care_plan_result = {
        "carePlan": {
            "visitId": visitId,
            "diagnosticTests": care_plan["diagnosticTests"],
            "treatmentOptions": care_plan["treatmentOptions"],
            "patientEducation": care_plan["patientEducation"],
            "followUpRecommendations": care_plan["followUpRecommendations"],
            "specialistReferrals": care_plan["specialistReferrals"]
        }
    }
    
    print("Care Plan Result:", json.dumps(care_plan_result, indent=2))
    return care_plan_result


def extract_json(text):
    """Extract JSON object from text string."""
    try:
        # Find JSON content between curly braces
        match = re.search(r'\{[\s\S]*\}', text)
        if match:
            json_str = match.group(0)
            return json.loads(json_str)
        else:
            print("No JSON object found in text")
            return {}
    except json.JSONDecodeError as e:
        print(f"Invalid JSON in response: {str(e)}")
        return {}

def generate_care_plan(bedrock_runtime, clinical_summary):
    # Pre-format the clinical data to avoid backslashes in f-strings
    chief_complaint_text = '\n'.join(clinical_summary['chief_complaint'])
    history_text = '\n'.join(clinical_summary['history_present_illness'])
    assessment_text = '\n'.join(clinical_summary['assessment'])
    
    prompt = f"""Given the following clinical information, generate a detailed care plan in natural language:

Chief Complaint:
{chief_complaint_text}

History of Present Illness:
{history_text}

Assessment:
{assessment_text}

Please provide a comprehensive care plan that addresses each of these areas in clear, natural language paragraphs:

1. Diagnostic Tests and Procedures: Describe recommended tests and procedures to confirm or monitor the condition.

2. Treatment Plan: Explain the recommended medications, therapies, and interventions, including dosages and duration where appropriate.

3. Patient Education: Describe what the patient needs to know about their condition, lifestyle modifications, and self-care instructions.

4. Follow-up Care: Explain when the patient should return for follow-up visits and what to monitor.

5. Specialist Referrals: Discuss any needed consultations with specialists and why they're necessary.

Format your response as a JSON object with the following structure, using complete sentences and paragraphs:
{{
  "diagnosticTests": ["Write each test recommendation as a complete sentence"],
  "treatmentOptions": ["Describe each treatment in detail"],
  "patientEducation": ["Provide detailed educational points in complete sentences"],
  "followUpRecommendations": ["Write follow-up instructions in clear, complete sentences"],
  "specialistReferrals": ["Explain each referral recommendation in detail"]
}}"""

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
                "text": "You are a medical assistant that creates comprehensive care plans using natural, clear language while maintaining clinical accuracy. Always respond in the requested JSON format."
            }
        ],
        "inferenceConfig": {
            "maxTokens": 2000,
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
        care_plan_text = response_body['output']['message']['content'][0]['text']
        
        # Extract JSON from the response
        care_plan_json = extract_json(care_plan_text)
        
        # Ensure all expected keys are present
        expected_keys = ["diagnosticTests", "treatmentOptions", "patientEducation", "followUpRecommendations", "specialistReferrals"]
        for key in expected_keys:
            if key not in care_plan_json:
                care_plan_json[key] = []
        
        return care_plan_json
    except Exception as e:
        print(f"Error generating care plan: {str(e)}")
        return {
            "diagnosticTests": [],
            "treatmentOptions": [],
            "patientEducation": [],
            "followUpRecommendations": [],
            "specialistReferrals": [],
            "error": str(e)
        }
