## 4.0.1 - Built-in Guide & Store Release

- Replaced legacy sample book with an original built-in first-run tutorial: "Welcome to Lirune".
- Added a full offline guide covering library management, reading customization, keyboard shortcuts, annotations, and local-first backups.
- Replaced sample cover with an original dynamic canvas-generated Lirune design.
- Removed all legacy sample references and third-party sample text.
- Finalized Microsoft Store package identity and release assets.

## 4.0.0 - Production hardening

- Moved managed EPUB binaries out of normal IndexedDB library reads.
- Added deterministic SHA-256 storage identities and legacy migration safeguards.
- Added verified managed reads, favorite state, collection metadata, and library filters.
- Added bounded cancellable in-book search and debounced reader/theme preference writes.
- Added offline CSP and removed Google Fonts runtime dependency.
- Added local Windows release validation and Store preparation documentation.

# Changelog

## 3.5.0 - 2026-09-17

- Added app-controlled light and dark themes for native controls instead of relying on Windows system colors.
- Added a dedicated themed loading card while the library is loading.
- Prevented the empty-library state from appearing before library data is ready.
- Added a frameless full-page window experience with custom minimize, maximize, and close controls.
- Added draggable application toolbars while preserving interactive search and reader controls.
- Improved EPUB loading and local library storage handling.
