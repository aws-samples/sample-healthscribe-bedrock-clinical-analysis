import json
import boto3
import os
from datetime import datetime
from decimal import Decimal
from botocore.exceptions import ClientError

def get_transcript_from_s3(s3_client, bucket, key):
    """Retrieve and parse transcript from S3."""
    try:
        clean_key = key.replace(f"s3://{bucket}/", "").rstrip('/')
        directory_path = clean_key.replace('/clinicalDoc.json', '')
        transcript_key = f"{directory_path}/transcript.json"
        
        print(f"Original key: {key}")
        print(f"Clean key: {clean_key}")
        print(f"Directory path: {directory_path}")
        print(f"Looking for transcript at: {bucket}/{transcript_key}")
        
        response = s3_client.get_object(Bucket=bucket, Key=transcript_key)
        return json.loads(response['Body'].read().decode('utf-8'))
    except Exception as e:
        print(f"Error getting transcript: {str(e)}")
        return None

def process_transcript_segments(transcript_data):
    """Process transcript segments into conversation format."""
    conversation = []
    print("Starting transcript processing...")
    
    if not transcript_data or 'Conversation' not in transcript_data:
        print("No valid transcript data found")
        return conversation
    
    segments = transcript_data['Conversation'].get('TranscriptSegments', [])
    print(f"Found {len(segments)} segments to process")
    
    for segment in segments:
        try:
            dialogue_entry = {
                'speaker': segment.get('ParticipantDetails', {}).get('ParticipantRole', 'UNKNOWN').replace('_0', '').replace('_1', ''),
                'message': segment.get('Content', ''),
                'timestamp': Decimal(str(segment.get('BeginAudioTime', 0)))
            }
            conversation.append(dialogue_entry)
        except Exception as e:
            print(f"Error processing segment: {str(e)}")
            continue
    
    print(f"Processed {len(conversation)} conversation entries")
    return conversation

def create_visit_item(visit_id, summary, bucket, original_key, conversation):
    """Create the visit item for DynamoDB."""
    # Get assessments list and handle secondary diagnosis if it exists
    assessments = summary.get('assessment', [])
    secondary_condition = assessments[1] if len(assessments) > 1 else ""  # Changed to empty string

    return {
        "visitID": visit_id,
        "date": datetime.now().strftime('%Y-%m-%d'),
        "summaryFile": f"s3://{bucket}/{original_key}",
        "soapNote": {
            "subjective": {
                "chiefComplaint": summary.get('chief_complaint', [''])[0] if summary.get('chief_complaint') else "",
                "historyOfPresentIllness": ". ".join(summary.get('history_present_illness', []))
            },
            "objective": ". ".join(summary.get('review_systems', [])),
            "assessment": {
                "primaryDiagnosis": {
                    "condition": assessments[0] if assessments else "",
                    "icd10": "Not available"
                },
                "secondaryDiagnosis": {
                    "condition": secondary_condition,  # Will be empty string if no secondary diagnosis
                    "icd10": ""  # Always empty string
                }
            },
            "plan": {
                "treatment": summary.get('plan', [''])[0] if summary.get('plan') else "",
                "followUp": "Not specified"
            }
        },
        "conversation": conversation
    }



def lambda_handler(event, context):
    print("Received event:", json.dumps(event, indent=2))
    
    # Initialize AWS clients
    s3 = boto3.client('s3')
    dynamodb = boto3.resource('dynamodb')
    
    # Use environment variable for table name
    visit_table_name = os.environ.get('VISIT_TABLE', 'asclepiusMVP-Visit')
    visit_table = dynamodb.Table(visit_table_name)

    try:
        # Extract event data
        summary = event.get('summary', {})
        bucket = event.get('bucket')
        visit_id = event.get('visitId')
        original_key = event.get('originalKey')

        # Validate required fields
        if not all([bucket, visit_id, original_key]):
            raise ValueError("Missing required fields in event")

        # Get transcript data
        transcript_data = None
        if 'transcript' in event:
            print("Using transcript from event")
            transcript_data = event['transcript']
        else:
            print("Attempting to get transcript from S3")
            transcript_data = get_transcript_from_s3(s3, bucket, original_key)

        if transcript_data:
            print("Successfully retrieved transcript data")
        else:
            print("No transcript data available")

        # Process conversation from transcript
        conversation = process_transcript_segments(transcript_data)

        # Create visit item
        visit_item = create_visit_item(
            visit_id, 
            summary, 
            bucket, 
            original_key, 
            conversation
        )

        # Store in DynamoDB
        print("Attempting to write to DynamoDB...")
        visit_table.put_item(Item=visit_item)
        print("Successfully wrote to DynamoDB")

        return {
            'statusCode': 200,
            'body': 'Successfully processed visit and transcript data',
            'visitID': visit_id,
            'data': {
                'visit': visit_item
            }
        }

    except ValueError as ve:
        print(f"Validation error: {str(ve)}")
        return {
            'statusCode': 400,
            'body': f'Validation error: {str(ve)}'
        }
    except Exception as e:
        print(f"Error: {str(e)}")
        print("Full error:", json.dumps({
            'error': str(e),
            'type': str(type(e)),
            'trace': str(e.__traceback__)
        }, default=str))
        return {
            'statusCode': 500,
            'body': f'Error processing request: {str(e)}'
        }
