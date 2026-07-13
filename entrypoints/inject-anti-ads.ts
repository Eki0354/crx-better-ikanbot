// entrypoints/inject-anit-ads.ts
declare var A_Store: any;

export default defineUnlistedScript(() => {
  try {
    A_Store.isCooldown = () => true; // 屏蔽广告判断逻辑
  } catch (e) {
    console.warn("Failed to override A_Store.isCooldown:", e);
  }
});
