/**
 * メタデータの解析を担当するモジュール
 */
import { sendDebugInfo } from './util';

/**
 * LSBExtractorクラス - バイナリデータからビットを抽出するためのユーティリティ
 */
export class LSBExtractor {
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

/**
 * 画像データからアルファチャンネルの最下位ビットを抽出
 */
export function extractAlphaChannelBits(pixels: Uint8ClampedArray | Uint8Array, width: number, height: number): Uint8Array {
  // αチャンネルの最下位ビットを抽出
  const alphaChannel = new Uint8Array(Math.floor(pixels.length / 4));
  for (let i = 0; i < pixels.length; i += 4) {
    alphaChannel[i / 4] = pixels[i + 3] & 1; // αチャンネルの最下位ビット
  }
  
  // 転置処理（行優先から列優先へ）
  const transposedAlphaChannel = new Uint8Array(alphaChannel.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // 転置: (x, y) -> (y, x)
      transposedAlphaChannel[x * height + y] = alphaChannel[y * width + x];
    }
  }
  
  return transposedAlphaChannel;
}

/**
 * 画像データからRGBチャンネルの最下位ビットを抽出
 */
export function extractRGBChannelBits(pixels: Uint8ClampedArray | Uint8Array, width: number, height: number, columnMajor: boolean = false): Uint8Array {
  const rgbBits = new Uint8Array(width * height * 3);
  let index = 0;
  
  if (columnMajor) {
    // 列優先（x, y）
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const pixelIndex = (y * width + x) * 4;
        rgbBits[index++] = pixels[pixelIndex] & 1;     // R
        rgbBits[index++] = pixels[pixelIndex + 1] & 1; // G
        rgbBits[index++] = pixels[pixelIndex + 2] & 1; // B
      }
    }
  } else {
    // 行優先（y, x）
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIndex = (y * width + x) * 4;
        rgbBits[index++] = pixels[pixelIndex] & 1;     // R
        rgbBits[index++] = pixels[pixelIndex + 1] & 1; // G
        rgbBits[index++] = pixels[pixelIndex + 2] & 1; // B
      }
    }
  }
  
  return rgbBits;
}

/**
 * ビット配列を8ビットごとにバイトにパック
 */
export function packBitsToBytes(bits: Uint8Array): Uint8Array {
  // 8の倍数に切り捨て
  const packedLength = Math.floor(bits.length / 8) * 8;
  const truncatedBits = bits.slice(0, packedLength);
  const packedBytes = new Uint8Array(Math.floor(packedLength / 8));
  
  for (let i = 0; i < packedBytes.length; i++) {
    let byte = 0;
    for (let j = 0; j < 8; j++) {
      byte |= (truncatedBits[i * 8 + j] << (7 - j));
    }
    packedBytes[i] = byte;
  }
  
  return packedBytes;
}

/**
 * マジックナンバーを確認し、メタデータ形式を判定
 */
export function checkMagicNumber(reader: LSBExtractor): { 
  isValid: boolean; 
  format: string | null; 
  isCompressed: boolean | null; 
} {
  // 可能なマジックナンバー
  const magicNumbers = [
    { magic: "stealth_pngcomp", format: "alpha", compressed: true },
    { magic: "stealth_pnginfo", format: "alpha", compressed: false },
    { magic: "stealth_rgbcomp", format: "rgb", compressed: true },
    { magic: "stealth_rgbinfo", format: "rgb", compressed: false }
  ];
  
  // 最長のマジックナンバーの長さを取得
  const maxLength = Math.max(...magicNumbers.map(m => m.magic.length));
  
  // マジックナンバーの長さ分のバイトを読み取る
  const magicBytes = reader.getNextNBytes(maxLength);
  const readMagic = new TextDecoder().decode(magicBytes);
  
  // マジックナンバーを確認
  for (const { magic, format, compressed } of magicNumbers) {
    if (readMagic.startsWith(magic)) {
      return { isValid: true, format, isCompressed: compressed };
    }
  }
  
  return { isValid: false, format: null, isCompressed: null };
}

/**
 * gzip圧縮データを解凍
 */
export async function decompressGzip(data: Uint8Array): Promise<ArrayBuffer> {
  const blob = new Blob([data as unknown as BlobPart]);
  const stream = new Response(
    blob.stream().pipeThrough(new DecompressionStream('gzip'))
  );
  return await stream.arrayBuffer();
}

/**
 * 圧縮データを展開してテキストに変換
 */
