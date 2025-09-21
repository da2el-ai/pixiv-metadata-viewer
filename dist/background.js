async function D(c) {
  const n = new Uint8Array(c), s = new DataView(c), o = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++)
    if (n[i] !== o[i])
      throw new Error("PNG署名が一致しません");
  let e = 8;
  const a = new TextDecoder("latin1"), g = new TextDecoder(), f = [];
  for (; e + 8 <= s.byteLength; ) {
    const i = s.getUint32(e);
    if (e += 4, e + 4 > s.byteLength)
      break;
    const d = String.fromCharCode(n[e], n[e + 1], n[e + 2], n[e + 3]);
    if (e += 4, e + i + 4 > s.byteLength)
      break;
    const r = n.slice(e, e + i);
    e += i, s.getUint32(e), e += 4;
    try {
      if (d === "tEXt") {
        const t = r.indexOf(0), l = a.decode(r.slice(0, t)), u = a.decode(r.slice(t + 1));
        f.push({ type: d, keyword: l, text: u });
      } else if (d === "iTXt") {
        let t = 0;
        const l = r.indexOf(0, t), u = a.decode(r.slice(t, l));
        t = l + 1;
        const w = r[t++], h = r[t++], m = r.indexOf(0, t), x = a.decode(r.slice(t, m));
        t = m + 1;
        const p = r.indexOf(0, t), k = g.decode(r.slice(t, p));
        t = p + 1;
        const b = r.slice(t);
        let y;
        w === 1 ? y = await T(b) : y = g.decode(b), f.push({
          type: d,
          keyword: u,
          text: y,
          languageTag: x,
          translatedKeyword: k,
          compMethod: h
        });
      } else if (d === "zTXt") {
        const t = r.indexOf(0), l = a.decode(r.slice(0, t)), u = r[t + 1], w = r.slice(t + 2), h = await T(w);
        f.push({ type: d, keyword: l, text: h, compMethod: u });
      }
    } catch (t) {
      f.push({ type: d, keyword: "parse-error", text: String(t) });
    }
    if (d === "IEND")
      break;
  }
  return { items: f };
}
async function T(c) {
  if (typeof DecompressionStream == "function")
    try {
      const n = new Blob([c]), o = await new Response(
        n.stream().pipeThrough(new DecompressionStream("deflate"))
      ).arrayBuffer();
      return new TextDecoder().decode(o);
    } catch {
      try {
        const s = new Blob([c]), e = await new Response(
          s.stream().pipeThrough(new DecompressionStream("deflate-raw"))
        ).arrayBuffer();
        return new TextDecoder().decode(e);
      } catch {
      }
    }
  throw new Error("DecompressionStream未対応のため圧縮テキストを展開できません");
}
async function L(c) {
  const n = await fetch(c, {
    // DNRでRefererは強制付与される想定
    credentials: "omit",
    cache: "no-cache",
    mode: "cors"
  });
  if (!n.ok)
    throw new Error(`画像取得に失敗: HTTP ${n.status}`);
  const s = await n.arrayBuffer();
  try {
    let o;
    if (c.toLowerCase().endsWith(".png"))
      o = await D(s);
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
chrome.runtime.onMessage.addListener((c, n, s) => {
  if (c && c.type === "GET_METADATA")
    return (async () => {
      try {
        const { imageUrls: o } = c;
        if (!o || !Array.isArray(o) || o.length === 0) {
          s({ success: !1, log: "有効な画像URLが指定されていません" });
          return;
        }
        for (const e of o)
          try {
            const a = await L(e);
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
