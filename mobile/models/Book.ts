export type ColorScheme = 'dark' | 'light';

export interface Book {
  id: string;
  title: string;
  author: string;
  description?: string;
  coverColor: string;
  coverUrl?: string;
  progress: number; // 0-100
  lastRead: string;
  currentChapter: string;
  chapterCount?: number;
  isFavorite: boolean;
  collectionIds: string[];
  dateAdded: number;
  fileId?: string;
  imported: boolean;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  color: string;
  bookIds: string[];
  dateCreated: number;
  dateModified: number;
}

export interface Bookmark {
  id: string;
  bookId: string;
  cfi: string;
  chapter: string;
  dateCreated: number;
}

export interface Highlight {
  id: string;
  bookId: string;
  cfiRange: string;
  text: string;
  color: string; // hex color
  note?: string;
  dateCreated: number;
}

export interface Note {
  id: string;
  bookId: string;
  cfi: string;
  text: string;
  dateCreated: number;
  dateModified: number;
}

export interface ReadingProgress {
  bookId: string;
  cfi: string;
  chapter: string;
  progressPercent: number;
  timeSpent: number; // milliseconds
  lastRead: number;
}

export type ViewMode = 'grid' | 'list';
export type SortCriterion = 'recent' | 'title' | 'author' | 'progress' | 'added';
export type FilterType = 'all' | 'unread' | 'reading' | 'finished' | 'favorites';

export interface LibraryState {
  books: Book[];
  collections: Collection[];
  viewMode: ViewMode;
  sortCriterion: SortCriterion;
  filter: FilterType;
  searchQuery: string;
  selectedCollectionId: string | 'all';
}

export interface ReaderState {
  bookId: string | null;
  cfi: string | null;
  theme: 'dark' | 'light' | 'sepia';
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  margin: number;
  flow: 'paginated' | 'scrolled';
  spread: 'auto' | 'none';
  alignment: 'left' | 'center' | 'right' | 'justify';
}