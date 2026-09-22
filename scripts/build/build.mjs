#!/usr/bin/env node
/**
 * MindForge 跨平台构建入口。
 *
 * 在本机常见路径自动探测 Xcode / Android SDK·NDK / JDK / Rust / Docker，
 * 并构建当前主机上可行的目标。无法在本机完成的目标会明确跳过并说明原因。
 *
 * Usage（仓库根目录）:
 *   node scripts/build/build.mjs --detect
 *   node scripts/build/build.mjs --all-possible
 *   node scripts/build/build.mjs --targets mac,android
 *   node scripts/build/build.mjs --targets windows          # 仅 Windows 主机
 *   node scripts/build/build.mjs --targets linux            # Linux 原生或 Docker
 *   node scripts/build/build.mjs --init-mobile              # 先 tauri android init
 *   node scripts/build/build.mjs --dry-run --all-possible
 *
 * pnpm:
 *   pnpm build:detect
 *   pnpm build:all
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  REPO_ROOT,
  SRC_TAURI,
  HOST,
  detectEnvironment,
  formatDetectReport,
} from './detect-env.mjs';

const args = parseArgs(process.argv.slice(2));

function parseArgs(argv) {
  const out = {
    detectOnly: false,
    dryRun: false,
    initMobile: false,
    skipFrontend: false,
    failFast: false,
    targets: null, // null = host-native default
    allPossible: false,
    json: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--detect' || a === '-d') out.detectOnly = true;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--init-mobile') out.initMobile = true;
    else if (a === '--skip-frontend') out.skipFrontend = true;
    else if (a === '--fail-fast') out.failFast = true;
    else if (a === '--all-possible' || a === '--all') out.allPossible = true;
    else if (a === '--json') out.json = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--targets' || a === '-t') {
      out.targets = (argv[++i] || '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    } else if (a.startsWith('--targets=')) {
      out.targets = a.slice('--targets='.length).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    }
  }
  return out;
}

function usage() {
  console.log(`MindForge 跨平台构建

用法:
  node scripts/build/build.mjs [选项]

选项:
  --detect, -d          只探测环境，不编译
  --targets, -t LIST    逗号分隔: mac,windows,linux,android
  --all-possible        构建本机所有可构建目标
  --init-mobile         若缺少 gen/android，先运行 tauri android init
  --skip-frontend       跳过 frontend_app 的 pnpm build
  --dry-run             只打印将要执行的命令
  --fail-fast           任一目标失败立即退出
  --json                探测结果以 JSON 输出
  --help, -h            显示帮助

说明:
  - mac 需在 macOS
  - windows 需在 Windows（本脚本不在 mac/linux 上交叉编 Windows 安装包）
  - linux 在非 Linux 主机上优先走 Docker（scripts/linux-build.Dockerfile）
  - android 需先 cargo tauri android init（可用 --init-mobile）
`);
}

function run(cmd, cmdArgs, opts = {}) {
  const label = [cmd, ...cmdArgs].join(' ');
  console.log(`\n→ ${label}`);
  if (args.dryRun) return { status: 0, dryRun: true };
  const r = spawnSync(cmd, cmdArgs, {
    cwd: opts.cwd || REPO_ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...opts.env },
    shell: HOST.platform === 'win32',
  });
  return { status: r.status ?? 1 };
}

function ensureRustTargets(list) {
  for (const t of list) {
    const check = spawnSync('rustup', ['target', 'list', '--installed'], { encoding: 'utf8' });
    if ((check.stdout || '').includes(t)) continue;
    console.log(`安装 Rust target: ${t}`);
    if (!args.dryRun) {
      const r = spawnSync('rustup', ['target', 'add', t], { stdio: 'inherit' });
      if (r.status !== 0) throw new Error(`rustup target add ${t} 失败`);
    }
  }
}

function applyAndroidEnv(env) {
  /** @type {Record<string, string>} */
  const extra = {};
  if (env.android.sdk) {
    extra.ANDROID_HOME = env.android.sdk;
    extra.ANDROID_SDK_ROOT = env.android.sdk;
  }
  if (env.android.ndk) extra.ANDROID_NDK_HOME = env.android.ndk;
  if (env.java.javaHome) extra.JAVA_HOME = env.java.javaHome;
  // Prefer SDK platform-tools on PATH
  if (env.android.platformTools) {
    const sep = HOST.platform === 'win32' ? ';' : ':';
    extra.PATH = `${env.android.platformTools}${sep}${process.env.PATH || ''}`;
  }
  return extra;
}

function buildFrontend() {
  if (args.skipFrontend) {
    console.log('跳过 frontend 构建（--skip-frontend）');
    return;
  }
  const r = run('pnpm', ['--dir', 'frontend_app', 'build']);
  if (r.status !== 0) throw new Error('frontend_app build 失败');
}

function tauriDesktopBuild(configRel = 'tauri.conf.json') {
  // Prefer cargo-tauri; fall back to pnpm tauri if present.
  const r = run('cargo', ['tauri', 'build', '--config', configRel], { cwd: SRC_TAURI });
  if (r.status !== 0) throw new Error(`tauri build (${configRel}) 失败`);
}

function resolveRequestedTargets(env) {
  if (args.targets?.length) {
    const unsupported = args.targets.filter((t) => t === 'ios');
    if (unsupported.length) {
      console.warn('已忽略不受支持的目标: ios');
    }
    return args.targets.filter((t) => t !== 'ios');
  }
  if (args.allPossible) {
    return Object.entries(env.targets)
      .filter(([name, t]) => {
        if (!t.buildable) return false;
        if (name === 'android' && !env.project.androidInitialized && !args.initMobile) return false;
        return true;
      })
      .map(([name]) => name);
  }
  // Default: native desktop for this host
  if (HOST.platform === 'darwin') return ['mac'];
  if (HOST.platform === 'win32') return ['windows'];
  if (HOST.platform === 'linux') return ['linux'];
  return [];
}

