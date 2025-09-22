/**
 * メタデータパネル
 * 画面下部に表示するメタデータパネルを担当
 */
import { CONFIG } from '../constants';
import { escapeHtml } from './utils';
import { updateBadgeState } from './badge';
import { extractSummary } from './parsePrompt';

// 状態管理
let isPanelFixed = false;
let currentMetadata: any = null;
let hideTimer: number | null = null;

/**
 * メタデータパネルを作成
 */
function createPanel(): HTMLElement {
  // 既存のパネルがあれば削除
  const existingPanel = document.querySelector('.d2-meta-panel');
  if (existingPanel) {
    return existingPanel as HTMLElement;
  }
  
  // パネル要素を作成
  const panel = document.createElement('div');
  panel.className = 'd2-meta-panel';
  panel.setAttribute('data-position', 'bottom');
  
//   // ヘッダー部分
//   const header = document.createElement('div');
//   header.style.display = 'flex';
//   header.style.padding = '0.5em';
//   header.style.borderBottom = '1px solid #666';
  
  // リサイズハンドル：上
  const resizeHandleTop = document.createElement('div');
  resizeHandleTop.classList.add('d2-meta-panel__resize', 'd2-meta-panel__resize--top');
  resizeHandleTop.innerHTML = '⋯';
  resizeHandleTop.title = 'ドラッグしてリサイズ';
  panel.appendChild(resizeHandleTop);

  // ボタンエリア
  const navContainer = document.createElement('div');
  navContainer.className = 'd2-meta-panel__nav-container';
  panel.appendChild(navContainer);

  // 位置変更ボタン
  const positionButton = document.createElement('button');
  positionButton.classList.add('d2-meta-panel__nav-btn', 'd2-meta-panel__nav-btn--position');
  positionButton.title = '位置変更';
  positionButton.addEventListener('click', () => {
    const panel = document.querySelector('.d2-meta-panel');
    if (panel) {
      const currentPosition = panel.getAttribute('data-position');
      if (currentPosition === 'top') {
        panel.setAttribute('data-position', 'bottom');
        positionButton.setAttribute('data-position', 'bottom');
      } else {
        panel.setAttribute('data-position', 'top');
        positionButton.setAttribute('data-position', 'top');
      }
    }
  });
  navContainer.appendChild(positionButton);

  // 閉じるボタン
  const closeButton = document.createElement('button');
  closeButton.classList.add('d2-meta-panel__nav-btn', 'd2-meta-panel__nav-btn--close');
  closeButton.textContent = '×';
  closeButton.title = '閉じる';
  closeButton.addEventListener('click', () => {
    unfixPanel();
  });
  navContainer.appendChild(closeButton);


  // コンテンツ部分
  const content = document.createElement('div');
  content.className = 'd2-meta-panel__layout';
  panel.appendChild(content);
  
  // プロンプト部分
  const promptSection = document.createElement('div');
  promptSection.className = 'd2-meta-panel__prompt';
  promptSection.style.backgroundColor = '#444';
  content.appendChild(promptSection);
  
  // オリジナル部分
  const originalSection = document.createElement('div');
  originalSection.className = 'd2-meta-panel__original';
  originalSection.style.backgroundColor = '#444';
  content.appendChild(originalSection);

  // リサイズハンドル：下
  const resizeHandleBottom = document.createElement('div');
  resizeHandleBottom.classList.add('d2-meta-panel__resize', 'd2-meta-panel__resize--bottom');
  resizeHandleBottom.innerHTML = '⋯';
  resizeHandleBottom.title = 'ドラッグしてリサイズ';
  panel.appendChild(resizeHandleBottom);

  // リサイズ機能
  let startY = 0;
  let startHeight = 0;
  
  // 上のリサイズハンドル
  resizeHandleTop.addEventListener('mousedown', (e) => {
    e.preventDefault();
    startY = e.clientY;
    startHeight = parseInt(getComputedStyle(panel).height, 10);
    document.addEventListener('mousemove', resizePanelTop);
    document.addEventListener('mouseup', stopResize);
  });

  // 下のリサイズハンドル
  resizeHandleBottom.addEventListener('mousedown', (e) => {
    e.preventDefault();
    startY = e.clientY;
    startHeight = parseInt(getComputedStyle(panel).height, 10);
    document.addEventListener('mousemove', resizePanelBottom);
    document.addEventListener('mouseup', stopResize);
  });
  
  function resizePanelTop(e: MouseEvent) {
    const newHeight = startHeight - (e.clientY - startY);
    if (newHeight > 100) {
      panel.style.height = `${newHeight}px`;
    }
  }

  function resizePanelBottom(e: MouseEvent) {
    const newHeight = startHeight + (e.clientY - startY);
    if (newHeight > 100) {
      panel.style.height = `${newHeight}px`;
    }
  }

  function stopResize() {
    document.removeEventListener('mousemove', resizePanelTop);
    document.removeEventListener('mousemove', resizePanelBottom);
    document.removeEventListener('mouseup', stopResize);
  }
  
  document.body.appendChild(panel);
  return panel;
}

