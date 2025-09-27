var U = Object.defineProperty;
var P = (s, t, n) => t in s ? U(s, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : s[t] = n;
var C = (s, t, n) => (P(s, typeof t != "symbol" ? t + "" : t, n), n);
class D {
  constructor(t) {
    C(this, "data");
    C(this, "pos");
    this.data = t, this.pos = 0;
  }
  getNextNBytes(t) {
    const n = this.data.slice(this.pos, this.pos + t);
    return this.pos += t, n;
  }
  read32BitInteger() {
    const t = this.getNextNBytes(4);
    return t.length === 4 ? t[0] << 24 | t[1] << 16 | t[2] << 8 | t[3] : null;
  }
}
function S(s, t, n) {
  const a = new Uint8Array(Math.floor(s.length / 4));
  for (let o = 0; o < s.length; o += 4)
    a[o / 4] = s[o + 3] & 1;
  const e = new Uint8Array(a.length);
  for (let o = 0; o < n; o++)
    for (let c = 0; c < t; c++)
      e[c * n + o] = a[o * t + c];
  return e;
}
function A(s, t, n, a = !1) {
  const e = new Uint8Array(t * n * 3);
  let o = 0;
  if (a)
    for (let c = 0; c < t; c++)
      for (let i = 0; i < n; i++) {
        const l = (i * t + c) * 4;
        e[o++] = s[l] & 1, e[o++] = s[l + 1] & 1, e[o++] = s[l + 2] & 1;
      }
  else
    for (let c = 0; c < n; c++)
      for (let i = 0; i < t; i++) {
        const l = (c * t + i) * 4;
        e[o++] = s[l] & 1, e[o++] = s[l + 1] & 1, e[o++] = s[l + 2] & 1;
      }
  return e;
}
function T(s) {
  const t = Math.floor(s.length / 8) * 8, n = s.slice(0, t), a = new Uint8Array(Math.floor(t / 8));
  for (let e = 0; e < a.length; e++) {
    let o = 0;
    for (let c = 0; c < 8; c++)
      o |= n[e * 8 + c] << 7 - c;
    a[e] = o;
  }
  return a;
}
function L(s) {
  const t = [
    { magic: "stealth_pngcomp", format: "alpha", compressed: !0 },
    { magic: "stealth_pnginfo", format: "alpha", compressed: !1 },
    { magic: "stealth_rgbcomp", format: "rgb", compressed: !0 },
    { magic: "stealth_rgbinfo", format: "rgb", compressed: !1 }
  ], n = Math.max(...t.map((o) => o.magic.length)), a = s.getNextNBytes(n), e = new TextDecoder().decode(a);
  for (const { magic: o, format: c, compressed: i } of t)
    if (e.startsWith(o))
      return { isValid: !0, format: c, isCompressed: i };
  return { isValid: !1, format: null, isCompressed: null };
}
async function N(s) {
  const t = new Blob([s]);
  return await new Response(
    t.stream().pipeThrough(new DecompressionStream("gzip"))
  ).arrayBuffer();
}
async function E(s) {
  if (typeof DecompressionStream == "function")
    try {
      const t = new Blob([s]), a = await new Response(
        t.stream().pipeThrough(new DecompressionStream("deflate"))
      ).arrayBuffer();
      return new TextDecoder().decode(a);
    } catch {
      try {
        const n = new Blob([s]), e = await new Response(
          n.stream().pipeThrough(new DecompressionStream("deflate-raw"))
        ).arrayBuffer();
        return new TextDecoder().decode(e);
      } catch {
      }
    }
  throw new Error("DecompressionStream未対応のため圧縮テキストを展開できません");
}
async function R(s) {
  try {
    const t = new Blob([s], { type: "image/png" }), n = await createImageBitmap(t), e = new OffscreenCanvas(n.width, n.height).getContext("2d");
    if (!e)
      throw new Error("2Dコンテキストの取得に失敗しました");
    e.drawImage(n, 0, 0);
    const c = e.getImageData(0, 0, n.width, n.height).data, i = S(c, n.width, n.height), l = T(i), f = new D(l), r = "stealth_pngcomp", d = f.getNextNBytes(r.length), m = new TextDecoder().decode(d);
    if (r !== m)
      return null;
    const h = f.read32BitInteger();
    if (h === null)
      return null;
    const B = f.getNextNBytes(Math.floor(h / 8)), u = await N(B), p = new TextDecoder().decode(u), g = JSON.parse(p);
    if (g.Comment && typeof g.Comment == "string")
      try {
        g.Comment = JSON.parse(g.Comment);
      } catch {
      }
    return { items: Object.entries(g).map(([w, y]) => ({
      type: "tEXt",
      keyword: w,
      text: JSON.stringify(y)
    })) };
  } catch {
    return null;
  }
}
async function v(s, t) {
  try {
    const n = new Blob([s], { type: "image/png" }), a = await createImageBitmap(n), o = new OffscreenCanvas(a.width, a.height).getContext("2d");
    if (!o)
      throw new Error("2Dコンテキストの取得に失敗しました");
    o.drawImage(a, 0, 0);
    const i = o.getImageData(0, 0, a.width, a.height).data, l = a.width, f = a.height;
    let r = null;
    const d = S(i, l, f), m = T(d), h = new D(m), B = L(h);
    if (B.isValid) {
      const u = h.read32BitInteger();
      if (u !== null) {
        const p = h.getNextNBytes(Math.floor(u / 8));
        if (B.isCompressed) {
          const g = await N(p);
          r = new TextDecoder().decode(g);
        } else
          r = new TextDecoder().decode(p);
      }
    }
    if (r === null) {
      const u = A(i, l, f), p = T(u), g = new D(p), x = L(g);
      if (x.isValid) {
        const w = g.read32BitInteger();
        if (w !== null) {
          const y = g.getNextNBytes(Math.floor(w / 8));
          if (x.isCompressed) {
            const b = await N(y);
            r = new TextDecoder().decode(b);
          } else
            r = new TextDecoder().decode(y);
        }
      } else {
        const w = A(i, l, f, !0), y = T(w), b = new D(y), k = L(b);
        if (k.isValid) {
          const M = b.read32BitInteger();
          if (M !== null) {
            const I = b.getNextNBytes(Math.floor(M / 8));
            if (k.isCompressed) {
              const O = await N(I);
              r = new TextDecoder().decode(O);
            } else
              r = new TextDecoder().decode(I);
          }
        }
      }
    }
    return r === null ? null : {
      items: [
        {
          type: "tEXt",
          keyword: "parameters",
          text: r
        }
      ]
    };
  } catch {
    return null;
  }
}
async function G(s) {
  const t = new Uint8Array(s), n = new DataView(s), a = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let l = 0; l < 8; l++)
    if (t[l] !== a[l])
      throw new Error("PNG署名が一致しません");
  let e = 8;
  const o = new TextDecoder("latin1"), c = new TextDecoder(), i = [];
  for (; e + 8 <= n.byteLength; ) {
    const l = n.getUint32(e);
    if (e += 4, e + 4 > n.byteLength)
      break;
    const f = String.fromCharCode(t[e], t[e + 1], t[e + 2], t[e + 3]);
    if (e += 4, e + l + 4 > n.byteLength)
      break;
    const r = t.slice(e, e + l);
    e += l, n.getUint32(e), e += 4;
    try {
      if (f === "tEXt") {
        const d = r.indexOf(0), m = o.decode(r.slice(0, d)), h = o.decode(r.slice(d + 1));
        i.push({ type: f, keyword: m, text: h });
      } else if (f === "iTXt") {
        let d = 0;
        const m = r.indexOf(0, d), h = o.decode(r.slice(d, m));
        d = m + 1;
        const B = r[d++], u = r[d++], p = r.indexOf(0, d), g = o.decode(r.slice(d, p));
        d = p + 1;
        const x = r.indexOf(0, d), w = c.decode(r.slice(d, x));
        d = x + 1;
        const y = r.slice(d);
        let b;
        B === 1 ? b = await E(y) : b = c.decode(y), i.push({
          type: f,
          keyword: h,
          text: b,
          languageTag: g,
          translatedKeyword: w,
          compMethod: u
        });
      } else if (f === "zTXt") {
        const d = r.indexOf(0), m = o.decode(r.slice(0, d)), h = r[d + 1], B = r.slice(d + 2), u = await E(B);
        i.push({ type: f, keyword: m, text: u, compMethod: h });
      }
    } catch (d) {
      i.push({ type: f, keyword: "parse-error", text: String(d) });
    }
    if (f === "IEND")
      break;
  }
  return { items: i };
}
async function _(s, t) {
  const n = await fetch(s, {
    // DNRでRefererは強制付与される想定
    credentials: "omit",
    cache: "no-cache",
    mode: "cors"
  });
  if (!n.ok)
    throw new Error(`画像取得に失敗: HTTP ${n.status}`);
  const a = await n.arrayBuffer();
  try {
    let e;
    if (s.toLowerCase().endsWith(".png"))
      e = await R(a), e || (e = await v(a, t)), e || (e = await G(a));
    else
      return {
        ok: !0,
        isNotPng: !0,
        parsed: { items: [] },
        bytes: a.byteLength
      };
    return { ok: !0, parsed: e, bytes: a.byteLength };
  } catch {
    return { ok: !0, parsed: { items: [] }, bytes: a.byteLength };
  }
}
function V(s, t, n, a) {
  s && chrome.tabs.sendMessage(s, {
    type: "DEBUG_INFO",
    label: t,
    data: n,
    error: a ? a instanceof Error ? a.message : String(a) : void 0
  });
}
chrome.action.onClicked.addListener((s) => {
  s.id && chrome.tabs.sendMessage(s.id, { type: "TOGGLE_PANEL" });
});
chrome.runtime.onMessage.addListener((s, t, n) => {
  if (s && s.type === "GET_METADATA")
    return (async () => {
      var a;
      try {
        const { imageUrls: e } = s, o = (a = t.tab) == null ? void 0 : a.id;
        if (!e || !Array.isArray(e) || e.length === 0) {
          o && V(o, "メタデータ取得エラー", null, "有効な画像URLが指定されていません"), n({ success: !1, log: "有効な画像URLが指定されていません" });
          return;
        }
        for (const c of e)
          try {
            const i = await _(c, o);
            n({ success: !0, metadata: i, url: c });
            return;
          } catch (i) {
            if (i.message.includes("HTTP 404") || i.message.includes("PNG以外の形式はまだサポートされていません"))
              continue;
            throw i;
          }
        n({ success: !1, log: "メタデータが見つかりません" });
      } catch (e) {
        n({ success: !1, log: e.message || String(e) });
      }
    })(), !0;
});
//# sourceMappingURL=background.js.map
