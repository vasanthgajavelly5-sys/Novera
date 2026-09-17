export type AppTheme = 'dark' | 'light' | 'sepia';

export type Book = {
  id: string;
  title: string;
  author: string;
  description: string;
  color: string;
  progress: number;
  lastRead: string;
  chapter: string;
  imported?: boolean;
};
