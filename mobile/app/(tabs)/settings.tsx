import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, Switch, Pressable } from 'react-native';
import { useTheme } from '@/theme';
import { useBooks } from '@/hooks';
import { Button, Card, globalStyles } from '@/components';
import * as DocumentPicker from 'expo-document-picker';

export default function SettingsScreen() {
  const theme = useTheme();
  const { books, addBook, refresh } = useBooks();

  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');
  const [showImport, setShowImport] = useState(false);

  const handleImport = useCallback(async () => {
    setShowImport(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/epub+zip',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      const title = asset.name.replace(/\.epub$/i, '').replace(/[-_]/g, ' ');
      // In a real app, this would save the file and create a book record
      Alert.alert('Book Added', `${title || 'Imported book'} is ready in your library.`);
      refresh();
    } catch (error) {
      console.error('Import failed:', error);
      Alert.alert('Import Failed', 'Could not import the EPUB file.');
    } finally {
      setShowImport(false);
    }
  }, [refresh]);

  const handleExport = useCallback(async () => {
    Alert.alert('Export Data', 'This will export your library data as JSON.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Export', onPress: () => Alert.alert('Exported', 'Data exported to clipboard (placeholder)') },
    ]);
  }, []);

  const handleClearAll = useCallback(() => {
    Alert.alert(
      'Clear All Data',
      'This will permanently remove all books, collections, bookmarks, highlights, notes, and progress. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear All', style: 'destructive', onPress: () => Alert.alert('Cleared', 'All data has been cleared (placeholder)') },
      ]
    );
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.eyebrow, { color: theme.colors.accent }]}>PERSONALIZE</Text>
          <Text style={[styles.wordmark, { color: theme.colors.text }]}>Settings</Text>
        </View>

        {/* Theme Section */}
        <Card variant="default" padding="lg" style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Appearance</Text>
          <Text style={[styles.sectionSubtitle, { color: theme.colors.textMuted }]}>Choose your preferred theme</Text>
          <View style={styles.themeRow}>
            {(['dark', 'light'] as const).map((mode) => (
              <ThemeOption
                key={mode}
                mode={mode}
                selected={themeMode === mode}
                onPress={() => setThemeMode(mode)}
                theme={theme}
              />
            ))}
          </View>
        </Card>

        {/* Library Section */}
        <Card variant="default" padding="lg" style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Library</Text>
          <Text style={[styles.sectionSubtitle, { color: theme.colors.textMuted }]}>Manage your books and data</Text>
          <View style={styles.actionGrid}>
            <Button title="Import EPUB" onPress={handleImport} variant="outline" size="md" fullWidth />
            <Button title="Export Data" onPress={handleExport} variant="outline" size="md" fullWidth />
          </View>
        </Card>

        {/* Reader Section */}
        <Card variant="default" padding="lg" style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Reading</Text>
          <Text style={[styles.sectionSubtitle, { color: theme.colors.textMuted }]}>Customize your reading experience</Text>
          <View style={styles.settingRow}>
            <View>
              <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Font Size</Text>
              <Text style={[styles.settingValue, { color: theme.colors.textMuted }]}>100%</Text>
            </View>
            <View style={styles.sliderContainer}>
              <View style={[styles.sliderTrack, { backgroundColor: theme.colors.border }]} />
            </View>
          </View>
          <View style={styles.settingRow}>
            <View>
              <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Line Height</Text>
              <Text style={[styles.settingValue, { color: theme.colors.textMuted }]}>1.6</Text>
            </View>
            <View style={styles.sliderContainer}>
              <View style={[styles.sliderTrack, { backgroundColor: theme.colors.border }]} />
            </View>
          </View>
          <View style={styles.settingRow}>
            <View>
              <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Margins</Text>
              <Text style={[styles.settingValue, { color: theme.colors.textMuted }]}>Normal</Text>
            </View>
            <View style={styles.sliderContainer}>
              <View style={[styles.sliderTrack, { backgroundColor: theme.colors.border }]} />
            </View>
          </View>
          <View style={styles.settingRow}>
            <View>
              <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Font Family</Text>
              <Text style={[styles.settingValue, { color: theme.colors.textMuted }]}>System Default</Text>
            </View>
          </View>
        </Card>

        {/* Privacy Section */}
        <Card variant="default" padding="lg" style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Privacy & Data</Text>
          <Text style={[styles.sectionSubtitle, { color: theme.colors.textMuted }]}>Your data stays on your device</Text>
          <View style={styles.privacyText}>
            <Text style={[styles.privacyLine, { color: theme.colors.textMuted }]}>Offline first. No account required.</Text>
            <Text style={[styles.privacyLine, { color: theme.colors.textMuted }]}>Your books, progress, highlights, and notes never leave this device.</Text>
            <Text style={[styles.privacyLine, { color: theme.colors.textMuted }]}>No analytics, no tracking, no cloud sync.</Text>
          </View>
        </Card>

        {/* Danger Zone */}
        <Card variant="outlined" padding="lg" style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, { color: theme.colors.error }]}>Danger Zone</Text>
          <Text style={[styles.sectionSubtitle, { color: theme.colors.textMuted }]}>Irreversible actions</Text>
          <Button title="Clear All Data" onPress={handleClearAll} variant="destructive" size="md" fullWidth />
        </Card>

        {/* Version */}
        <View style={styles.version}>
          <Text style={[styles.versionText, { color: theme.colors.textFaint }]}>Lirune Reader 4.0.3</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function ThemeOption({ mode, selected, onPress, theme }: { mode: 'dark' | 'light'; selected: boolean; onPress: () => void; theme: ReturnType<typeof import('@/theme').useTheme> }) {
  const modeColors = {
    dark: { bg: '#1A1A1D', text: '#F0F0EB', accent: '#C9B8FF' },
    light: { bg: '#F8F8F5', text: '#1A1A18', accent: '#7C5CFF' },
  };
  const colors = modeColors[mode];

  return (
    <Pressable
      style={[
        styles.themeOption,
        { backgroundColor: colors.bg, borderColor: selected ? colors.accent : '#2C3949' },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${mode} theme`}
      accessibilityState={{ selected }}
    >
      <View style={[styles.themeDot, { backgroundColor: colors.accent }]} />
      <Text style={[styles.themeLabel, { color: colors.text, fontWeight: selected ? '700' : '500' }]}>
        {mode.charAt(0).toUpperCase() + mode.slice(1)}
      </Text>
      {selected && <View style={styles.checkMark} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 100 },
  header: { marginBottom: 24 },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  wordmark: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  sectionCard: { marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  sectionSubtitle: { fontSize: 13, marginBottom: 16 },
  themeRow: { flexDirection: 'row', gap: 12 },
  themeOption: { flex: 1, padding: 16, borderRadius: 16, borderWidth: 2, alignItems: 'center', gap: 10 },
  themeDot: { width: 28, height: 28, borderRadius: 14 },
  themeLabel: { fontSize: 14, fontWeight: '600' },
  checkMark: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#C9B8FF', alignItems: 'center', justifyContent: 'center' },
  actionGrid: { flexDirection: 'row', gap: 12 },
  settingRow: { marginBottom: 20 },
  settingLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  settingValue: { fontSize: 12, marginTop: 2 },
  sliderContainer: { height: 4, marginTop: 8 },
  sliderTrack: { borderRadius: 2 },
  privacyText: { gap: 8 },
  privacyLine: { fontSize: 13, lineHeight: 20 },
  version: { alignItems: 'center', paddingTop: 24, paddingBottom: 40 },
  versionText: { fontSize: 11 },
});