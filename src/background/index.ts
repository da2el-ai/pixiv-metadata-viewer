/**
 * バックグラウンドスクリプト
 * メタデータの取得と解析を担当
 */
import { CONFIG } from '../constants';
import { fetchAndParseMetadata } from './parseMetadata';
import { sendDebugInfo } from './util';

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
