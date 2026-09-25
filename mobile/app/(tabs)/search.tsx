import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet, Keyboard, Pressable } from 'react-native';
import { useTheme } from '@/theme';
import { useBooks } from '@/hooks';
import { EmptySearchState, globalStyles } from '@/components';

export default function SearchScreen() {
  const theme = useTheme();
  const { books, searchBooks, loading } = useBooks();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = useCallback(async (text: string) => {
    setQuery(text);
    if (!text.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      const data = await searchBooks(text);
      setResults(data);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(query);
    }, 200);
    return () => clearTimeout(timer);
  }, [query, handleSearch]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={[styles.searchBar, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.searchIcon, { color: theme.colors.textMuted }]}>⌕</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search titles, authors, descriptions…"
              placeholderTextColor={theme.colors.textFaint}
              style={[styles.searchInput, { color: theme.colors.text }]}
              autoFocus
              autoCorrect={false}
              spellCheck={false}
              accessibilityLabel="Search your library"
            />
            {query && (
              <Pressable style={styles.clearButton} onPress={() => { setQuery(''); Keyboard.dismiss(); }}>
                <Text style={[styles.clearText, { color: theme.colors.textMuted }]}>✕</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Results */}
        {query.trim() === '' ? (
          <View style={styles.emptyHint}>
            <Text style={[styles.hintText, { color: theme.colors.textMuted }]}>Type to search your library</Text>
          </View>
        ) : searching ? (
          <View style={styles.searching}>
            <Text style={[styles.loadingText, { color: theme.colors.textMuted }]}>Searching…</Text>
          </View>
        ) : results.length === 0 ? (
          <EmptySearchState query={query} />
        ) : (
          <View style={styles.results}>
            <Text style={[styles.resultsLabel, { color: theme.colors.textMuted }]}>{results.length} result{results.length !== 1 ? 's' : ''}</Text>
            <View style={styles.resultsGrid}>
              {results.map((book) => (
                <SearchResultCard key={book.id} book={book} theme={theme} />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function SearchResultCard({ book, theme }: { book: any; theme: ReturnType<typeof import('@/theme').useTheme> }) {
  return (
    <Pressable style={styles.resultCard} accessibilityLabel={`${book.title} by ${book.author}, ${book.progress}% read`} accessibilityRole="button">
      <View style={[styles.resultCover, { backgroundColor: book.coverColor }]}>
        <Text style={styles.coverInitial}>{book.title.slice(0, 1)}</Text>
      </View>
      <View style={styles.resultInfo}>
        <Text style={[styles.resultTitle, { color: theme.colors.text }]} numberOfLines={2}>{book.title}</Text>
        <Text style={[styles.resultAuthor, { color: theme.colors.textMuted }]}>{book.author}</Text>
        <View style={styles.resultProgress}>
          <View style={[styles.progressTrack, { backgroundColor: theme.colors.surfaceElevated }]}>
            <View style={[styles.progressFill, { backgroundColor: theme.colors.accent, width: `${book.progress}%` }]} />
          </View>
          <Text style={[styles.progressText, { color: theme.colors.accent }]}>{book.progress}%</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 100 },
  searchContainer: { marginBottom: 16 },
  searchBar: { height: 52, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  searchIcon: { fontSize: 22, marginRight: 10 },
  searchInput: { flex: 1, fontSize: 16 },
  clearButton: { padding: 4 },
  clearText: { fontSize: 20 },
  emptyHint: { paddingTop: 60, alignItems: 'center' },
  hintText: { fontSize: 16, textAlign: 'center', maxWidth: 280, lineHeight: 24 },
  searching: { paddingTop: 60, alignItems: 'center' },
  loadingText: { fontSize: 16 },
  results: { marginTop: 16 },
  resultsLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 12 },
  resultsGrid: { gap: 12 },
  resultCard: { flexDirection: 'row', gap: 14, padding: 12, borderRadius: 12, backgroundColor: '#202024', borderWidth: 1, borderColor: '#2C3949' },
  resultCover: { width: 56, height: 78, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  coverInitial: { color: '#fff', fontSize: 18, fontWeight: '700' },
  resultInfo: { flex: 1, justifyContent: 'center', minWidth: 0 },
  resultTitle: { fontSize: 14, fontWeight: '700', lineHeight: 18, marginBottom: 4 },
  resultAuthor: { fontSize: 11, marginBottom: 8 },
  resultProgress: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressTrack: { height: 4, flex: 1, borderRadius: 2, overflow: 'hidden', backgroundColor: '#2A2A2F' },
  progressFill: { height: '100%', borderRadius: 2 },
  progressText: { fontSize: 10, fontWeight: '700' },
});