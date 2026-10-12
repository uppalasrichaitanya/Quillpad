/**
 * Real download artifact facts. `sizeBytes` and `sha256` are filled in from
 * the actual built exe (see scripts/fetch-download.mjs) so the page can never
 * drift from the artifact it serves.
 */
export const DOWNLOAD = {
  version: "0.1.0",
  fileName: "Quillpad.exe",
  href: "/download/Quillpad.exe",
  sizeBytes: 14897664,
  sha256:
    "3c0d190485d6cedd8c0b74aa04ff49b57da58cf355e7fc00acdae2fb0e3273f6",
};

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "";
  const mib = bytes / (1024 * 1024);
  return `${mib.toFixed(1)} MB`;
}
