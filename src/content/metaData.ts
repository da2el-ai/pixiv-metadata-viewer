import { CONFIG } from '../constants';

// チェック済み画像のリスト
interface CheckedImage {
  url: string; // 画像URL
  hasMetadata: boolean; // メタデータの有無
  baseUrl: string | null; // オリジナル画像のベースURL
  metadata?: any; // メタデータオブジェクト自体（追加）
}

// メタデータをキャッシュするためのMap
const checkedImages: Map<string, CheckedImage> = new Map();

/**
 * メタデータの有無を判定
 */
function hasValidMetadata(metadata: any): boolean {
  return (
    metadata.parsed.items.length >= 2 ||
    (metadata.parsed.items.length > 0 &&
      metadata.parsed.items[0].keyword === "parameters")
  );
}

/**
 * エラー時のメタデータを生成
 */
function createErrorMetadata(isNotPng: boolean = false): any {
  return {
    isNotPng,
    parsed: { items: [] },
  };
}

/**
 * 画像URLからオリジナル画像のベースURLを取得
 */
function getOriginalBaseUrl(imgUrl: string): string | null {
  for (const pattern of CONFIG.IMAGE_URL_PATTERNS) {
    const match = imgUrl.match(pattern);
    if (match && match[1]) {
      return `https://i.pximg.net/img-original/img/${match[1]}`;
    }
  }
  return null;
}

/**
 * オリジナル画像URLの配列を準備する
 */
function prepareOriginalImageUrls(originalBaseUrl: string | null): string[] {
  const originalImages: string[] = [];
  
  if (originalBaseUrl) {
    CONFIG.IMAGE_FORMATS.forEach(format => {
      originalImages.push(`${originalBaseUrl}.${format}`);
    });
  }
  
  return originalImages;
}

/**
 * メタデータ取得処理
 */
async function fetchMetadata(imageUrls: string[]): Promise<any> {
  if (!imageUrls || imageUrls.length === 0) {
    throw new Error('画像URLが指定されていません');
  }

  // バックグラウンドスクリプトにメッセージを送信
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: 'GET_METADATA', imageUrls },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        
        if (response.success) {
          resolve(response.metadata);
        } else {
          reject(new Error(response.error || 'メタデータの取得に失敗しました'));
        }
      }
    );
  });
}

export { 
  hasValidMetadata, 
  createErrorMetadata, 
  fetchMetadata,
  getOriginalBaseUrl,
  prepareOriginalImageUrls,
  checkedImages
};
export type { CheckedImage };
