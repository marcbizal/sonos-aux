const WebSocket = require("ws");
const compression = require("compression");
const express = require("express");
const http = require("http");
var cors = require("cors");
const path = require("path");
const ffmpeg = require('fluent-ffmpeg');
const stream = require('stream')

const port = 8000;

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

wss.on("connection", async (ws) => {
  console.log(`New websocket connection established`);

  const messageStream = stream.Readable()
  messageStream._read = () => {}

  ffmpeg()
  .noVideo()
  .input(messageStream)
  .inputOptions([
    '-f s16le',
    '-ar 48000',
    '-ac 2'
  ])
  .output(`./stream/aux320.m3u8`)
  .outputOptions([
    '-c:a aac',
    '-b:a 1411k',
    '-f hls',
    '-hls_flags delete_segments+omit_endlist'
  ])
  .run()

  ws.on("message", async (message) => {
    messageStream.push(message)
  });
});

server.listen(port, () => {
  console.log(`Started HTTP server on port ${port}`);
});