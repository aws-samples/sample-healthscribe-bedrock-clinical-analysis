import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
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
const PATIENT_TABLE = import.meta.env.VITE_PATIENT_TABLE || "asclepius-patient-dev";

export interface Patient {
  patientID: string;
  firstName: string;
  lastName: string;
  dob: string;
}

export const getAllPatients = async (): Promise<Patient[]> => {
  const command = new ScanCommand({
    TableName: PATIENT_TABLE,
  });

  try {
    // Verify user is authenticated
    await getCurrentUser();
    const response = await docClient.send(command);
    return response.Items as Patient[];
  } catch (error) {
    console.error("Error fetching patients:", error);
    throw error;
  }
};

export const getPatientById = async (patientID: string): Promise<Patient | null> => {
    const command = new GetCommand({
      TableName: PATIENT_TABLE,
      Key: {
        patientID: patientID
      }
    });
  
    try {
      // Verify user is authenticated
      await getCurrentUser();
      const response = await docClient.send(command);
      return response.Item as Patient || null;
    } catch (error) {
      console.error("Error fetching patient:", error);
      throw error;
    }
  };