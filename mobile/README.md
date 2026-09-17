# Novera Mobile

Novera Mobile is the Android and iOS application foundation for version 4.0. It is built with Expo and React Native so both platforms share the same TypeScript UI and product behavior.

## Run locally

From the repository root:

```powershell
cd mobile
npm install
npm start
```

Use Expo Go for a quick device preview, or use `npm run android` and `npm run ios` when the native toolchains are installed.

## Current mobile foundation

- Mobile-first library with continue reading and search.
- EPUB document picker import entry point.
- Touch-friendly reader shell with progress and navigation.
- Library stats and weekly reading intention.
- Dark, light, and sepia app themes.
- Offline-first product copy and local-library UX.

## Next integration layer

The desktop reader uses Electron and iframe-based epub.js rendering, which cannot be copied directly into native Android/iOS builds. The next mobile slice should add native filesystem persistence, an EPUB archive/parser bridge, paginated rendering, and shared annotation/progress adapters. Keep those services behind the UI contracts in `src/types.ts` so the library remains testable without a device.