import { StatusBar } from 'expo-status-bar';
import * as DocumentPicker from 'expo-document-picker';
import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { sampleBooks } from './src/sampleBooks';
import { themes } from './src/theme';
import { AppTheme, Book } from './src/types';

export default function App() {
  const [themeName, setThemeName] = useState<AppTheme>('dark');
  const [books, setBooks] = useState<Book[]>(sampleBooks);
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'library' | 'stats' | 'settings'>('library');
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const theme = themes[themeName];
  const filteredBooks = useMemo(
    () => books.filter((book) => `${book.title} ${book.author}`.toLowerCase().includes(query.toLowerCase())),
    [books, query],
  );

  async function importBook() {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/epub+zip',
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    const title = asset.name.replace(/\.epub$/i, '').replace(/[-_]/g, ' ');
    const importedBook: Book = {
      id: `imported-${Date.now()}`,
      title: title || 'Imported book',
      author: 'Imported EPUB',
      description: 'Ready for offline reading on this device.',
      color: theme.accent,
      progress: 0,
      lastRead: 'Just added',
      chapter: 'Opening chapter',
      imported: true,
    };
    setBooks((current) => [importedBook, ...current]);
    Alert.alert('Book added', `${importedBook.title} is ready in your library.`);
  }

  if (selectedBook) {
    return <Reader book={selectedBook} theme={theme} onBack={() => setSelectedBook(null)} />;
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <StatusBar style={themeName === 'dark' ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.eyebrow, { color: theme.accent }]}>YOUR READING ROOM</Text>
            <Text style={[styles.wordmark, { color: theme.text }]}>Novera</Text>
          </View>
          <Pressable onPress={() => setActiveTab('settings')} style={[styles.avatar, { backgroundColor: theme.accentSoft }]}>
            <Text style={[styles.avatarText, { color: theme.accent }]}>V</Text>
          </Pressable>
        </View>

        {activeTab === 'library' && (
          <>
            <View style={[styles.welcome, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.welcomeCopy}>
                <Text style={[styles.welcomeLabel, { color: theme.muted }]}>GOOD EVENING</Text>
                <Text style={[styles.welcomeTitle, { color: theme.text }]}>A quiet place{`\n`}for your next chapter.</Text>
                <Text style={[styles.welcomeBody, { color: theme.muted }]}>Your books, progress, and notes stay on this device.</Text>
              </View>
              <View style={[styles.sun, { backgroundColor: theme.accent }]} />
            </View>

            <View style={styles.sectionHeading}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Continue reading</Text>
              <Text style={[styles.sectionMeta, { color: theme.accent }]}>{books.length} books</Text>
            </View>

            {books[0] && <ContinueCard book={books[0]} theme={theme} onPress={() => setSelectedBook(books[0])} />}

            <View style={[styles.search, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.searchIcon, { color: theme.muted }]}>⌕</Text>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search your library"
                placeholderTextColor={theme.faint}
                style={[styles.searchInput, { color: theme.text }]}
              />
            </View>

            <View style={styles.sectionHeading}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>All books</Text>
              <Pressable onPress={importBook}><Text style={[styles.sectionMeta, { color: theme.accent }]}>+ Import</Text></Pressable>
            </View>
            <View style={styles.grid}>
              {filteredBooks.map((book) => <BookCard key={book.id} book={book} theme={theme} onPress={() => setSelectedBook(book)} />)}
            </View>
            {filteredBooks.length === 0 && <Text style={[styles.empty, { color: theme.muted }]}>No books match that search.</Text>}
          </>
        )}

        {activeTab === 'stats' && <Stats theme={theme} books={books} />}
        {activeTab === 'settings' && <Settings theme={theme} themeName={themeName} setThemeName={setThemeName} importBook={importBook} />}
      </ScrollView>

      <View style={[styles.tabBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Tab label="Library" icon="▦" active={activeTab === 'library'} theme={theme} onPress={() => setActiveTab('library')} />
        <Tab label="Stats" icon="◒" active={activeTab === 'stats'} theme={theme} onPress={() => setActiveTab('stats')} />
        <Tab label="Settings" icon="⌘" active={activeTab === 'settings'} theme={theme} onPress={() => setActiveTab('settings')} />
      </View>
    </SafeAreaView>
  );
}

function ContinueCard({ book, theme, onPress }: { book: Book; theme: typeof themes.dark; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.continueCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
    <BookCover book={book} theme={theme} large />
    <View style={styles.continueInfo}>
      <Text style={[styles.kicker, { color: theme.accent }]}>PICK UP WHERE YOU LEFT OFF</Text>
      <Text style={[styles.continueTitle, { color: theme.text }]} numberOfLines={2}>{book.title}</Text>
      <Text style={[styles.author, { color: theme.muted }]}>{book.author}</Text>
      <View style={styles.progressRow}><View style={[styles.progressTrack, { backgroundColor: theme.elevated }]}><View style={[styles.progressFill, { backgroundColor: theme.accent, width: `${book.progress}%` }]} /></View><Text style={[styles.progressText, { color: theme.accent }]}>{book.progress}%</Text></View>
    </View>
  </Pressable>;
}

function BookCard({ book, theme, onPress }: { book: Book; theme: typeof themes.dark; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.bookCard}><BookCover book={book} theme={theme} /><Text style={[styles.bookTitle, { color: theme.text }]} numberOfLines={2}>{book.title}</Text><Text style={[styles.bookAuthor, { color: theme.muted }]} numberOfLines={1}>{book.author}</Text></Pressable>;
}

function BookCover({ book, theme, large = false }: { book: Book; theme: typeof themes.dark; large?: boolean }) {
  return <View style={[large ? styles.coverLarge : styles.cover, { backgroundColor: book.color, borderColor: theme.border }]}><View style={styles.coverMark}><Text style={styles.coverInitial}>{book.title.slice(0, 1)}</Text></View><Text style={styles.coverText} numberOfLines={3}>{book.title}</Text><Text style={styles.coverAuthor} numberOfLines={1}>{book.author}</Text></View>;
}

function Stats({ theme, books }: { theme: typeof themes.dark; books: Book[] }) {
  const average = Math.round(books.reduce((sum, book) => sum + book.progress, 0) / Math.max(books.length, 1));
  return <View><Text style={[styles.pageTitle, { color: theme.text }]}>Your reading rhythm</Text><Text style={[styles.pageSubtitle, { color: theme.muted }]}>A gentle view of your progress, without the pressure.</Text><View style={styles.statGrid}><Stat label="Books" value={String(books.length)} theme={theme} /><Stat label="Avg. progress" value={`${average}%`} theme={theme} /><Stat label="This week" value="3h 40m" theme={theme} /><Stat label="Streak" value="6 days" theme={theme} /></View><View style={[styles.goalCard, { backgroundColor: theme.card, borderColor: theme.border }]}><Text style={[styles.kicker, { color: theme.accent }]}>WEEKLY INTENTION</Text><Text style={[styles.goalTitle, { color: theme.text }]}>Make room for 30 more pages.</Text><View style={[styles.progressTrack, { backgroundColor: theme.elevated }]}><View style={[styles.progressFill, { backgroundColor: theme.accent, width: '64%' }]} /></View><Text style={[styles.pageSubtitle, { color: theme.muted }]}>19 of 30 pages completed</Text></View></View>;
}

function Stat({ label, value, theme }: { label: string; value: string; theme: typeof themes.dark }) { return <View style={[styles.stat, { backgroundColor: theme.surface, borderColor: theme.border }]}><Text style={[styles.statValue, { color: theme.text }]}>{value}</Text><Text style={[styles.statLabel, { color: theme.muted }]}>{label}</Text></View>; }

function Settings({ theme, themeName, setThemeName, importBook }: { theme: typeof themes.dark; themeName: AppTheme; setThemeName: (value: AppTheme) => void; importBook: () => void }) {
  return <View><Text style={[styles.pageTitle, { color: theme.text }]}>Make Novera yours</Text><Text style={[styles.pageSubtitle, { color: theme.muted }]}>Reading preferences are designed to travel with you.</Text><Text style={[styles.settingLabel, { color: theme.muted }]}>APP THEME</Text><View style={styles.themeRow}>{(['dark', 'light', 'sepia'] as AppTheme[]).map((option) => <Pressable key={option} onPress={() => setThemeName(option)} style={[styles.themeChoice, { backgroundColor: themes[option].surface, borderColor: themeName === option ? theme.accent : theme.border }]}><View style={[styles.themeDot, { backgroundColor: themes[option].accent }]} /><Text style={[styles.themeName, { color: themes[option].text }]}>{option[0].toUpperCase() + option.slice(1)}</Text></Pressable>)}</View><Pressable onPress={importBook} style={[styles.importButton, { backgroundColor: theme.accent }]}><Text style={styles.importText}>Import an EPUB</Text></Pressable><Text style={[styles.privacy, { color: theme.muted }]}>Offline first. No account required. Your books and reading data stay on this device.</Text></View>;
}

function Reader({ book, theme, onBack }: { book: Book; theme: typeof themes.dark; onBack: () => void }) {
  return <SafeAreaView style={[styles.safe, { backgroundColor: theme.reading }]}><StatusBar style="light" /><View style={[styles.readerHeader, { borderBottomColor: theme.border }]}><Pressable onPress={onBack}><Text style={[styles.back, { color: theme.accent }]}>‹ Library</Text></Pressable><Text style={[styles.readerProgress, { color: theme.muted }]}>{book.progress}%</Text></View><ScrollView contentContainerStyle={styles.readerContent}><Text style={[styles.readerKicker, { color: theme.accent }]}>{book.chapter}</Text><Text style={[styles.readerTitle, { color: theme.readingText }]}>{book.title}</Text><Text style={[styles.readerBody, { color: theme.readingText }]}>The room was quiet, save for the soft turn of a page. Outside, the evening gathered at the windows, but here the story held its own weather.</Text><Text style={[styles.readerBody, { color: theme.readingText }]}>There are books that ask to be finished, and books that ask to be visited. Novera keeps the door open, remembering the place where you paused and leaving enough silence for you to return.</Text><Text style={[styles.readerBody, { color: theme.readingText }]}>This mobile reader shell is ready for the EPUB rendering bridge, with typography, themes, progress, highlights, and offline storage designed as separate layers.</Text></ScrollView></SafeAreaView>;
}

function Tab({ label, icon, active, theme, onPress }: { label: string; icon: string; active: boolean; theme: typeof themes.dark; onPress: () => void }) { return <Pressable onPress={onPress} style={styles.tab}><Text style={[styles.tabIcon, { color: active ? theme.accent : theme.muted }]}>{icon}</Text><Text style={[styles.tabLabel, { color: active ? theme.accent : theme.muted }]}>{label}</Text></Pressable>; }

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  content: { padding: 22, paddingBottom: 110 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 26 },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  wordmark: { fontSize: 34, fontWeight: '700', letterSpacing: -1.2, marginTop: 3 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '700' },
  welcome: { borderRadius: 24, borderWidth: 1, padding: 22, minHeight: 168, overflow: 'hidden', flexDirection: 'row', marginBottom: 28 },
  welcomeCopy: { flex: 1, zIndex: 1 },
  welcomeLabel: { fontSize: 10, letterSpacing: 1.4, fontWeight: '700' },
  welcomeTitle: { fontSize: 25, lineHeight: 29, fontWeight: '700', marginTop: 10 },
  welcomeBody: { fontSize: 12, lineHeight: 18, marginTop: 13, maxWidth: 220 },
  sun: { position: 'absolute', width: 170, height: 170, borderRadius: 85, right: -58, top: -46, opacity: 0.8 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 13 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  sectionMeta: { fontSize: 12, fontWeight: '700' },
  continueCard: { borderRadius: 20, borderWidth: 1, padding: 14, flexDirection: 'row', marginBottom: 26 },
  continueInfo: { flex: 1, paddingLeft: 15, justifyContent: 'center' },
  kicker: { fontSize: 9, fontWeight: '700', letterSpacing: 1.1 },
  continueTitle: { fontSize: 18, lineHeight: 22, fontWeight: '700', marginTop: 7 },
  author: { fontSize: 12, marginTop: 5 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 15 },
  progressTrack: { height: 5, flex: 1, borderRadius: 5, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 5 },
  progressText: { fontSize: 10, fontWeight: '700' },
  cover: { width: 102, height: 142, borderRadius: 8, borderWidth: 1, padding: 10, justifyContent: 'space-between', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 7, elevation: 4 },
  coverLarge: { width: 106, height: 148, borderRadius: 9, borderWidth: 1, padding: 10, justifyContent: 'space-between' },
  coverMark: { width: 21, height: 21, borderRadius: 11, backgroundColor: 'rgba(255,255,255,.18)', alignItems: 'center', justifyContent: 'center' },
  coverInitial: { color: '#fff', fontSize: 11, fontWeight: '700' },
  coverText: { color: '#fff', fontSize: 14, lineHeight: 16, fontWeight: '700' },
  coverAuthor: { color: 'rgba(255,255,255,.72)', fontSize: 9 },
  search: { height: 48, borderRadius: 15, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, marginBottom: 25 },
  searchIcon: { fontSize: 23, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 22 },
  bookCard: { width: '31%', minWidth: 100 },
  bookTitle: { fontSize: 12, lineHeight: 15, fontWeight: '700', marginTop: 9 },
  bookAuthor: { fontSize: 10, marginTop: 3 },
  empty: { textAlign: 'center', marginTop: 25 },
  tabBar: { position: 'absolute', left: 15, right: 15, bottom: 14, height: 68, borderRadius: 22, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', elevation: 10 },
  tab: { alignItems: 'center', minWidth: 72 },
  tabIcon: { fontSize: 21, lineHeight: 25 },
  tabLabel: { fontSize: 10, fontWeight: '600', marginTop: 3 },
  pageTitle: { fontSize: 28, lineHeight: 33, fontWeight: '700', marginBottom: 8 },
  pageSubtitle: { fontSize: 14, lineHeight: 20, marginBottom: 26 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 22 },
  stat: { width: '48%', padding: 16, borderRadius: 17, borderWidth: 1 },
  statValue: { fontSize: 24, fontWeight: '700' },
  statLabel: { fontSize: 11, marginTop: 7 },
  goalCard: { padding: 19, borderRadius: 20, borderWidth: 1 },
  goalTitle: { fontSize: 19, fontWeight: '700', marginVertical: 13 },
  settingLabel: { fontSize: 10, letterSpacing: 1.5, fontWeight: '700', marginBottom: 12 },
  themeRow: { gap: 9, marginBottom: 28 },
  themeChoice: { height: 57, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15 },
  themeDot: { width: 22, height: 22, borderRadius: 11, marginRight: 12 },
  themeName: { fontSize: 14, fontWeight: '600' },
  importButton: { height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  importText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  privacy: { textAlign: 'center', fontSize: 12, lineHeight: 18, marginTop: 20, paddingHorizontal: 18 },
  readerHeader: { height: 62, borderBottomWidth: 1, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { fontSize: 15, fontWeight: '700' },
  readerProgress: { fontSize: 12 },
  readerContent: { padding: 28, paddingBottom: 80 },
  readerKicker: { fontSize: 10, letterSpacing: 1.4, fontWeight: '700', marginBottom: 16 },
  readerTitle: { fontSize: 35, lineHeight: 40, fontWeight: '700', marginBottom: 30 },
  readerBody: { fontFamily: 'serif', fontSize: 19, lineHeight: 31, marginBottom: 24 },
});
