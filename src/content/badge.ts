/**
 * メタデータバッジ
 * 画像上に表示するメタデータバッジを担当
 */
import { CONFIG } from '../constants';
import { showPanel, getCurrentMetadata } from './panel';

/**
 * メタデータバッジを作成
 */
export function createBadge(imgElement: HTMLImageElement): HTMLElement {
  // 既存のバッジがあれば削除
  const existingBadge = document.querySelector('.d2-meta-badge');
  if (existingBadge) {
    existingBadge.remove();
  }
  
  // バッジ要素を作成
  const badge = document.createElement('div');
  badge.className = 'd2-meta-badge';
  badge.textContent = 'META';
  // badge.dataset.active = isPanelFixed ? 'true' : 'false';
  
  // 画像の位置に合わせて配置
  const rect = imgElement.getBoundingClientRect();
  const imgParent = imgElement.parentElement;
  
  if (imgParent) {
    imgParent.style.position = 'relative';
    imgParent.appendChild(badge);
  }
  
  return badge;
}

/**
 * バッジの状態を更新
 */
export function updateBadgeState(isFixed: boolean): void {
  const badge = document.querySelector('.d2-meta-badge');
  if (badge) {
    badge.setAttribute('data-active', isFixed ? 'true' : 'false');
  }
}