/**
 * パネルのコンテンツを描画
 */
function renderPanelContent(panel: HTMLElement, metadata: any): void {
  const promptSection = panel.querySelector('.d2-meta-panel__prompt');
  const originalSection = panel.querySelector('.d2-meta-panel__original');
  
  if (!promptSection || !originalSection) return;
  
  // メタデータが見つかるかどうかを判定
  const hasMetadata = metadata.parsed && metadata.parsed.items && metadata.parsed.items.length > 0;
  
  // パネルの透明度を設定
  panel.style.opacity = hasMetadata ? '1' : '0.5';
  
  // PNG以外の形式の場合
  if (metadata.isNotPng) {
    promptSection.innerHTML = '<p>PNG以外の画像形式のため、メタデータは表示されません。</p>';
    originalSection.innerHTML = '';
    return;
  }
  
  // // metadata.parsed が存在するか確認
  // if (metadata.parsed && metadata.parsed.items) {
  //   console.log("メタデータ", metadata.parsed.items);
  // } else {
  //   console.log("メタデータが見つかりません");
  // }

  // プロンプト情報を抽出
  const summary = metadata.parsed && metadata.parsed.items ? 
    extractSummary(metadata.parsed.items) : {};

  // プロンプト情報
  let promptHtml = '';
  
  if (summary.prompt) {
    promptHtml += `<h3>Prompt</h3><p style="white-space: pre-wrap;">${escapeHtml(summary.prompt)}</p>`;
  }
  
  if (summary.negative) {
    promptHtml += `<h3>Negative Prompt</h3><p style="white-space: pre-wrap;">${escapeHtml(summary.negative)}</p>`;
  }
  
  // パラメータ情報
  let paramsHtml = '<h3>Parameters</h3><ul>';
  if (summary.sampler) paramsHtml += `<li>Sampler: ${escapeHtml(summary.sampler)}</li>`;
  if (summary.steps) paramsHtml += `<li>Steps: ${escapeHtml(summary.steps)}</li>`;
  if (summary.cfg) paramsHtml += `<li>CFG: ${escapeHtml(summary.cfg)}</li>`;
  if (summary.seed) paramsHtml += `<li>Seed: ${escapeHtml(summary.seed)}</li>`;
  if (summary.model) paramsHtml += `<li>Model: ${escapeHtml(summary.model)}</li>`;
  if (summary.size) paramsHtml += `<li>Size: ${escapeHtml(summary.size)}</li>`;
  if (summary.software) paramsHtml += `<li>Software: ${escapeHtml(summary.software)}</li>`;
  paramsHtml += '</ul>';
  
  promptSection.innerHTML = promptHtml || '<p>プロンプト情報が見つかりませんでした。</p>';
  originalSection.innerHTML = paramsHtml;
  
  // オリジナルデータ
  if (metadata.parsed && metadata.parsed.items && metadata.parsed.items.length > 0) {
    let originalHtml = '<h3>Original Data</h3><ul>';
    metadata.parsed.items.forEach((item: any) => {
      originalHtml += `<li><strong>${escapeHtml(item.keyword)}</strong>: <span style="white-space: pre-wrap;">${escapeHtml(item.text)}</span></li>`;
    });
    originalHtml += '</ul>';
    originalSection.innerHTML += originalHtml;
  }
}

/**
 * パネルを表示
 */
export function showPanel(metadata: any, isFixed = false): void {
  // パネルが固定されている場合は更新しない
  if (isPanelFixed && !isFixed) return;
  
  // パネルを作成または取得
  const panel = createPanel();
  
  // 非表示タイマーをクリア
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  
  // メタデータを表示
  renderPanelContent(panel, metadata);
  
  // パネルを表示
  panel.setAttribute('data-is-show', 'true');
  
  // 状態更新
  isPanelFixed = isFixed;
  currentMetadata = metadata;
  
  // バッジの状態も更新
  updateBadgeState(isFixed);
}

/**
 * パネルを非表示
 */
export function hidePanel(): void {
  if (isPanelFixed) return;
  
  // 非表示タイマーをセット
  if (hideTimer) clearTimeout(hideTimer);
  
  hideTimer = window.setTimeout(() => {
    const panel = document.querySelector('.d2-meta-panel');
    if (panel) {
      panel.setAttribute('data-is-show', 'false');
    }
    hideTimer = null;
  }, CONFIG.HIDE_DELAY);
}

/**
 * パネルを固定
 */
export function fixPanel(): void {
  isPanelFixed = true;
  updateBadgeState(true);
}

/**
 * パネル固定解除
 */
export function unfixPanel(): void {
  isPanelFixed = false;
  hidePanel();
  updateBadgeState(false);
}

/**
 * パネルが固定されているかどうかを取得
 */
export function isPanelFixedState(): boolean {
  return isPanelFixed;
}

/**
 * 現在のメタデータを取得
 */
export function getCurrentMetadata(): any {
  return currentMetadata;
}
