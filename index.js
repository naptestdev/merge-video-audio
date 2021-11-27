const express = require("express");
const app = express();
const fileUpload = require("express-fileupload");
const { join } = require("path");
const { exec } = require("child_process");
const fs = require("fs");

require("dotenv/config");

app.use(fileUpload({ createParentPath: true, useTempFiles: true }));
app.enable("trust proxy");

const randomId = () =>
  Math.random()
    .toString(36)
    .slice(-10)
    .split("")
    .map((i) => (Math.random() > 0.5 ? i.toUpperCase() : i))
    .join("");

app.get("/", (req, res) => {
  res.sendFile(join(__dirname, "index.html"));
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
      const outputPath = join(__dirname, "output", outputId, "output.mp4");

      res.send({
        message: "File uploaded! Conversion will begin shortly",
        url: `${req.protocol}://${req.get(
          "host"
        )}/download?outputId=${outputId}`,
      });

      fs.mkdirSync(join(__dirname, "output", outputId), { recursive: true });

      const command = `ffmpeg -i ${videoFilePath} -i ${audioFilePath} -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 ${outputPath}`;

      exec(command, (error) => {
        if (error) {
          console.log("Convert error: ", error);
        }
      });
    };
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: "File upload failed", error });
  }
});

app.get("/download", (req, res) => {
  try {
    const { outputId } = req.query;

    const exist = fs.existsSync(
      join(__dirname, "output", outputId, "output.mp4")
    );

    if (!exist)
      return res.send({
        message: "File is being processed",
      });

    res.download(join(__dirname, "output", outputId, "output.mp4"));
  } catch (error) {
    console.log(error);
    if (!res.headerSent) res.sendStatus(500);
  }
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server is listening on port ${port}`));
