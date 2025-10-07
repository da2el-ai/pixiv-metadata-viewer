/**
 * コンテンツスクリプト
 * pixivのページ上で実行され、画像の検出とUI表示を担当
 */
import { CONFIG } from '../constants';
import { createBadge } from './badge';
import { showPanel, hidePanel, getCurrentMetadata } from './panel';
import { loadSettings, getCurrentSettings, saveSettings, Settings } from './settings';

// 状態管理
let hoverTimer: number | null = null;
let currentTarget: HTMLImageElement | null = null;
let isPanelDisabledByIcon = false; // アイコンによって非表示にされたかどうかのフラグ

// チェック済み画像のリスト
interface CheckedImage {
  url: string;           // 画像URL
  hasMetadata: boolean;  // メタデータの有無
  baseUrl: string | null; // オリジナル画像のベースURL
  metadata?: any;        // メタデータオブジェクト自体（追加）
}
const checkedImages: Map<string, CheckedImage> = new Map();

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

  console.log("fetchMetadata", imageUrls);

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
 * メタデータの有無を判定
 */
function hasValidMetadata(metadata: any): boolean {
  return metadata.parsed.items.length >= 2 || 
         (metadata.parsed.items.length > 0 && metadata.parsed.items[0].keyword === 'parameters');
}

/**
 * エラー時のメタデータを生成
 */
function createErrorMetadata(isNotPng: boolean = false): any {
  return {
    isNotPng,
    parsed: { items: [] }
  };
}

/**
 * 画像処理のメイン関数
 */
async function processImage(imgElement: HTMLImageElement): Promise<void> {
  // アイコンによって非表示にされている場合は処理をスキップ
  if (isPanelDisabledByIcon) {
    return;
  }

  try {
    const imgUrl = imgElement.src;
    console.log("checkedImages", checkedImages);

    // チェック済みリストを確認
    if (checkedImages.has(imgUrl)) {

      const checkedImage = checkedImages.get(imgUrl)!;
      console.log("checkedImages に存在する", checkedImage);
      
      // メタデータがある場合はバッジを付ける
      if (checkedImage.hasMetadata) {
        // console.log("[PMV] ホバー: チェック済み画像、バッジを付与:", imgUrl);
        createBadge(imgElement);
      }
      
      // キャッシュされたメタデータがある場合はそれを使用
      if(checkedImage.metadata){
        showPanel(checkedImage.metadata);
        return;
      }

      console.log("checkedImages にメタデータが存在しない");

      // ここでメタデータを再取得する必要がある
      const originalBaseUrl = checkedImage.baseUrl;
      const originalImages = prepareOriginalImageUrls(originalBaseUrl);
      
      if (originalImages.length > 0) {
        
        try {
          const metadata = await fetchMetadata(originalImages);
          showPanel(metadata);
        } catch (error) {
          // エラーの場合は空のパネルを表示
          const errorMetadata = createErrorMetadata(false);
          showPanel(errorMetadata);
        }
      }
      
      return;
    }
    
    console.log("checkedImages に存在しない");
    // オリジナル画像URLを取得して出力
    const originalBaseUrl = getOriginalBaseUrl(imgUrl);
    const originalImages = prepareOriginalImageUrls(originalBaseUrl);
    
    // メタデータ取得
    try {
      const metadata = await fetchMetadata(originalImages);
      
      // メタデータパネルを表示
      showPanel(metadata);

      // メタデータの有無を判定
      const hasMetadata = hasValidMetadata(metadata);
      
      // チェック済みリストに追加
      checkedImages.set(imgUrl, {
        url: imgUrl,
        hasMetadata,
        baseUrl: originalBaseUrl,
        metadata
      });
      
      // メタデータバッジを表示
      if (hasMetadata) {
        createBadge(imgElement);
      }

    } catch (error) {
      // console.log('[PMV] メタデータ取得エラー:', error);
      
      // エラーの場合でもパネルを表示
      const errorMetadata = createErrorMetadata(false);
      
      // エラーメッセージに基づいて適切なフラグを設定
      if (error instanceof Error && error.message && error.message.includes('HTTP 404')) {
        // 画像が見つからない場合
        errorMetadata.isNotPng = true;
      }
      
      showPanel(errorMetadata);
      
      // エラーの場合もチェック済みリストに追加（メタデータなしとして）
      checkedImages.set(imgUrl, {
        url: imgUrl,
        hasMetadata: false,
        baseUrl: originalBaseUrl,
        metadata: errorMetadata
      });
    }
    
  } catch (error) {
    console.log('[PMV] 画像処理エラー:', error);
    
    // 画像処理エラーの場合でもパネルを表示
    const errorMetadata = createErrorMetadata(true);
    showPanel(errorMetadata);
  }
}

