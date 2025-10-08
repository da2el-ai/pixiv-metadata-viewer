/**
 * 共通設定モジュール
 * content/settingsとpopup/indexで共有する設定機能を提供
 */

// 設定の型定義
export interface Settings {
  // メタデータ表示機能の有効/無効
  enableMetadataDisplay: boolean;
  
  // 全画像一括チェックの設定
  // 'auto': 自動でチェック
  // 'disabled': 自動チェックを無効
  // 'manual': 手動ボタンを表示
  bulkCheckMode: 'auto' | 'disabled' | 'manual';

  // コピー機能のショートカットキー
  copyShortcut: {
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    key: string;
  };
}

// デフォルト設定
export const DEFAULT_SETTINGS: Settings = {
  enableMetadataDisplay: true,
  bulkCheckMode: 'auto',
  copyShortcut: {
    ctrlKey: true,
    shiftKey: true,
    altKey: false,
    key: 'C'
  }
};

// 現在の設定
let currentSettings: Settings = { ...DEFAULT_SETTINGS };

/**
 * 設定を読み込む
 */
export async function loadSettings(): Promise<Settings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get('settings', (result) => {
      if (result.settings) {
        currentSettings = { ...DEFAULT_SETTINGS, ...result.settings };
      }
      resolve(currentSettings);
    });
  });
}

/**
 * 設定を保存する
 */
export async function saveSettings(settings: Settings): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ settings }, () => {
      currentSettings = settings;
      resolve();
    });
  });
}

/**
 * 現在の設定を取得する
 */
export function getCurrentSettings(): Settings {
  return { ...currentSettings };
}
