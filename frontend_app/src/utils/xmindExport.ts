import { zipSync, strToU8 } from 'fflate';
import type { MindMapTreeNode } from '../types';

let topicCounter = 0;

interface XMindTopic {
  id: string;
  class: 'topic';
  title: string;
  children?: { attached: XMindTopic[] };
  notes?: { plain: { content: string } };
  href?: string;
  style?: { id: string; type: 'topic'; properties: Record<string, string> };
}

/** Stub content.xml that modern XMind packages carry for older clients. */
const CONTENT_XML_STUB = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<xmap-content xmlns="urn:xmind:xmap:xmlns:content:2.0" xmlns:fo="http://www.w3.org/1999/XSL/Format" xmlns:svg="http://www.w3.org/2000/svg" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:xlink="http://www.w3.org/1999/xlink" modified-by="mindforge" timestamp="0" version="2.0">
  <sheet id="sheet-stub" modified-by="mindforge" theme="0imagh3k3tt2m43n7ttnugo33ck" timestamp="0">
    <topic id="root-stub" modified-by="mindforge" structure-class="org.xmind.ui.map.unbalanced" timestamp="0">
      <title>Warning</title>
      <children>
        <topics type="attached">
          <topic id="warn-stub" modified-by="mindforge" timestamp="0">
            <title>This file can not be opened normally, please do not modify and save, otherwise the contents will be permanently lost！ You can try using XMind 8 Update 3 or later version to open</title>
          </topic>
        </topics>
      </children>
      <extensions>
        <extension provider="org.xmind.ui.map.unbalanced">
          <content>
            <right-number>-1</right-number>
          </content>
        </extension>
      </extensions>
    </topic>
    <title>Sheet 1</title>
  </sheet>
</xmap-content>
`;

// 1×1 transparent PNG — some XMind builds expect a thumbnail entry.
const THUMBNAIL_PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

function nodeToXMind(node: MindMapTreeNode): XMindTopic {
  const id = `topic-${++topicCounter}-${Math.random().toString(36).slice(2, 7)}`;
  const topic: XMindTopic = {
    id,
    class: 'topic',
    title: node.text,
  };

  if (node.notes?.trim()) {
    topic.notes = { plain: { content: node.notes.trim() } };
  }

  if (node.urls?.length) {
    topic.href = node.urls[0].url;
  }

  if (node.color) {
    topic.style = {
      id: `${id}-style`,
      type: 'topic',
      // Modern XMind fills topics via svg:fill; keep background-color for our importer.
      properties: { 'svg:fill': node.color, 'background-color': node.color },
    };
  }

  if (node.children.length > 0) {
    topic.children = { attached: node.children.map(nodeToXMind) };
  }

  return topic;
}

/**
 * Exports a MindMapTreeNode tree as a .xmind ZIP archive (XMind Zen / 2020+ JSON format).
 * Package layout matches the official xmind-sdk-js Zipper so desktop XMind can open the file.
 * Returns a Blob ready for download.
 */
export function treeToXmind(root: MindMapTreeNode, title: string): Blob {
  topicCounter = 0;

  const content = JSON.stringify(
    [
      {
        id: 'sheet-1',
        class: 'sheet',
        title: title || 'Sheet 1',
        rootTopic: nodeToXMind(root),
      },
    ],
    null,
    2,
  );

  const metadata = JSON.stringify({
    creator: { name: 'MindForge', version: '1' },
  });

  const manifest = JSON.stringify({
    'file-entries': {
      'content.json': {},
      'metadata.json': {},
      'content.xml': {},
      'Thumbnails/thumbnail.png': {},
    },
  });

  // Official SDK switched ZIP compression from DEFLATE to STORE for client compatibility.
  const store = { level: 0 as const };
  const zipped = zipSync({
    'content.json': [strToU8(content), store],
    'metadata.json': [strToU8(metadata), store],
    'manifest.json': [strToU8(manifest), store],
    'content.xml': [strToU8(CONTENT_XML_STUB), store],
    'Thumbnails/thumbnail.png': [THUMBNAIL_PNG, store],
  });

  return new Blob([zipped], { type: 'application/vnd.xmind.workbook' });
}
