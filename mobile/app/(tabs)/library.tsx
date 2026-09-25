import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet, RefreshControl } from 'react-native';
import { useTheme } from '@/theme';
import { useBooks, useCollections } from '@/hooks';
import { Button, Card, EmptyLibraryState, EmptySearchState, globalStyles } from '@/components';
import { FilterType, SortCriterion, ViewMode } from '@/models/Book';
import { Collection, Book } from '@/models/Book';

export default function LibraryScreen() {
  const theme = useTheme();
  const { books, loading, addBook, searchBooks, getFavoriteBooks, refresh } = useBooks();
  const { collections } = useCollections();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortCriterion>('recent');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('all');
  const [showImport, setShowImport] = useState(false);

  const filteredBooks = useMemo(() => {
    let result = books;

    // Filter by collection
    if (selectedCollectionId !== 'all') {
      result = result.filter((b) => b.collectionIds.includes(selectedCollectionId));
    }

    // Filter by type
    switch (filter) {
      case 'unread':
        result = result.filter((b) => b.progress === 0);
        break;
      case 'reading':
        result = result.filter((b) => b.progress > 0 && b.progress < 100);
        break;
      case 'finished':
        result = result.filter((b) => b.progress === 100);
        break;
      case 'favorites':
        result = result.filter((b) => b.isFavorite);
        break;
    }

    // Search
    if (query.trim()) {
      const lower = query.toLowerCase();
      result = result.filter(
        (b) =>
          b.title.toLowerCase().includes(lower) ||
          b.author.toLowerCase().includes(lower) ||
          b.description?.toLowerCase().includes(lower)
      );
    }

    // Sort
    switch (sort) {
      case 'title':
        result = [...result].sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'author':
        result = [...result].sort((a, b) => a.author.localeCompare(b.author));
        break;
      case 'progress':
        result = [...result].sort((a, b) => b.progress - a.progress);
        break;
      case 'added':
        result = [...result].sort((a, b) => a.dateAdded - b.dateAdded);
        break;
      case 'recent':
      default:
        result = [...result].sort((a, b) => b.dateAdded - a.dateAdded);
        break;
    }

    return result;
  }, [books, query, filter, sort, selectedCollectionId]);

  const handleRefresh = useCallback(async () => {
    await refresh();
  }, [refresh]);

  const handleImport = useCallback(async () => {
    // Import functionality would go here
    setShowImport(true);
  }, []);

  const handleImportSuccess = useCallback(() => {
    setShowImport(false);
    refresh();
  }, [refresh]);

  if (loading) {
    return (
      <View style={[styles(theme).container, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles(theme).loadingText, { color: theme.colors.textMuted }]}>Loading your library…</Text>
      </View>
    );
  }

  return (
    <View style={[styles(theme).container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles(theme).scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={handleRefresh}
            colors={[theme.colors.accent]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles(theme).header}>
          <View>
            <Text style={[styles(theme).eyebrow, { color: theme.colors.accent }]}>YOUR LIBRARY</Text>
            <Text style={[styles(theme).wordmark, { color: theme.colors.text }]}>Lirune Reader</Text>
          </View>
          <Button
            title="Import"
            onPress={handleImport}
            variant="outline"
            size="sm"
            accessibilityLabel="Import a new EPUB"
          />
        </View>

        {/* Search */}
        <View style={[styles(theme).searchBar, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles(theme).searchIcon, { color: theme.colors.textMuted }]}>⌕</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search your library"
            placeholderTextColor={theme.colors.textFaint}
            style={[styles(theme).searchInput, { color: theme.colors.text }]}
            accessibilityLabel="Search books"
          />
        </View>

        {/* Filter/Sort/Collection chips */}
        <View style={styles(theme).chipRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles(theme).chipContainer}>
            {(['all', 'unread', 'reading', 'finished', 'favorites'] as FilterType[]).map((f) => (
              <FilterChip
                key={f}
                label={f.charAt(0).toUpperCase() + f.slice(1)}
                selected={filter === f}
                onPress={() => setFilter(f)}
                theme={theme}
              />
            ))}
          </ScrollView>
        </View>

        <View style={styles(theme).chipRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles(theme).chipContainer}>
            {(['recent', 'title', 'author', 'progress', 'added'] as SortCriterion[]).map((s) => (
              <FilterChip
                key={s}
                label={s.charAt(0).toUpperCase() + s.slice(1)}
                selected={sort === s}
                onPress={() => setSort(s)}
                theme={theme}
              />
            ))}
          </ScrollView>
        </View>

        {/* Collections dropdown */}
        <View style={styles(theme).collectionRow}>
          <Text style={[styles(theme).collectionLabel, { color: theme.colors.textMuted }]}>Collection</Text>
          <CollectionSelector
            collections={collections}
            selectedId={selectedCollectionId}
            onSelect={setSelectedCollectionId}
            theme={theme}
          />
        </View>

        {/* Empty state or book grid */}
        {filteredBooks.length === 0 ? (
          books.length === 0 ? (
            <EmptyLibraryState onImport={handleImport} />
          ) : (
            <EmptySearchState query={query} />
          )
        ) : (
          <View style={styles(theme).grid}>
            {filteredBooks.map((book) => (
              <BookCard key={book.id} book={book} theme={theme} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function FilterChip({ label, selected, onPress, theme }: { label: string; selected: boolean; onPress: () => void; theme: ReturnType<typeof import('@/theme').useTheme> }) {
  return (
    <Button
      title={label}
      onPress={onPress}
      variant={selected ? 'primary' : 'outline'}
      size="sm"
      style={styles(theme).filterChip}
    />
  );
}

function CollectionSelector({
  collections,
  selectedId,
  onSelect,
  theme,
}: {
  collections: Collection[];
  selectedId: string;
  onSelect: (id: string) => void;
  theme: ReturnType<typeof import('@/theme').useTheme>;
}) {
  return (
    <View style={styles(theme).collectionSelector}>
      <Text style={[styles(theme).selectorText, { color: theme.colors.text }]}>
        {selectedId === 'all' ? 'All Collections' : collections.find((c) => c.id === selectedId)?.name || 'All Collections'}
      </Text>
    </View>
  );
}

function BookCard({ book, theme }: { book: Book; theme: ReturnType<typeof import('@/theme').useTheme> }) {
  return (
    <Card variant="elevated" padding="none" style={styles(theme).bookCard}>
      <View style={styles(theme).coverWrap}>
        <View style={[styles(theme).cover, { backgroundColor: book.coverColor }]}>
          <Text style={styles(theme).coverInitial}>{book.title.slice(0, 1)}</Text>
        </View>
        {book.isFavorite && <View style={styles(theme).favoriteBadge} />}
        <View style={[styles(theme).progressBar, { backgroundColor: theme.colors.surfaceElevated }]}>
          <View style={[styles(theme).progressFill, { backgroundColor: theme.colors.accent, width: `${book.progress}%` }]} />
        </View>
      </View>
      <View style={styles(theme).bookInfo}>
        <Text style={[styles(theme).bookTitle, { color: theme.colors.text }]} numberOfLines={2}>
          {book.title}
        </Text>
        <Text style={[styles(theme).bookAuthor, { color: theme.colors.textMuted }]} numberOfLines={1}>
          {book.author}
        </Text>
        <View style={styles(theme).progressRow}>
          <View style={[styles(theme).progressTrack, { backgroundColor: theme.colors.surfaceElevated }]}>
            <View style={[styles(theme).progressFillInner, { backgroundColor: theme.colors.accent, width: `${book.progress}%` }]} />
          </View>
          <Text style={[styles(theme).progressText, { color: theme.colors.accent }]}>{book.progress}%</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = (theme: ReturnType<typeof import('@/theme').useTheme>) => StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  wordmark: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  searchBar: { height: 48, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, marginBottom: 12 },
  searchIcon: { fontSize: 20, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15 },
  chipRow: { marginBottom: 12 },
  chipContainer: { flexDirection: 'row', gap: 8 },
  collectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  collectionLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  collectionSelector: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end' },
  selectorText: { fontSize: 13, fontWeight: '500' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  bookCard: { width: '48%', minWidth: 150 },
  coverWrap: { position: 'relative', marginBottom: 12 },
  cover: { width: '100%', height: 180, borderRadius: 12, justifyContent: 'flex-end', padding: 12 },
  coverInitial: { color: '#fff', fontSize: 24, fontWeight: '700' },
  favoriteBadge: { position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  progressBar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 4 },
  progressFill: { height: '100%', borderRadius: 2 },
  bookInfo: { paddingTop: 10 },
  bookTitle: { fontSize: 14, fontWeight: '700', lineHeight: 18, marginBottom: 4 },
  bookAuthor: { fontSize: 11, marginBottom: 8 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressTrack: { height: 4, flex: 1, borderRadius: 2, overflow: 'hidden' },
  progressFillInner: { height: '100%', borderRadius: 2 },
  progressText: { fontSize: 10, fontWeight: '700' },
  filterChip: { marginRight: 8 },
  loadingText: { textAlign: 'center', marginTop: 50 },
});