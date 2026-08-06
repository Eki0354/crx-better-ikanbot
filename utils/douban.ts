import { load, CheerioAPI } from "cheerio";
import QRCode from "qrcode";

const ORIGIN = "https://movie.douban.com";

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

export async function genQRCodeHTML(content: string, label: string = "") {
  const svg = await QRCode.toString(content, {
    width: 60,
    margin: 1,
  });

  const qrDataUrl = `data:image/svg+xml;base64,${btoa(svg)}`;

  return `
    <div style="display:flex;flex-direction:column;gap:4px;align-items:center;">
      ${label ? `<span style="font-size:12px;">${label}</span>` : ""}
      <img src="${qrDataUrl}" style="width:60px;aspect-ratio:1/1;" />
    </div>
  `;
}

export const genCurrentPageQRCodeHTML = () =>
  genQRCodeHTML(location.href, "Ikanbot");

export const genHomePageQRCodeHTML = () =>
  genQRCodeHTML(import.meta.env.WXT_HOME_URL, "分享自Better Ikanbot");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 解析豆瓣 PoW 验证页（sec.douban.com 的"载入中 ..."页）中的表单。
 * 该页带有一个 #sec 表单：JS 计算 sha512(cha+nonce) 前 difficulty 位为 0 的
 * nonce 作为 sol，再 POST 回 /c 完成验证后跳转到真实页面。
 */
function parsePowForm(html: string): {
  tok: string;
  cha: string;
  red: string;
  difficulty: number;
} | null {
  const tok = html.match(/id="tok" name="tok" value="([^"]+)"/)?.[1];
  const cha = html.match(/id="cha" name="cha" value="([^"]+)"/)?.[1];
  const red = html.match(/id="red" name="red" value="([^"]+)"/)?.[1];
  if (!tok || !cha || !red) return null;

  const difficulty = Number(html.match(/difficulty\s*=\s*(\d+)/)?.[1]);
  return { tok, cha, red, difficulty: Number.isFinite(difficulty) ? difficulty : 4 };
}

/**
 * 计算 PoW：找到 nonce 使得 sha512(cha + nonce) 的十六进制前
 * `difficulty` 位全为 0（等价于前几个字节为 0）。
 */
async function solveDoubanPow(
  cha: string,
  difficulty: number,
): Promise<string> {
  const encoder = new TextEncoder();
  const fullBytes = Math.floor(difficulty / 2);
  const halfByte = difficulty % 2; // difficulty 为奇数时还需检查末字节高 4 位
  let nonce = 0;

  for (;;) {
    nonce++;
    const digest = await crypto.subtle.digest(
      "SHA-512",
      encoder.encode(cha + nonce),
    );
    const bytes = new Uint8Array(digest);
    let ok = true;
    for (let i = 0; i < fullBytes; i++) {
      if (bytes[i] !== 0) {
        ok = false;
        break;
      }
    }
    if (ok && halfByte && (bytes[fullBytes] & 0xf0) !== 0) ok = false;
    if (ok) return String(nonce);
  }
}

/**
 * 模拟执行豆瓣 PoW 验证：计算 nonce 并 POST 回执到 sec.douban.com/c。
 * 验证通过后服务器返回 302 重定向到真实页面并种下 cookie。
 * @returns 验证结果；失败返回 null
 */
