import "./plyr.css";
import "./series.css";
import { replacePlayer } from "./player";
import { fixBtns, fixSeries } from "./series";

export default defineContentScript({
  matches: ["*://www.ikanbot.com/play/*"],
  async main(ctx) {
    await injectScript("/inject-ikanbot-main-world.js");

    replacePlayer(ctx);
    fixSeries(ctx);
    fixBtns(ctx);
  },
});
