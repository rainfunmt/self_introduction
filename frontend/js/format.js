// 前台與後台共用的格式化工具

// 把位元組數轉成好讀的大小，例如 1536 → "1.5 KB"
export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