/**
 * メタデータのある画像にバッジを付ける
 */
async function processAllImages(imgElement: HTMLImageElement): Promise<void> {
  // アイコンによって非表示にされている場合は処理をスキップ
  if (isPanelDisabledByIcon) {
    return;
  }

  const imgUrl = imgElement.src;
  // console.log("processAllImages", imgUrl);
  
  // チェック済みリストを確認
  if (checkedImages.has(imgUrl)) {
    const checkedImage = checkedImages.get(imgUrl)!;
    
    // メタデータがある場合はバッジを付ける
    if (checkedImage.hasMetadata) {
      // console.log("[PMV] チェック済み画像、バッジを付与:", imgUrl);
      createBadge(imgElement);
    } else {
      // console.log("[PMV] チェック済み画像、メタデータなし:", imgUrl);
    }
    
    return;
  }
  
  // オリジナル画像URLを取得して出力
  const originalBaseUrl = getOriginalBaseUrl(imgUrl);
  const originalImages = prepareOriginalImageUrls(originalBaseUrl);
  
  try {
    // console.log("[PMV] 画像を取得:", originalImages);
    // メタデータ取得
    const metadata = await fetchMetadata(originalImages);
    
    // メタデータの有無を判定
    const hasMetadata = hasValidMetadata(metadata);
    
    // チェック済みリストに追加
    checkedImages.set(imgUrl, {
      url: imgUrl,
      hasMetadata,
      baseUrl: originalBaseUrl,
      metadata
    });
    
    // メタデータバッジを表示
    if (hasMetadata) {
      createBadge(imgElement);
    }
  } catch (error) {
    // console.log("[PMV] メタデータ取得エラー:", error);
    
    // エラーの場合もチェック済みリストに追加（メタデータなしとして）
    checkedImages.set(imgUrl, {
      url: imgUrl,
      hasMetadata: false,
      baseUrl: originalBaseUrl,
      metadata: createErrorMetadata(false)
    });
  }
}



/**
 * ページ内の画像をチェックしてバッジを付ける
 */
function checkImagesAndAddBadges(): void {
  const topSideMenuImages = document.querySelectorAll('.__top_side_menu_body img');

  topSideMenuImages.forEach(imgElement => {
    const imgUrl = (imgElement as HTMLImageElement).src;
    if (isTargetImage(imgUrl)) {
      processAllImages(imgElement as HTMLImageElement);
    }
  });
}

// DOM変更を監視するためのタイマーID
let mutationDebounceTimer: number | null = null;

// MutationObserverのインスタンス
let observer: MutationObserver | null = null;

// 手動チェックボタンの要素
let checkButton: HTMLElement | null = null;

/**
 * 設定を適用する
 */
function applySettings(settings: Settings): void {
  // メタデータ表示機能の設定を適用
  if (settings.enableMetadataDisplay) {
    // メタデータ表示を有効化
    isPanelDisabledByIcon = false;
  } else {
    // メタデータ表示を無効化
    isPanelDisabledByIcon = true;
    hidePanel();
  }
  
  // 全画像一括チェックの設定を適用
  // 'auto': 自動でチェック（デフォルト）
  // 'disabled': 自動チェックを無効
  // 'manual': 手動ボタンを表示
  if (settings.bulkCheckMode === 'disabled') {
    // 自動チェックを無効化
    disableMutationObserver();
    hideCheckButton();
  } else if (settings.bulkCheckMode === 'manual') {
    // 手動ボタンを表示
    disableMutationObserver();
    showCheckButton();
  } else {
    // 自動でチェック（デフォルト）
    setupMutationObserver();
    hideCheckButton();
  }
}

/**
 * DOM変更を監視するMutationObserverの設定
 */
function setupMutationObserver(): void {
  // 既存のObserverがあれば切断
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  
  // MutationObserverのコールバック
  const mutationCallback = (mutations: MutationRecord[]) => {
    // 変更があった場合、遅延処理を行う
    if (mutationDebounceTimer) {
      clearTimeout(mutationDebounceTimer);
    }
    
    // 1000msの遅延を入れて画像チェックを実行
    mutationDebounceTimer = window.setTimeout(() => {
      // console.log("[PMV] DOM変更を検知、画像チェックを実行します");
      checkImagesAndAddBadges();
    }, 1000);
  };
  
  // MutationObserverの設定
  observer = new MutationObserver(mutationCallback);
  
  // 監視オプション
  const config = {
    childList: true,  // 子ノードの変更を監視
    subtree: true,    // 子孫ノードの変更も監視
  };
  
  // bodyの変更を監視開始
  observer.observe(document.body, config);
  
  console.log("[PMV] MutationObserver設定完了");
}

