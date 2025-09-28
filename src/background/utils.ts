/**
 * バックグラウンドスクリプトのユーティリティ関数
 */

/**
 * デバッグ情報をコンテンツスクリプトに送信
 */
export function sendDebugInfo(tabId: number | undefined, label: string, data?: any, error?: any): void {
  if (!tabId) return;
  
  chrome.tabs.sendMessage(tabId, {
    type: 'DEBUG_INFO',
    label,
    data,
    error: error ? (error instanceof Error ? error.message : String(error)) : undefined
  });
}
