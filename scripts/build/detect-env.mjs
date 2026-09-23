/**
 * Discover local toolchains for MindForge / Tauri builds.
 * Looks in env vars and common install directories (no network).
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { homedir, platform as osPlatform, arch as osArch } from 'node:os';
import { join, delimiter, resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(HERE, '../..');
export const SRC_TAURI = join(REPO_ROOT, 'desktop/src-tauri');
export const FRONTEND_APP = join(REPO_ROOT, 'frontend_app');

export const HOST = {
  platform: osPlatform(), // darwin | win32 | linux
  arch: osArch(),
};

function which(cmd) {
  const r = spawnSync(HOST.platform === 'win32' ? 'where' : 'which', [cmd], {
    encoding: 'utf8',
    shell: HOST.platform === 'win32',
  });
  if (r.status !== 0) return null;
  const line = (r.stdout || '').split(/\r?\n/).map((s) => s.trim()).find(Boolean);
  return line || null;
}

function runCapture(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    encoding: 'utf8',
    shell: HOST.platform === 'win32',
    ...opts,
  });
  return {
    ok: r.status === 0,
    status: r.status,
    stdout: (r.stdout || '').trim(),
    stderr: (r.stderr || '').trim(),
  };
}

function firstExisting(paths) {
  for (const p of paths) {
    if (p && existsSync(p)) return p;
  }
  return null;
}

function latestSubdir(dir) {
  if (!dir || !existsSync(dir)) return null;
  try {
    const entries = readdirSync(dir)
      .map((name) => ({ name, path: join(dir, name) }))
      .filter((e) => {
        try {
          return statSync(e.path).isDirectory();
        } catch {
          return false;
        }
      })
      .sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true }));
    return entries[0]?.path ?? null;
  } catch {
    return null;
  }
}

function detectNode() {
  const bin = which('node');
  const ver = bin ? runCapture('node', ['-v']).stdout : null;
  const pnpm = which('pnpm');
  return { node: bin, nodeVersion: ver, pnpm };
}

function detectRust() {
  const rustc = which('rustc');
  const cargo = which('cargo');
  const rustup = which('rustup');
  const targets = rustup
    ? runCapture('rustup', ['target', 'list', '--installed']).stdout.split(/\n/).filter(Boolean)
    : [];
  const cargoTauri = which('cargo-tauri') || (cargo && runCapture('cargo', ['tauri', '--version']).ok ? 'cargo tauri' : null);
  return {
    rustc,
    cargo,
    rustup,
    rustcVersion: rustc ? runCapture('rustc', ['--version']).stdout : null,
    targets,
    cargoTauri: Boolean(cargoTauri),
  };
}

function detectXcode() {
  if (HOST.platform !== 'darwin') {
    return { available: false, reason: '仅 macOS 可构建本机 macOS 桌面包' };
  }
  const xcodebuild = which('xcodebuild');
  const select = runCapture('xcode-select', ['-p']);
  const app = firstExisting([
    '/Applications/Xcode.app',
    '/Applications/Xcode-beta.app',
  ]);
  const version = xcodebuild ? runCapture('xcodebuild', ['-version']).stdout.split('\n')[0] : null;
  return {
    available: Boolean(xcodebuild && select.ok) || Boolean(which('clang')),
    xcodebuild,
    developerDir: select.ok ? select.stdout : null,
    app,
    version,
  };
}

function detectJava() {
  const fromEnv = process.env.JAVA_HOME && existsSync(process.env.JAVA_HOME)
    ? process.env.JAVA_HOME
    : null;
  const candidates = [
    fromEnv,
  ];
  if (HOST.platform === 'darwin') {
    const home = runCapture('/usr/libexec/java_home', []);
    if (home.ok) candidates.push(home.stdout);
    try {
      const jvms = '/Library/Java/JavaVirtualMachines';
      if (existsSync(jvms)) {
        for (const name of readdirSync(jvms)) {
          candidates.push(join(jvms, name, 'Contents/Home'));
        }
      }
    } catch { /* ignore */ }
    candidates.push(
      '/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home',
      '/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home',
      '/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home',
      '/usr/local/opt/openjdk/libexec/openjdk.jdk/Contents/Home',
    );
  } else if (HOST.platform === 'linux') {
    candidates.push(
      '/usr/lib/jvm/default-java',
      '/usr/lib/jvm/java-21-openjdk-amd64',
      '/usr/lib/jvm/java-17-openjdk-amd64',
      '/usr/lib/jvm/java-21-openjdk',
      '/usr/lib/jvm/java-17-openjdk',
    );
  } else if (HOST.platform === 'win32') {
    const pf = process.env['ProgramFiles'] || 'C:\\Program Files';
    const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    candidates.push(
      join(pf, 'Android', 'Android Studio', 'jbr'),
      join(pf, 'Java', 'jdk-21'),
      join(pf, 'Java', 'jdk-17'),
      join(pf86, 'Android', 'Android Studio', 'jbr'),
    );
  }
  const javaHome = firstExisting(candidates.filter(Boolean));
  const javaBin = which('java');
  const version = javaBin ? runCapture('java', ['-version']).stderr || runCapture('java', ['-version']).stdout : null;
  return { javaHome, java: javaBin, version: version?.split('\n')[0] ?? null };
}