/**
 * MutationObserverを無効化
 */
function disableMutationObserver(): void {
  if (observer) {
    observer.disconnect();
    observer = null;
    console.log("[PMV] MutationObserver無効化");
  }
}

/**
 * 手動チェックボタンを作成
 */
function createCheckButton(): HTMLElement {
  // 既存のボタンがあれば削除
  if (checkButton) {
    checkButton.remove();
    checkButton = null;
  }
  
  // ボタン要素を作成
  const button = document.createElement('div');
  button.className = 'd2-meta-checkbtn';
  button.title = '全画像をチェック';

  const iconUrl = chrome.runtime.getURL('img/icon.svg');
  button.style.backgroundImage = `url("${iconUrl}")`;
  
  // クリックイベントを設定
  button.addEventListener('click', () => {
    checkImagesAndAddBadges();
  });
  
  // bodyに追加
  document.body.appendChild(button);
  
  return button;
}

/**
 * 手動チェックボタンを表示
 */
function showCheckButton(): void {
  if (!checkButton) {
    checkButton = createCheckButton();
  }
  checkButton.style.display = 'block';
}

/**
 * 手動チェックボタンを非表示
 */
function hideCheckButton(): void {
  if (checkButton) {
    checkButton.style.display = 'none';
  }
}

/**
 * 初期化
 */
async function initialize(): Promise<void> {
  console.log("[PMV] initialize");

  // 設定を読み込む
  await loadSettings();
  
  // 設定変更イベントのリスナーを設定
  document.addEventListener('d2-settings-changed', (e: Event) => {
    const settings = (e as CustomEvent<Settings>).detail;
    applySettings(settings);
  });

  // 現在の設定を適用
  applySettings(getCurrentSettings());

  // 設定に応じた初期化処理
  setTimeout(() => {
    const settings = getCurrentSettings();
    
    // 全画像一括チェックの設定に応じた処理
    if (settings.bulkCheckMode === 'disabled') {
      // 自動チェックを無効化
      console.log("[PMV] 自動チェック無効モード");
    } else if (settings.bulkCheckMode === 'manual') {
      // 手動ボタンを表示
      console.log("[PMV] 手動チェックモード");
    } else {
      // 自動でチェック（デフォルト）
      console.log("[PMV] 自動チェックモード");
      checkImagesAndAddBadges();
      // 初回チェック後にMutationObserverを設定
      setupMutationObserver();
    }
  }, 1000);

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
      
  //     hidePanel();
  //   }
  // });
}

// 初期化実行
initialize();

/**
 * メッセージハンドラ
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  
  // 設定の更新
  if (message && message.type === 'UPDATE_SETTINGS') {
    const settings = getCurrentSettings();
    
    if (message.setting === 'enableMetadataDisplay') {
      settings.enableMetadataDisplay = message.value;
    } else if (message.setting === 'bulkCheckMode') {
      settings.bulkCheckMode = message.value;
    }
    
    // 設定を保存
    saveSettings(settings);
    
    // 設定変更イベントを発火
    document.dispatchEvent(new CustomEvent('d2-settings-changed', { detail: settings }));
    
    return true;
  }
  
  // パネル表示/非表示の切り替え（旧機能）
  if (message && message.type === 'TOGGLE_PANEL') {
    const panel = document.querySelector('.d2-meta-panel');
    if (panel) {
      const isShow = panel.getAttribute('data-is-show') === 'true';
      if (isShow) {
        // パネルが表示されている場合は非表示にする
        panel.setAttribute('data-is-show', 'false');
        hidePanel();
        // アイコンによって非表示にされたフラグをセット
        isPanelDisabledByIcon = true;
      } else {
        // パネルが非表示の場合は表示する
        // 現在のメタデータがあれば表示、なければ空のパネルを表示
        const metadata = getCurrentMetadata() || createErrorMetadata(false);
        showPanel(metadata);
        // アイコンによって非表示にされたフラグを解除
        isPanelDisabledByIcon = false;
      }
    }
  }
  
  // デバッグ情報の出力
  if (message && message.type === 'DEBUG_INFO') {
    // デバッグ情報をコンソールに出力
    console.log('[PMV Debug]', message.label || 'デバッグ情報:');
    
    // データがある場合は詳細を出力
    if (message.data) {
      console.log(message.data);
    }
    
    // エラー情報がある場合は出力
    if (message.error) {
      console.error('[PMV Error]', message.error);
    }
  }
});
