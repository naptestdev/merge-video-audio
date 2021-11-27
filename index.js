const express = require("express");
const app = express();
const fileUpload = require("express-fileupload");
const cors = require("cors");
const { mkdirSync, fstat } = require("fs");
const { join } = require("path");
const { exec } = require("child_process");
require("dotenv/config");

app.use(cors({ origin: true, credentials: true }));
app.use(fileUpload({ createParentPath: true, useTempFiles: true }));
app.enable("trust proxy");

app.set("json spaces", 2);

const randomId = () =>
  Math.random()
    .toString(36)
    .slice(-10)
    .split("")
    .map((i) => (Math.random() > 0.5 ? i.toUpperCase() : i))
    .join("");

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

app.post("/merge", async (req, res) => {
  try {
    const videoFile = req.files.video;
    const audioFile = req.files.audio;

    if (!videoFile || !audioFile)
      return res.status(400).send({
        message: "Files are missing",
      });

    let videoUploaded = false;
    let audioUploaded = false;

    const videoFilePath = join(
      __dirname,
      "videos",
      randomId(),
      encodeURIComponent(videoFile.name)
    );

    const audioFilePath = join(
      __dirname,
      "audios",
      randomId(),
      encodeURIComponent(audioFile.name)
    );

    videoFile.mv(videoFilePath, (err) => {
      if (err) {
        if (!res.headersSent) res.status(500).send(err);
        return;
      }

      videoUploaded = true;

      if (audioUploaded) merge();
    });

    audioFile.mv(audioFilePath, (err) => {
      if (err) {
        if (!res.headersSent) res.status(500).send(err);
        return;
      }

      audioUploaded = true;

      if (videoUploaded) merge();
    });

    const merge = () => {
      const outputId = randomId();
      const outputPath = join(__dirname, "output", outputId + ".mp4");

      mkdirSync("output", { recursive: true });

      const command = `ffmpeg -i ${videoFilePath} -i ${audioFilePath} -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 ${outputPath}`;

      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.log("Convert error: ", error);
          if (!res.headersSent) return res.status(500).send(error);
        }

        res.download(outputPath);
      });
    };
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: "File upload failed", error });
  }
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server is listening on port ${port}`));
