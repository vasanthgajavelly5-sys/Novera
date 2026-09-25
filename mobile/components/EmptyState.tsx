import React from 'react';
import { View, Text, StyleSheet, ImageStyle, ViewStyle } from 'react-native';
import { useTheme } from '@/theme';
import { Button } from './Button';

export interface EmptyStateProps {
  title: string;
  message: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'outline';
  };
  style?: ViewStyle;
  illustrationStyle?: ImageStyle;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  message,
  icon,
  action,
  style,
  illustrationStyle,
}) => {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.background },
        style,
      ]}
      accessibilityLiveRegion="polite"
    >
      {icon && (
        <View style={[styles.iconContainer, { backgroundColor: theme.colors.accentSoft }, illustrationStyle]}>
          {icon}
        </View>
      )}
      <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
      <Text style={[styles.message, { color: theme.colors.textMuted }]}>{message}</Text>
      {action && (
        <View style={styles.actionContainer}>
          <Button
            title={action.label}
            onPress={action.onPress}
            variant={action.variant || 'primary'}
            size="md"
            fullWidth={false}
            accessibilityLabel={action.label}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    minHeight: 200,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    maxWidth: 280,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 280,
  },
  actionContainer: {
    width: '100%',
    alignItems: 'center',
  },
});

// Simple icon components using Text
const BookIcon = ({ size = 32, color }: { size?: number; color: string }) => (
  <Text style={{ fontSize: size, color }}>📖</Text>
);
const FolderIcon = ({ size = 32, color }: { size?: number; color: string }) => (
  <Text style={{ fontSize: size, color }}>📁</Text>
);
const SearchIcon = ({ size = 32, color }: { size?: number; color: string }) => (
  <Text style={{ fontSize: size, color }}>🔍</Text>
);
const SettingsIcon = ({ size = 32, color }: { size?: number; color: string }) => (
  <Text style={{ fontSize: size, color }}>⚙️</Text>
);

export const EmptyLibraryState = ({ onImport }: { onImport: () => void }) => (
  <EmptyState
    title="Your Library is Empty"
    message="Add your first EPUB to start reading. Your books stay private and offline."
    icon={<BookIcon size={32} color="#C9B8FF" />}
    action={{ label: 'Import EPUB', onPress: onImport, variant: 'primary' }}
  />
);

export const EmptyCollectionsState = ({ onCreate }: { onCreate: () => void }) => (
  <EmptyState
    title="No Collections Yet"
    message="Create collections to organize your books by genre, mood, or reading goal."
    icon={<FolderIcon size={32} color="#C9B8FF" />}
    action={{ label: 'Create Collection', onPress: onCreate, variant: 'primary' }}
  />
);

export const EmptySearchState = ({ query }: { query: string }) => (
  <EmptyState
    title="No Results"
    message={`No books found for "${query}". Try a different search term.`}
    icon={<SearchIcon size={32} color="#C9B8FF" />}
  />
);

export const EmptyCollectionsFilterState = () => (
  <EmptyState
    title="No Books in Collection"
    message="This collection doesn't have any books yet. Add some from your library."
    icon={<FolderIcon size={32} color="#C9B8FF" />}
  />
);