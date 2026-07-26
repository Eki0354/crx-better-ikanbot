import { load, CheerioAPI } from "cheerio";
import QRCode from "qrcode";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export async function genDoubanLink(keyword: string) {
  const url = `https://search.douban.com/movie/subject_search?search_text=${encodeURIComponent(keyword)}&cat=1002`;

  try {
    const res = await fetch(url, { method: "get" });
    const html = await res.text();
    const encryptData = (html || "").match(
      /window.__DATA__ = ([^\r\n]+);/,
    )?.[1];
    if (!encryptData) return null;

    let resData = null;

    try {
      resData = JSON.parse(encryptData) as any;
    } catch (error) {
      console.log("error", error);
      return null;
    }

    if (!resData) return null;

    const { items = [] } = resData;
    const list = items.filter(
      (item: any) => item.tpl_name === "search_subject",
    );

    if (list.length !== 1) return null;

    return `https://movie.douban.com/subject/${list[0].id}/`;
  } catch (error) {
    return null;
  }
}

/** 从 CSS 中筛选出与指定 HTML 节点相关的部分 */
function filterRelevantCss(css: string, $node: CheerioAPI): string {
  // 收集节点中出现的所有类名、ID、标签名
  const classes = new Set<string>();
  const ids = new Set<string>();
  const tags = new Set<string>();
  $node("*").each((_, el) => {
    const tag = (el as any).tagName?.toLowerCase();
    if (tag && !tags.has(tag)) tags.add(tag);
    const cls = $node(el).attr("class");
    if (cls) cls.split(/\s+/).forEach((c) => c && classes.add(c));
    const id = $node(el).attr("id");
    if (id) ids.add(id);
  });

  // 判断选择器是否引用节点中的标识
  function isSelectorRelevant(sel: string): boolean {
    const s = sel.toLowerCase();
    if (s === "*" || s === "body" || s === "html") return true;
    for (const c of classes) if (s.includes(`.${c}`)) return true;
    for (const id of ids) if (s.includes(`#${id}`)) return true;
    // 标签名需要作为独立 token 匹配，避免误匹配（如 .div 里的 div）
    for (const t of tags) {
      const re = new RegExp(`(?:^|[^.#a-z0-9_-])${t}(?:$|[^.#a-z0-9_-])`, "i");
      if (re.test(s)) return true;
    }
    return false;
  }

  // 将 CSS 拆成顶层规则（处理嵌套如 @media）
  const blocks: { prefix: string; body: string }[] = [];
  let i = 0;
  while (i < css.length) {
    const braceStart = css.indexOf("{", i);
    if (braceStart === -1) break;
    const prefix = css.slice(i, braceStart).trim();
    // 找到匹配的 }
    let depth = 1;
    let braceEnd = braceStart + 1;
    while (depth > 0 && braceEnd < css.length) {
      if (css[braceEnd] === "{") depth++;
      else if (css[braceEnd] === "}") depth--;
      braceEnd++;
    }
    const body = css.slice(braceStart + 1, braceEnd - 1).trim();
    blocks.push({ prefix, body });
    i = braceEnd;
  }

  const kept: string[] = [];
  for (const block of blocks) {
    // @-rule（如 @media）递归处理 body 中的规则
    if (block.prefix.startsWith("@")) {
      const innerBlocks: { prefix: string; body: string }[] = [];
      let j = 0;
      while (j < block.body.length) {
        const bs = block.body.indexOf("{", j);
        if (bs === -1) break;
        const p = block.body.slice(j, bs).trim();
        let d = 1;
        let be = bs + 1;
        while (d > 0 && be < block.body.length) {
          if (block.body[be] === "{") d++;
          else if (block.body[be] === "}") d--;
          be++;
        }
        const b = block.body.slice(bs + 1, be - 1).trim();
        innerBlocks.push({ prefix: p, body: b });
        j = be;
      }
      const keptInner = innerBlocks
        .filter((r) => isSelectorRelevant(r.prefix))
        .map((r) => `${r.prefix}{${r.body}}`);
      if (keptInner.length) {
        kept.push(`${block.prefix}{${keptInner.join("")}}`);
      }
    } else if (isSelectorRelevant(block.prefix)) {
      kept.push(`${block.prefix}{${block.body}}`);
    }
  }
  return kept.join("\n");
}

