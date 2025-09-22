/**
 * バックグラウンドスクリプト
 * メタデータの取得と解析を担当
 */
import { CONFIG } from '../constants';

/**
 * PNG画像のテキストチャンクを解析
 */
async function parsePngTextChunks(buf: ArrayBuffer): Promise<any> {
  const u8 = new Uint8Array(buf);
  const dv = new DataView(buf);
  
  // PNG署名チェック
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) {
    if (u8[i] !== sig[i]) {
      throw new Error('PNG署名が一致しません');
    }
  }
  
  let off = 8;
  const latin1 = new TextDecoder('latin1');
  const utf8 = new TextDecoder();
  const items = [];
  
  while (off + 8 <= dv.byteLength) {
    const len = dv.getUint32(off);
    off += 4;
    
    if (off + 4 > dv.byteLength) break;
    
    const type = String.fromCharCode(u8[off], u8[off+1], u8[off+2], u8[off+3]);
    off += 4;
    
    if (off + len + 4 > dv.byteLength) break; // 範囲外
    
    const data = u8.slice(off, off + len);
    off += len;
    
    const _crc = dv.getUint32(off);
    off += 4;

    try {
      if (type === 'tEXt') {
        // 非圧縮テキスト
        const sep = data.indexOf(0);
        const keyword = latin1.decode(data.slice(0, sep));
        const text = latin1.decode(data.slice(sep + 1));
        items.push({ type, keyword, text });
      } else if (type === 'iTXt') {
        // 国際テキスト
        let p = 0;
        const i0 = data.indexOf(0, p);
        const keyword = latin1.decode(data.slice(p, i0));
        p = i0 + 1;
        
        const compFlag = data[p++];
        const compMethod = data[p++];
        
        const i1 = data.indexOf(0, p);
        const languageTag = latin1.decode(data.slice(p, i1));
        p = i1 + 1;
        
        const i2 = data.indexOf(0, p);
        const translatedKeyword = utf8.decode(data.slice(p, i2));
        p = i2 + 1;
        
        const textBytes = data.slice(p);
        let text;
        
        if (compFlag === 1) {
          text = await inflateToString(textBytes); // zlib圧縮
        } else {
          text = utf8.decode(textBytes);
        }
        
        items.push({
          type,
          keyword,
          text,
          languageTag,
          translatedKeyword,
          compMethod
        });
      } else if (type === 'zTXt') {
        // 圧縮テキスト
        const sep = data.indexOf(0);
        const keyword = latin1.decode(data.slice(0, sep));
        const compMethod = data[sep + 1];
        const compressed = data.slice(sep + 2);
        const text = await inflateToString(compressed);
        items.push({ type, keyword, text, compMethod });
      }
    } catch (e) {
      items.push({ type, keyword: 'parse-error', text: String(e) });
    }

    if (type === 'IEND') break;
  }
  
  return { items };
}

/**
 * 圧縮データを展開してテキストに変換
 */
async function inflateToString(u8: Uint8Array): Promise<string> {
  if (typeof DecompressionStream === 'function') {
    try {
      const blob = new Blob([u8 as unknown as BlobPart]);
      const stream = new Response(
        blob.stream().pipeThrough(new DecompressionStream('deflate'))
      );
      const ab = await stream.arrayBuffer();
      return new TextDecoder().decode(ab);
    } catch (e) {
      // deflate-rawを試す
      try { 
        const blob = new Blob([u8 as unknown as BlobPart]);
        const stream = new Response(
          blob.stream().pipeThrough(new DecompressionStream('deflate-raw'))
        );
        const ab = await stream.arrayBuffer();
        return new TextDecoder().decode(ab);
      } catch (e) {
        // どちらも失敗
      }
    }
  }
  
  throw new Error('DecompressionStream未対応のため圧縮テキストを展開できません');
}


/**
 * 画像からメタデータを取得
 */
async function fetchAndParseMetadata(url: string): Promise<any> {
  // 画像を取得
  const res = await fetch(url, {
    // DNRでRefererは強制付与される想定
    credentials: 'omit',
    cache: 'no-cache',
    mode: 'cors'
  });
  
  if (!res.ok) {
    throw new Error(`画像取得に失敗: HTTP ${res.status}`);
  }
  
  const buf = await res.arrayBuffer();
  
  try {
    // 拡張子に基づいて解析
    let parsed;
    const urlLower = url.toLowerCase();
    
    if (urlLower.endsWith('.png')) {
      parsed = await parsePngTextChunks(buf);
    } else {
      // PNG以外の形式の場合は何もせず処理を完了
      console.log('PNG以外の画像を検出しました。処理を完了します。');
      return { 
        ok: true, 
        isNotPng: true,
        parsed: { items: [] }, 
        bytes: buf.byteLength 
      };
    }
    
    // summary の生成部分を削除
    return { ok: true, parsed, bytes: buf.byteLength };
  } catch (e) {
    console.log('メタデータ解析エラー:', e);
    // エラーが発生しても空の結果を返す
    return { ok: true, parsed: { items: [] }, bytes: buf.byteLength };
  }
}

/**
 * 拡張機能アイコンのクリックイベント
 */
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_PANEL' });
  }
});

/**
 * メッセージハンドラ
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === 'GET_METADATA') {
    (async () => {
      try {
        const { imageUrls } = message;
        
        if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
          sendResponse({ success: false, log: '有効な画像URLが指定されていません' });
          return;
        }
        
        // 画像URLを順番に試行
        for (const url of imageUrls) {
          try {
            const metadata = await fetchAndParseMetadata(url);
            sendResponse({ success: true, metadata, url });
            return;
          } catch (err: any) {
            // 404の場合は次のURLを試す、それ以外はエラー
            if (err.message.includes('HTTP 404')) {
              continue;
            }
            // PNG以外の形式はまだサポートされていない場合も次のURLを試す
            if (err.message.includes('PNG以外の形式はまだサポートされていません')) {
              continue;
            }
            throw err;
          }
        }
        
        // すべてのURLで失敗
        sendResponse({ success: false, log: 'メタデータが見つかりません' });
      } catch (e: any) {
        sendResponse({ success: false, log: e.message || String(e) });
      }
    })();
    return true; // 非同期レスポンス
  }
});