function initAndroidIfNeeded(env) {
  if (env.project.androidInitialized) return { ok: true };
  if (!args.initMobile) {
    return {
      ok: false,
      skip: true,
      reason: 'android 尚未 init。请加 --init-mobile，或手动: cd desktop/src-tauri && cargo tauri android init',
    };
  }
  const r = run('cargo', ['tauri', 'android', 'init'], { cwd: SRC_TAURI });
  if (r.status !== 0) throw new Error('cargo tauri android init 失败');
  return { ok: true };
}

function buildTarget(name, env) {
  const info = env.targets[name];
  if (!info) throw new Error(`未知目标: ${name}`);

  switch (name) {
    case 'mac': {
      if (HOST.platform !== 'darwin') return { name, status: 'skipped', reason: '需要 macOS' };
      if (!env.rust.cargo) return { name, status: 'skipped', reason: '未找到 cargo' };
      buildFrontend();
      tauriDesktopBuild('tauri.conf.json');
      return { name, status: 'ok' };
    }
    case 'windows': {
      if (HOST.platform !== 'win32') return { name, status: 'skipped', reason: '需要 Windows 主机' };
      if (!env.rust.cargo) return { name, status: 'skipped', reason: '未找到 cargo' };
      buildFrontend();
      tauriDesktopBuild('tauri.conf.json');
      return { name, status: 'ok' };
    }
    case 'linux': {
      if (HOST.platform === 'linux') {
        if (!env.rust.cargo) return { name, status: 'skipped', reason: '未找到 cargo' };
        buildFrontend();
        const conf = existsSync(join(SRC_TAURI, 'tauri.conf.linux.json'))
          ? 'tauri.conf.linux.json'
          : 'tauri.conf.json';
        tauriDesktopBuild(conf);
        return { name, status: 'ok' };
      }
      if (env.docker.available && env.project.linuxDockerFile) {
        const r = run('pnpm', ['build:linux']);
        if (r.status !== 0) throw new Error('Docker Linux 构建失败');
        return { name, status: 'ok', mode: 'docker' };
      }
      return { name, status: 'skipped', reason: '非 Linux 且无可用 Docker 构建' };
    }
    case 'android': {
      if (!env.android.sdk) return { name, status: 'skipped', reason: '未找到 Android SDK' };
      if (!env.android.ndk) return { name, status: 'skipped', reason: '未找到 Android NDK' };
      if (!env.java.javaHome) return { name, status: 'skipped', reason: '未找到 JDK / JAVA_HOME' };
      const init = initAndroidIfNeeded(env);
      if (!init.ok) return { name, status: 'skipped', reason: init.reason };
      ensureRustTargets([
        'aarch64-linux-android',
        'armv7-linux-androideabi',
        'i686-linux-android',
        'x86_64-linux-android',
      ]);
      buildFrontend();
      const extra = applyAndroidEnv(env);
      const r = run('cargo', ['tauri', 'android', 'build'], {
        cwd: SRC_TAURI,
        env: extra,
      });
      if (r.status !== 0) throw new Error('tauri android build 失败');
      return { name, status: 'ok' };
    }
    case 'ios':
      return { name, status: 'skipped', reason: '已移除 iOS 构建支持' };
    default:
      return { name, status: 'skipped', reason: '未知目标' };
  }
}

function main() {
  if (args.help) {
    usage();
    process.exit(0);
  }

  const env = detectEnvironment();

  if (args.detectOnly || args.json) {
    if (args.json) {
      console.log(JSON.stringify(env, null, 2));
    } else {
      console.log(formatDetectReport(env));
    }
    if (args.detectOnly) process.exit(0);
  }

  if (!env.rust.cargo) {
    console.error('未找到 cargo。请安装 Rust：https://rustup.rs');
    process.exit(1);
  }
  if (!env.rust.cargoTauri) {
    console.warn('警告: 未检测到 cargo-tauri。安装: cargo install tauri-cli --version "^2"');
  }

  if (!args.json) console.log(formatDetectReport(env));

  const requested = resolveRequestedTargets(env);
  if (!requested.length) {
    console.error('没有可构建的目标。使用 --targets 或 --all-possible，或先 --detect 查看环境。');
    process.exit(1);
  }

  console.log(`\n计划构建: ${requested.join(', ')}${args.dryRun ? ' (dry-run)' : ''}`);

  const results = [];
  for (const name of requested) {
    try {
      const live = detectEnvironment();
      const result = buildTarget(name, live);
      results.push(result);
      console.log(`\n[${result.status}] ${name}${result.reason ? ` — ${result.reason}` : ''}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`\n[fail] ${name} — ${message}`);
      results.push({ name, status: 'fail', reason: message });
      if (args.failFast) break;
    }
  }

  const outDir = join(REPO_ROOT, 'scripts/build/.cache');
  mkdirSync(outDir, { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(),
    host: env.host,
    requested,
    results,
  };
  writeFileSync(join(outDir, 'last-build.json'), `${JSON.stringify(report, null, 2)}\n`);

  console.log('\n======== 汇总 ========');
  for (const r of results) {
    console.log(`  ${r.status.padEnd(8)} ${r.name}${r.reason ? `  (${r.reason})` : ''}`);
  }

  const failed = results.some((r) => r.status === 'fail');
  const anyOk = results.some((r) => r.status === 'ok');
  if (failed) process.exit(1);
  if (!anyOk && results.every((r) => r.status === 'skipped')) {
    console.error('全部目标被跳过 — 请根据上方探测结果安装/切换环境。');
    process.exit(2);
  }
}

main();