function detectAndroid() {
  const home = homedir();
  const sdkCandidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    join(home, 'Library/Android/sdk'), // macOS Android Studio default
    join(home, 'Android/Sdk'), // Linux Android Studio default
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Android', 'Sdk'),
    process.env.USERPROFILE && join(process.env.USERPROFILE, 'AppData', 'Local', 'Android', 'Sdk'),
    '/usr/lib/android-sdk',
    '/opt/android-sdk',
    '/opt/android-sdk-linux',
  ].filter(Boolean);

  const sdk = firstExisting(sdkCandidates);
  const ndkFromEnv = process.env.ANDROID_NDK_HOME || process.env.NDK_HOME;
  const ndk = firstExisting([
    ndkFromEnv,
    sdk && join(sdk, 'ndk-bundle'),
    latestSubdir(sdk && join(sdk, 'ndk')),
  ].filter(Boolean));

  const platformTools = sdk && existsSync(join(sdk, 'platform-tools')) ? join(sdk, 'platform-tools') : null;
  const buildTools = latestSubdir(sdk && join(sdk, 'build-tools'));
  const platforms = latestSubdir(sdk && join(sdk, 'platforms'));
  const cmdlineTools = firstExisting([
    sdk && join(sdk, 'cmdline-tools', 'latest'),
    latestSubdir(sdk && join(sdk, 'cmdline-tools')),
  ].filter(Boolean));

  const rustAndroidTargets = [
    'aarch64-linux-android',
    'armv7-linux-androideabi',
    'i686-linux-android',
    'x86_64-linux-android',
  ];

  return {
    sdk,
    ndk,
    platformTools,
    buildTools,
    platforms,
    cmdlineTools,
    adb: platformTools && existsSync(join(platformTools, HOST.platform === 'win32' ? 'adb.exe' : 'adb'))
      ? join(platformTools, HOST.platform === 'win32' ? 'adb.exe' : 'adb')
      : which('adb'),
    available: Boolean(sdk && ndk),
  };
}

function detectDocker() {
  const docker = which('docker');
  if (!docker) return { available: false, docker: null };
  const info = runCapture('docker', ['info']);
  return { available: info.ok, docker, reason: info.ok ? null : (info.stderr || 'docker daemon 不可用') };
}

function detectProjectMobile() {
  return {
    androidInitialized: existsSync(join(SRC_TAURI, 'gen/android')) || existsSync(join(REPO_ROOT, 'src-tauri/gen/android')),
    linuxDockerFile: existsSync(join(REPO_ROOT, 'scripts/linux-build.Dockerfile')),
  };
}

/**
 * Full environment probe used by the build CLI.
 */
export function detectEnvironment() {
  const node = detectNode();
  const rust = detectRust();
  const xcode = detectXcode();
  const java = detectJava();
  const android = detectAndroid();
  const docker = detectDocker();
  const project = detectProjectMobile();

  /** @type {Record<string, { buildable: boolean, mode: string, notes: string[] }>} */
  const targets = {
    mac: {
      buildable: HOST.platform === 'darwin' && Boolean(rust.cargo) && Boolean(xcode.available || which('clang')),
      mode: HOST.platform === 'darwin' ? 'native' : 'unsupported-host',
      notes: HOST.platform === 'darwin'
        ? []
        : ['macOS 桌面包只能在 macOS 上构建（或使用专门的 CI runner）'],
    },
    windows: {
      buildable: HOST.platform === 'win32' && Boolean(rust.cargo),
      mode: HOST.platform === 'win32' ? 'native' : 'unsupported-host',
      notes: HOST.platform === 'win32'
        ? []
        : ['Windows 安装包需在 Windows 主机或 CI 上构建；本机无法可靠交叉编译 Tauri WebView2 包'],
    },
    linux: {
      buildable: (HOST.platform === 'linux' && Boolean(rust.cargo)) || docker.available,
      mode: HOST.platform === 'linux' ? 'native' : (docker.available ? 'docker' : 'unsupported-host'),
      notes: HOST.platform === 'linux'
        ? []
        : docker.available
          ? ['将通过 scripts/linux-build.Dockerfile 在 Docker 中构建']
          : ['非 Linux 主机需要 Docker，或到 Linux/WSL 上原生构建'],
    },
    android: {
      buildable: Boolean(android.available && rust.cargo && java.javaHome),
      mode: 'ndk',
      notes: [
        ...(!android.sdk ? ['未找到 Android SDK（常见路径：~/Library/Android/sdk、~/Android/Sdk、$ANDROID_HOME）'] : []),
        ...(!android.ndk ? ['未找到 Android NDK（$ANDROID_NDK_HOME 或 SDK/ndk/<version>）'] : []),
        ...(!java.javaHome ? ['未找到 JAVA_HOME / JDK'] : []),
        ...(!project.androidInitialized ? ['尚未执行 `cargo tauri android init`（可用 --init-mobile）'] : []),
      ],
    },
  };

  return {
    host: HOST,
    node,
    rust,
    xcode,
    java,
    android,
    docker,
    project,
    targets,
    pathHint: process.env.PATH?.split(delimiter).slice(0, 8),
  };
}

