/**
 * メタデータバッジ
 * 画像上に表示するメタデータバッジを担当
 */

/**
 * メタデータバッジを作成
 */
export function createBadge(imgElement: HTMLImageElement): void {
  // 画像の親要素
  const imgParent = imgElement.parentElement;

  // 既存のバッジがあれば何もしない
  if( imgParent && imgParent.querySelectorAll('.d2-meta-badge').length){
    return;
  }
  
  // バッジ要素を作成
  const badge = document.createElement('div');
  badge.className = 'd2-meta-badge';
  badge.textContent = 'META';
  
  // 画像の位置に合わせて配置
  const rect = imgElement.getBoundingClientRect();
  
  if (imgParent) {
    const computedStyle = window.getComputedStyle(imgParent);
    if(!['relative', 'absolute', 'fixed'].includes(computedStyle.position)){
      imgParent.style.position = 'relative';
    }
    imgParent.appendChild(badge);
  }
}
