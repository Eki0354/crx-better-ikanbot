// entrypoints/inject-main-world.ts
export default defineUnlistedScript(() => {
  // 这里的代码可以访问原页面的 window 变量
  console.log(
    "Inject script in MAIN world, page title:",
    window.document.title,
  );
  console.log("Page variable v_tks:", (window as any).v_tks);

  localStorage.setItem('token', (window as any).v_tks);
});
