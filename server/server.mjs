import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import { TranscribeStreamingClient, StartMedicalScribeStreamCommand } from "@aws-sdk/client-transcribe-streaming";
import { NodeHttp2Handler } from '@smithy/node-http-handler';
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import cors from 'cors';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import wav from 'wav';
import { Readable } from 'stream';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
app.use(cors());
const server = http.createServer(app);

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

const wss = new WebSocketServer({
  server,
  path: '/stream',
  perMessageDeflate: false, // Disable compression for better performance
  maxPayload: 65536 // Increase max payload size
});
const sampleRateHertz = 16000

class AudioStreamHandler {
  constructor() {
    this.sessionId = uuidv4(); // Unique session ID for each new stream with AWS HealthScribe
    this.chunks = [];
    this.configSent = false;
    this.resolver = null;
    this.bufferThreshold = 8192; // Increased to 32KB for better performance
    this.rawAudioBuffer = Buffer.alloc(0); // Store raw audio data for saving in S3
    this.s3Client = new S3Client({ 
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: fromNodeProviderChain()
    });
    this.isEnded = false;
    this.hasEndedSession = false;
    this.endAcknowledged = false;
  }

  addChunk(chunk) {
    const buffer = Buffer.from(chunk);

    // Accumulate raw audio data
    this.rawAudioBuffer = Buffer.concat([this.rawAudioBuffer, buffer]);

    if (buffer.length > this.bufferThreshold) {
      // Split large chunks using subarray
      let offset = 0;
      while (offset < buffer.length) {
        const end = Math.min(offset + this.bufferThreshold, buffer.length);
        const slicedChunk = buffer.subarray(offset, end);
        this.chunks.push(slicedChunk);
        offset += this.bufferThreshold;
      }
    } else {
      this.chunks.push(buffer);
    }
  }

  async *generateStream() {
    yield {
      ConfigurationEvent: {
        MediaEncoding: "pcm",
        AudioFormat: {
          AudioFormatType: "PCM",
          SampleRate: sampleRateHertz,
          BitDepth: 16,
          Channels: 1,
          Endianness: "little"
        },
        ResourceAccessRoleArn: process.env.HEALTHSCRIBE_ROLE_ARN,
        PostStreamAnalyticsSettings: {
          ClinicalNoteGenerationSettings: {
            OutputBucketName: process.env.HEALTHSCRIBE_OUTPUT_BUCKET,
            NoteTemplate: "HISTORY_AND_PHYSICAL"
          }
        }
      }
    };

    try {
      while (!this.hasEndedSession) {
        // Process all remaining chunks before ending
        while (this.chunks.length > 0) {
          const chunk = this.chunks.shift();
          if (chunk) {
            yield {
              AudioEvent: {
                AudioChunk: chunk
              }
            };
          }
        }

        await new Promise(resolve => {
          this.waitForChunk = resolve;
          setTimeout(() => {
            if (this.waitForChunk === resolve) {
              this.waitForChunk = null;
              resolve();
            }
          }, 20);
        });
      }

      // Process any remaining chunks after stream is marked as ended
      while (this.chunks.length > 0) {
        const chunk = this.chunks.shift();
        if (chunk) {
          yield {
            AudioEvent: {
              AudioChunk: chunk
            }
          };
        }
      }
      // Add a small delay to ensure all audio is processed
      await new Promise(resolve => setTimeout(resolve, 100));
      // If ended and all chunks processed, send END_OF_SESSION
      console.log('Sending END_OF_SESSION event');
      yield {
        SessionControlEvent: {
          Type: "END_OF_SESSION"
        }
      };
      this.endAcknowleged = true;
      console.log('END_OF_SESSION event sent');
    } catch (error) {
      console.error('Error in generateStream:', error);
      if (!this.endAcknowleged) {
        yield {
          SessionControlEvent: {
            Type: "END_OF_SESSION"
          }
        };
      }
      throw error;
    }
  }

