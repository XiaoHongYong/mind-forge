/**
 * @vitest-environment jsdom
 *
 * The adapter's whole job is to survive the JS/ArkTS boundary, so these tests
 * are about the wire: whether an envelope is unwrapped, whether a shell-side
 * failure becomes a real `Error` at the call site, and whether bytes survive a
 * base64 round trip at the chunk boundary. All of it is invisible to a test
 * that stubs the bridge with something well-behaved, which is why the fake
 * below deliberately answers with the exact strings the shell produces.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Builds the envelope the shell returns, so tests never hand-write JSON shape. */
function envelope(value: string): string {
  return JSON.stringify({ ok: true, error: '', value });
}

function failure(error: string): string {
  return JSON.stringify({ ok: false, error, value: '' });
}

interface FakeBridge {
  [key: string]: unknown;
}

function installBridge(overrides: FakeBridge = {}): FakeBridge {
  const bridge: FakeBridge = {
    openDocument: vi.fn(async () => envelope('')),
    saveDocument: vi.fn(async () => envelope('')),
    readFile: vi.fn(async () => envelope('')),
    writeFile: vi.fn(async () => envelope('')),
    persistUri: vi.fn(async () => envelope('')),
    activateUri: vi.fn(async () => envelope('')),
    readAppData: vi.fn(async () => envelope('')),
    writeAppData: vi.fn(async () => envelope('')),
    deleteAppData: vi.fn(async () => envelope('')),
    openExternal: vi.fn(async () => envelope('')),
    diagnostics: vi.fn(async () => envelope('{"persistSyscap":true,"persistPermissionGranted":true}')),
    log: vi.fn(),
    ...overrides,
  };
  (window as unknown as Record<string, unknown>).MindForgeNative = bridge;
  return bridge;
}

/** Fresh module state per test — the capability probe memoizes. */
async function adapter() {
  vi.resetModules();
  return import('../ohos');
}

beforeEach(() => {
  delete (window as unknown as Record<string, unknown>).MindForgeNative;
});

describe('detection', () => {
  it('is false without a bridge', async () => {
    const { isOhos } = await adapter();
    expect(isOhos()).toBe(false);
  });

  it('is true once the shell has injected one', async () => {
    installBridge();
    const { isOhos } = await adapter();
    expect(isOhos()).toBe(true);
  });
});

describe('envelope handling', () => {
  it('unwraps a successful value', async () => {
    installBridge({ readAppData: vi.fn(async () => envelope('hello')) });
    const { ohosReadAppData } = await adapter();
    expect(await ohosReadAppData('k')).toBe('hello');
  });

  it('turns a shell failure into a thrown Error carrying the shell message', async () => {
    installBridge({ readFile: vi.fn(async () => failure('13900002: No such file')) });
    const { ohosReadFile } = await adapter();
    await expect(ohosReadFile('file://x')).rejects.toThrow(/13900002: No such file/);
  });

  it('rejects an unreadable response rather than returning garbage', async () => {
    installBridge({ readAppData: vi.fn(async () => 'not json') });
    const { ohosReadAppData } = await adapter();
    await expect(ohosReadAppData('k')).rejects.toThrow(/unreadable bridge response/);
  });

  it('throws instead of silently no-oping when called outside the shell', async () => {
    const { ohosOpenExternal } = await adapter();
    await expect(ohosOpenExternal('https://example.com')).rejects.toThrow(/not running/i);
  });
});

describe('cancellation', () => {
  it('reports a cancelled open as null', async () => {
    installBridge({ openDocument: vi.fn(async () => envelope('')) });
    const { ohosOpenDocument } = await adapter();
    expect(await ohosOpenDocument([])).toBeNull();
  });

  it('reports a cancelled save as null', async () => {
    installBridge({ saveDocument: vi.fn(async () => envelope('')) });
    const { ohosSaveDocument } = await adapter();
    expect(await ohosSaveDocument('a.mmforge', [])).toBeNull();
  });

  it('parses the picked reference', async () => {
    installBridge({
      openDocument: vi.fn(async () => envelope(JSON.stringify({ uri: 'file://docs/a.mmforge', name: 'a.mmforge' }))),
    });
    const { ohosOpenDocument } = await adapter();
    expect(await ohosOpenDocument([])).toEqual({ uri: 'file://docs/a.mmforge', name: 'a.mmforge' });
  });

  it('treats an absent app-data slot as null', async () => {
    installBridge({ readAppData: vi.fn(async () => envelope('')) });
    const { ohosReadAppData } = await adapter();
    expect(await ohosReadAppData('missing')).toBeNull();
  });
});

