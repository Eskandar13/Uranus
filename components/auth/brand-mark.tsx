/** Platform mark (plate-shaped QR tile) and wordmark. Pure SVG/markup: safe in server and client components. */

export const BRAND = {
  green: "#1f5c46",
  cream: "#f6efe0",
  amber: "#f1ad2f",
} as const;

export function BrandMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false" className={className}>
      <rect width="32" height="32" rx="9" fill={BRAND.green} />
      <rect x="6" y="6" width="8" height="8" rx="2" fill={BRAND.cream} />
      <rect x="18" y="6" width="8" height="8" rx="2" fill={BRAND.cream} />
      <rect x="6" y="18" width="8" height="8" rx="2" fill={BRAND.cream} />
      <circle cx="22" cy="22" r="4.4" fill={BRAND.amber} />
      <rect x="8.5" y="8.5" width="3" height="3" rx="0.8" fill={BRAND.green} />
      <rect x="20.5" y="8.5" width="3" height="3" rx="0.8" fill={BRAND.green} />
      <rect x="8.5" y="20.5" width="3" height="3" rx="0.8" fill={BRAND.green} />
    </svg>
  );
}

export function BrandWordmark({ name, size = 32, className }: { name: string; size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 font-semibold tracking-tight ${className ?? ""}`}>
      <BrandMark size={size} />
      <span className="text-lg leading-none">{name}</span>
    </span>
  );
}