export function formatDetectReport(env) {
  const lines = [];
  lines.push(`主机: ${env.host.platform}/${env.host.arch}`);
  lines.push(`Node: ${env.node.nodeVersion || '未找到'}  pnpm: ${env.node.pnpm || '未找到'}`);
  lines.push(`Rust: ${env.rust.rustcVersion || '未找到'}  cargo-tauri: ${env.rust.cargoTauri ? '是' : '否'}`);
  lines.push(`Xcode / clang: ${env.xcode.available ? (env.xcode.version || '是') : '否'}`);
  lines.push(`Java: ${env.java.javaHome || '未找到'}  (${env.java.version || '—'})`);
  lines.push(`Android SDK: ${env.android.sdk || '未找到'}`);
  lines.push(`Android NDK: ${env.android.ndk || '未找到'}`);
  lines.push(`Docker: ${env.docker.available ? '可用' : '不可用'}`);
  lines.push(`项目 android init: ${env.project.androidInitialized}`);
  lines.push('');
  lines.push('目标可构建性:');
  for (const [name, t] of Object.entries(env.targets)) {
    const flag = t.buildable ? '✓' : '✗';
    lines.push(`  ${flag} ${name.padEnd(8)} mode=${t.mode}${t.notes.length ? `  — ${t.notes.join('; ')}` : ''}`);
  }
  return lines.join('\n');
}

/** Shell-safe single-quoted string for eval in bash. */
function shQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

/**
 * Env vars for `cargo tauri android dev|build` (same keys as build.mjs applyAndroidEnv).
 * @returns {{ exports: string, missing: string[] }}
 */
export function formatAndroidEnvExports(env = detectEnvironment()) {
  /** @type {string[]} */
  const missing = [];
  if (!env.android.sdk) missing.push('Android SDK（$ANDROID_HOME 或 ~/Library/Android/sdk）');
  if (!env.android.ndk) missing.push('Android NDK（$ANDROID_NDK_HOME 或 SDK/ndk/<version>）');
  if (!env.java.javaHome) missing.push('JDK / JAVA_HOME');
  if (!env.rust.cargo) missing.push('cargo / Rust');

  /** @type {string[]} */
  const lines = [];
  if (env.android.sdk) {
    lines.push(`export ANDROID_HOME=${shQuote(env.android.sdk)}`);
    lines.push(`export ANDROID_SDK_ROOT=${shQuote(env.android.sdk)}`);
  }
  if (env.android.ndk) {
    lines.push(`export ANDROID_NDK_HOME=${shQuote(env.android.ndk)}`);
  }
  if (env.java.javaHome) {
    lines.push(`export JAVA_HOME=${shQuote(env.java.javaHome)}`);
  }
  if (env.android.platformTools) {
    const sep = HOST.platform === 'win32' ? ';' : ':';
    lines.push(`export PATH=${shQuote(`${env.android.platformTools}${sep}${process.env.PATH || ''}`)}`);
  }
  return { exports: lines.join('\n'), missing };
}

function isCliMain() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return fileURLToPath(import.meta.url) === resolve(entry);
  } catch {
    return false;
  }
}

// CLI: node scripts/build/detect-env.mjs --export-android-env
if (isCliMain() && process.argv.includes('--export-android-env')) {
  const { exports, missing } = formatAndroidEnvExports();
  if (missing.length) {
    console.error(`Android 开发环境不完整，缺少: ${missing.join('；')}`);
    process.exit(1);
  }
  console.log(exports);
  process.exit(0);
}
