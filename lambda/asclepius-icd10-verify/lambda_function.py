import json
import boto3
import os
import re
from botocore.exceptions import ClientError

## Extracts diagnoses from summary.json. Performs RAG query on ICD-10 database using diagnoses and returns SOAP with validated codes

def lambda_handler(event, context):
    print("Received event:", json.dumps(event, indent=2))  # Debug log
    
    # Use environment variable for region
    region = os.environ.get('AWS_REGION', 'us-east-1')
    bedrock_runtime = boto3.client('bedrock-runtime', region_name=region)
    bedrock_agent = boto3.client('bedrock-agent-runtime')
    
    # Get data from Step Functions input
    payload = event.get('Payload', event)  # Handles both direct and Step Functions input
    
    clinical_summary = payload['summary']
    bucket = payload['bucket']
    visit_id = payload['visitId']
    
    try:
        # 1. Extract diagnoses from assessment section
        diagnoses = extract_diagnoses_from_assessment(clinical_summary['assessment'])
        print(f"Extracted diagnoses: {diagnoses}")
        
        # 2. Verify ICD-10 codes using RAG query (commented out until OpenSearch is re-enabled)
        verified_codes = {}
        # knowledge_base_id = os.environ.get('KNOWLEDGE_BASE_ID')
        # if knowledge_base_id:
        #     for diagnosis in diagnoses:
        #         verified_code = query_knowledge_base(diagnosis, knowledge_base_id)
        #         if verified_code:
        #             verified_codes[diagnosis] = verified_code
        #             print(f"Found code for {diagnosis}: {verified_code}")
        #         else:
        #             print(f"No code found for {diagnosis}")
        # else:
        #     print("Knowledge base ID not configured, skipping ICD-10 verification")
        
        print(f"Verified codes: {verified_codes}")
        
        # 3. Update assessment with ICD-10 codes (if any were found)
        updated_assessment = []
        if verified_codes:
            for diagnosis, code in verified_codes.items():
                updated_assessment.append(f"{diagnosis} (ICD-10: {code})")
        else:
            # Keep original assessment if no codes were verified
            updated_assessment = clinical_summary['assessment']
        
        clinical_summary['assessment'] = updated_assessment
        
        result = {
            "summary": clinical_summary,
            "bucket": bucket,
            "visitId": visit_id,
            "originalKey": payload.get('originalKey'),  
            "verifiedCodes": verified_codes
        }
        
        print("Function output:", json.dumps(result, indent=2))  # Debug log
        return result
        
    except Exception as e:
        print(f"Error: {str(e)}")
        raise e

def extract_diagnoses_from_assessment(assessment_items):
    """Extract potential diagnoses from assessment items"""
    diagnoses = []
    for item in assessment_items:
        # Remove leading/trailing whitespace and dash
        cleaned_item = item.strip().lstrip('-').strip()
        diagnoses.append(cleaned_item)
    return diagnoses

def query_knowledge_base(diagnosis, knowledge_base_id):
    """Query the knowledge base for ICD-10 code of a diagnosis"""
    region = os.environ.get('AWS_REGION', 'us-east-1')
    bedrock_agent = boto3.client('bedrock-agent-runtime', region_name=region)
    try:
        query = f"""Find the exact ICD-10 code for: '{diagnosis}'

Rules:
1. EXACT MATCH REQUIRED: If '{diagnosis}' exists as an exact term match in the database, use that code
2. Only if no exact match exists:
   - Use the most general/unspecified version of the condition
   - Avoid specific subtypes or variants unless explicitly mentioned
3. Return only a single code

Required format:
[CODE]"""
        
        print(f"Querying knowledge base with: '{query}'")
        
        response = bedrock_agent.retrieve_and_generate(
            input={
                'text': query
            },
            retrieveAndGenerateConfiguration={
                'type': 'KNOWLEDGE_BASE',
                'knowledgeBaseConfiguration': {
                    'knowledgeBaseId': knowledge_base_id,
                    'modelArn': f'arn:aws:bedrock:{region}::foundation-model/amazon.nova-micro-v1:0',
                    'retrievalConfiguration': {
                        'vectorSearchConfiguration': {
                            'numberOfResults': 3
                        }
                    },
                    'generationConfiguration': {
                        'promptTemplate': {
                            'textPromptTemplate': """Given the following retrieved information:
$search_results$

Return ONLY the single most appropriate ICD-10 code for: {query}

Format: [CODE]"""
                        },
                        'inferenceConfig': {
                            'textInferenceConfig': {
                                'maxTokens': 500,
                                'temperature': 0,
                                'topP': 1
                            }
                        }
                    }
                }
            }
        )
        generated_text = response.get('output', {}).get('text', 'No response generated')
        print(f"Raw response from knowledge base: {generated_text}")
        
        cleaned_code = generated_text.strip('[]').strip()
        if re.match(r'^[A-Z]\d+(\.\d+)?$', cleaned_code):
            return cleaned_code
        else:
            print(f"No valid ICD-10 code found in response for {diagnosis}: {cleaned_code}")
            return None

    except ClientError as e:
        print(f"Error querying knowledge base: {str(e)}")
        return None
