/**
 * MindForge brand mark — uses the app icon from `public/icon-192.png`
 * (same artwork as desktop/Tauri icons).
 */
interface LogoProps {
  className?: string;
  size?: number;
}

const BRAND_ICON_SRC = '/icon-192.png';

/**
 * Brand mark — use wherever the product logo appears (settings, headers, …).
 */
export function VaultIcon({ className = '', size = 32 }: LogoProps) {
  return (
    <img
      className={className}
      src={BRAND_ICON_SRC}
      width={size}
      height={size}
      alt=""
      draggable={false}
      style={{ display: 'block', borderRadius: Math.max(4, Math.round(size * 0.22)) }}
    />
  );
}

/**
 * Logo with text — brand mark + "MindForge".
 */
export function LogoWithText({ className = '', size = 32 }: LogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <VaultIcon size={size} />
      <span className="text-lg font-bold text-white">MindForge</span>
    </div>
  );
}

/**
 * Logo block — centered brand mark + heading + tagline.
 */
export function LogoBlock({ className = '' }: { className?: string }) {
  return (
    <div className={`text-center ${className}`}>
      <VaultIcon className="mx-auto" size={48} />
      <h1 className="mt-3 text-2xl font-bold tracking-tight text-white">MindForge</h1>
      <p className="mt-1 text-sm text-slate-400">Privacy-first mind maps</p>
    </div>
  );
}
