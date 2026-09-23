/**
 * @vitest-environment jsdom
 *
 * End-to-end through the document layer with a fake ArkWeb bridge installed.
 *
 * `platform/__tests__/ohos.test.ts` proves the adapter speaks the wire protocol
 * correctly. This proves the document layer actually *uses* it — an adapter
 * that is correct but never reached is the exact failure mode `CLAUDE.md`
 * describes, invisible to both the adapter's own tests and to a unit test that
 * stubs out file access.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

function envelope(value: string): string {
  return JSON.stringify({ ok: true, error: '', value });
}

/** base64 of what the fake document "on disk" holds, keyed by URI. */
let disk: Map<string, string>;
let bridge: Record<string, ReturnType<typeof vi.fn>>;

function installBridge() {
  disk = new Map();
  bridge = {
    openDocument: vi.fn(async () => envelope('')),
    saveDocument: vi.fn(async () => envelope('')),
    readFile: vi.fn(async (uri: string) => {
      const held = disk.get(uri);
      if (held === undefined) return JSON.stringify({ ok: false, error: '13900002: no such file', value: '' });
      return envelope(held);
    }),
    writeFile: vi.fn(async (payloadJson: string) => {
      const payload = JSON.parse(payloadJson) as { uri: string; base64: string };
      disk.set(payload.uri, payload.base64);
      return envelope('');
    }),
    persistUri: vi.fn(async () => envelope('')),
    activateUri: vi.fn(async () => envelope('')),
    readAppData: vi.fn(async () => envelope('')),
    writeAppData: vi.fn(async () => envelope('')),
    deleteAppData: vi.fn(async () => envelope('')),
    openExternal: vi.fn(async () => envelope('')),
    diagnostics: vi.fn(async () => envelope('{"persistSyscap":true,"persistPermissionGranted":true}')),
    log: vi.fn(),
  };
  (window as unknown as Record<string, unknown>).MindForgeNative = bridge;
}

beforeEach(() => {
  vi.resetModules();
  installBridge();
});

const URI = 'file://docs/storage/Users/currentUser/My%20Map.mmforge';

/** Produces real `.mmforge` bytes using the app's own serializer. */
async function mmforgeBytes(title: string): Promise<string> {
  const { EXPORT_FORMATS } = await import('../../utils/exportFormats');
  const { toBase64 } = await import('../../utils/base64');
  const format = EXPORT_FORMATS.find((f) => f.id === 'mmforge')!;
  const blob = await format.serialize(
    { id: 'root', text: title, children: [], collapsed: false },
    title,
  );
  return toBase64(new Uint8Array(await blob.arrayBuffer()));
}

describe('opening through the shell', () => {
  it('reads the picked document and titles it from the decoded URI', async () => {
    disk.set(URI, await mmforgeBytes('Roadmap'));
    bridge.openDocument.mockResolvedValue(envelope(JSON.stringify({ uri: URI, name: 'My Map.mmforge' })));

    const { openDocumentViaDialog } = await import('../io');
    const session = await openDocumentViaDialog();

    expect(session).not.toBeNull();
    // The reference is kept raw — it is the key the backup and recent stores
    // are written under, and the shell's file APIs take it verbatim.
    expect(session!.path).toBe(URI);
    expect(session!.title).toBe('My Map');
    expect(session!.formatId).toBe('mmforge');
    // The parser is seeded with the title derived from the path, so a decoded
    // URI is what ends up as the central topic — the same contract every other
    // shell gets, now reachable from a URI as well as from an absolute path.
    expect(session!.tree.root.text).toBe('My Map');
  });

  it('requests the grant while it is still live', async () => {
    disk.set(URI, await mmforgeBytes('Roadmap'));
    bridge.openDocument.mockResolvedValue(envelope(JSON.stringify({ uri: URI, name: 'My Map.mmforge' })));

    const { openDocumentViaDialog } = await import('../io');
    await openDocumentViaDialog();

    expect(bridge.persistUri).toHaveBeenCalledWith(URI);
  });

  it('returns null when the user cancels, without touching the disk', async () => {
    const { openDocumentViaDialog } = await import('../io');
    expect(await openDocumentViaDialog()).toBeNull();
    expect(bridge.readFile).not.toHaveBeenCalled();
  });

  it('surfaces a shell read failure instead of opening an empty document', async () => {
    bridge.openDocument.mockResolvedValue(envelope(JSON.stringify({ uri: URI, name: 'My Map.mmforge' })));

    const { openDocumentViaDialog } = await import('../io');
    await expect(openDocumentViaDialog()).rejects.toThrow(/13900002/);
  });
});

