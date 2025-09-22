async function k(n) {
  const c = new Uint8Array(n), s = new DataView(n), o = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++)
    if (c[i] !== o[i])
      throw new Error("PNG署名が一致しません");
  let e = 8;
  const a = new TextDecoder("latin1"), g = new TextDecoder(), f = [];
  for (; e + 8 <= s.byteLength; ) {
    const i = s.getUint32(e);
    if (e += 4, e + 4 > s.byteLength)
      break;
    const d = String.fromCharCode(c[e], c[e + 1], c[e + 2], c[e + 3]);
    if (e += 4, e + i + 4 > s.byteLength)
      break;
    const r = c.slice(e, e + i);
    e += i, s.getUint32(e), e += 4;
    try {
      if (d === "tEXt") {
        const t = r.indexOf(0), l = a.decode(r.slice(0, t)), u = a.decode(r.slice(t + 1));
        f.push({ type: d, keyword: l, text: u });
      } else if (d === "iTXt") {
        let t = 0;
        const l = r.indexOf(0, t), u = a.decode(r.slice(t, l));
        t = l + 1;
        const h = r[t++], w = r[t++], m = r.indexOf(0, t), x = a.decode(r.slice(t, m));
        t = m + 1;
        const p = r.indexOf(0, t), L = g.decode(r.slice(t, p));
        t = p + 1;
        const b = r.slice(t);
        let y;
        h === 1 ? y = await T(b) : y = g.decode(b), f.push({
          type: d,
          keyword: u,
          text: y,
          languageTag: x,
          translatedKeyword: L,
          compMethod: w
        });
      } else if (d === "zTXt") {
        const t = r.indexOf(0), l = a.decode(r.slice(0, t)), u = r[t + 1], h = r.slice(t + 2), w = await T(h);
        f.push({ type: d, keyword: l, text: w, compMethod: u });
      }
    } catch (t) {
      f.push({ type: d, keyword: "parse-error", text: String(t) });
    }
    if (d === "IEND")
      break;
  }
  return { items: f };
}
async function T(n) {
  if (typeof DecompressionStream == "function")
    try {
      const c = new Blob([n]), o = await new Response(
        c.stream().pipeThrough(new DecompressionStream("deflate"))
      ).arrayBuffer();
      return new TextDecoder().decode(o);
    } catch {
      try {
        const s = new Blob([n]), e = await new Response(
          s.stream().pipeThrough(new DecompressionStream("deflate-raw"))
        ).arrayBuffer();
        return new TextDecoder().decode(e);
      } catch {
      }
    }
  throw new Error("DecompressionStream未対応のため圧縮テキストを展開できません");
}
async function D(n) {
  const c = await fetch(n, {
    // DNRでRefererは強制付与される想定
    credentials: "omit",
    cache: "no-cache",
    mode: "cors"
  });
  if (!c.ok)
    throw new Error(`画像取得に失敗: HTTP ${c.status}`);
  const s = await c.arrayBuffer();
  try {
    let o;
    if (n.toLowerCase().endsWith(".png"))
      o = await k(s);
    else
      return console.log("PNG以外の画像を検出しました。処理を完了します。"), {
        ok: !0,
        isNotPng: !0,
        parsed: { items: [] },
        bytes: s.byteLength
      };
    return { ok: !0, parsed: o, bytes: s.byteLength };
  } catch (o) {
    return console.log("メタデータ解析エラー:", o), { ok: !0, parsed: { items: [] }, bytes: s.byteLength };
  }
}
chrome.action.onClicked.addListener((n) => {
  n.id && chrome.tabs.sendMessage(n.id, { type: "TOGGLE_PANEL" });
});
chrome.runtime.onMessage.addListener((n, c, s) => {
  if (n && n.type === "GET_METADATA")
    return (async () => {
      try {
        const { imageUrls: o } = n;
        if (!o || !Array.isArray(o) || o.length === 0) {
          s({ success: !1, log: "有効な画像URLが指定されていません" });
          return;
        }
        for (const e of o)
          try {
            const a = await D(e);
            s({ success: !0, metadata: a, url: e });
            return;
          } catch (a) {
            if (a.message.includes("HTTP 404") || a.message.includes("PNG以外の形式はまだサポートされていません"))
              continue;
            throw a;
          }
        s({ success: !1, log: "メタデータが見つかりません" });
      } catch (o) {
        s({ success: !1, log: o.message || String(o) });
      }
    })(), !0;
});
//# sourceMappingURL=background.js.map
