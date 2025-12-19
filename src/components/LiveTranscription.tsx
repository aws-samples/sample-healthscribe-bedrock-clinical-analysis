import React, { useState, useEffect } from 'react';

interface TranscriptionProps {
  transcription: string;
  isPartial: boolean;
}

const LiveTranscription: React.FC<TranscriptionProps> = ({ transcription, isPartial }) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    if (transcription) {
      setDisplayedText(prev => {
        // If it's a partial result, replace the last segment
        if (isPartial) {
          const segments = prev.split('\n');
          segments[segments.length - 1] = transcription;
          return segments.join('\n');
        }
        // If it's a final result, add it as a new line
        return prev + (prev ? '\n' : '') + transcription;
      });
    }
  }, [transcription, isPartial]);

  return (
    <div>
      {displayedText || 'Transcription will appear here...'}
    </div>
  );
};

export default LiveTranscription;
