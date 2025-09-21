/**
 * 設定値を定数として定義
 */
export const CONFIG = {
  // 対象となる画像URLのパターン
  IMAGE_URL_PATTERNS: [
    /https:\/\/i\.pximg\.net\/.*\/?img-master\/img\/(.+_p\d+)_(master|square)\d*.jpg/
  ],
  
  // オリジナル画像URLの生成パターン
  ORIGINAL_URL_TEMPLATE: 'https://i.pximg.net/img-original/img/$1.$2',
  
  // 試行する画像形式（優先順）
  // IMAGE_FORMATS: ['png', 'jpg', 'webp'],
  IMAGE_FORMATS: ['png'],
  
  // ホバー遅延時間（ミリ秒）
  HOVER_DELAY: 500,
  
  // パネル非表示遅延時間（ミリ秒）
  HIDE_DELAY: 200
};
