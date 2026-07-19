/** Strips characters that are illegal in filenames on common filesystems. */
export function sanitizeFilename(name: string): string {
  return name.trim().replace(/[\\/:*?"<>|]+/g, '-') || 'mosaic';
}
