import json
import boto3

def lambda_handler(event, context):
    s3 = boto3.client('s3')
    
    # Extract information from the EventBridge event structure
    # The event details are in event['Detail'] if it's a string, or event['detail'] if it's already parsed
    if isinstance(event.get('Detail'), str):
        detail = json.loads(event['Detail'])
    else:
        detail = event.get('detail', event)  # fallback to entire event if detail not found
    
    # Get bucket and key from the detail
    bucket = detail['bucket']
    key = detail['key']
    # Get visitId from detail instead of parsing it from key
    visitId = detail['visitId']
    
    try:
        # Get the summary file
        response = s3.get_object(Bucket=bucket, Key=key)
        summary_data = json.loads(response['Body'].read().decode('utf-8'))
        
        # Extract relevant sections from summary
        sections = summary_data['ClinicalDocumentation']['Sections']
        
        # Create a simplified structure with just the sections we need
        clinical_summary = {
            'chief_complaint': get_section_content('CHIEF_COMPLAINT', sections),
            'history_present_illness': get_section_content('HISTORY_OF_PRESENT_ILLNESS', sections),
            'review_systems': get_section_content('REVIEW_OF_SYSTEMS', sections),
            'assessment': get_section_content('ASSESSMENT', sections),
            'plan': get_section_content('PLAN', sections)
        }

        return {
            "summary": clinical_summary,
            "bucket": bucket,
            "visitId": visitId,
            "originalKey": key
        }
 
    except Exception as e:
        print(f"Received event:", json.dumps(event, indent=2))  # Add this for debugging
        print(f"Error: {str(e)}")
        raise e

def get_section_content(section_name, sections):
    """Extract content from a specific section"""
    for section in sections:
        if section['SectionName'] == section_name:
            return [item['SummarizedSegment'] for item in section.get('Summary', [])]
    return []
