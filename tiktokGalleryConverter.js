const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffprobePath = require("@ffprobe-installer/ffprobe").path;
const ffmpeg = require("fluent-ffmpeg");
const fsExtra = require("fs-extra");
const sharp = require("sharp");
const fs = require("fs");
const https = require("https");
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);
var size = undefined;
/**
 * @param {Array} imgData Array of src images and size(wxh).
 */
function convertImgToMP4(imgSrc, i, duration = 3) {
  return new Promise(async (resolve, reject) => {
    if (size == undefined) size = `${maxWidth}x${maxHeight}`;
    ffmpeg()
      .input(imgSrc)
      // .size("640x640")
      .size(size || "640x640")
      .loop(duration)
      .inputOptions("-t", duration)
      .outputOptions("-pix_fmt", "yuv420p")
      .output(`./temp/converted${i}.mp4`)
      .on("end", () => {
        resolve(`./temp/converted${i}.mp4`);
      })
      .on("error", (err) => {
        reject("File conversion error");
      })
      .run();
  });
}
async function convertImgToMP4Array(imgDataRaw) {
  return new Promise(async (resolve, reject) => {
    var convertIndex = 0;
    var imageData = [];
    for await (const line of imgDataRaw) {
      imageData.push(await convertImgToMP4(line, convertIndex));
      convertIndex++;
    }
    resolve(imageData);
  });
}

/**
 * @param {Array} src Array of MP4 videos to merge.
 */
function mergeMP4(src = [], index) {
  return new Promise(async (resolve, reject) => {
    if (src.length < 2) {
      reject("Not enough files provided.");
    }
    ffmpeg({ source: src[0] })
      .input(src[1])
      .mergeToFile(`./temp/merged${index}.mp4`)
      .on("end", () => {
        resolve("Merge finished, saved.");
      })
      .on("error", (err) => {
        reject("File merge error. ");
      });
  });
}
var merge = true;
async function mergeMP4Array(imgData) {
  return new Promise(async (resolve, reject) => {
    await mergeMP4([imgData[0], imgData[1]], 0);

    imgData.splice(0, 2);
    for await (const line of imgData) {
      await mergeMP4(
        [`./temp/merged${merge ? 0 : 1}.mp4`, line],
        merge ? 1 : 0
      );
      merge = !merge;
    }
    await mergeMP4(
      [
        `./temp/merged${merge ? 0 : 1}.mp4`,
        `./temp/merged${merge ? 0 : 1}.mp4`,
      ],
      merge ? 1 : 0
    );
    merge = !merge;
    resolve("Merge finished, saved.");
  });
}

/**
 * @param {string} src Src of MP4 video  to add audio.
 * @param {string} audioSrc Src of MP3 audio.
 */
function addMusic(src, audioSrc, length, exportSrc) {
  return new Promise(async (resolve, reject) => {
    ffmpeg()
      .videoCodec("copy")
      .format("mp4")
      .addInput(audioSrc)
      .addInput(src)
      .duration(length * 6)
      .save(`${exportSrc}.mp4`)
      .on("end", () => {
        resolve("Music added successfully.");
      })
      .on("error", (err) => {
        reject("Error while adding music. " + err.message);
      });
  });
}
function clearTemp() {
  fsExtra.emptyDirSync("./temp/");
}
var maxWidth = 0;
var maxHeight = 0;
/**
 * @param {Array} imgData Array of src images and size(wxh).
 * @param {string} audio Src of MP3 audio.
 * @param {string} exportSrc Src to export location with filename.
 */
module.exports.tiktokGalleryConverter = async function (
  imgDataRaw = [],
  audio = "",
  exportSrc = ""
) {
  return new Promise(async (resolve, reject) => {
    clearTemp();

    var j = 0;
    imgDataRaw.forEach((e) => {
      if (e.size.split("x")[0] > maxWidth)
        maxWidth = parseInt(e.size.split("x")[0]);
      if (e.size.split("x")[1] > maxHeight)
        maxHeight = parseInt(e.size.split("x")[1]);
    });
    var imgResized = [];
    for await (const line of imgDataRaw) {
      await downloadFromSrc(line.src, `./temp/img${j}.png`);
      await scaleImage(
        `./temp/img${j}.png`,
        `./temp/imgscaled${j}.png`,
        maxWidth,
        maxHeight
      );
      imgResized.push(`./temp/imgscaled${j}.png`);
      j++;
    }

    var imgData = await convertImgToMP4Array(imgResized);
    await mergeMP4Array(imgData);
    await addMusic(
      `./temp/merged${merge ? 0 : 1}.mp4`,
      audio,
      imgData.length + 2,
      exportSrc
    );
    clearTemp();
    clearTemp();
    resolve("Gallery downloaded");
  });
};
module.exports.tiktokDownloader = async function (url = "", exportSrc = "") {
  return new Promise(async (resolve, reject) => {
    ffmpeg()
      .input(url)
      .output(`${exportSrc}.mp4`)
      .on("end", () => {
        resolve("Music added successfully.");
      })
      .on("error", (err) => {
        reject("Error while adding music. " + err.message);
      })
      .run();
  });
};

async function scaleImage(inputPath, outputPath, targetWidth, targetHeight) {
  return new Promise(async (resolve, reject) => {
    try {
      await sharp(inputPath)
        .resize(targetWidth, targetHeight, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 1 },
        })
        .toFile(outputPath);
      resolve("Image scaled successfully!");
    } catch (error) {
      reject("An error occurred:" + err.message);
    }
  });
}
function downloadFromSrc(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    const request = https.get(url, (response) => {
      response.pipe(file);
      file.on("finish", () => {
        file.close();
        resolve();
      });
    });

    request.on("error", (error) => {
      fs.unlink(outputPath, () => {
        reject(error);
      });
    });
  });
}
