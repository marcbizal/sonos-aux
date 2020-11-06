<script>
  export let kind = "audio";

  export let deviceId = '';
  export let mediaStream = null;

  async function getDevices() {
    await navigator.mediaDevices.getUserMedia({ [kind]: true });

    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioDevices = devices.filter(device => device.kind === kind + "input");

    deviceId = audioDevices[0].deviceId;

    return audioDevices;
  }

  $: if (deviceId) {
    mediaStream = navigator.mediaDevices.getUserMedia({
      [kind]: {
        autoGainControl: false,
        channelCount: 2,
        echoCancellation: false,
        latency: 0,
        noiseSuppression: false,
        sampleRate: 48000,
        sampleSize: 16,
        volume: 1.0,
        deviceId: { exact: deviceId },
      }
    });
  }
</script>

{#await getDevices() then devices}
  <select bind:value={deviceId}>
    {#each devices as device (device.deviceId)}
      <option value={device.deviceId}>
        {device.label}
      </option>
    {/each}
  </select>
{/await}
