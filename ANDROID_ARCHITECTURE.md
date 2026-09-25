# Lirune Reader — Android Architecture

## Overview

This document describes the architecture of the Android version of Lirune Reader, an experimental/future mobile development branch.

**Important:** This Android branch is intentionally separate from the Windows desktop release branch (`lirune-store-home`). The Android app is experimental/future mobile development and is not part of the current Windows Store release.

## Current State

The Android app is built with:
- **Framework**: Expo 57 / React Native 0.86 / React 19 / TypeScript
- **Navigation**: expo-router (file-based routing)
- **State Management**: React hooks + custom repository pattern
- **UI**: React Native components with custom design system
- **Storage**: In-memory repository (placeholder for future Room/SQLite implementation)

## Project Structure

```
mobile/
├── app/                    # expo-router pages (file-based routing)
│   ├── _layout.tsx         # Root stack navigator
│   ├── (tabs)/             # Tab navigation group
│   │   ├── _layout.tsx     # Tab navigator
│   │   ├── library.tsx     # Library/Home screen
│   │   ├── collections.tsx # Collections screen
│   │   ├── search.tsx      # Search screen
│   │   ├── settings.tsx    # Settings screen
│   │   └── about.tsx       # About screen
│   ├── reader.tsx          # Reader screen (full-screen modal)
│   └── _layout.tsx         # Root stack
├── components/             # Reusable UI components
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── EmptyState.tsx
│   ├── Styles.ts
│   └── index.ts
├── hooks/                  # Custom React hooks
│   ├── useBooks.ts
│   └── index.ts
├── models/                 # Domain models (TypeScript interfaces)
│   └── Book.ts
├── repositories/           # Data layer abstraction
│   ├── BookRepository.ts   # Repository interface
│   ├── InMemoryBookRepository.ts  # In-memory implementation
│   └── index.ts
├── theme/                  # Design system
│   ├── Colors.ts           # Color tokens (dark/light)
│   ├── Tokens.ts           # Spacing, typography, shadows
│   ├── Theme.ts            # Theme hook
│   ├── ThemeContext.tsx    # React context for theme
│   └── index.ts
├── types/                  # Shared type definitions
├── utils/                  # Utility functions
├── assets/                 # Static assets
├── App.tsx                 # Root component
├── index.ts                # Entry point
├── package.json
├── tsconfig.json
└── ANDROID_ARCHITECTURE.md # This file
```

## Navigation Structure

```
App (Stack)
├── (tabs) - Tab Navigation
│   ├── library      - Home/Library screen
│   ├── collections  - Collections management
│   ├── search       - Full-text search
│   ├── settings     - App settings
│   └── about        - About/credits/license
└── reader           - Full-screen reader modal
```

The reader is opened as a full-screen modal from any book interaction, not as a permanent tab.

## Domain Models

Defined in `models/Book.ts`:
- **Book** - Core book entity with metadata, progress, favorites, collections
- **Collection** - User-created book groupings
- **Bookmark** - Reading position markers
- **Highlight** - Text highlights with colors
- **Note** - User notes attached to positions
- **ReadingProgress** - Detailed progress tracking

## Repository Abstraction

`BookRepository` interface (`repositories/BookRepository.ts`) defines the data contract:
- Books CRUD + search, favorites, recent, by collection
- Collections CRUD + book membership
- Bookmarks, Highlights, Notes CRUD
- Reading progress tracking
- Data export/import (JSON)

Current implementation: `InMemoryBookRepository` (`repositories/InMemoryBookRepository.ts`)
- Fully functional in-memory implementation
- Ready to be replaced with Room/SQLite persistence
- Includes data export/import for backup/restore

Hook `useBooks` (`hooks/useBooks.ts`) provides React-friendly access to the repository.

## Design System

Centralized in `theme/`:
- **Colors.ts** - Dark/light color tokens (Lirune charcoal/off-white/accent palette)
- **Tokens.ts** - Spacing, border radius, typography, shadows, breakpoints
- **Theme.ts** - `useTheme()` hook for accessing tokens
- **ThemeContext.tsx** - React context for theme switching

Palette (from Windows desktop):
- Dark: `#1A1A1D` background, `#C9B8FF` accent
- Light: `#F8F8F5` background, `#7C5CFF` accent
- Reader: `#1C1C20` / `#FBFAF5` backgrounds

## Components

Reusable components in `components/`:
- **Button** - Primary, secondary, outline, ghost, destructive variants
- **Card** - Default, elevated, outlined variants with padding options
- **EmptyState** - Reusable empty states (Library, Collections, Search, etc.)
- **Styles** - Global StyleSheet utilities and theme hook

## Screens

### Library (Home)
- Grid/list view with lazy loading
- Search, filter, sort, collection filtering
- Empty state with import action
- Continue reading card

### Collections
- List/create/delete collections
- Add/remove books from collections
- Empty state

### Search
- Real-time search with debounce
- Results grid
- Empty state for no results

### Settings
- Theme selection (dark/light)
- Reader preferences (font, size, spacing, margins)
- Import/export data
- Privacy notice
- Danger zone (clear all data)

### About
- Version info
- Description
- Feature list
- Links (GitHub, issues, privacy, licenses)
- GPL-3.0 license

### Reader (Shell)
- Chapter/title display
- Scrollable reading area
- Progress bar
- Bottom controls (font, bookmark, highlight, search)
- Theme switching
- Tap to toggle controls

## Data Flow

```
User Action → Hook (useBooks/useCollections) → Repository → In-Memory Store
                                    ↓
                              React State Update
                                    ↓
                              UI Re-render
```

## Future Work

### Phase 2: EPUB Rendering
- Integrate EPUB.js or native EPUB renderer
- Replace Reader shell with actual rendering
- CFI navigation, pagination, text selection

### Phase 3: Persistence
- Replace InMemoryBookRepository with Room database
- Background sync, migration support
- Encrypted storage for highlights/notes

### Phase 4: Advanced Features
- Cloud sync (optional, opt-in)
- TTS integration
- Dictionary lookup
- OPDS catalog browsing

## Relationship to Windows Desktop

- **Windows** (`lirune-store-home`): Primary product, Electron + epub.js, NSIS/MSIX packaging
- **Android** (`android`): Experimental mobile companion, Expo/React Native
- Shared concepts: domain models, repository pattern, design tokens, feature set
- No code sharing currently; separate codebases for platform-appropriate tech stacks

## Build & Run

```bash
cd mobile
npm install
npm run start          # Start Expo dev server
npm run android        # Run on Android device/emulator
npm run ios            # Run on iOS simulator
npm run web            # Run in browser
npm run lint           # ESLint
npm run typecheck      # TypeScript check
```

## Build Configuration

- **Package**: `com.lirune.reader`
- **Version**: 4.0.3 (matches desktop)
- **Scheme**: `lirune://`
- **Icons/Splash**: In `assets/`

## Testing

```bash
npm run test           # Not yet configured
```

## Accessibility

- Content descriptions on all icons/buttons
- Semantic roles (button, link, heading)
- Color contrast meets WCAG AA
- System font scaling supported
- Touch targets ≥ 48dp
- Screen reader labels on all interactive elements

## Known Limitations (Phase 1)

- No EPUB rendering (reader is shell only)
- In-memory only (data lost on app close)
- No background import/parsing
- No OPDS catalog
- No cloud sync
- Single-file TypeScript (no separate test files yet)

---

*This document describes the Android branch architecture as of Phase 1 completion. The Android branch is experimental and not part of the Windows desktop release.*