  async end() {
    if (!this.isEnded) {
      console.log('Ending audio stream...', this.chunks.length, 'chunks remaining');
      this.isEnded = true;


      // Wait for all chunks to be processed
      if (this.chunks.length > 0) {
        console.log('waiting for final chunks to process: ', this.chunks.length);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Signal end of session
      this.hasEndedSession = true;

      try {
        // Save audio to S3 before completing
        const audioLocation = await this.saveAudioToS3();
        console.log('Audio saved to:', audioLocation);
      } catch (error) {
        console.error('Error saving audio:', error);
      }
    }
  }

  async saveAudioToS3() {
    try {
      // Create WAV file in memory
      const writer = new wav.Writer({
        channels: 1,
        sampleRate: sampleRateHertz,
        bitDepth: 16
      });

      // Create a readable stream from the raw audio buffer
      const readable = Readable.from(this.rawAudioBuffer);

      // Pipe the audio through the WAV writer
      readable.pipe(writer);

      // Collect WAV data
      const wavChunks = [];
      writer.on('data', chunk => wavChunks.push(chunk));

      // Wait for WAV encoding to complete
      await new Promise((resolve, reject) => {
        writer.on('end', resolve);
        writer.on('error', reject);
      });

      // Combine WAV chunks
      const wavBuffer = Buffer.concat(wavChunks);

      // Upload to S3
      const command = new PutObjectCommand({
        Bucket: process.env.AUDIO_BUCKET_NAME,
        Key: `audio-recordings/${this.sessionId}.wav`,
        Body: wavBuffer,
        ContentType: 'audio/wav'
      });

      await this.s3Client.send(command);
      console.log(`Audio saved to S3: audio-recordings/${this.sessionId}.wav`);

      // Return the S3 location
      return {
        bucket: process.env.AUDIO_BUCKET_NAME,
        key: `audio-recordings/${this.sessionId}.wav`
      };
    } catch (error) {
      console.error('Error saving audio to S3:', error);
      throw error;
    }
  }
}

wss.on('connection', async (ws) => {
  console.log('Frontend client connected');

  let audioHandler = null;
  let transcribeClient = null;
  let isClosing = false;

  const cleanup = async () => {
    if (isClosing) return;
    isClosing = true;

    try {
      if (audioHandler) {
        console.log('Starting cleanup process...');
        await audioHandler.end();

        try {
          const audioLocation = await audioHandler.saveAudioToS3();
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({
              type: 'AUDIO_SAVED',
              location: audioLocation
            }));
          }
        } catch (error) {
          console.error('Error saving audio:', error);
        }
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    } finally {
      // Only close WebSocket after everything is done
      if (ws.readyState === ws.OPEN) {
        ws.close();
      }
    }
  };

  try {
    audioHandler = new AudioStreamHandler();
    console.log('New session created with ID:', audioHandler.sessionId);

    // send session ID immediately after connection
    ws.send(JSON.stringify({ type: 'SESSION_START', sessionId: audioHandler.sessionId }));

    // Log environment variables for debugging (excluding sensitive data)
    console.log('Environment variables:', {
      AWS_REGION: process.env.AWS_REGION,
      AUDIO_BUCKET_NAME: process.env.AUDIO_BUCKET_NAME,
      HEALTHSCRIBE_OUTPUT_BUCKET: process.env.HEALTHSCRIBE_OUTPUT_BUCKET,
      HEALTHSCRIBE_ROLE_ARN: process.env.HEALTHSCRIBE_ROLE_ARN ? 'Set (value hidden)' : 'Not set'
    });

    try {
      transcribeClient = new TranscribeStreamingClient({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: fromNodeProviderChain(),
        requestHandler: new NodeHttp2Handler({
          sessionTimeout: 60000,
          keepAlive: true,
        })
      });
      
      console.log('TranscribeStreamingClient initialized successfully');
    } catch (credError) {
      console.error('Error initializing TranscribeStreamingClient:', credError);
      throw new Error(`Failed to initialize TranscribeStreamingClient: ${credError.message}`);
    }

    const command = new StartMedicalScribeStreamCommand({
      SessionId: audioHandler.sessionId,
      LanguageCode: "en-US",
      MediaSampleRateHertz: 16000,
      MediaEncoding: "pcm",
      Type: "CONVERSATION",
      Specialty: "PRIMARYCARE",
      ShowSpeakerLabels: true,
      EnablePartialResultsStablization: true,
      PartialResultsStability: "MEDIUM",
      InputStream: audioHandler.generateStream()
    });


    const startTranscription = async () => {
      console.log('Starting transcription stream...');
      try {
        const response = await transcribeClient.send(command);
        console.log('Transcription stream connected successfully');

        if (response && response.ResultStream) {
          try {
            for await (const event of response.ResultStream) {
              if (isClosing) break; // Exit loop if we're closing

              if (ws.readyState === ws.OPEN) {
                if (event.TranscriptEvent?.TranscriptSegment) {
                  const segment = event.TranscriptEvent.TranscriptSegment;

                  console.log('Transcription segment received:', segment);
                  ws.send(JSON.stringify({
                    channel: segment.ChannelId,
                    transcription: segment.Content,
                    isPartial: segment.IsPartial
                  }));
                }
              } else {
                break;
              }
            }
          } catch (streamError) {
            if (streamError.code === 'ERR_STREAM_PREMATURE_CLOSE' && isClosing) {
              console.log('Stream closed normally during cleanup');
            } else {
              throw streamError;
            }
          }
        }
      } catch (error) {
        if (!isClosing) { // Only log error if it's not during normal cleanup
          console.error('Transcription error:', error);
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ error: 'Transcription error: ' + error.message }));
          }
        }
      }
    };

    startTranscription().catch(error => {
      if (!isClosing) {
        console.error('Error in transcription process:', error);
      }
    });

    // Handle incoming audio data
    ws.on('message', async (data) => {
      if (isClosing) return; // Don't process new data if we're closing

      if (audioHandler) {
        try {
          if (data instanceof Buffer) {
            audioHandler.addChunk(data);
          } else {
            const strData = data.toString();
            try {
              const jsonData = JSON.parse(strData);
              if (jsonData.type === 'END_STREAM') { 
                console.log('Received end stream signal');
                await cleanup();
                ws.send(JSON.stringify({ type: 'STREAM_ENDED' }));
              }
            } catch (e) {
              audioHandler.addChunk(data);
            }
          }
        } catch (error) {
          console.error('Error processing audio chunk:', error);
        }
      }
    });

    // Handle WebSocket close
    ws.on('close', async () => {
      console.log('Client disconnected');
      await cleanup();
    });

  } catch (error) {
    console.error('Error setting up transcription:', error);
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ error: 'Setup error: ' + error.message }));
      ws.close();
    }
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});