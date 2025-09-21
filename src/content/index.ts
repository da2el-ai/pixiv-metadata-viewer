/**
 * コンテンツスクリプト
 * pixivのページ上で実行され、画像の検出とUI表示を担当
 */
import { CONFIG } from '../constants';
// import { createBadge } from './badge';
import { showPanel, hidePanel, isPanelFixedState } from './panel';

// 状態管理
let hoverTimer: number | null = null;
let currentTarget: HTMLImageElement | null = null;

console.log("/////////////////// PIXIV-METADATA-VIEWER");

/**
 * 画像URLがターゲットパターンにマッチするか確認
 */
function isTargetImage(url: string): boolean {
  return CONFIG.IMAGE_URL_PATTERNS.some(pattern => pattern.test(url));
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
 * メタデータ取得処理
 */
async function fetchMetadata(imageUrls: string[]): Promise<any> {
  if (!imageUrls || imageUrls.length === 0) {
    throw new Error('画像URLが指定されていません');
  }

  // console.log("fetchMetadata", imageUrls);

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

/**
 * 画像処理のメイン関数
 */
async function processImage(imgElement: HTMLImageElement): Promise<void> {
  try {
    const imgUrl = imgElement.src;
    
    // オリジナル画像URLを取得して出力
    const originalBaseUrl = getOriginalBaseUrl(imgUrl);
    const originalImages: string[] = [];
    // console.log('元の画像URL:', imgUrl);
    
    if (originalBaseUrl) {
      // 各形式のURLを出力
      CONFIG.IMAGE_FORMATS.forEach(format => {
        originalImages.push(`${originalBaseUrl}.${format}`);
      });
    }
    
    // // メタデータバッジを表示（エラーの場合でも表示）
    // createBadge(imgElement, isPanelFixedState());
    
    // メタデータ取得
    try {
      const metadata = await fetchMetadata(originalImages);
      
      // メタデータパネルを表示
      showPanel(metadata);
      
    } catch (error) {
      // console.log('メタデータ取得エラー:', error);
      
      // エラーの場合でもパネルを表示
      const errorMetadata = {
        isNotPng: false,
        parsed: { items: [] }
      };
      
      // エラーメッセージに基づいて適切なフラグを設定
      if (error instanceof Error && error.message && error.message.includes('HTTP 404')) {
        // 画像が見つからない場合
        errorMetadata.isNotPng = true;
      }
      
      showPanel(errorMetadata);
    }
    
  } catch (error) {
    // console.log('画像処理エラー:', error);
    
    // 画像処理エラーの場合でもパネルを表示
    const errorMetadata = {
      isNotPng: true,
      parsed: { items: [] }
    };
    
    // // メタデータバッジを表示
    // createBadge(imgElement, isPanelFixedState());
    
    showPanel(errorMetadata);
  }
}

/**
 * 初期化
 */
function initialize(): void {
  // console.log("[PMV] initialize");
  // 画像ホバー検出
  document.addEventListener('mouseover', (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG') {
      const imgElement = target as HTMLImageElement;
      const imgUrl = imgElement.src;
      // console.log("[PMV] initialize src", imgUrl);
      
      // URLパターンチェック
      if (isTargetImage(imgUrl)) {
        // console.log("[PMV] initialize isTarget");
        // 前のタイマーをクリア
        if (hoverTimer) clearTimeout(hoverTimer);
        
        // 新しいタイマーをセット（0.5秒遅延）
        hoverTimer = window.setTimeout(() => {
          currentTarget = imgElement;
          processImage(imgElement);
        }, CONFIG.HOVER_DELAY);
      }
    }
  });

  // // 画像マウスアウト検出
  // document.addEventListener('mouseout', (e) => {
  //   const target = e.target as HTMLElement;
  //   if (target.tagName === 'IMG') {
  //     // タイマーをクリア
  //     if (hoverTimer) {
  //       clearTimeout(hoverTimer);
  //       hoverTimer = null;
  //     }
      
  //     // パネルが固定されていなければ非表示
  //     if (!isPanelFixedState()) {
  //       hidePanel();
  //     }
  //   }
  // });
}

// 初期化実行
initialize();
