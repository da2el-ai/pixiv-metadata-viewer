/**
 * ポップアップスクリプト
 * 設定パネルの動作を担当
 */

// 設定の型定義
interface Settings {
  // メタデータ表示機能の有効/無効
  enableMetadataDisplay: boolean;
  
  // 全画像一括チェックの設定
  // 'auto': 自動でチェック
  // 'disabled': 自動チェックを無効
  // 'manual': 手動ボタンを表示
  bulkCheckMode: 'auto' | 'disabled' | 'manual';
}

// デフォルト設定
const DEFAULT_SETTINGS: Settings = {
  enableMetadataDisplay: true,
  bulkCheckMode: 'auto'
};

// 現在の設定
let currentSettings: Settings = { ...DEFAULT_SETTINGS };

/**
 * 設定を読み込む
 */
async function loadSettings(): Promise<Settings> {
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
async function saveSettings(settings: Settings): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ settings }, () => {
      currentSettings = settings;
      resolve();
    });
  });
}

/**
 * 現在のタブに設定変更を通知する
 */
async function notifySettingsChange(setting: string, value: any): Promise<void> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length > 0 && tabs[0].id) {
    chrome.tabs.sendMessage(tabs[0].id, {
      type: 'UPDATE_SETTINGS',
      setting,
      value
    });
  }
}

/**
 * 設定をUIに適用する
 */
function applySettingsToUI(settings: Settings): void {
  const enableMetadataDisplayCheckbox = document.getElementById('enableMetadataDisplay') as HTMLInputElement;
  if (enableMetadataDisplayCheckbox) {
    enableMetadataDisplayCheckbox.checked = settings.enableMetadataDisplay;
  }
  
  const bulkCheckModeSelect = document.getElementById('bulkCheckMode') as HTMLSelectElement;
  if (bulkCheckModeSelect) {
    bulkCheckModeSelect.value = settings.bulkCheckMode;
  }
}

/**
 * イベントハンドラを設定
 */
function setupEventHandlers(): void {
  // メタデータ表示機能のチェックボックス
  const enableMetadataDisplayCheckbox = document.getElementById('enableMetadataDisplay') as HTMLInputElement;
  if (enableMetadataDisplayCheckbox) {
    enableMetadataDisplayCheckbox.addEventListener('change', async () => {
      const settings = { ...currentSettings };
      settings.enableMetadataDisplay = enableMetadataDisplayCheckbox.checked;
      await saveSettings(settings);
      await notifySettingsChange('enableMetadataDisplay', settings.enableMetadataDisplay);
    });
  }
  
  // 全画像一括チェックのセレクトボックス
  const bulkCheckModeSelect = document.getElementById('bulkCheckMode') as HTMLSelectElement;
  if (bulkCheckModeSelect) {
    bulkCheckModeSelect.addEventListener('change', async () => {
      const settings = { ...currentSettings };
      settings.bulkCheckMode = bulkCheckModeSelect.value as 'auto' | 'disabled' | 'manual';
      await saveSettings(settings);
      await notifySettingsChange('bulkCheckMode', settings.bulkCheckMode);
    });
  }
}

/**
 * 初期化
 */
async function initialize(): Promise<void> {
  // 設定を読み込む
  await loadSettings();
  
  // 設定をUIに適用
  applySettingsToUI(currentSettings);
  
  // イベントハンドラを設定
  setupEventHandlers();
}

// DOMContentLoadedイベントで初期化
document.addEventListener('DOMContentLoaded', () => {
  initialize();
});
