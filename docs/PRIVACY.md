# Lirune Reader Privacy

Lirune Reader is local-first. It does not require an account, cloud library, analytics SDK, or telemetry service.

Imported EPUB files are kept in local application storage. Book metadata, progress, annotations, preferences, favorites, and collections are stored locally in IndexedDB. Lirune Reader does not upload book contents, notes, highlights, or reading history.

The application shell no longer depends on Google Fonts or another runtime font network request. Reading is designed to work offline after installation.

Lirune Reader rejects DRM-protected and encrypted-resource EPUBs; it does not bypass DRM.

Uninstall removes the installed application and shortcuts by default. User library data under the application data directory is preserved. Users should back up their data before manually resetting application data.
