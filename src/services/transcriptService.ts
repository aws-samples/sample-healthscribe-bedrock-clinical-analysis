import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
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
const TRANSCRIPT_TABLE = import.meta.env.VITE_TRANSCRIPT_TABLE || "asclepius-transcript-dev";

export interface Transcript {
    visitID: string;
    conversation: {
        message: string;
        speaker: 'CLINICIAN' | 'PATIENT';
        timestamp: number;
    }[];
}

export const getTranscript = async (sessionId: string): Promise<Transcript | null> => {
    const command = new GetCommand({
        TableName: TRANSCRIPT_TABLE,
        Key: {
            visitID: sessionId
        }
    });

    try {
        // Verify user is authenticated
        await getCurrentUser();
        const response = await docClient.send(command);
        return response.Item as Transcript || null;
    } catch (error) {
        console.error("Error fetching transcript:", error);
        throw error;
    }
};
