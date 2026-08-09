import "./plyr.css";
import { initPlayer } from "./player/main";
import { fixBtns, fixSeries } from "./series";

export default defineContentScript({
  matches: ["*://www.ikanbot.com/play/*"],
  async main(ctx) {
    await injectScript("/inject-play.js");

    initPlayer(ctx);
    fixSeries(ctx);
    fixBtns(ctx);
  },
});
