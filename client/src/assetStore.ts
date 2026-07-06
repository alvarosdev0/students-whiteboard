// === Asset Store for tldraw ===
// Handles image uploads and resolution for the tldraw canvas.
// Uses URL.createObjectURL for ephemeral in-memory blobs (per REQ-CANVAS-004).

import type { TLAssetStore } from "tldraw";

export const myAssetStore: TLAssetStore = {
  async upload(_asset, file) {
    // Ephemeral: create a blob URL valid for this session only.
    // The URL is revoked when the tab closes — no server upload needed.
    const src = URL.createObjectURL(file);
    return { src };
  },
  resolve(asset) {
    // tldraw stores the src directly in asset.props; resolve returns it.
    return (asset.props as { src?: string }).src ?? "";
  },
};
