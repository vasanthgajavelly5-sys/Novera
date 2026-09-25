import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, StatusBar, ScrollView, Pressable } from 'react-native';
import { useTheme } from '@/theme';
import { Button } from '@/components';

interface ReaderScreenProps {
  book?: any;
}

export default function ReaderScreen({ book }: ReaderScreenProps) {
  const theme = useTheme();
  const [showControls, setShowControls] = useState(true);
  const [fontSize, setFontSize] = useState(100);
  const [themeMode, setThemeMode] = useState<'dark' | 'light' | 'sepia'>('dark');

  const handleBack = useCallback(() => {
    // Navigation would go back to library
  }, []);

  const toggleControls = useCallback(() => {
    setShowControls((prev) => !prev);
  }, []);

  const mockBook = book || {
    title: 'Sample Book',
    author: 'Sample Author',
    progress: 42,
    chapter: 'Chapter 3 · The Beginning',
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.readingBackground }]}>
      <StatusBar barStyle={themeMode === 'dark' ? 'light-content' : 'dark-content'} />

      {/* Top Controls */}
      {showControls && (
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <Button
            title="‹ Library"
            onPress={handleBack}
            variant="ghost"
            size="sm"
            accessibilityLabel="Go back to library"
          />
          <Text style={[styles.progressText, { color: theme.colors.readingMuted }]}>{mockBook.progress}%</Text>
        </View>
      )}

      {/* Reading Area */}
      <Pressable style={styles.readerArea} onPress={toggleControls} accessible={true} accessibilityRole="button" accessibilityLabel="Tap to show controls">
        <View style={styles.chapterWrapper}>
          <Text style={[styles.chapterLabel, { color: theme.colors.accent }]}>{mockBook.chapter}</Text>
          <Text style={[styles.chapterTitle, { color: theme.colors.readingText }]}>{mockBook.title}</Text>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.bodyText, { color: theme.colors.readingText }]}>
            The room was quiet, save for the soft turn of a page. Outside, the evening gathered at the windows, but here the story held its own weather.
          </Text>
          <Text style={[styles.bodyText, { color: theme.colors.readingText }]}>
            There are books that ask to be finished, and books that ask to be visited. Lirune Reader keeps the door open, remembering the place where you paused and leaving enough silence for you to return.
          </Text>
          <Text style={[styles.bodyText, { color: theme.colors.readingText }]}>
            This mobile reader shell is ready for the EPUB rendering bridge, with typography, themes, progress, highlights, and offline storage designed as separate layers.
          </Text>
          <Text style={[styles.bodyText, { color: theme.colors.readingText }]}>
            The architecture separates the reading engine from the UI layer, allowing the EPUB renderer to be swapped without affecting the rest of the application. This modularity ensures that future improvements to the rendering engine won't require rewriting the entire application.
          </Text>
          <Text style={[styles.bodyText, { color: theme.colors.readingText }]}>
            Chapter navigation, bookmarks, highlights, and annotations are all managed through a central state layer, making it easy to persist and restore reading sessions across app launches.
          </Text>
        </ScrollView>

        {/* Progress Bar */}
        <View style={[styles.progressContainer, { backgroundColor: theme.colors.surfaceElevated }]}>
          <View style={[styles.progressTrack, { backgroundColor: theme.colors.border }]}>
            <View style={[styles.progressFill, { backgroundColor: theme.colors.accent, width: `${mockBook.progress}%` }]} />
          </View>
          <Text style={[styles.progressLabel, { color: theme.colors.readingMuted }]}>{mockBook.progress}% · {mockBook.chapter}</Text>
        </View>

        {/* Bottom Controls */}
        {showControls && (
          <View style={[styles.bottomControls, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
            <View style={styles.controlRow}>
              <Button title="Aa" onPress={() => {}} variant="outline" size="sm" accessibilityLabel="Font settings" />
              <Button title="🔖" onPress={() => {}} variant="outline" size="sm" accessibilityLabel="Add bookmark" />
              <Button title="🖍" onPress={() => {}} variant="outline" size="sm" accessibilityLabel="Add highlight" />
              <Button title="🔍" onPress={() => {}} variant="outline" size="sm" accessibilityLabel="Search in book" />
            </View>
          </View>
        )}
      </Pressable>
      </SafeAreaView>
    );
  }
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { height: 56, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16 },
  progressText: { fontSize: 12, fontWeight: '600' },
  readerArea: { flex: 1 },
  chapterWrapper: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 12 },
  chapterLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.4, marginBottom: 8 },
  chapterTitle: { fontSize: 28, fontWeight: '700', lineHeight: 34, marginBottom: 24 },
  content: { flex: 1 },
  contentContainer: { paddingHorizontal: 24, paddingBottom: 100 },
  bodyText: { fontSize: 19, lineHeight: 31, fontFamily: 'serif', marginBottom: 24 },
  progressContainer: { paddingHorizontal: 24, paddingVertical: 12 },
  progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  progressLabel: { fontSize: 11, fontWeight: '600', marginTop: 6, textAlign: 'center' },
  bottomControls: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', justifyContent: 'center' },
  controlRow: { flexDirection: 'row', gap: 12 },
});