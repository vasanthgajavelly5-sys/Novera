import { Book } from './types';

export const sampleBooks: Book[] = [
  {
    id: 'alice',
    title: 'Alice in Wonderland',
    author: 'Lewis Carroll',
    description: 'A curious adventure through a world where logic takes a holiday.',
    color: '#345B63',
    progress: 68,
    lastRead: 'Today',
    chapter: 'Chapter VII · A Mad Tea-Party',
  },
  {
    id: 'frankenstein',
    title: 'Frankenstein',
    author: 'Mary Shelley',
    description: 'A haunting study of ambition, isolation, and the cost of creation.',
    color: '#634D57',
    progress: 24,
    lastRead: 'Yesterday',
    chapter: 'Chapter IV · The Creature',
  },
  {
    id: 'sherlock',
    title: 'The Adventures of Sherlock Holmes',
    author: 'Arthur Conan Doyle',
    description: 'The first collection of cases for London’s most celebrated detective.',
    color: '#806E45',
    progress: 8,
    lastRead: '4 days ago',
    chapter: 'A Scandal in Bohemia',
  },
];
