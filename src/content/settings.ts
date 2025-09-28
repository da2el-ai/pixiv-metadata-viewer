/**
 * 設定パネル
 * 機能拡張の設定を管理するパネルを担当
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

/**
 * 設定パネルのHTMLを生成
 */
export function getSettingsPanelHtml(): string {
  // メタデータ表示機能
  const metadataDisplayChecked = currentSettings.enableMetadataDisplay ? 'checked' : '';
  
  // 全画像一括チェック
  const bulkCheckOptions = [
    { value: 'auto', text: '自動でチェック' },
    { value: 'disabled', text: '自動チェックを無効' },
    { value: 'manual', text: '手動ボタンを表示' }
  ].map(option => {
    const selected = currentSettings.bulkCheckMode === option.value ? 'selected' : '';
    return `<option value="${option.value}" ${selected}>${option.text}</option>`;
  }).join('');
  
  return `
    <div class="d2-meta-settings">
      <div class="d2-meta-settings__item">
        <label>メタデータ表示機能</label>
        <label class="d2-meta-settings__switch">
          <input type="checkbox" id="enableMetadataDisplay" ${metadataDisplayChecked}>
          <span class="slider"></span>
        </label>
      </div>
      
      <div class="d2-meta-settings__item">
        <label>全画像一括チェック</label>
        <select id="bulkCheckMode">
          ${bulkCheckOptions}
        </select>
      </div>
    </div>
  `;
}

/**
 * 設定パネルのイベントハンドラを設定
 */
export function setupSettingsEventHandlers(): void {
  // メタデータ表示機能のチェックボックス
  const metadataDisplayCheckbox = document.getElementById('enableMetadataDisplay') as HTMLInputElement;
  if (metadataDisplayCheckbox) {
    metadataDisplayCheckbox.addEventListener('change', async () => {
      const settings = getCurrentSettings();
      settings.enableMetadataDisplay = metadataDisplayCheckbox.checked;
      await saveSettings(settings);
      
      // 設定変更イベントを発火
      document.dispatchEvent(new CustomEvent('d2-settings-changed', { detail: settings }));
    });
  }
  
  // 全画像一括チェックのセレクトボックス
  const bulkCheckSelect = document.getElementById('bulkCheckMode') as HTMLSelectElement;
  if (bulkCheckSelect) {
    bulkCheckSelect.addEventListener('change', async () => {
      const settings = getCurrentSettings();
      settings.bulkCheckMode = bulkCheckSelect.value as 'auto' | 'disabled' | 'manual';
      await saveSettings(settings);
      
      // 設定変更イベントを発火
      document.dispatchEvent(new CustomEvent('d2-settings-changed', { detail: settings }));
    });
  }
}