export async function inflateToString(u8: Uint8Array): Promise<string> {
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
 * PNGのαチャンネルに埋め込まれたメタデータを抽出
 * NovelAIなどで使用されるstealth_pngcompフォーマットに対応
 */
export async function parsePngAlphaChannel(buf: ArrayBuffer): Promise<any | null> {
  try {
    // 画像をデコード
    const blob = new Blob([buf], { type: 'image/png' });
    const imgBitmap = await createImageBitmap(blob);
    
    // OffscreenCanvasを作成して画像を描画
    const canvas = new OffscreenCanvas(imgBitmap.width, imgBitmap.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('2Dコンテキストの取得に失敗しました');
    }
    
    ctx.drawImage(imgBitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, imgBitmap.width, imgBitmap.height);
    const pixels = imageData.data;
    
    // αチャンネルの最下位ビットを抽出して転置
    const transposedAlphaChannel = extractAlphaChannelBits(pixels, imgBitmap.width, imgBitmap.height);
    
    // 8ビットごとにバイトにパック
    const packedBytes = packBitsToBytes(transposedAlphaChannel);
    
    // メタデータの抽出
    const reader = new LSBExtractor(packedBytes);
    
    // マジックナンバーの確認
    const magic = "stealth_pngcomp";
    const magicBytes = reader.getNextNBytes(magic.length);
    const readMagic = new TextDecoder().decode(magicBytes);
    
    if (magic !== readMagic) {
      // マジックナンバーが一致しない場合はメタデータなし
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
    return null;
  }
}

/**
 * StableDiffusion Forgeのメタデータを抽出
 * アルファチャンネルモードとRGBモードの両方に対応
 */
export async function parseStableDiffusionForgeMetadata(buf: ArrayBuffer, tabId?: number): Promise<any | null> {
  try {
    // 画像をデコード
    const blob = new Blob([buf], { type: 'image/png' });
    const imgBitmap = await createImageBitmap(blob);
    
    // OffscreenCanvasを作成して画像を描画
    const canvas = new OffscreenCanvas(imgBitmap.width, imgBitmap.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('2Dコンテキストの取得に失敗しました');
    }
    
    ctx.drawImage(imgBitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, imgBitmap.width, imgBitmap.height);
    const pixels = imageData.data;
    const width = imgBitmap.width;
    const height = imgBitmap.height;
    
    // メタデータを抽出
    let metadataText: string | null = null;
    
    // アルファチャンネルからメタデータを抽出
    const alphaBits = extractAlphaChannelBits(pixels, width, height);
    const alphaBytes = packBitsToBytes(alphaBits);
    const alphaReader = new LSBExtractor(alphaBytes);
    const alphaResult = checkMagicNumber(alphaReader);
    
    if (alphaResult.isValid) {
      // データ長の読み取り
      const dataLength = alphaReader.read32BitInteger();
      if (dataLength !== null) {
        // データの読み取り
        const dataBytes = alphaReader.getNextNBytes(Math.floor(dataLength / 8));
        
        // 圧縮されている場合は解凍
        if (alphaResult.isCompressed) {
          const decompressed = await decompressGzip(dataBytes);
          metadataText = new TextDecoder().decode(decompressed);
        } else {
          metadataText = new TextDecoder().decode(dataBytes);
        }
      }
    }
    
    // アルファチャンネルでメタデータが見つからなかった場合、RGBチャンネルを試す
    if (metadataText === null) {
      // 行優先でRGBチャンネルからメタデータを抽出
      const rgbBits = extractRGBChannelBits(pixels, width, height);
      const rgbBytes = packBitsToBytes(rgbBits);
      const rgbReader = new LSBExtractor(rgbBytes);
      const rgbResult = checkMagicNumber(rgbReader);
      
      if (rgbResult.isValid) {
        // データ長の読み取り
        const dataLength = rgbReader.read32BitInteger();
        if (dataLength !== null) {
          // データの読み取り
          const dataBytes = rgbReader.getNextNBytes(Math.floor(dataLength / 8));
          
          // 圧縮されている場合は解凍
          if (rgbResult.isCompressed) {
            const decompressed = await decompressGzip(dataBytes);
            metadataText = new TextDecoder().decode(decompressed);
          } else {
            metadataText = new TextDecoder().decode(dataBytes);
          }
        }
      } else {
        // 列優先でRGBチャンネルからメタデータを抽出
        const rgbBits2 = extractRGBChannelBits(pixels, width, height, true);
        const rgbBytes2 = packBitsToBytes(rgbBits2);
        const rgbReader2 = new LSBExtractor(rgbBytes2);
        const rgbResult2 = checkMagicNumber(rgbReader2);
        
        if (rgbResult2.isValid) {
          // データ長の読み取り
          const dataLength = rgbReader2.read32BitInteger();
          if (dataLength !== null) {
            // データの読み取り
            const dataBytes = rgbReader2.getNextNBytes(Math.floor(dataLength / 8));
            
            // 圧縮されている場合は解凍
            if (rgbResult2.isCompressed) {
              const decompressed = await decompressGzip(dataBytes);
              metadataText = new TextDecoder().decode(decompressed);
            } else {
              metadataText = new TextDecoder().decode(dataBytes);
            }
          }
        }
      }
    }
    
    // メタデータが見つからなかった場合
    if (metadataText === null) {
      return null;
    }
    
    // メタデータをitemsフォーマットに変換して返す
    return {
      items: [
        {
          type: 'tEXt',
          keyword: 'parameters',
          text: metadataText
        }
      ]
    };
    
  } catch (e) {
    return null;
  }
}

/**
 * PNG画像のテキストチャンクを解析
 */
export async function parsePngTextChunks(buf: ArrayBuffer): Promise<any> {
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
 * 画像からメタデータを取得
 */
export async function fetchAndParseMetadata(url: string, tabId?: number): Promise<any> {
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
      // まずNovelAIのメタデータを抽出を試みる
        parsed = await parsePngAlphaChannel(buf);
      
      // NovelAIのメタデータが見つからなければStableDiffusion Forgeのメタデータを抽出
      if (!parsed) {
        parsed = await parseStableDiffusionForgeMetadata(buf, tabId);
      }
      
      // どちらも見つからなければテキストチャンクを解析
      if (!parsed) {
        parsed = await parsePngTextChunks(buf);
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
    
    return { ok: true, parsed, bytes: buf.byteLength };
  } catch (e) {
    // エラーが発生しても空の結果を返す
    return { ok: true, parsed: { items: [] }, bytes: buf.byteLength };
  }
}
