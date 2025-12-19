class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const audioData = input[0];
      if (audioData.length > 0) {
        // Convert Float32Array to Int16Array for PCM
        const pcmData = new Int16Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
          pcmData[i] = audioData[i] * 0x7FFF;
        }
        this.port.postMessage(pcmData.buffer, [pcmData.buffer]);
      }
    }
    return true;
  }
}

registerProcessor('audio-processor', AudioProcessor);