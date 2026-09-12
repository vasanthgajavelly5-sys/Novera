# Vellune

**A beautiful home for your books**

Vellune is an independent Windows desktop EPUB library and reader. It keeps books, reading progress, bookmarks, highlights, notes, themes, and preferences on the local machine.

## Features

- A focused library with search, sorting, grid/list views, covers, recent reading, and progress.
- Paginated EPUB reading with table of contents, in-book search, bookmarks, highlights, notes, themes, typography, and layout controls.
- Single EPUB import, recursive folder import, drag and drop, and Windows EPUB file association opening.
- Native Windows window state, fullscreen, dialogs, and packaged-app storage.
- Safe duplicate handling and per-file import errors.

## Supported EPUB behavior

Vellune accepts valid EPUB 2 and EPUB 3 ZIP packages with standard `META-INF/container.xml` and an OPF package document, including nested OPF paths, Unicode filenames, optional or incomplete metadata, and cover resources when epub.js can resolve them.

DRM-protected books and EPUBs containing encrypted resources are detected and rejected with an explanation. Vellune does not bypass DRM. A malformed ZIP, missing container, missing OPF, unreadable file, or unsupported package is reported per file without aborting the rest of a folder import.

The regression corpus in `Master_EPUB_Library_All/` contains 243 EPUB files when complete. The corpus inventory and failure ledger are kept in `corpus-inventory.txt` and `corpus-failures.txt`.

## Setup and start

Requirements:

- Windows 10 or later
- Node.js 22 or a compatible current LTS release
- npm

Install dependencies and start the desktop app:

```powershell
npm install
npm start
```

You can also launch with `Launch-Folio.bat`; the filename remains for backwards compatibility with existing shortcuts, while the window and application are branded Vellune.

## Packaging

Create an unpacked Windows Electron package:

```powershell
npm run pack
```

Create the NSIS installer:

```powershell
npm run dist:win
```

The installer registers `.epub` files with Vellune. Opening an EPUB from Explorer starts or focuses the existing Vellune window and imports the file before opening it.

## Import workflow

Select the plus button in the library toolbar. **File** opens a single-selection EPUB picker. **Folder** opens a native folder picker and recursively scans every `.epub` file below it. Import progress is shown while books are processed. Invalid, encrypted, DRM-protected, unreadable, and duplicate files do not prevent valid files from importing.

The empty-library browse action uses the same chooser. Drag and drop remains available for one or more EPUB files; browser fallback uses a single-file input for the chooser's File path.

## Data and privacy

Book binaries and metadata are stored locally in the browser IndexedDB database used by the app. Desktop imports also keep a copy under Electron's per-user application storage so the library remains independent of the original file. No book content is uploaded. The legacy IndexedDB name `FolioReaderDB` and the `folioDesktop` bridge are retained so existing Folio data and preferences remain available after the rename.

## Troubleshooting

- If a book is rejected, read the per-file toast for the archive, container, OPF, DRM, or encryption reason.
- If a file association does not open Vellune, run the installer again and choose the installation directory, then open the EPUB from Explorer.
- If a packaged app cannot find its assets, rebuild with `npm run pack` or reinstall the NSIS package rather than opening `index.html` directly.
- To reset only the application library, use the browser's application storage tools carefully. Do not remove the user-data directory when preserving existing books and preferences matters.

## Validation notes

The project is validated with JavaScript diagnostics, `npm run pack`, and a repeatable corpus pass that enumerates all `.epub` files, checks ZIP/container/OPF integrity, records failures by filename, and reports totals. Full reader rendering remains dependent on epub.js and the individual book's package quality; source-file limitations are recorded rather than silently skipped.
