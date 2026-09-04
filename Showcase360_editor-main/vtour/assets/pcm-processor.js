class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Int16Array(2048);
    this.bufferIndex = 0;
    // We want to send chunks of ~32ms. At 16kHz, 32ms is 512 samples.
    // 512 samples is exactly 4 audio quantums (128 samples each).
    this.chunkSize = 512;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input.length > 0) {
      const channelData = input[0];
      
      for (let i = 0; i < channelData.length; i++) {
        // Convert Float32 [-1.0, 1.0] to Int16 [-32768, 32767]
        let s = Math.max(-1, Math.min(1, channelData[i]));
        this.buffer[this.bufferIndex++] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        
        if (this.bufferIndex >= this.chunkSize) {
          // Send a copy of the chunk to the main thread
          const chunk = this.buffer.slice(0, this.chunkSize);
          this.port.postMessage(chunk.buffer, [chunk.buffer]);
          this.bufferIndex = 0;
        }
      }
    }
    return true; // Keep the processor alive
  }
}

registerProcessor('pcm-processor', PCMProcessor);