describe('saving through the shell', () => {
  const tree = {
    version: 'tree' as const,
    root: { id: 'root', text: 'Roadmap', children: [], collapsed: false },
  };

  it('saves in place to the URI it was opened from', async () => {
    disk.set(URI, await mmforgeBytes('Roadmap'));
    bridge.openDocument.mockResolvedValue(envelope(JSON.stringify({ uri: URI, name: 'My Map.mmforge' })));
    const { openDocumentViaDialog, saveDocument } = await import('../io');

    const opened = await openDocumentViaDialog();
    const saved = await saveDocument(opened!, tree, 'Roadmap');

    // In-place, so no dialog: `saveDocument` must not have reached for one.
    expect(bridge.saveDocument).not.toHaveBeenCalled();
    expect(bridge.writeFile).toHaveBeenCalledTimes(1);
    expect(saved.path).toBe(URI);
    expect(saved.dirty).toBe(false);
  });

  it('writes a fresh document to the URI the save dialog returned', async () => {
    const target = 'file://docs/storage/Users/currentUser/Untitled.mmforge';
    bridge.saveDocument.mockResolvedValue(envelope(JSON.stringify({ uri: target, name: 'Untitled.mmforge' })));

    const { newDocument, saveDocument } = await import('../io');
    const saved = await saveDocument(newDocument('Untitled'), tree, 'Untitled');

    const payload = JSON.parse(bridge.writeFile.mock.calls[0][0] as string) as { uri: string };
    expect(payload.uri).toBe(target);
    expect(saved.path).toBe(target);
    expect(saved.title).toBe('Untitled');
  });

  it('keeps the session untouched when the save dialog is cancelled', async () => {
    const { newDocument, saveDocument } = await import('../io');
    const session = newDocument('Untitled');

    const saved = await saveDocument(session, tree, 'Untitled');
    expect(saved).toBe(session);
    expect(bridge.writeFile).not.toHaveBeenCalled();
  });
});

describe('crash recovery through the shell', () => {
  const tree = {
    version: 'tree' as const,
    root: { id: 'root', text: 'Roadmap', children: [], collapsed: false },
  };

  it('stores an untitled backup in app-private storage and restores it', async () => {
    const slots = new Map<string, string>();
    bridge.writeAppData.mockImplementation(async (payloadJson: string) => {
      const payload = JSON.parse(payloadJson) as { key: string; value: string };
      slots.set(payload.key, payload.value);
      return envelope('');
    });
    bridge.readAppData.mockImplementation(async (key: string) =>
      envelope(slots.get(key) ?? ''),
    );

    const { writeUnsavedBackup, restoreOrCreateNew } = await import('../index');
    await writeUnsavedBackup({ path: null, title: 'Untitled', tree, formatId: 'mmforge' });
    expect(slots.size).toBe(1);

    const restored = await restoreOrCreateNew();
    expect(restored.dirty).toBe(true);
    expect(restored.path).toBeNull();
    expect(restored.tree.root.text).toBe('Roadmap');
  });

  it('does not go looking for a file when the backup is for an untitled buffer', async () => {
    const slots = new Map<string, string>();
    bridge.writeAppData.mockImplementation(async (payloadJson: string) => {
      const payload = JSON.parse(payloadJson) as { key: string; value: string };
      slots.set(payload.key, payload.value);
      return envelope('');
    });
    bridge.readAppData.mockImplementation(async (key: string) => envelope(slots.get(key) ?? ''));

    const { writeUnsavedBackup } = await import('../index');
    await writeUnsavedBackup({ path: null, title: 'Untitled', tree, formatId: 'mmforge' });

    expect(bridge.readFile).not.toHaveBeenCalled();
  });
});
