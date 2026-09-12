# Novera

> A calm, private home for your EPUB library on Windows.

Novera is a free and open-source Windows desktop reader for EPUB books. It keeps your library, reading progress, highlights, notes, themes, and preferences on your computer—without an account or cloud library.

[![License: GPL v3](https://img.shields.io/badge/License-GPL--3.0--only-blue.svg)](LICENSE)
[![Platform: Windows](https://img.shields.io/badge/platform-Windows-0078D4?logo=windows&logoColor=white)](#install-on-windows)

## Features

- Browse a focused local library with cover art, search, sorting, grid and list views, reading progress, and continue-reading.
- Read EPUB 2 and EPUB 3 books in paginated or scrolling layouts.
- Adjust themes, typography, spacing, margins, alignment, and page spread for a more comfortable reading experience.
- Use table of contents navigation, in-book search, bookmarks, highlights, and notes.
- Import a book, a folder of books, or drop EPUB files onto the library.
- Open `.epub` files directly from Windows Explorer after installing Novera.
- Keep a local copy of imported books so the library is not tied to the original file location.

## Screenshots

Novera deliberately does not use mockups or stock screenshots. Release screenshots will be captured from the packaged Windows application and added here with the first public release assets.

## Install on Windows

Download the latest `Novera-<version>-Setup.exe` from the repository’s [Releases](../../releases) page, then run the installer. The installer adds Start Menu and desktop shortcuts and associates `.epub` files with Novera.

Windows may show a reputation warning for an unsigned new release. Verify that the installer came from the project’s official Releases page before continuing.

## EPUB compatibility

Novera accepts standard EPUB 2 and EPUB 3 ZIP packages with `META-INF/container.xml` and an OPF package document. It supports nested package paths, Unicode filenames, incomplete metadata, and cover resources when they can be resolved by epub.js.

DRM-protected books and EPUBs with encrypted resources are detected and rejected with an explanation. Novera does not bypass DRM. Malformed archives, missing container files, missing OPFs, and unreadable books are reported per file without stopping a folder import.

## Privacy

Your books and reading data stay on your computer. Novera does not require an account and does not upload book content, annotations, or library metadata.

Imported books are stored in Novera’s local application storage and in its local IndexedDB database. The interface currently loads its optional web fonts from Google Fonts when an internet connection is available; no book content is sent with those requests.

## Support Novera

Novera is free software. If it makes your reading time better, you can support ongoing development with a coffee:

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-Donate-orange?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/vasanthgajavelly)

## Develop locally

Requirements: Windows 10 or later, [Node.js](https://nodejs.org/) 20 or newer, and npm.

```powershell
git clone https://github.com/vasanthgajavelly5-sys/Novera.git
cd Novera
npm ci
npm start
```

Useful commands:

```powershell
npm run validate:corpus  # Validates a locally available EPUB test corpus
npm run pack             # Builds an unpacked Windows application
npm run dist:win         # Creates the NSIS Windows installer
```

`Master_EPUB_Library_All/` is an optional local regression corpus and is intentionally ignored by Git. Do not add books, private libraries, or generated corpus reports to commits.

## Troubleshooting

- **A book will not import:** Check the displayed error. Novera rejects invalid archives, missing EPUB package files, encrypted EPUB resources, and DRM-protected books.
- **An EPUB does not open from Explorer:** Re-run the installer, then try opening the file again. The installer registers the `.epub` association.
- **The app will not start from source:** Run `npm ci` again, confirm a supported Node.js version with `node --version`, and retry `npm start`.
- **A packaged build cannot locate its files:** Build with `npm run pack` or reinstall the NSIS installer; do not open `index.html` directly.
- **I need to reset my library:** Novera stores data locally. Back up your application data before clearing it, because doing so removes books, annotations, and preferences.

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) and follow the [Code of Conduct](CODE_OF_CONDUCT.md). Keep changes focused, preserve existing user data, and never commit private books, credentials, signing files, or generated user storage.

## License

Copyright © 2026 Novera contributors.

Novera is licensed under the [GNU General Public License v3.0 only](LICENSE). See [COPYRIGHT.md](COPYRIGHT.md) for the project notice.
