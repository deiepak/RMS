class AudioStreamReceiver {
  constructor() {
    this.mediaSource = new MediaSource();
    this.audioElement = new Audio();
    this.audioElement.src = URL.createObjectURL(this.mediaSource);
    this.sourceBuffer = null;
    this.queue = [];
    this.isUpdating = false;

    this.mediaSource.addEventListener('sourceopen', () => {
      try {
        if (MediaSource.isTypeSupported('audio/webm; codecs="opus"')) {
          this.sourceBuffer = this.mediaSource.addSourceBuffer('audio/webm; codecs="opus"');
        } else if (MediaSource.isTypeSupported('audio/webm')) {
          this.sourceBuffer = this.mediaSource.addSourceBuffer('audio/webm');
        } else if (MediaSource.isTypeSupported('audio/mp4; codecs="mp4a.40.2"')) {
          this.sourceBuffer = this.mediaSource.addSourceBuffer('audio/mp4; codecs="mp4a.40.2"');
        }
        
        if (this.sourceBuffer) {
          this.sourceBuffer.addEventListener('updateend', () => {
            this.isUpdating = false;
            this.processQueue();
          });
        }
      } catch (err) {
        console.error("Failed to add source buffer", err);
      }
    });
  }

  reset() {
    if (this.mediaSource.readyState === 'open') {
      try { this.mediaSource.endOfStream(); } catch(e){}
    }
    this.mediaSource = new MediaSource();
    this.audioElement.src = URL.createObjectURL(this.mediaSource);
    this.sourceBuffer = null;
    this.queue = [];
    this.isUpdating = false;

    this.mediaSource.addEventListener('sourceopen', () => {
      try {
        if (MediaSource.isTypeSupported('audio/webm; codecs="opus"')) {
          this.sourceBuffer = this.mediaSource.addSourceBuffer('audio/webm; codecs="opus"');
        } else if (MediaSource.isTypeSupported('audio/webm')) {
          this.sourceBuffer = this.mediaSource.addSourceBuffer('audio/webm');
        }
        if (this.sourceBuffer) {
          this.sourceBuffer.addEventListener('updateend', () => {
            this.isUpdating = false;
            this.processQueue();
          });
        }
      } catch (e) {
        console.error("Failed to reset source buffer", e);
      }
    });
  }

  async playChunk(base64Data, isFirstChunk = false) {
    if (isFirstChunk) {
      this.reset();
    }
    try {
      const res = await fetch(base64Data);
      const arrayBuffer = await res.arrayBuffer();
      this.queue.push(arrayBuffer);
      
      if (this.audioElement.paused) {
        this.audioElement.play().catch(e => console.error("Auto-play prevented", e));
      }

      this.processQueue();
    } catch (err) {
      console.error('Failed to process audio chunk', err);
    }
  }

  processQueue() {
    if (this.isUpdating || this.queue.length === 0 || !this.sourceBuffer || this.mediaSource.readyState !== 'open') {
      return;
    }
    this.isUpdating = true;
    const chunk = this.queue.shift();
    try {
      this.sourceBuffer.appendBuffer(chunk);
    } catch (e) {
      console.error('Failed to append buffer', e);
      this.isUpdating = false;
    }
  }
}

// Global instances for multiple streams might be needed if multiple people speak at once, but usually walkie-talkie is 1 at a time.
const streams = {};

export const playAudioChunk = (streamId, base64Data, isFirstChunk) => {
  if (!streams[streamId]) {
    streams[streamId] = new AudioStreamReceiver();
  }
  streams[streamId].playChunk(base64Data, isFirstChunk);
};
