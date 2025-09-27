var S = Object.defineProperty;
var M = (n, s, t) => s in n ? S(n, s, { enumerable: !0, configurable: !0, writable: !0, value: t }) : n[s] = t;
var k = (n, s, t) => (M(n, typeof s != "symbol" ? s + "" : s, t), t);
function O(n, s, t, o) {
  n && chrome.tabs.sendMessage(n, {
    type: "DEBUG_INFO",
    label: s,
    data: t,
    error: o ? o instanceof Error ? o.message : String(o) : void 0
  });
}
async function U(n, s) {
  try {
    const t = new Blob([n], { type: "image/png" }), o = await createImageBitmap(t), d = new OffscreenCanvas(o.width, o.height).getContext("2d");
    if (!d)
      throw new Error("2Dコンテキストの取得に失敗しました");
    d.drawImage(o, 0, 0);
    const l = d.getImageData(0, 0, o.width, o.height).data, h = new Uint8Array(Math.floor(l.length / 4));
    for (let i = 0; i < l.length; i += 4)
      h[i / 4] = l[i + 3] & 1;
    const f = o.width, c = o.height, r = new Uint8Array(h.length);
    for (let i = 0; i < c; i++)
      for (let a = 0; a < f; a++)
        r[a * c + i] = h[i * f + a];
    const g = Math.floor(r.length / 8) * 8, u = r.slice(0, g), m = new Uint8Array(Math.floor(g / 8));
    for (let i = 0; i < m.length; i++) {
      let a = 0;
      for (let y = 0; y < 8; y++)
        a |= u[i * 8 + y] << 7 - y;
      m[i] = a;
    }
    class b {
      constructor(a) {
        k(this, "data");
        k(this, "pos");
        this.data = a, this.pos = 0;
      }
      getNextNBytes(a) {
        const y = this.data.slice(this.pos, this.pos + a);
        return this.pos += a, y;
      }
      read32BitInteger() {
        const a = this.getNextNBytes(4);
        return a.length === 4 ? a[0] << 24 | a[1] << 16 | a[2] << 8 | a[3] : null;
      }
    }
    const w = new b(m), D = "stealth_pngcomp", L = w.getNextNBytes(D.length), N = new TextDecoder().decode(L);
    if (D !== N)
      return null;
    const x = w.read32BitInteger();
    if (x === null)
      return null;
    const T = w.getNextNBytes(Math.floor(x / 8)), A = await I(T), E = new TextDecoder().decode(A), B = JSON.parse(E);
    if (B.Comment && typeof B.Comment == "string")
      try {
        B.Comment = JSON.parse(B.Comment);
      } catch {
      }
    return { items: Object.entries(B).map(([i, a]) => ({
      type: "tEXt",
      keyword: i,
      text: JSON.stringify(a)
    })) };
  } catch {
    return null;
  }
}
async function I(n) {
  const s = new Blob([n]);
  return await new Response(
    s.stream().pipeThrough(new DecompressionStream("gzip"))
  ).arrayBuffer();
}
async function P(n) {
  const s = new Uint8Array(n), t = new DataView(n), o = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let h = 0; h < 8; h++)
    if (s[h] !== o[h])
      throw new Error("PNG署名が一致しません");
  let e = 8;
  const d = new TextDecoder("latin1"), p = new TextDecoder(), l = [];
  for (; e + 8 <= t.byteLength; ) {
    const h = t.getUint32(e);
    if (e += 4, e + 4 > t.byteLength)
      break;
    const f = String.fromCharCode(s[e], s[e + 1], s[e + 2], s[e + 3]);
    if (e += 4, e + h + 4 > t.byteLength)
      break;
    const c = s.slice(e, e + h);
    e += h, t.getUint32(e), e += 4;
    try {
      if (f === "tEXt") {
        const r = c.indexOf(0), g = d.decode(c.slice(0, r)), u = d.decode(c.slice(r + 1));
        l.push({ type: f, keyword: g, text: u });
      } else if (f === "iTXt") {
        let r = 0;
        const g = c.indexOf(0, r), u = d.decode(c.slice(r, g));
        r = g + 1;
        const m = c[r++], b = c[r++], w = c.indexOf(0, r), D = d.decode(c.slice(r, w));
        r = w + 1;
        const L = c.indexOf(0, r), N = p.decode(c.slice(r, L));
        r = L + 1;
        const x = c.slice(r);
        let T;
        m === 1 ? T = await C(x) : T = p.decode(x), l.push({
          type: f,
          keyword: u,
          text: T,
          languageTag: D,
          translatedKeyword: N,
          compMethod: b
        });
      } else if (f === "zTXt") {
        const r = c.indexOf(0), g = d.decode(c.slice(0, r)), u = c[r + 1], m = c.slice(r + 2), b = await C(m);
        l.push({ type: f, keyword: g, text: b, compMethod: u });
      }
    } catch (r) {
      l.push({ type: f, keyword: "parse-error", text: String(r) });
    }
    if (f === "IEND")
      break;
  }
  return { items: l };
}
async function C(n) {
  if (typeof DecompressionStream == "function")
    try {
      const s = new Blob([n]), o = await new Response(
        s.stream().pipeThrough(new DecompressionStream("deflate"))
      ).arrayBuffer();
      return new TextDecoder().decode(o);
    } catch {
      try {
        const t = new Blob([n]), e = await new Response(
          t.stream().pipeThrough(new DecompressionStream("deflate-raw"))
        ).arrayBuffer();
        return new TextDecoder().decode(e);
      } catch {
      }
    }
  throw new Error("DecompressionStream未対応のため圧縮テキストを展開できません");
}
async function G(n, s) {
  const t = await fetch(n, {
    // DNRでRefererは強制付与される想定
    credentials: "omit",
    cache: "no-cache",
    mode: "cors"
  });
  if (!t.ok)
    throw new Error(`画像取得に失敗: HTTP ${t.status}`);
  const o = await t.arrayBuffer();
  try {
    let e;
    if (n.toLowerCase().endsWith(".png"))
      e = await U(o, s), e || (e = await P(o));
    else
      return {
        ok: !0,
        isNotPng: !0,
        parsed: { items: [] },
        bytes: o.byteLength
      };
    return { ok: !0, parsed: e, bytes: o.byteLength };
  } catch {
    return { ok: !0, parsed: { items: [] }, bytes: o.byteLength };
  }
}
chrome.action.onClicked.addListener((n) => {
  n.id && chrome.tabs.sendMessage(n.id, { type: "TOGGLE_PANEL" });
});
chrome.runtime.onMessage.addListener((n, s, t) => {
  if (n && n.type === "GET_METADATA")
    return (async () => {
      var o;
      try {
        const { imageUrls: e } = n, d = (o = s.tab) == null ? void 0 : o.id;
        if (!e || !Array.isArray(e) || e.length === 0) {
          d && O(d, "メタデータ取得エラー", null, "有効な画像URLが指定されていません"), t({ success: !1, log: "有効な画像URLが指定されていません" });
          return;
        }
        for (const p of e)
          try {
            const l = await G(p, d);
            t({ success: !0, metadata: l, url: p });
            return;
          } catch (l) {
            if (l.message.includes("HTTP 404") || l.message.includes("PNG以外の形式はまだサポートされていません"))
              continue;
            throw l;
          }
        t({ success: !1, log: "メタデータが見つかりません" });
      } catch (e) {
        t({ success: !1, log: e.message || String(e) });
      }
    })(), !0;
});
//# sourceMappingURL=background.js.map