describe('byte transport', () => {
  it('round-trips bytes through base64', async () => {
    let seen = '';
    installBridge({
      writeFile: vi.fn(async (payloadJson: string) => {
        seen = (JSON.parse(payloadJson) as { base64: string }).base64;
        return envelope('');
      }),
      readFile: vi.fn(async () => envelope(seen)),
    });
    const { ohosReadFile, ohosWriteFile } = await adapter();

    const bytes = new Uint8Array([0, 1, 127, 128, 255]);
    await ohosWriteFile('file://x', bytes);
    expect(Array.from(await ohosReadFile('file://x'))).toEqual([0, 1, 127, 128, 255]);
  });

  it('survives a payload larger than the base64 chunk size', async () => {
    let seen = '';
    installBridge({
      writeFile: vi.fn(async (payloadJson: string) => {
        seen = (JSON.parse(payloadJson) as { base64: string }).base64;
        return envelope('');
      }),
      readFile: vi.fn(async () => envelope(seen)),
    });
    const { ohosReadFile, ohosWriteFile } = await adapter();

    // 0x8000 is where `toBase64` switches from one `String.fromCharCode` call
    // to many; an off-by-one there corrupts exactly the larger documents.
    const bytes = new Uint8Array(0x8000 + 17).map((_, i) => i % 251);
    await ohosWriteFile('file://x', bytes);
    expect(Array.from(await ohosReadFile('file://x'))).toEqual(Array.from(bytes));
  });

  it('sends the write payload as { uri, base64 }', async () => {
    // Typed argument so `mock.calls[0][0]` is the payload, not `never`.
    const writeFile = vi.fn(async (_payloadJson: string) => envelope(''));
    installBridge({ writeFile });
    const { ohosWriteFile } = await adapter();

    await ohosWriteFile('file://docs/a.mmforge', new Uint8Array([65]));
    const payload = JSON.parse(writeFile.mock.calls[0][0] as string) as Record<string, string>;
    expect(payload.uri).toBe('file://docs/a.mmforge');
    expect(payload.base64).toBe('QQ==');
  });
});

describe('display path', () => {
  it('drops the scheme query and hash and decodes the name', async () => {
    const { ohosDisplayPath } = await adapter();
    expect(ohosDisplayPath('file://docs/storage/Users/currentUser/My%20Map.mmforge?x=1#y')).toBe(
      'docs/storage/Users/currentUser/My Map.mmforge',
    );
  });

  it('leaves the basename that the title is read from intact', async () => {
    const { ohosDisplayPath } = await adapter();
    const basename = ohosDisplayPath('file://docs/a/My%20Map.mmforge').split('/').pop();
    expect(basename).toBe('My Map.mmforge');
  });

  it('keeps a literal percent that is not valid encoding', async () => {
    const { ohosDisplayPath } = await adapter();
    expect(ohosDisplayPath('file://docs/100%_done.mmforge')).toBe('docs/100%_done.mmforge');
  });

  it('is a no-op on other shells, so it is safe to call unconditionally', async () => {
    const { shellDisplayPath } = await adapter();
    const path = '/Users/me/My%20Map.mmforge';
    expect(shellDisplayPath(path)).toBe(path);
  });
});

describe('persist capability', () => {
  it('is false before the probe runs, so nothing unfounded is offered', async () => {
    installBridge();
    const { getPersistCapability } = await adapter();
    expect(getPersistCapability()).toBe(false);
  });

  it('reports true when the device grants both syscap and permission', async () => {
    installBridge();
    const { probePersistCapability } = await adapter();
    expect(await probePersistCapability()).toBe(true);
  });

  it('reports false when the syscap is missing, as on a phone', async () => {
    installBridge({
      diagnostics: vi.fn(async () => envelope('{"persistSyscap":false,"persistPermissionGranted":true}')),
    });
    const { probePersistCapability } = await adapter();
    expect(await probePersistCapability()).toBe(false);
  });

  it('reports false when the permission was never granted', async () => {
    installBridge({
      diagnostics: vi.fn(async () => envelope('{"persistSyscap":true,"persistPermissionGranted":false}')),
    });
    const { probePersistCapability } = await adapter();
    expect(await probePersistCapability()).toBe(false);
  });

  it('reports false when the shell cannot answer at all', async () => {
    installBridge({ diagnostics: vi.fn(async () => failure('boom')) });
    const { probePersistCapability } = await adapter();
    expect(await probePersistCapability()).toBe(false);
  });

  it('notifies subscribers once the answer lands', async () => {
    installBridge();
    const { probePersistCapability, subscribePersistCapability, getPersistCapability } = await adapter();

    const seen: boolean[] = [];
    subscribePersistCapability(() => seen.push(getPersistCapability()));

    await probePersistCapability();
    expect(seen).toEqual([true]);
  });

  it('probes only once, however many callers ask', async () => {
    const diagnostics = vi.fn(async () => envelope('{"persistSyscap":true,"persistPermissionGranted":true}'));
    installBridge({ diagnostics });
    const { probePersistCapability } = await adapter();

    await Promise.all([probePersistCapability(), probePersistCapability(), probePersistCapability()]);
    expect(diagnostics).toHaveBeenCalledTimes(1);
  });
});

describe('grant persistence', () => {
  it('swallows a refusal, because session access survives it', async () => {
    installBridge({ persistUri: vi.fn(async () => failure('801: Capability not supported')) });
    const { rememberGrant } = await adapter();
    await expect(rememberGrant('file://docs/a.mmforge')).resolves.toBeUndefined();
  });

  it('still reports a genuine transport failure to explicit callers', async () => {
    installBridge({ persistUri: vi.fn(async () => failure('801: Capability not supported')) });
    const { persistUri } = await adapter();
    await expect(persistUri('file://docs/a.mmforge')).rejects.toThrow(/801/);
  });
});

describe('logging', () => {
  it('never throws, whatever the shell does', async () => {
    installBridge({
      log: vi.fn(() => {
        throw new Error('bridge gone');
      }),
    });
    const { ohosLog } = await adapter();
    expect(() => ohosLog('tag', 'payload')).not.toThrow();
  });
});
