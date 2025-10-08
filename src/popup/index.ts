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

  // コピー機能のショートカットキー
  copyShortcut: {
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    key: string;
  };
}

// デフォルト設定
const DEFAULT_SETTINGS: Settings = {
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

  // ショートカット設定をUIに反映
  const copyShortcutCtrl = document.getElementById('copyShortcutCtrl') as HTMLInputElement;
  if (copyShortcutCtrl) {
    copyShortcutCtrl.checked = settings.copyShortcut.ctrlKey;
  }
  
  const copyShortcutShift = document.getElementById('copyShortcutShift') as HTMLInputElement;
  if (copyShortcutShift) {
    copyShortcutShift.checked = settings.copyShortcut.shiftKey;
  }
  
  const copyShortcutAlt = document.getElementById('copyShortcutAlt') as HTMLInputElement;
  if (copyShortcutAlt) {
    copyShortcutAlt.checked = settings.copyShortcut.altKey;
  }
  
  const copyShortcutKey = document.getElementById('copyShortcutKey') as HTMLInputElement;
  if (copyShortcutKey) {
    copyShortcutKey.value = settings.copyShortcut.key;
  }
}

/**
 * ショートカット設定を更新する
 */
async function updateShortcutSettings(): Promise<void> {
  const copyShortcutCtrl = document.getElementById('copyShortcutCtrl') as HTMLInputElement;
  const copyShortcutShift = document.getElementById('copyShortcutShift') as HTMLInputElement;
  const copyShortcutAlt = document.getElementById('copyShortcutAlt') as HTMLInputElement;
  const copyShortcutKey = document.getElementById('copyShortcutKey') as HTMLInputElement;

  const settings = { ...currentSettings };
  settings.copyShortcut = {
    ctrlKey: copyShortcutCtrl?.checked || false,
    shiftKey: copyShortcutShift?.checked || false,
    altKey: copyShortcutAlt?.checked || false,
    key: copyShortcutKey?.value?.toUpperCase() || 'C'
  };

  // キーが空の場合はデフォルト値を使用
  if (!settings.copyShortcut.key) {
    settings.copyShortcut.key = 'C';
    if (copyShortcutKey) {
      copyShortcutKey.value = 'C';
    }
  }

  await saveSettings(settings);
  await notifySettingsChange('copyShortcut', settings.copyShortcut);
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

  // ショートカット設定の各要素にイベントハンドラを設定
  const copyShortcutCtrl = document.getElementById('copyShortcutCtrl') as HTMLInputElement;
  const copyShortcutShift = document.getElementById('copyShortcutShift') as HTMLInputElement;
  const copyShortcutAlt = document.getElementById('copyShortcutAlt') as HTMLInputElement;
  const copyShortcutKey = document.getElementById('copyShortcutKey') as HTMLInputElement;

  if (copyShortcutCtrl) {
    copyShortcutCtrl.addEventListener('change', updateShortcutSettings);
  }
  
  if (copyShortcutShift) {
    copyShortcutShift.addEventListener('change', updateShortcutSettings);
  }
  
  if (copyShortcutAlt) {
    copyShortcutAlt.addEventListener('change', updateShortcutSettings);
  }
  
  if (copyShortcutKey) {
    // 入力値を大文字に変換
    copyShortcutKey.addEventListener('input', (e) => {
      const input = e.target as HTMLInputElement;
      input.value = input.value.toUpperCase();
      updateShortcutSettings();
    });
    
    // フォーカスが外れたときに値が空だったらデフォルト値を設定
    copyShortcutKey.addEventListener('blur', () => {
      if (!copyShortcutKey.value) {
        copyShortcutKey.value = 'C';
        updateShortcutSettings();
      }
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
