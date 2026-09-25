import { BookRepository } from './BookRepository';
import { Book, Collection, Bookmark, Highlight, Note, ReadingProgress } from '@/models/Book';

export class InMemoryBookRepository implements BookRepository {
  private books: Map<string, Book> = new Map();
  private collections: Map<string, Collection> = new Map();
  private bookmarks: Map<string, Bookmark> = new Map();
  private highlights: Map<string, Highlight> = new Map();
  private notes: Map<string, Note> = new Map();
  private readingProgress: Map<string, ReadingProgress> = new Map();

  constructor() {
    // Initialize with empty state - no sample data presented as real
  }

  // Books
  async getBooks(): Promise<Book[]> {
    return Array.from(this.books.values()).sort((a, b) => b.dateAdded - a.dateAdded);
  }

  async getBook(id: string): Promise<Book | null> {
    return this.books.get(id) ?? null;
  }

  async addBook(book: Book): Promise<void> {
    this.books.set(book.id, { ...book });
  }

  async removeBook(id: string): Promise<void> {
    this.books.delete(id);
    // Remove from collections
    for (const collection of this.collections.values()) {
      collection.bookIds = collection.bookIds.filter((bid) => bid !== id);
    }
    // Clean up related data
    for (const bookmark of this.bookmarks.values()) {
      if (bookmark.bookId === id) this.bookmarks.delete(bookmark.id);
    }
    for (const highlight of this.highlights.values()) {
      if (highlight.bookId === id) this.highlights.delete(highlight.id);
    }
    for (const note of this.notes.values()) {
      if (note.bookId === id) this.notes.delete(note.id);
    }
    this.readingProgress.delete(id);
  }

  async updateBook(book: Book): Promise<void> {
    if (this.books.has(book.id)) {
      this.books.set(book.id, { ...book });
    }
  }

  async searchBooks(query: string): Promise<Book[]> {
    const lower = query.toLowerCase();
    return (await this.getBooks()).filter(
      (book) =>
        book.title.toLowerCase().includes(lower) ||
        book.author.toLowerCase().includes(lower) ||
        book.description?.toLowerCase().includes(lower)
    );
  }

  async getBooksByCollection(collectionId: string): Promise<Book[]> {
    const collection = this.collections.get(collectionId);
    if (!collection) return [];
    return collection.bookIds
      .map((id) => this.books.get(id))
      .filter((b): b is Book => b !== undefined)
      .sort((a, b) => b.dateAdded - a.dateAdded);
  }

  async getFavoriteBooks(): Promise<Book[]> {
    return (await this.getBooks()).filter((b) => b.isFavorite);
  }

  async getRecentBooks(limit = 5): Promise<Book[]> {
    return (await this.getBooks()).slice(0, limit);
  }

  // Collections
  async getCollections(): Promise<Collection[]> {
    return Array.from(this.collections.values()).sort((a, b) => b.dateModified - a.dateModified);
  }

  async getCollection(id: string): Promise<Collection | null> {
    return this.collections.get(id) ?? null;
  }

  async addCollection(collection: Collection): Promise<void> {
    this.collections.set(collection.id, { ...collection });
  }

  async removeCollection(id: string): Promise<void> {
    this.collections.delete(id);
  }

  async updateCollection(collection: Collection): Promise<void> {
    if (this.collections.has(collection.id)) {
      this.collections.set(collection.id, { ...collection, dateModified: Date.now() });
    }
  }

  async addBookToCollection(bookId: string, collectionId: string): Promise<void> {
    const collection = this.collections.get(collectionId);
    const book = this.books.get(bookId);
    if (collection && book && !collection.bookIds.includes(bookId)) {
      collection.bookIds.push(bookId);
      collection.dateModified = Date.now();
      this.collections.set(collectionId, { ...collection });
      // Update book
      if (!book.collectionIds.includes(collectionId)) {
        book.collectionIds.push(collectionId);
        this.books.set(bookId, { ...book });
      }
    }
  }