async function solveDoubanPowChallenge(pow: {
  tok: string;
  cha: string;
  red: string;
  difficulty: number;
}): Promise<{ html: string; followUrl?: string } | null> {
  try {
    const sol = await solveDoubanPow(pow.cha, pow.difficulty);
    console.log(`[fetchDoubanHtml] PoW 计算完成 sol=${sol}`);

    const form = new URLSearchParams({
      tok: pow.tok,
      cha: pow.cha,
      sol,
      red: pow.red,
    });

    // redirect: "manual" 以便读取 302 的 Location 和 Set-Cookie
    // （浏览器会自动存储 cookie，重试时携带；Node/undici 需手动管理）
    const res = await fetch("https://sec.douban.com/c", {
      method: "POST",
      redirect: "manual",
      credentials: "include",
      referrer: "https://sec.douban.com/",
      referrerPolicy: "unsafe-url",
      headers: {
        "user-agent": UA,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: form,
    });
    const html = await res.text();
    const location = res.headers.get("location");

    console.log(
      `[fetchDoubanHtml] PoW 回执 status=${res.status} length=${html.length} location=${location}`,
    );

    // 200 且已含目标节点：验证通过并直接返回页面
    if (res.ok && load(html)("#content .article .subjectwrap").length > 0) {
      return { html };
    }
    // 302/303：验证通过，跟随重定向（cookie 已种下）
    if (res.status === 302 || res.status === 303) {
      return { html, followUrl: location || pow.red };
    }
    return null;
  } catch (error) {
    console.error("[fetchDoubanHtml] PoW 失败", error);
    return null;
  }
}

/**
 * 解析豆瓣等待页中的跳转信息（meta refresh 或 JS location 跳转），
 * 作为 PoW 验证页之外的兜底处理。
 */
function parseRedirect(
  html: string,
  baseUrl: string,
): { delayMs: number; url?: string } | null {
  // <meta http-equiv="refresh" content="1;url=https://...">
  const metaTag = html.match(/<meta[^>]*http-equiv=["']?refresh["']?[^>]*>/i)?.[0];
  if (metaTag) {
    const content = metaTag.match(/content=["']([^"']+)["']/i)?.[1];
    if (content) {
      const delay = Number(content.split(";")[0]);
      const urlPart = content.match(/url\s*=\s*(.+)$/i)?.[1];
      return {
        delayMs: Number.isFinite(delay) ? delay * 1000 : 1200,
        url: urlPart ? new URL(urlPart.trim(), baseUrl).href : undefined,
      };
    }
  }

  // JS 跳转：location.href / location.replace，附带 setTimeout 延迟
  const jsHref = html.match(
    /location\.(?:href|replace)\s*=\s*["']([^"']+)["']/i,
  )?.[1];
  if (jsHref) {
    const jsDelay = Number(
      html.match(/setTimeout\([^,]*,\s*(\d+)\s*\)/i)?.[1],
    );
    return {
      delayMs: Number.isFinite(jsDelay) ? jsDelay : 1200,
      url: new URL(jsHref, baseUrl).href,
    };
  }

  return null;
}

/**
 * 抓取豆瓣页面 HTML，自动处理豆瓣反爬：
 * 1. 首次请求可能 302 到 sec.douban.com 的 PoW 验证页（"载入中 ..."），
 *    通过 credentials: "include" 让浏览器自动存储/携带 cookie；
 * 2. 检测到验证页时模拟计算 PoW nonce 并 POST 回执，通过后重取详情页；
 * 3. 其他等待页（meta refresh / JS 跳转）则等待对应延迟后重试。
 */
async function fetchDoubanHtml(
  url: string,
  maxAttempts = 3,
): Promise<string> {
  let lastHtml = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(url, {
      credentials: "include",
      referrer: ORIGIN,
      referrerPolicy: "unsafe-url",
      headers: {
        "user-agent": UA,
      },
    });
    const html = await res.text();
    console.log(
      `[fetchDoubanHtml] attempt ${attempt}/${maxAttempts} status=${res.status} length=${html.length}`,
    );

    // 429 限流：等待后重试，避免连续触发风控
    if (res.status === 429) {
      lastHtml = html;
      await sleep(3000);
      continue;
    }

    // 已拿到真实详情页（目标节点存在）
    if (load(html)("#content .article .subjectwrap").length > 0) {
      return html;
    }

    lastHtml = html;

    // 豆瓣 PoW 验证页：模拟计算 nonce 并 POST 回执
    const pow = parsePowForm(html);
    if (pow) {
      const solved = await solveDoubanPowChallenge(pow);
      if (solved) {
        if (
          load(solved.html)("#content .article .subjectwrap").length > 0
        ) {
          return solved.html;
        }
        // 验证通过（302 已种下 cookie）：跟随重定向重新抓取
        lastHtml = solved.html;
        if (solved.followUrl) url = solved.followUrl;
      }
      continue;
    }

    // 其他等待页（meta refresh / JS 跳转）：等待对应延迟后重试
    const redirect = parseRedirect(html, url);
    if (redirect) {
      console.log("[fetchDoubanHtml] 检测到等待页跳转", redirect);
      await sleep(redirect.delayMs);
      if (redirect.url) url = redirect.url;
      continue;
    }

    // 无跳转特征（如风控提示页）：等待后重试原 URL
    console.log("[fetchDoubanHtml] 疑似等待页（无跳转特征），稍后重试");
    await sleep(1500);
  }

  return lastHtml;
}

export async function genDoubanScreenshot(url: string, originTabId?: number) {
  console.log("[genDoubanScreenshot] start", { url, originTabId });

  // 1. fetch 页面 HTML（自动处理豆瓣"请稍候"等待页并重试）
  const html = await fetchDoubanHtml(url);
  console.log("[genDoubanScreenshot] fetched html length", html.length);

  const $ = load(html);

  // 2. 提取目标节点 HTML
  let nodeHtml = $("#content .article .subjectwrap").prop("outerHTML");
  if (!nodeHtml) {
    console.log("[genDoubanScreenshot] subjectwrap not found");
    return;
  }

  const extraSelectors = ["#content > h1", "#content > .rank-label"];
  extraSelectors.forEach((se) => {
    const extraHtml = $(se).prop("outerHTML");
    if (!extraHtml) return;

    nodeHtml = extraHtml + nodeHtml;
  });

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

  if (!gactFirst) {
    $node('#mainpic').append("<p class='gact'></p>");
    gactFirst = $node('#mainpic .gact').first();
  }

  if (gactFirst) {
    try {
      // 豆瓣链接二维码
      const doubanSvg = await genQRCodeHTML(url, "豆瓣");

      // 当前页面二维码
      const pageSvg = await genCurrentPageQRCodeHTML();

      gactFirst.replaceWith(
        `<div style="display:flex;justify-content:space-between;padding:8px 0">
          ${doubanSvg}
          ${pageSvg}
        </div>`,
      );
    } catch (e) {
      console.log("[genDoubanScreenshot] qrcode error", e);
      gactFirst.remove();
    }
  }

  // 4d. 添加插件主页二维码
  $node("#interest_sectl").each((i, el) => {
    genHomePageQRCodeHTML().then((svg) => {
      $node(el).append(svg);
    });
  });

  // 4e. 将外部图片转为 data URL 内联（避免截图跨域）
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

  // 5. 将所有相对地址链接转换为绝对地址
  $node("a").each((i, el) => {
    const n = $node(el);
    const href = n.attr("href") || "";
    if (!href) return;

    if (href === "comments") {
      n.attr("href", url + href);
    } else if (/^\/[^\/]/.test(href)) {
      n.attr("href", ORIGIN + href);
    }

    n.attr("target", "_blank");
  });

  const nodeHtmlInlined = $node.html();
  console.log(`[genDoubanScreenshot] inlined ${imgTasks.length} images`);

  return { url, html: nodeHtmlInlined, css: allCss };
}
