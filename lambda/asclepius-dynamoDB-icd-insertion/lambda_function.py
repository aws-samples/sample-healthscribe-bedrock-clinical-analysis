import json
import boto3
import os
from botocore.exceptions import ClientError

def lambda_handler(event, context):
    print("Received event:", json.dumps(event, indent=2))
    
    # Initialize DynamoDB resource
    dynamodb = boto3.resource('dynamodb')
    
    # Use environment variables for table names
    source_table_name = os.environ.get('VISIT_DATA_TABLE', 'asclepius-visit-data')
    target_table_name = os.environ.get('VISIT_TABLE', 'asclepiusMVP-Visit')
    
    source_table = dynamodb.Table(source_table_name)
    target_table = dynamodb.Table(target_table_name)
    
    try:
        # Extract visitId from event
        visit_id = event.get('visitId') or event.get('visitID')
        
        if not visit_id:
            raise ValueError("Missing visitId in event")
        
        print(f"Processing ICD insertion for visitId: {visit_id}")
        
        # Query source table for finalSummary data
        response = source_table.query(
            KeyConditionExpression='visitId = :vid AND dataCategory = :cat',
            ExpressionAttributeValues={
                ':vid': visit_id,
                ':cat': 'finalSummary'
            }
        )
        
        if not response['Items']:
            print(f"No finalSummary found for visitId: {visit_id}")
            return {
                'statusCode': 404,
                'body': f'No finalSummary found for visitId: {visit_id}'
            }
        
        final_summary = response['Items'][0]
        print(f"Found finalSummary: {json.dumps(final_summary, default=str)}")
        
        # Extract assessment data (which should contain ICD-10 codes)
        assessment_data = final_summary.get('assessment')
        if assessment_data:
            # Parse the assessment JSON string
            if isinstance(assessment_data, str):
                assessment = json.loads(assessment_data)
            else:
                assessment = assessment_data
            
            # Update the target table with ICD-10 codes
            update_expression = "SET soapNote.assessment.primaryDiagnosis.icd10 = :primary_icd"
            expression_values = {':primary_icd': 'Not available'}
            
            # Extract ICD-10 codes from assessment if available
            if isinstance(assessment, list) and assessment:
                primary_diagnosis = assessment[0]
                # Look for ICD-10 code pattern in the diagnosis text
                import re
                icd_match = re.search(r'\(ICD-10:\s*([A-Z]\d+(?:\.\d+)?)\)', primary_diagnosis)
                if icd_match:
                    expression_values[':primary_icd'] = icd_match.group(1)
            
            # Update the visit record
            target_table.update_item(
                Key={'visitID': visit_id},
                UpdateExpression=update_expression,
                ExpressionAttributeValues=expression_values
            )
            
            print(f"Successfully updated ICD-10 codes for visitId: {visit_id}")
            
        return {
            'statusCode': 200,
            'body': f'Successfully processed ICD insertion for visitId: {visit_id}',
            'visitId': visit_id
        }
        
    except ValueError as ve:
        print(f"Validation error: {str(ve)}")
        return {
            'statusCode': 400,
            'body': f'Validation error: {str(ve)}'
        }
    except ClientError as ce:
        print(f"DynamoDB error: {str(ce)}")
        return {
            'statusCode': 500,
            'body': f'Database error: {str(ce)}'
        }
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'body': f'Error processing request: {str(e)}'
        }