  async removeBookFromCollection(bookId: string, collectionId: string): Promise<void> {
    const collection = this.collections.get(collectionId);
    const book = this.books.get(bookId);
    if (collection) {
      collection.bookIds = collection.bookIds.filter((id) => id !== bookId);
      collection.dateModified = Date.now();
      this.collections.set(collectionId, { ...collection });
    }
    if (book) {
      book.collectionIds = book.collectionIds.filter((id) => id !== collectionId);
      this.books.set(bookId, { ...book });
    }
  }

  // Bookmarks
  async getBookmarks(bookId: string): Promise<Bookmark[]> {
    return Array.from(this.bookmarks.values())
      .filter((b) => b.bookId === bookId)
      .sort((a, b) => a.dateCreated - b.dateCreated);
  }

  async addBookmark(bookmark: Bookmark): Promise<void> {
    this.bookmarks.set(bookmark.id, { ...bookmark });
  }

  async removeBookmark(id: string): Promise<void> {
    this.bookmarks.delete(id);
  }

  // Highlights
  async getHighlights(bookId: string): Promise<Highlight[]> {
    return Array.from(this.highlights.values())
      .filter((h) => h.bookId === bookId)
      .sort((a, b) => a.dateCreated - b.dateCreated);
  }

  async addHighlight(highlight: Highlight): Promise<void> {
    this.highlights.set(highlight.id, { ...highlight });
  }

  async removeHighlight(id: string): Promise<void> {
    this.highlights.delete(id);
  }

  // Notes
  async getNotes(bookId: string): Promise<Note[]> {
    return Array.from(this.notes.values())
      .filter((n) => n.bookId === bookId)
      .sort((a, b) => b.dateModified - a.dateModified);
  }

  async addNote(note: Note): Promise<void> {
    this.notes.set(note.id, { ...note });
  }

  async updateNote(note: Note): Promise<void> {
    if (this.notes.has(note.id)) {
      this.notes.set(note.id, { ...note, dateModified: Date.now() });
    }
  }

  async removeNote(id: string): Promise<void> {
    this.notes.delete(id);
  }

  // Reading Progress
  async getReadingProgress(bookId: string): Promise<ReadingProgress | null> {
    return this.readingProgress.get(bookId) ?? null;
  }

  async updateReadingProgress(progress: ReadingProgress): Promise<void> {
    this.readingProgress.set(progress.bookId, { ...progress });
  }

  // Data management
  async exportData(): Promise<string> {
    const data = {
      books: Array.from(this.books.values()),
      collections: Array.from(this.collections.values()),
      bookmarks: Array.from(this.bookmarks.values()),
      highlights: Array.from(this.highlights.values()),
      notes: Array.from(this.notes.values()),
      readingProgress: Array.from(this.readingProgress.values()),
      exportedAt: Date.now(),
      version: 1,
    };
    return JSON.stringify(data, null, 2);
  }

  async importData(json: string): Promise<void> {
    const data = JSON.parse(json);
    if (data.version !== 1) throw new Error('Unsupported data version');

    this.books.clear();
    this.collections.clear();
    this.bookmarks.clear();
    this.highlights.clear();
    this.notes.clear();
    this.readingProgress.clear();

    for (const book of data.books ?? []) this.books.set(book.id, book);
    for (const col of data.collections ?? []) this.collections.set(col.id, col);
    for (const bm of data.bookmarks ?? []) this.bookmarks.set(bm.id, bm);
    for (const hl of data.highlights ?? []) this.highlights.set(hl.id, hl);
    for (const note of data.notes ?? []) this.notes.set(note.id, note);
    for (const rp of data.readingProgress ?? []) this.readingProgress.set(rp.bookId, rp);
  }

  async clearAllData(): Promise<void> {
    this.books.clear();
    this.collections.clear();
    this.bookmarks.clear();
    this.highlights.clear();
    this.notes.clear();
    this.readingProgress.clear();
  }
}

// Singleton instance
let repositoryInstance: BookRepository | null = null;

export function getBookRepository(): BookRepository {
  if (!repositoryInstance) {
    repositoryInstance = new InMemoryBookRepository();
  }
  return repositoryInstance;
}

export function setBookRepository(repo: BookRepository) {
  repositoryInstance = repo;
}