import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, GetCommand, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';

const client = new DynamoDBClient({
    region: import.meta.env.VITE_AWS_REGION || "us-east-1",
    credentials: async () => {
        const session = await fetchAuthSession();
        return {
            accessKeyId: session.credentials.accessKeyId,
            secretAccessKey: session.credentials.secretAccessKey,
            sessionToken: session.credentials.sessionToken
        };
    }
});

const docClient = DynamoDBDocumentClient.from(client);

// Environment variables for table names
const VISIT_TABLE = import.meta.env.VITE_VISIT_TABLE || "asclepius-visit-dev";
const VISIT_DATA_TABLE = import.meta.env.VITE_VISIT_DATA_TABLE || "asclepius-visit-data";

export interface Visit {
    visitID: string;
    conversation: string;
    date: string;
    patientID: string;
    soapNote: string;
    summaryFile: string;
}

export interface AIVisit {
    visitID: string;
    dataCategory: string;
    diagnosticTests: string;
    expertResult: string;
    finalSummary: string;
    followUpRecommendations: string;
    patientEducation: string;
    specialistReferrals: string;
    timestamp: string;
    treatmentOptions: string;
}

export const getAllVisits= async (): Promise<Visit[]> => {
  const command = new ScanCommand({
    TableName: VISIT_TABLE,
  });

  try {
    // Verify user is authenticated
    await getCurrentUser();
    const response = await docClient.send(command);
    return response.Items as Visit[];
  } catch (error) {
    console.error("Error fetching visits:", error);
    throw error;
  }
};

export const getVisitById = async (visitID: string): Promise<Visit | null> => {
  const params = {
    TableName: VISIT_TABLE,
    KeyConditionExpression: "visitID = :vid",
    ExpressionAttributeValues: {
      ":vid": visitID
    }
  };

  try {
    // Verify user is authenticated
    await getCurrentUser();
    
    const command = new QueryCommand(params);
    const response = await docClient.send(command);
    
    if (!response.Items || response.Items.length === 0) {
      console.log(`No visit found for visitID: ${visitID}`);
      return null;
    }

    // Since visitID should be unique, we expect only one item
    if (response.Items.length > 1) {
      console.warn(`Multiple visits found for visitID: ${visitID}. Using first result.`);
    }

    console.log(`Found visit for visitID: ${visitID}`);
    return response.Items[0] as Visit;
  } catch (error) {
    console.error("Error querying visit:", {
      visitID,
      error: error.message,
      code: error.code,
      requestParams: params
    });
    throw error;
  }
};


  export const getVisitsByPatientId = async (patientID: string): Promise<Visit[]> => {
    const command = new ScanCommand({
      TableName: VISIT_TABLE,
      FilterExpression: "patientID = :pid",
      ExpressionAttributeValues: {
        ":pid": patientID
      }
    });
  
    try {
      // Verify user is authenticated
      await getCurrentUser();
      const response = await docClient.send(command);
      return response.Items as Visit[];
    } catch (error) {
      console.error("Error fetching visits for patient:", error);
      throw error;
    }
  };

  export const getVisitDataByCategory = async (visitId: string): Promise<AIVisit[]> => {
    const params = {
      TableName: VISIT_DATA_TABLE,
      KeyConditionExpression: "visitId = :vid",
      ExpressionAttributeValues: {
        ":vid": visitId

      }
    };
  
    try {
      const command = new QueryCommand(params);
      const response = await docClient.send(command);
      
      if (!response.Items || response.Items.length === 0) {
        console.log(`No items found for visitId: ${visitId}`);
        return [];
      }
      
      console.log(`Found ${response.Items.length} items for visitId: ${visitId}`);
      return response.Items as AIVisit[];
    } catch (error) {
      console.error("Error querying visit data:", {
        visitId,
        error: error.message,
        code: error.code
      });
      throw error;
    }
  };

  export const getFinalSummary = async (visitId: string) => {
    const params = {
      TableName: VISIT_DATA_TABLE,
      KeyConditionExpression: 'visitId = :vid AND dataCategory = :cat',
      ExpressionAttributeValues: {
        ':vid': visitId,
        ':cat': 'finalSummary'
      }
    };
  
    try {
      const command = new QueryCommand(params);
      const response = await docClient.send(command);
      console.log("final summary service", response)
      return response.Items|| {};
    } catch (error) {
      console.error('Error fetching visit data:', error);
      throw error;
    }
  };

  export const updateVisitData = async (visitId: string, updates: {
    assessment: string;
    chief_complaint: string;
    history_present_illness: string;
    plan: string;
    review_systems: string;
  }) => {
    const params = {
      TableName: VISIT_DATA_TABLE,
      Key: {
        visitId: visitId,
        dataCategory: 'finalSummary'
      },
      UpdateExpression: 'set assessment = :assessment, chief_complaint = :chief_complaint, history_present_illness = :history_present_illness, #planField = :plan, review_systems = :review_systems',
      ExpressionAttributeNames: {
        '#planField': 'plan'  // Use ExpressionAttributeNames for reserved keyword
      },
      ExpressionAttributeValues: {
        ':assessment': JSON.stringify(updates.assessment),
        ':chief_complaint': JSON.stringify(updates.chief_complaint),
        ':history_present_illness': JSON.stringify(updates.history_present_illness),
        ':plan': JSON.stringify(updates.plan),
        ':review_systems': JSON.stringify(updates.review_systems)
      },
      ReturnValues: 'ALL_NEW'
    };
  
    try {
      const command = new UpdateCommand(params);
      const result = await docClient.send(command);
      return result.Attributes;
    } catch (error) {
      console.error('Error updating visit data:', error);
      throw error;
    }
  };


  export const updatePatientId = async (visitId: string, patientId: string) => {
    const params = {
      TableName: VISIT_TABLE,
      Key: {
        visitID: visitId  // Note: using visitID to match your interface
      },
      UpdateExpression: 'set patientID = :pid',
      ExpressionAttributeValues: {
        ':pid': patientId
      },
      ReturnValues: 'ALL_NEW'
    };
  
    try {
      // Verify user is authenticated (following pattern from other functions)
      await getCurrentUser();
      
      const command = new UpdateCommand(params);
      const result = await docClient.send(command);
      return result.Attributes;
    } catch (error) {
      console.error('Error updating patient ID:', error);
      throw error;
    }
  };
  