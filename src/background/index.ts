/**
 * バックグラウンドスクリプト
 * メタデータの取得と解析を担当
 */
import { CONFIG } from '../constants';

/**
 * デバッグ情報をコンテンツスクリプトに送信
 */
function sendDebugInfo(tabId: number | undefined, label: string, data?: any, error?: any): void {
  if (!tabId) return;
  
  chrome.tabs.sendMessage(tabId, {
    type: 'DEBUG_INFO',
    label,
    data,
    error: error ? (error instanceof Error ? error.message : String(error)) : undefined
  });
}

/**
 * PNGのαチャンネルに埋め込まれたメタデータを抽出
 * NovelAIなどで使用されるstealth_pngcompフォーマットに対応
 */
async function parsePngAlphaChannel(buf: ArrayBuffer, tabId?: number): Promise<any | null> {
  try {
    // 画像をデコード
    const blob = new Blob([buf], { type: 'image/png' });
    const imgBitmap = await createImageBitmap(blob);
    
    // // デバッグ情報を送信
    // if (tabId) {
    //   sendDebugInfo(tabId, 'αチャンネル解析開始', {
    //     width: imgBitmap.width,
    //     height: imgBitmap.height,
    //     size: buf.byteLength
    //   });
    // }
    
    // OffscreenCanvasを作成して画像を描画
    const canvas = new OffscreenCanvas(imgBitmap.width, imgBitmap.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('2Dコンテキストの取得に失敗しました');
    }
    
    ctx.drawImage(imgBitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, imgBitmap.width, imgBitmap.height);
    const pixels = imageData.data;
    
    // αチャンネルの最下位ビットを抽出
    const alphaChannel = new Uint8Array(Math.floor(pixels.length / 4));
    for (let i = 0; i < pixels.length; i += 4) {
      alphaChannel[i / 4] = pixels[i + 3] & 1; // αチャンネルの最下位ビット
    }
    
    // // デバッグ情報を送信
    // if (tabId) {
    //   sendDebugInfo(tabId, 'αチャンネル抽出完了', {
    //     alphaChannelLength: alphaChannel.length,
    //     sampleValues: Array.from(alphaChannel.slice(0, 20)) // 最初の20個の値をサンプルとして送信
    //   });
    // }
    
    // Pythonの実装に合わせて転置処理を追加
    // 画像データは行優先で格納されているため、列優先に変換する
    const width = imgBitmap.width;
    const height = imgBitmap.height;
    const transposedAlphaChannel = new Uint8Array(alphaChannel.length);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // 転置: (x, y) -> (y, x)
        transposedAlphaChannel[x * height + y] = alphaChannel[y * width + x];
      }
    }
    
    // if (tabId) {
    //   sendDebugInfo(tabId, 'αチャンネル転置完了', {
    //     sampleValues: Array.from(transposedAlphaChannel.slice(0, 20)) // 最初の20個の値をサンプルとして送信
    //   });
    // }
    
    // 8ビットごとにバイトにパック
    // Pythonの実装に合わせて、8の倍数に切り捨て
    const packedLength = Math.floor(transposedAlphaChannel.length / 8) * 8;
    const truncatedAlphaChannel = transposedAlphaChannel.slice(0, packedLength);
    const packedBytes = new Uint8Array(Math.floor(packedLength / 8));
    
    for (let i = 0; i < packedBytes.length; i++) {
      let byte = 0;
      for (let j = 0; j < 8; j++) {
        byte |= (truncatedAlphaChannel[i * 8 + j] << (7 - j));
      }
      packedBytes[i] = byte;
    }
    
    // if (tabId) {
    //   sendDebugInfo(tabId, 'バイトパック完了', {
    //     packedLength: packedBytes.length,
    //     sampleValues: Array.from(packedBytes.slice(0, 20)) // 最初の20個の値をサンプルとして送信
    //   });
    // }
    
    // LSBExtractorの実装
    class LSBExtractor {
      private data: Uint8Array;
      private pos: number;
      
      constructor(data: Uint8Array) {
        this.data = data;
        this.pos = 0;
      }
      
      getNextNBytes(n: number): Uint8Array {
        const bytes = this.data.slice(this.pos, this.pos + n);
        this.pos += n;
        return bytes;
      }
      
      read32BitInteger(): number | null {
        const bytes = this.getNextNBytes(4);
        if (bytes.length === 4) {
          return (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
        }
        return null;
      }
    }
    
    // メタデータの抽出
    const reader = new LSBExtractor(packedBytes);
    
    // マジックナンバーの確認
    const magic = "stealth_pngcomp";
    const magicBytes = reader.getNextNBytes(magic.length);
    const readMagic = new TextDecoder().decode(magicBytes);
    
    // デバッグ情報を送信
    // if (tabId) {
    //   sendDebugInfo(tabId, 'マジックナンバー確認', {
    //     expected: magic,
    //     actual: readMagic,
    //     match: magic === readMagic
    //   });
    // }
    
    if (magic !== readMagic) {
      // マジックナンバーが一致しない場合はメタデータなし
      // if (tabId) {
      //   sendDebugInfo(tabId, 'マジックナンバー不一致', {
      //     expected: magic,
      //     actual: readMagic
      //   });
      // }
      return null;
    }
    
    // データ長の読み取り
    const dataLength = reader.read32BitInteger();
    if (dataLength === null) {
      return null;
    }
    
    // JSONデータの読み取り
    const jsonDataBytes = reader.getNextNBytes(Math.floor(dataLength / 8));
    
    // gzip解凍
    const decompressed = await decompressGzip(jsonDataBytes);
    const jsonText = new TextDecoder().decode(decompressed);
    const jsonData = JSON.parse(jsonText);
    
    // Commentフィールドが文字列の場合はJSONとして解析
    if (jsonData.Comment && typeof jsonData.Comment === 'string') {
      try {
        jsonData.Comment = JSON.parse(jsonData.Comment);
      } catch (e) {
        // 解析に失敗した場合は文字列のまま
      }
    }
    
    // メタデータをitemsフォーマットに変換して返す
    const items = Object.entries(jsonData).map(([key, value]) => {
      return {
        type: 'tEXt',
        keyword: key,
        text: JSON.stringify(value),
      }
    });

    return {items: items};

  } catch (e) {
    // if (tabId) {
    //   sendDebugInfo(tabId, 'αチャンネルメタデータ抽出エラー', null, e);
    // }
    return null;
  }
}

