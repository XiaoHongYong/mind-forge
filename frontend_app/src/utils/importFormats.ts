/**
 * Mind map formats the Open dialog can parse.
 *
 * Adding a format is one entry in this table; Save/Export reuse the matching
 * serializers in `exportFormats.ts`.
 */

import type { MindMapTreeNode } from '../types';
import { freemindToTree } from './freemindImport';
import { obsidianMarkdownToTree } from './markdownImport';
import { wisemappingToTree } from './wisemappingImport';
import { mmforgeToTree } from './mmforgeFormat';

export type ImportFormatId = 'mmforge' | 'md' | 'mm' | 'wxml' | 'xmind';

export interface ImportFormat {
  id: ImportFormatId;
  /** The `accept` attribute of this format's hidden file input. */
  accept: string;
  /** Prefixes this format's failure message, which is shown on its own. */
  errorLabel: string;
  /** Stripped from the file name to title the new vault. */
  extensions: RegExp;
  /** Reads the file and parses it into a tree root. */
  parse: (file: File, vaultTitle: string) => Promise<MindMapTreeNode>;
}

/** The opened document is titled from the file name, without its extension. */
export function vaultTitleFromFileName(fileName: string, extensions: RegExp): string {
  return fileName.replace(extensions, '') || 'Untitled';
}

export const IMPORT_FORMATS: ImportFormat[] = [
  {
    // The native format: the only one that re-imports everything the editor
    // can set. Listed first for the same reason it is first in the export menu.
    id: 'mmforge',
    accept: '.mmforge',
    errorLabel: 'MindForge import failed',
    extensions: /\.mmforge$/i,
    parse: async (file, title) => mmforgeToTree(await file.text(), title),
  },
  {
    id: 'md',
    accept: '.md',
    errorLabel: 'Import failed',
    extensions: /\.md$/i,
    parse: async (file, title) => obsidianMarkdownToTree(await file.text(), title),
  },
  {
    id: 'mm',
    accept: '.mm',
    errorLabel: '.mm import failed',
    extensions: /\.mm$/i,
    // Handles both FreeMind and FreePlane — the parser detects which by
    // <map version>.
    parse: async (file, title) => freemindToTree(await file.text(), title),
  },
  {
    id: 'wxml',
    accept: '.wxml,.xml',
    errorLabel: 'WiseMapping import failed',
    extensions: /\.(wxml|xml)$/i,
    parse: async (file, title) => wisemappingToTree(await file.text(), title),
  },
  {
    id: 'xmind',
    accept: '.xmind',
    errorLabel: 'XMind import failed',
    extensions: /\.xmind$/i,
    // Loaded on demand: the XMind reader pulls in a zip decoder that the other
    // three formats do not need.
    parse: async (file, title) => {
      const { xmindToTree } = await import('./xmindImport');
      return xmindToTree(await file.arrayBuffer(), title);
    },
  },
];

/**
 * The import menu, which is not one-to-one with the formats above: FreeMind
 * and FreePlane are listed separately because people look for their own
 * application's name, and both open the same `.mm` reader.
 */
export interface ImportMenuItem {
  label: string;
  /** Shown greyed beside the label. */
  extension: string;
  format: ImportFormatId;
}

export const IMPORT_MENU_ITEMS: ImportMenuItem[] = [
  { label: 'MindForge', extension: '.mmforge', format: 'mmforge' },
  { label: 'Markdown', extension: '.md', format: 'md' },
  { label: 'FreeMind', extension: '.mm', format: 'mm' },
  { label: 'FreePlane', extension: '.mm', format: 'mm' },
  { label: 'WiseMapping', extension: '.wxml', format: 'wxml' },
  { label: 'XMind', extension: '.xmind', format: 'xmind' },
];
