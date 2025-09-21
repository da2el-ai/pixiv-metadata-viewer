/**
 * publicディレクトリの内容をdistディレクトリにコピーするスクリプト
 */
const fs = require('fs');
const path = require('path');

// ディレクトリパスの設定
const publicDir = path.resolve(__dirname, '../public');
const distDir = path.resolve(__dirname, '../dist');

// ディレクトリが存在するか確認
if (!fs.existsSync(publicDir)) {
  console.error(`Error: Public directory not found: ${publicDir}`);
  process.exit(1);
}

if (!fs.existsSync(distDir)) {
  console.error(`Error: Dist directory not found: ${distDir}`);
  process.exit(1);
}

/**
 * ディレクトリを再帰的にコピーする関数
 * @param {string} src - コピー元ディレクトリパス
 * @param {string} dest - コピー先ディレクトリパス
 */
function copyDir(src, dest) {
  // コピー先ディレクトリが存在しない場合は作成
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  // ディレクトリ内のファイル/ディレクトリを取得
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  // 各エントリに対して処理
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      // ディレクトリの場合は再帰的にコピー
      copyDir(srcPath, destPath);
    } else {
      // ファイルの場合はコピー
      fs.copyFileSync(srcPath, destPath);
      console.log(`Copied: ${srcPath} -> ${destPath}`);
    }
  }
}

// コピー処理の実行
try {
  copyDir(publicDir, distDir);
  console.log('Public directory copied to dist successfully');
} catch (error) {
  console.error('Error copying public directory:', error);
  process.exit(1);
}