/**
 * gzip圧縮データを解凍
 */
async function decompressGzip(data: Uint8Array): Promise<ArrayBuffer> {
  const blob = new Blob([data as unknown as BlobPart]);
  const stream = new Response(
    blob.stream().pipeThrough(new DecompressionStream('gzip'))
  );
  return await stream.arrayBuffer();
}

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
async function fetchAndParseMetadata(url: string, tabId?: number): Promise<any> {
  // // デバッグ情報を送信
  // if (tabId) {
  //   sendDebugInfo(tabId, '画像取得開始', { url });
  // }
  
  // 画像を取得
  const res = await fetch(url, {
    // DNRでRefererは強制付与される想定
    credentials: 'omit',
    cache: 'no-cache',
    mode: 'cors'
  });
  
  if (!res.ok) {
    // if (tabId) {
    //   sendDebugInfo(tabId, '画像取得失敗', { url, status: res.status });
    // }
    throw new Error(`画像取得に失敗: HTTP ${res.status}`);
  }
  
  const buf = await res.arrayBuffer();
  
  // if (tabId) {
  //   sendDebugInfo(tabId, '画像取得完了', { 
  //     url, 
  //     size: buf.byteLength,
  //     contentType: res.headers.get('content-type')
  //   });
  // }
  
  try {
    // 拡張子に基づいて解析
    let parsed;
    const urlLower = url.toLowerCase();
    
    if (urlLower.endsWith('.png')) {
      // if (tabId) {
      //   sendDebugInfo(tabId, 'PNG画像の解析開始', { url });
      // }
      
      // まずαチャンネルからメタデータを抽出を試みる
      parsed = await parsePngAlphaChannel(buf, tabId);
      
      if (parsed) {
        // if (tabId) {
        //   sendDebugInfo(tabId, 'αチャンネルからメタデータ抽出成功', { 
        //     itemsCount: parsed.items?.length || 0
        //   });
        // }
      } else {
        // if (tabId) {
        //   sendDebugInfo(tabId, 'αチャンネルからメタデータ抽出失敗、テキストチャンク解析に移行');
        // }
        // αチャンネルからメタデータが見つからなければテキストチャンクを解析
        parsed = await parsePngTextChunks(buf);
        
        // if (tabId) {
        //   sendDebugInfo(tabId, 'テキストチャンク解析結果', { 
        //     success: !!parsed,
        //     itemsCount: parsed?.items?.length || 0
        //   });
        // }
      }
    } else {
      // PNG以外の形式の場合は何もせず処理を完了
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
    // if (tabId) {
    //   sendDebugInfo(tabId, 'メタデータ解析エラー', null, e);
    // }
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
        const tabId = sender.tab?.id;
        
        if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
          if (tabId) {
            sendDebugInfo(tabId, 'メタデータ取得エラー', null, '有効な画像URLが指定されていません');
          }
          sendResponse({ success: false, log: '有効な画像URLが指定されていません' });
          return;
        }
        
        // if (tabId) {
        //   sendDebugInfo(tabId, 'メタデータ取得開始', { imageUrls });
        // }
        
        // 画像URLを順番に試行
        for (const url of imageUrls) {
          try {
            const metadata = await fetchAndParseMetadata(url, tabId);
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
