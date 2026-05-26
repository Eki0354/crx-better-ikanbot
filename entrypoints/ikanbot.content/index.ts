// content script 中
import Hls from "hls.js";
import Plyr from "plyr";
import "./plyr.css";

type PlayHistory = {
  date: number;
  lineId: string;
  name: string;
  title: string;
  videoId: string;
};

type M3U8ResData = {
  flag: string;
  url: string;
};

type M3U8Response = {
  state: number;
  message: string;
  data: {
    list: {
      siteId: number;
      id: number;
      resData: string;
    }[];
  };
};

function waitFor<T = string>(
  fn: () => T | undefined,
  timeout = 10000,
  duration = 100,
) {
  let timer = 0;

  const cb = <T>(
    resolve: (value: T | PromiseLike<T>) => void,
    reject: (reason?: any) => void,
  ) => {
    const res = fn();
    console.log("cb:", res);
    if (res !== undefined) {
      resolve(res as T);
      return;
    }

    if (!timer) {
      timer = window.setTimeout(() => {
        reject(new Error("waitFor 超时"));
      }, timeout);
    }

    setTimeout(() => cb(resolve, reject), duration);
  };

  return new Promise<T>(cb);
}

function waitForVideoSrc(videoElement: HTMLVideoElement, timeout = 10000) {
  return new Promise<string | undefined>((resolve, reject) => {
    // 如果已经有非空的 src 或 currentSrc
    if (videoElement.src || videoElement.currentSrc) {
      resolve(videoElement.currentSrc || videoElement.src);
      return;
    }

    let timer = setTimeout(() => {
      reject(new Error("等待 video src 超时"));
    }, timeout);

    const onMetadata = () => {
      clearTimeout(timer);
      const src = videoElement.currentSrc || videoElement.src;
      resolve(src);
      videoElement.removeEventListener("loadedmetadata", onMetadata);
    };
    videoElement.addEventListener("loadedmetadata", onMetadata);
  });
}

const getVideoId = () =>
  window.location.pathname.replace(/\/+$/g, "").split("/").pop();

const getPlayHistory = () => {
  const id = getVideoId();
  const playHistory: PlayHistory[] = JSON.parse(
    localStorage.getItem("playHistory") || "[]",
  );
  const ph = playHistory.find((p) => p.videoId === id);
  if (!ph) return;

  return ph;
};

const getVideoM3u8 = async () => {
  const id = getVideoId();
  if (!id) return;

  const token = localStorage.getItem("token");
  if (!token) return;

  const url = new URL("https://www.ikanbot.com/api/getResN");
  url.searchParams.set("videoId", id);
  url.searchParams.set("mtype", "2");
  url.searchParams.set("token", token);

  const ph = getPlayHistory();

  const res = (await (await fetch(url.toString())).json()) as M3U8Response;

  let listStr: string = "";

  if (!ph) {
    listStr = res.data.list[0].resData;
  } else {
    listStr =
      res.data.list.find((p) => ph.lineId.includes(p.id.toString()))?.resData ||
      "";
  }

  if (!listStr) return;

  const item = JSON.parse(listStr);
  const list = (JSON.parse(listStr) as M3U8ResData[])[0]!.url
    .split("#")
    .map((l) => l.split("$"));

  let mu: string = "";

  if (!ph) {
    mu = list[0][1];
  } else {
    mu = list.find((p) => p[0] === ph.name)?.[1] || "";
  }

  if (!mu) return;

  return mu;
};

export default defineContentScript({
  matches: ["*://www.ikanbot.com/play/*"],
  async main(ctx) {
    await injectScript("/inject-main-world.js");

    const ui = createIntegratedUi(ctx, {
      position: "inline",
      anchor: "#player-wrap > .video-js > video",
      onMount: async (container) => {
        const vj = container.parentElement as HTMLVideoElement;
        if (!vj) return;

        // const src = await waitForVideoSrc(video);
        // console.log("最终视频地址:", src);
        // if (!src) return;

        const wrapper = vj.parentElement?.parentElement;
        if (!wrapper) return;

        const source = await getVideoM3u8();
        if (!source) return;

        const video = document.createElement("video");
        wrapper.innerHTML = "";
        wrapper.appendChild(video);
        wrapper.parentElement!.className = "";
        (wrapper.parentElement!.querySelector(
          ":scope video",
        ) as HTMLVideoElement)!.style = "aspect-ratio: 16/9;";

        if (Hls.isSupported()) {
          // 初始化 Hls.js 并关联视频
          const hls = new Hls();
          hls.loadSource(source);
          hls.attachMedia(video);

          // 等待解析完成后，再初始化 Plyr，确保它接管视频控制
          hls.on(Hls.Events.MANIFEST_PARSED, function () {
            const player = new Plyr(video, {
              keyboard: {
                global: true,
              },
              controls: [
                "play-large", // 这一项是关键，不能少
                "play",
                "progress",
                "current-time",
                "duration",
                "mute",
                "volume",
                "fullscreen",
                // ... 其他控件
              ],
            });
          });
        }
      },
    });

    ui.autoMount();
  },
});
