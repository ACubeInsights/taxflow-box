/**
 * Pure utility functions for file display in the Vault Browser.
 */

/**
 * Converts bytes to a human-readable file size string.
 * @param {number} bytes - Non-negative integer byte count
 * @returns {string} Formatted string like "1.2 KB", "3.4 MB", etc.
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';

  const units = ['Bytes', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const unitIndex = Math.min(i, units.length - 1);

  if (unitIndex === 0) {
    return `${bytes} Bytes`;
  }

  const value = bytes / Math.pow(k, unitIndex);
  // Use up to 2 decimal places, but strip trailing zeros
  const formatted = value % 1 === 0 ? value.toFixed(0) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return `${formatted} ${units[unitIndex]}`;
}

/**
 * Maps a file name's extension to a Lucide icon component name string.
 * @param {string} fileName - File name with extension
 * @returns {string} Lucide icon component name: 'FileText', 'FileSpreadsheet', 'Image', or 'File'
 */
export function getFileIcon(fileName) {
  if (!fileName || typeof fileName !== 'string') return 'File';

  const ext = fileName.split('.').pop()?.toLowerCase();

  const iconMap = {
    // Document types → FileText
    pdf: 'FileText',
    doc: 'FileText',
    docx: 'FileText',
    txt: 'FileText',
    rtf: 'FileText',
    // Spreadsheet types → FileSpreadsheet
    xls: 'FileSpreadsheet',
    xlsx: 'FileSpreadsheet',
    csv: 'FileSpreadsheet',
    // Image types → Image
    jpg: 'Image',
    jpeg: 'Image',
    png: 'Image',
    gif: 'Image',
    svg: 'Image',
    webp: 'Image',
    bmp: 'Image',
  };

  return iconMap[ext] || 'File';
}

/**
 * Returns a new array of files sorted by modified_at descending (newest first).
 * @param {Array<{modified_at: string}>} files - Array of file objects with modified_at ISO timestamps
 * @returns {Array} New sorted array (does not mutate input)
 */
export function sortFilesByDate(files) {
  if (!Array.isArray(files)) return [];
  return [...files].sort((a, b) => {
    const dateA = new Date(a.modified_at).getTime();
    const dateB = new Date(b.modified_at).getTime();
    return dateB - dateA;
  });
}
