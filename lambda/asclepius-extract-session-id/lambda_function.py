import json
import boto3

def lambda_handler(event, context):
    s3 = boto3.client('s3')
    events = boto3.client('events')  # Add EventBridge client
    
    # Check if this is an S3 trigger event
    if 'Records' in event and len(event['Records']) > 0:
        bucket = event['Records'][0]['s3']['bucket']['name']
        key = event['Records'][0]['s3']['object']['key']
        
        # Only process if it's a transcript.json file
        if 'transcript.json' not in key.lower():
            print(f"Not a transcript file: {key}")
            return
            
        try:
            # Get the transcript file
            response = s3.get_object(Bucket=bucket, Key=key)
            transcript_data = json.loads(response['Body'].read().decode('utf-8'))
            
            # Extract SessionId
            session_id = transcript_data['Conversation']['SessionId']
            
            # Get summary key (assuming same directory as transcript)
            summary_key = key.replace('transcript.json', 'clinicalDoc.json')
            
            # Emit event to EventBridge
            response = events.put_events(
                Entries=[
                    {
                        'Source': 'custom.transcript',
                        'DetailType': 'TranscriptProcessed',
                        'Detail': json.dumps({
                            'bucket': bucket,
                            'key': summary_key,
                            'visitId': session_id
                        })
                    }
                ]
            )
            
            print(f"Emitted event to EventBridge: {response}")
            return response
            
        except Exception as e:
            print(f"Error: {str(e)}")
            raise e