async function extractStyles($: CheerioAPI, baseUrl: string): Promise<string> {
  const parts: string[] = [];

  // 1. <style> 内联样式
  $("style").each((_, el) => {
    parts.push($(el).html() || "");
  });

  // 2. <link rel="stylesheet"> 外联样式表 — fetch 后内联
  const hrefs: string[] = [];
  $('link[rel="stylesheet"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) hrefs.push(new URL(href, baseUrl).href);
  });

  const cssTexts = await Promise.all(
    hrefs.map(async (href) => {
      try {
        const res = await fetch(href, {
          referrer: baseUrl,
          referrerPolicy: "unsafe-url",
          headers: {
            "user-agent": UA,
            accept: "text/css,*/*;q=0.1",
          },
        });
        if (!res.ok) {
          console.log("[css fetch fail]", href, res.status);
          return "";
        }
        return res.text();
      } catch {
        return "";
      }
    }),
  );

  parts.push(...cssTexts.filter(Boolean));

  // 3. 处理 CSS
  let combinedCss = parts.join("\n");

  // 去掉 @import（内容已内联，留在 data: URI 中会导致 CORS 错误）
  combinedCss = combinedCss.replace(/@import\s+(url\()?[^;]+;/gi, "");

  // 将 url() 中的相对/协议相对路径转为绝对路径
  combinedCss = combinedCss.replace(
    /url\((['"]?)([^'")]+)\1?\)/gi,
    (match, q, url) => {
      url = url.trim();
      if (url.startsWith("http://") || url.startsWith("https://")) return match;
      if (url.startsWith("data:")) return match;
      if (url.startsWith("//")) return `url(${q}https:${url}${q})`;
      const abs = new URL(url, baseUrl).href;
      return `url(${q}${abs}${q})`;
    },
  );

  return combinedCss;
}

export async function genDoubanScreenshot(url: string, originTabId?: number) {
  console.log("[genDoubanScreenshot] start", { url, originTabId });

  // 1. fetch 页面 HTML
  const res = await fetch(url, {
    referrer: "https://movie.douban.com/",
    referrerPolicy: "unsafe-url",
    headers: {
      "user-agent": UA,
    },
  });
  const html = await res.text();
  console.log("[genDoubanScreenshot] fetched html length", html.length);

  const $ = load(html);

  // 2. 提取目标节点 HTML
  const nodeHtml = $("#content .article .subjectwrap").prop("outerHTML");
  if (!nodeHtml) {
    console.log("[genDoubanScreenshot] subjectwrap not found");
    return;
  }
  console.log("[genDoubanScreenshot] nodeHtml length", nodeHtml.length);

  // 3. 提取并内联所有 CSS
  const rawCss = await extractStyles($, url);
  console.log("[genDoubanScreenshot] css length", rawCss.length);

  // 4. 处理内容：删 script/gact、生成二维码、图片内联
  const $node = load(nodeHtml);

  // 4a. 筛选与节点相关的 CSS，去掉页面无关样式
  const allCss = filterRelevantCss(rawCss, $node);
  console.log("[genDoubanScreenshot] filtered css length", allCss.length);

  // 4b. 移除所有 script 节点
  $node("script").remove();

  // 4c. 删除所有 .gact 节点，第一个位置用二维码占位
  const gactEls = $node(".gact");
  let gactFirst: any = null;
  gactEls.each((i, el) => {
    if (i === 0) gactFirst = $node(el);
    else $node(el).remove();
  });

  if (gactFirst) {
    try {
      // 豆瓣链接二维码
      const svg = await QRCode.toString(url, { width: 60, margin: 1 });
      const qrDataUrl = `data:image/svg+xml;base64,${btoa(svg)}`;

      // 当前页面二维码
      let pageQrHtml = "";
      if (originTabId) {
        const tab = await browser.tabs.get(originTabId);
        if (tab?.url) {
          const pageSvg = await QRCode.toString(tab.url, {
            width: 60,
            margin: 1,
          });
          const pageQrDataUrl = `data:image/svg+xml;base64,${btoa(pageSvg)}`;
          pageQrHtml = `<img src="${pageQrDataUrl}" alt="page QR" style="width:60px;aspect-ratio:1/1;">`;
        }
      }

      gactFirst.replaceWith(
        `<div style="display:flex;justify-content:space-between;padding:8px 0">
          <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
            <span style="font-size:12px;color:#666">豆瓣</span>
            <img src="${qrDataUrl}" alt="QR" style="width:60px;aspect-ratio:1/1;">
          </div>
          ${
            pageQrHtml
              ? `<div style="display:flex;flex-direction:column;align-items:center;gap:4px">
            <span style="font-size:12px;color:#666">Ikanbot</span>
            ${pageQrHtml}
          </div>`
              : ""
          }
        </div>`,
      );
    } catch (e) {
      console.log("[genDoubanScreenshot] qrcode error", e);
      gactFirst.remove();
    }
  }

  // 4d. 添加插件主页二维码
  $node("#interest_sectl").each((i, el) => {
    QRCode.toString(import.meta.env.WXT_HOME_URL, {
      width: 60,
      margin: 1,
    }).then((svg) => {
      const qrDataUrl = `data:image/svg+xml;base64,${btoa(svg)}`;

      $node(el).append(`
        <span style="font-size:12px;">分享自Better Ikanbot</span>
        <img src="${qrDataUrl}" style="width:60px;aspect-ratio:1/1;margin-top:4px;" />
      `);
    });
  });

  // 4e. 将外部图片转为 data URL 内联（避免 html2canvas 跨域）
  const imgTasks = $node("img[src]")
    .map(async (_, el) => {
      const src = $node(el).attr("src")!;
      if (src.startsWith("data:")) return;
      let absSrc: string;
      try {
        absSrc = new URL(src, url).href;
      } catch {
        return;
      }
      if (!absSrc.startsWith("http://") && !absSrc.startsWith("https://"))
        return;

      try {
        const imgRes = await fetch(absSrc, {
          referrer: "https://movie.douban.com/",
          referrerPolicy: "unsafe-url",
          headers: { "user-agent": UA },
        });
        if (!imgRes.ok) return;
        const blob = await imgRes.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        $node(el).attr("src", dataUrl);
      } catch (e) {
        console.log("[img proxy fail]", absSrc, e);
      }
    })
    .get();
  await Promise.all(imgTasks);
  const nodeHtmlInlined = $node.html();
  console.log(`[genDoubanScreenshot] inlined ${imgTasks.length} images`);

  return { url, html: nodeHtmlInlined, css: allCss };
}
