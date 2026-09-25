import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, TextInput } from 'react-native';
import { useTheme } from '@/theme';
import { useCollections, useBooks } from '@/hooks';
import { Button, Card, EmptyCollectionsState, globalStyles } from '@/components';
import { Collection } from '@/models/Book';

export default function CollectionsScreen() {
  const theme = useTheme();
  const { collections, loading, addCollection, removeCollection } = useCollections();
  const { books } = useBooks();

  const [showCreate, setShowCreate] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');

  const handleCreate = () => {
    if (!newCollectionName.trim()) return;
    const newCollection: Collection = {
      id: `col-${Date.now()}`,
      name: newCollectionName.trim(),
      color: theme.colors.accent,
      bookIds: [],
      dateCreated: Date.now(),
      dateModified: Date.now(),
    };
    addCollection(newCollection);
    setShowCreate(false);
    setNewCollectionName('');
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete Collection',
      'This will remove the collection but keep the books in your library.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => removeCollection(id) },
      ]
    );
  };

  if (loading) {
    return <View style={[styles(theme).container, { backgroundColor: theme.colors.background }]} />;
  }

  return (
    <View style={[styles(theme).container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles(theme).scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles(theme).header}>
          <View>
            <Text style={[styles(theme).eyebrow, { color: theme.colors.accent }]}>ORGANIZE</Text>
            <Text style={[styles(theme).wordmark, { color: theme.colors.text }]}>Collections</Text>
          </View>
        </View>

        {/* Create collection button */}
        <View style={styles(theme).createSection}>
          <Button
            title="+ New Collection"
            onPress={() => setShowCreate(true)}
            variant="primary"
            size="md"
            fullWidth
            accessibilityLabel="Create a new collection"
          />
        </View>

        {showCreate && (
          <View style={styles(theme).createForm}>
            <Text style={[styles(theme).formLabel, { color: theme.colors.textMuted }]}>Collection Name</Text>
            <View style={[styles(theme).inputRow, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
              <TextInput
                value={newCollectionName}
                onChangeText={setNewCollectionName}
                placeholder="e.g. Sci-Fi, To Read, Favorites"
                placeholderTextColor={theme.colors.textFaint}
                style={[styles(theme).formInput, { color: theme.colors.text }]}
                autoFocus
                onSubmitEditing={handleCreate}
              />
            </View>
            <View style={styles(theme).formActions}>
              <Button title="Cancel" onPress={() => setShowCreate(false)} variant="ghost" size="md" />
              <Button title="Create" onPress={handleCreate} variant="primary" size="md" disabled={!newCollectionName.trim()} />
            </View>
          </View>
        )}

        {/* Collections list */}
        {collections.length === 0 ? (
          <EmptyCollectionsState onCreate={() => setShowCreate(true)} />
        ) : (
          <View style={styles(theme).list}>
            {collections.map((collection) => (
              <CollectionCard
                key={collection.id}
                collection={collection}
                bookCount={books.filter((b) => collection.bookIds.includes(b.id)).length}
                theme={theme}
                onPress={() => {/* Navigate to collection detail */}}
                onDelete={() => handleDelete(collection.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function CollectionCard({ collection, bookCount, theme, onPress, onDelete }: { collection: Collection; bookCount: number; theme: ReturnType<typeof import('@/theme').useTheme>; onPress: () => void; onDelete: () => void }) {
  return (
    <Card variant="default" padding="md" style={styles(theme).collectionCard} onPress={onPress} onLongPress={onDelete} accessibilityLabel={`Collection: ${collection.name}, ${bookCount} books`} accessibilityRole="button">
      <View style={styles(theme).collectionHeader}>
        <View style={[styles(theme).collectionColor, { backgroundColor: collection.color }]} />
        <View style={styles(theme).collectionInfo}>
          <Text style={[styles(theme).collectionName, { color: theme.colors.text }]}>{collection.name}</Text>
          <Text style={[styles(theme).collectionCount, { color: theme.colors.textMuted }]}>{bookCount} book{bookCount !== 1 ? 's' : ''}</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = (theme: ReturnType<typeof import('@/theme').useTheme>) => StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 100 },
  header: { marginBottom: 24 },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: theme.colors.accent, marginBottom: 4 },
  wordmark: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  createSection: { marginBottom: 20 },
  createForm: { marginBottom: 24, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceElevated },
  formLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', height: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14 },
  formInput: { flex: 1, fontSize: 16 },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 12 },
  list: { gap: 12 },
  collectionCard: { padding: 16 },
  collectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  collectionColor: { width: 44, height: 44, borderRadius: 12 },
  collectionInfo: { flex: 1 },
  collectionName: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  collectionCount: { fontSize: 12, color: theme.colors.textMuted },
});