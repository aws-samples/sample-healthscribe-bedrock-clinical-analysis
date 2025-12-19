import json
import boto3

def lambda_handler(event, context):
    s3 = boto3.client('s3')
    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table('Conversations')  # Your DynamoDB table name
    
    # Get bucket and key from S3 event
    if 'Records' in event and len(event['Records']) > 0:
        bucket = event['Records'][0]['s3']['bucket']['name']
        key = event['Records'][0]['s3']['object']['key']
        
        try:
            # Get the transcript file from S3
            response = s3.get_object(Bucket=bucket, Key=key)
            transcript_data = json.loads(response['Body'].read().decode('utf-8'))
            
            # Extract conversation data
            conversation = transcript_data['Conversation']
            
            # Format dialogue for DynamoDB
            dialogue = []
            for segment in conversation['TranscriptSegments']:
                dialogue.append({
                    'speaker': segment['ParticipantDetails']['ParticipantRole'].replace('_0', ''),
                    'message': segment['Content'],
                    'timestamp': segment['BeginAudioTime']
                })
            
            # Sort by timestamp
            dialogue.sort(key=lambda x: x['timestamp'])
            
            # Create DynamoDB item
            item = {
                'sessionId': conversation['SessionId'],
                'conversation': dialogue
            }
            
            # Store in DynamoDB
            table.put_item(Item=item)
            
            print(f"Successfully stored conversation for session: {conversation['SessionId']}")
            
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'message': 'Successfully processed transcript',
                    'sessionId': conversation['SessionId']
                })
            }
            
        except Exception as e:
            print(f"Error: {str(e)}")
            raise e
    
    return {
        'statusCode': 400,
        'body': json.dumps('Invalid event format')
    }
