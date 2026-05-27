import Hls from "hls.js";
import Plyr from "plyr";
import nextIcon from "~/assets/next.png";

type PlaybackProgress = {
  url: string;
  time: number;
};

let hls = new Hls();
let player: Plyr | null = null;
let currentSource: string | null = null;

const KEY_PLAYBACK_PROGRESS = "playback_progress";

const getVideoProgress = (): PlaybackProgress | null => {
  if (!currentSource || !player) return null;

  const list = JSON.parse(
    localStorage.getItem(KEY_PLAYBACK_PROGRESS) || "[]",
  ) as PlaybackProgress[];
  return list.find((item) => item.url === currentSource) || null;
};

const saveVideoProgress = () => {
  if (!currentSource || !player) return;

  const list = JSON.parse(
    localStorage.getItem(KEY_PLAYBACK_PROGRESS) || "[]",
  ) as PlaybackProgress[];
  const existingIndex = list.findIndex((item) => item.url === currentSource);

  const newProgress: PlaybackProgress = {
    url: currentSource,
    time: player.currentTime,
  };

  if (existingIndex >= 0) {
    list[existingIndex] = newProgress;
  } else {
    list.push(newProgress);
  }

  localStorage.setItem(KEY_PLAYBACK_PROGRESS, JSON.stringify(list));
};

const createNextBtn = () => {
  const controlsContainer = document.querySelector(".plyr__controls");
  if (!controlsContainer) {
    console.warn("未找到控件栏，延迟插入");
    return;
  }

  const playBtn = controlsContainer.querySelector(
    '.plyr__control[data-plyr="play"]',
  );
  if (
    playBtn &&
    !controlsContainer.querySelector(".plyr__control--next-episode")
  ) {
    // 创建下一集按钮
    const nextBtn = document.createElement("button");
    nextBtn.className =
      "plyr__control plyr__control--custom plyr__control--next-episode";
    nextBtn.setAttribute("data-plyr", "next-episode");
    nextBtn.setAttribute("aria-label", "下一集");
    // 使用 Font Awesome 前进双箭头图标 (更直观)
    nextBtn.innerHTML = `<img src="${nextIcon}" alt="下一集" style="width: 18px; aspect-ratio: square;" />`;
    // 添加工具提示 (Plyr 风格)
    nextBtn.setAttribute("data-plyr-tooltip", "下一集");
    nextBtn.setAttribute("data-plyr-tooltip-persistent", "false");

    // 绑定点击事件 - 执行播放下一集逻辑 (业务自定义)
    nextBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      //   playNextEpisode(); // 自定义逻辑，完全可替换

      const node = document.querySelector(
        '#lineContent .line-res [name="lineData"].active ~ [name="lineData"]',
      ) as HTMLElement;
      if (!node) return;

      node.click();
    });

    // 插入到播放按钮后面 (作为兄弟节点)
    if (playBtn.nextSibling) {
      controlsContainer.insertBefore(nextBtn, playBtn.nextSibling);
    } else {
      controlsContainer.appendChild(nextBtn);
    }
  }
};

function playVideo(source: string) {
  hls.loadSource(source);
  currentSource = source;
  player?.play();
}

function initPlayer(video: HTMLVideoElement, source: string) {
  if (Hls.isSupported()) {
    // 初始化 Hls.js 并关联视频
    hls.loadSource(source);
    hls.attachMedia(video);
    currentSource = source;

    // 等待解析完成后，再初始化 Plyr，确保它接管视频控制
    hls.on(Hls.Events.MANIFEST_PARSED, function () {
      player = new Plyr(video, {
        keyboard: {
          global: true,
        },
        controls: [
          "play-large",
          "play",
          "progress",
          "current-time",
          "duration",
          "mute",
          "volume",
          "fullscreen",
        ],
      });

      let hasInited = false;

      player.on("canplay", () => {
        if (hasInited) return;
        hasInited = true;

        const progress = getVideoProgress();
        if (!progress) return;

        player!.currentTime = progress.time;
      });

      player.on("ready", createNextBtn);

      player.on("timeupdate", saveVideoProgress);
    });
  }
}

export { player, initPlayer, playVideo };
