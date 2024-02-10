const fetch = require("node-fetch");
const chalk = require("chalk");
const inquirer = require("inquirer");
const fs = require("fs");
const { exit } = require("process");
const { Headers } = require("node-fetch");
const readline = require("readline");
const {
  tiktokGalleryConverter,
  tiktokDownloader,
} = require("./tiktokGalleryConverter.js");
//adding useragent to avoid ip bans
const headers = new Headers();
headers.append(
  "User-Agent",
  "TikTok 26.2.0 rv:262018 (iPhone; iOS 14.4.2; en_US) Cronet"
);
const headersWm = new Headers();
headersWm.append(
  "User-Agent",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36"
);

const getChoice = () =>
  new Promise((resolve, reject) => {
    inquirer
      .prompt([
        {
          type: "list",
          name: "type",
          message: "Choose a option",
          choices: ["With Watermark", "Without Watermark"],
        },
      ])
      .then((res) => resolve(res))
      .catch((err) => reject(err));
  });

async function downloadMediaFromList(item) {
  return new Promise(async (resolve, reject) => {
    const folder = "downloads/";
    try {
      if (item.imgData.length > 1) {
        console.log(chalk.green("[*] Gallery downloading started!"));
        await tiktokGalleryConverter(
          item.imgData,
          item.audio,
          folder + item.id
        );
        resolve("[+] Downloaded successfully");
      } else {
        await tiktokDownloader(item.src, folder + item.id);
        resolve("[+] Downloaded successfully");
      }
    } catch (error) {
      await tiktokDownloader(item.src, folder + item.id);
      resolve("[+] Downloaded successfully");
    }
  });
}

const getVideoWM = async (url) => {
  const idVideo = await getIdVideo(url);
  const API_URL = `https://api16-normal-c-useast1a.tiktokv.com/aweme/v1/feed/?aweme_id=${idVideo}`;
  const request = await fetch(API_URL, {
    method: "GET",
    headers: headers,
  });
  const body = await request.text();
  try {
    var res = JSON.parse(body);
  } catch (err) {
    console.error("Error:", err);
    console.error("Response body:", body);
  }
  const urlMedia = res.aweme_list[0].video.download_addr.url_list[0];
  const data = {
    url: urlMedia,
    id: idVideo,
  };
  return data;
};

const getVideoNoWM = async (url) => {
  const idVideo = await getIdVideo(url);
  const API_URL = `https://api16-normal-c-useast1a.tiktokv.com/aweme/v1/feed/?aweme_id=${idVideo}`;
  const request = await fetch(API_URL, {
    method: "GET",
    headers: headers,
  });
  const body = await request.text();
  try {
    var res = JSON.parse(body);
  } catch (err) {
    console.error("Error:", err);
    console.error("Response body:", body);
  }
  var imgData = [];
  var audio = "";
  try {
    imgData = [];
    audio = res.aweme_list[0].music.play_url.uri;
    res.aweme_list[0].image_post_info.images.forEach((img) => {
      imgData.push({
        src: img.display_image.url_list[0],
        size: `${img.display_image.width}x${img.display_image.height}`,
      });
    });
  } catch (error) {}
  const urlMedia = res.aweme_list[0].video.play_addr.url_list[0];
  const data = {
    src: urlMedia,
    id: idVideo,
    imgData: imgData,
    audio: audio,
  };
  return data;
};
const getRedirectUrl = async (url) => {
  if (url.includes("vm.tiktok.com") || url.includes("vt.tiktok.com")) {
    url = await fetch(url, {
      redirect: "follow",
      follow: 10,
    });
    url = url.url;
    console.log(chalk.green("[*] Redirecting to: " + url));
  }
  return url;
};

const getIdVideo = (url) => {
  const matching = url.includes("/video/") || url.includes("/photo/");
  if (!matching) {
    console.log(chalk.red("[X] Error: URL not found"));
    exit();
  }
  if (url.includes("/video/")) {
    var idVideo = url.substring(url.indexOf("/video/") + 7, url.length);
  } else {
    var idVideo = url.substring(url.indexOf("/photo/") + 7, url.length);
  }
  return idVideo.length > 19
    ? idVideo.substring(0, idVideo.indexOf("?"))
    : idVideo;
};
(async () => {
  const choice = await getChoice();
  var listVideo = [];
  {
    var urls = [];
    const file = "memy.txt";

    if (!fs.existsSync(file)) {
      console.log(chalk.red("[X] Error: File not found"));
      exit();
    }

    // read file line by line
    const rl = readline.createInterface({
      input: fs.createReadStream(file),
      crlfDelay: Infinity,
    });
    for await (const line of rl) {
      if (line.startsWith("https")) {
        urls.push(line);
        console.log(chalk.green(`[*] Found URL: ${line}`));
      }
    }
    for (var i = 0; i < urls.length; i++) {
      const url = await getRedirectUrl(urls[i]);
      listVideo.push(url);
    }
  }
  console.log(chalk.green(`[!] Found ${listVideo.length} video`));

  for (var i = 0; i < listVideo.length; i++) {
    console.log(
      chalk.green(`[*] Downloading video ${i + 1} of ${listVideo.length}`)
    );
    console.log(chalk.green(`[*] URL: ${listVideo[i]}`));
    var data =
      choice.type == "With Watermark"
        ? await getVideoWM(listVideo[i])
        : await getVideoNoWM(listVideo[i]);

    console.log(chalk.green(await downloadMediaFromList(data)));
  }
})();
