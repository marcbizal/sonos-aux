let max = 0
let min = 0

function* getAlternatingChannels(...channels) {
  for (let i = 0; i < channels[0].length; i++) {
    for (let channel of channels) {
      max = Math.max(max, channel[i]);
      min = Math.min(min, channel[i]);

      if (min < -1.0 || max > +1.0) {
        throw new Error('clipping')
      }

      yield channel[i] * 32768;
    }
  }
}

function mergeTypedArraysUnsafe(a, b) {
  var c = new Int16Array(a.length + b.length);

  c.set(a);
  c.set(b, a.length);

  return c;
}

class WebSocketProcessor extends AudioWorkletProcessor {
  constructor({ processorOptions = {} }) {
    super();

    const {
      sampleRate = 48000,
      channels = 2,
      bufferLength = 2
    } = processorOptions;

    this.buffer = new Int16Array(0);
    this.bufferSize = bufferLength * (sampleRate * channels);
  }
  process(inputs) {
    const inputLeftChannel = inputs[0][0]; //inputChannel Float32Array(128)
    const inputRightChannel = inputs[0][1]; //inputChannel Float32Array(128)

    if (!inputLeftChannel || !inputRightChannel) return

    const interleavedChannels = new Int16Array(
      getAlternatingChannels(inputLeftChannel, inputRightChannel)
    );

    this.buffer = mergeTypedArraysUnsafe(this.buffer, interleavedChannels);

    if (this.buffer.length >= this.bufferSize) {
      this.port.postMessage(this.buffer.slice(0, this.bufferSize + 1));
      this.buffer = this.buffer.slice(this.bufferSize);
    }

    return true;
  }
}

registerProcessor("websocket-processor", WebSocketProcessor);
