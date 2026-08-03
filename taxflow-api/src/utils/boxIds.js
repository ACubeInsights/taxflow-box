/**
 * Box resource IDs are numeric strings. Seed/demo data uses placeholders like `box-file-d5`.
 */
export function isRealBoxFileId(fileId) {
  return /^\d+$/.test(String(fileId ?? '').trim());
}

export function isPlaceholderBoxFileId(fileId) {
  const value = String(fileId ?? '');
  return value.startsWith('box-file-') || (value.length > 0 && !isRealBoxFileId(value));
}
