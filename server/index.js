const WebSocket = require("ws");
const compression = require("compression");
const express = require("express");
const http = require("http");
var cors = require("cors");
const path = require("path");
const fs = require("fs");
const { promisify } = require("util");
const { DeviceDiscovery, Sonos } = require("sonos");
const { Fdkaac } = require("node-fdkaac");
const nodeCleanup = require("node-cleanup");

const unlinkAsync = promisify(fs.unlink);
const writeFileAsync = promisify(fs.writeFile);

let chunk = 0;
let mediaSequence = 0;
const chunkSeconds = 2;

const ipAddress = "192.168.1.69";
const port = 8000;
const encoderOptions = {
  bitrate: 320,
  raw: true,
  "raw-rate": 48000,
  "raw-format": "f32",
  "gapless-mode": 2,
  "moov-before-mdat": true,
};

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(compression());
app.use((req, res, next) => {
  switch (path.extname(req.path)) {
    case ".m4u8":
      res.type("application/x-mpegURL");
      break;
    case ".aac":
      res.type("audio/aac");
      break;
    default:
  }
  next();
});

app.use(express.static("public"));
app.use(express.static("stream"));

const chunks = [];

wss.on("connection", async (ws) => {
  console.log(`New websocket connection established`);

  ws.on("message", async (message) => {
    const chunkName = `chunk-${chunk++}.aac`;

    const aac = new Fdkaac({
      output: `./stream/${chunkName}`,
      ...encoderOptions,
    }).setBuffer(message);

    await aac.encode();

    chunks.push(chunkName);

    if (chunks.length >= 10) {
      const firstChunkName = chunks.shift();
      await unlinkAsync(path.join(__dirname, `./stream/${firstChunkName}`));

      mediaSequence++;
    }

    await writeFileAsync(
      path.join(__dirname, "./stream/aux320.m3u8"),
      `#EXTM3U
#EXT-X-TARGETDURATION:${chunkSeconds}
#EXT-X-VERSION:4
#EXT-X-MEDIA-SEQUENCE:${mediaSequence}
${chunks
  .map(
    (chunk) => `#EXT-X-DISCONTINUITY
#EXTINF:${chunkSeconds},
${chunk}`
  )
  .join("\n")}`
    );
  });
});

server.listen(port, () => {
  console.log(`Started HTTP server on port ${port}`);
});

nodeCleanup(() => {
  const chunks = fs
    .readdirSync(path.join(__dirname, "./stream"))
    .filter((file) => file.includes("chunk"));

  for (const chunk of chunks) {
    fs.unlinkSync(path.join(__dirname, `./stream/${chunk}`));
  }
});

// DeviceDiscovery().once('DeviceAvailable', (device) => {
//   console.log('found device at ' + device.host);

//   device.stop().catch(console.warn);
//   device.flush().catch(console.warn);
//   device
//     .playNotification({
//       uri: `http://${ipAddress}:${port}/pad_soft_echo.wav`,
//       onlyWhenPlaying: false,
//       volume: 50,
//     })
//     .then(() => {
//       console.log('success');
//     })
//     .catch(console.warn);

//   device
//     .play(`http://${ipAddress}:${port}/aux.m3u8`)
//     .then(() => {
//       console.log('playing')
//       playing = true;
//     })
//     .catch(console.error);
// })
