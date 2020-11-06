<script>
import { element } from "svelte/internal";

  import DeviceSelect from "./DeviceSelect.svelte";

  function mergeTypedArraysUnsafe(a, b) {
    var c = new Int16Array(a.length + b.length);

    c.set(a);
    c.set(b, a.length);

    return c;
  }

  let deviceId;
  let mediaStream;

  let recording = false;

  const sampleRate = 48000
  const numChannels = 2
  const context = new AudioContext({ sampleRate });
  const ws = new WebSocket('ws://192.168.1.69:8000')

  let data = new Int16Array(0);

  let source = null;
  let websocketProcessor = null;
  let downloadLink

  async function setup(stream) {
    context.suspend()

    await context.audioWorklet.addModule("worklet/websocket-processor.js");

    if (source) {
      source.disconnect();
    }

    source = context.createMediaStreamSource(await stream);

    websocketProcessor = new AudioWorkletNode(context, "websocket-processor");

    source.connect(websocketProcessor)
    source.connect(context.destination)

    context.resume()
  }

  $: if (websocketProcessor) {
    websocketProcessor.port.onmessage = (message) => {
      ws.send(message.data)
      if (recording) {
        data = mergeTypedArraysUnsafe(data, message.data)
      }
    }
  }

  $: if (mediaStream) setup(mediaStream);

  function startRecording() {
    recording = true;
  }

  const encoder = new TextEncoder()
  function setString(view, offset, string) {
    encoder
      .encode(string)
      .forEach((byte, i) => view.setUint8(offset + i, byte))
  }

  function stopRecording() {
    recording = false;

    const subchunk1Size = 16
    const subchunk2Size = data.byteLength
    const chunkSize = 4 + (8 + subchunk1Size) + (8 + subchunk2Size)

    const buffer = new ArrayBuffer(chunkSize + 8)
    const view = new DataView(buffer)

    setString(view, 0, 'RIFF')
    view.setUint32(4, chunkSize, true) // ChunkSize
    setString(view, 8, 'WAVE')

    setString(view, 12, 'fmt ') // Subchunk1ID
    view.setUint32(16, subchunk1Size, true) // Subchunk1Size
    view.setUint16(20, 1, true) // AudioFormat (PCM)
    view.setUint16(22, numChannels, true) // NumChannels
    view.setUint32(24, sampleRate, true) // SampleRate
    view.setUint32(28, sampleRate * numChannels * Int16Array.BYTES_PER_ELEMENT, true) // ByteRate
    view.setUint16(32, numChannels * Int16Array.BYTES_PER_ELEMENT, true) // BlockAlign
    view.setUint16(34, Int16Array.BYTES_PER_ELEMENT * 8, true) // BitsPerSample

    setString(view, 36, 'data') // Subchunk2ID
    view.setUint32(40, subchunk2Size, true)
    data.forEach((sample, i) => view.setInt16(44 + (i * Int16Array.BYTES_PER_ELEMENT), sample, true))

    const blob = new Blob([buffer], { type: 'audio/wav' })

    downloadLink = window.URL.createObjectURL(blob);
    data = new Int16Array(0)
  }
</script>

<style>
  main {
    font-family: sans-serif;
    text-align: center;
  }
</style>

<main>
	<h1>Hello CodeSandbox</h1>
	<h2>Start editing to see some magic happen!</h2>
	<DeviceSelect bind:deviceId bind:mediaStream/>
  <p>{deviceId}</p>
  <button on:click={() => recording ? stopRecording() : startRecording()}>{recording ? 'Stop Recording' : 'Start Recording'}</button>
  {#if downloadLink}<a href={downloadLink} download="aux-recording.wav">Download Recording</a>{/if}
</main>
