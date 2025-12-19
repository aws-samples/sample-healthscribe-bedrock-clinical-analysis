import React, { useEffect, useRef, useState } from 'react';
import Button from '@cloudscape-design/components/button';
interface StartTranscriptionButtonProps {
  onTranscriptionUpdate: (transcription: string, isPartial: boolean) => void;
  onSessionStart?: (sessionId: string) => void;  
}

const StartTranscriptionButton: React.FC<StartTranscriptionButtonProps> = ({onTranscriptionUpdate, onSessionStart}) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const sampleRateHertz = 16000;
  const [sessionId, setSessionId] = useState<string | null> (null);

    // Update sessionId and notify parent
    const updateSessionId = (newSessionId: string | null) => {
      setSessionId(newSessionId);
      onSessionStart(newSessionId);
    };

  const requestMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: sampleRateHertz,
          sampleSize: 16,
          echoCancellation: true,
          noiseSuppression: true,
        } 
      });
      stream.getTracks().forEach(track => track.stop());
      setHasPermission(true);
    } catch (error) {
      console.error('Error getting microphone permission:', error);
      setHasPermission(false);
    }
  };
  const startTranscription = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: sampleRateHertz,
          sampleSize: 16,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      streamRef.current = stream;
  
      audioContextRef.current = new AudioContext({
        sampleRate: sampleRateHertz,
        latencyHint: 'interactive'
      });
  
      await audioContextRef.current.audioWorklet.addModule('/audio-processor.js');
      
      workletNodeRef.current = new AudioWorkletNode(audioContextRef.current, 'audio-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1,
        processorOptions: {
          numberOfChannels: 1,      // Add this to ensure mono processing
          sampleRate: sampleRateHertz
        }
      });
  
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(workletNodeRef.current);
  
      // Connect to your backend WebSocket server
      // Use environment variable for WebSocket endpoint (set by deployment)
      const wsEndpoint = import.meta.env.VITE_WEBSOCKET_ENDPOINT;
      if (!wsEndpoint) {
        console.error('WebSocket endpoint not configured. Set VITE_WEBSOCKET_ENDPOINT environment variable.');
        return;
      }
      console.log('Connecting to WebSocket endpoint:', wsEndpoint);
      wsRef.current = new WebSocket(`${wsEndpoint}/stream`);
      
      wsRef.current.onopen = () => {
        console.log('WebSocket connected to backend server');
        setIsStreaming(true);
      };
  
      // // Your backend will handle the AWS Transcribe connection
      workletNodeRef.current.port.onmessage = (event) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          // Make sure we're sending the actual audio data, not the whole event
          const audioData = event.data.audioData;
          
          // Ensure we have valid audio data before sending
          if (audioData instanceof ArrayBuffer) {
            wsRef.current.send(audioData);
          } else {
            console.error('Invalid audio data format:', typeof audioData);
          }
        }
      };

      workletNodeRef.current.port.onmessage = (event) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          // The data is the ArrayBuffer itself, not wrapped in an object
          if (event.data instanceof ArrayBuffer) {
            wsRef.current.send(event.data);
          } else {
            console.error('Invalid audio data format:', event.data);
          }
        }
      };
      
      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch(data.type) {
            case 'SESSION_START':
              console.log('Session ID received:', data.sessionId);
              setSessionId(data.sessionId);
              if (onSessionStart) {
              onSessionStart(data.sessionId);
              }
              break;
            
            case 'AUDIO_SAVED':
              console.log('Audio saved to S3:', data.location);
              break;
            
            case 'STREAM_ENDED':
              console.log('Stream ended successfully');
              break;
            
            default:
              if (data.transcription) {
                onTranscriptionUpdate(data.transcription, data.isPartial);
              }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        stopTranscription();
      };
  
    } catch (error) {
      console.error('Error starting transcription:', error);
      await stopTranscription();
    }
  };

  const stopTranscription = async () => {
    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        // Send end stream signal first
        wsRef.current.send(JSON.stringify({ type: 'END_STREAM' }));
        
        // Wait a moment for the message to be sent
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Then close the connection
        wsRef.current.close();
        wsRef.current = null;
      }
  
      // Stop the media stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
  
      // Disconnect and clean up audio worklet
      if (workletNodeRef.current) {
        workletNodeRef.current.disconnect();
        workletNodeRef.current = null;
      }
  
      // Close audio context
      if (audioContextRef.current) {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }
  
      setIsStreaming(false);
    } catch (error) {
      console.error('Error stopping transcription:', error);
    }
  };
  
  // Add this useEffect to handle cleanup on component unmount
  useEffect(() => {
    return () => {
      stopTranscription();
    };
  }, []);

  const handleButtonClick = () => {
    if (isStreaming) {
      stopTranscription();
    } else {
      startTranscription();
    }
  };

  return (
    <div>
      <Button 
        onClick={handleButtonClick}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          margin: '10px',
          backgroundColor: isStreaming ? '#ff4444' : '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        {isStreaming ? 'Finish Recording' : 'Start Recording'}
      </Button>
    </div>
  );
};

export default StartTranscriptionButton;