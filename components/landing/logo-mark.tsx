/** Platform mark: a plate-shaped QR tile. Pure SVG, safe in server and client components. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="9" fill="#1f5c46" />
      <rect x="6" y="6" width="8" height="8" rx="2" fill="#f6efe0" />
      <rect x="18" y="6" width="8" height="8" rx="2" fill="#f6efe0" />
      <rect x="6" y="18" width="8" height="8" rx="2" fill="#f6efe0" />
      <circle cx="22" cy="22" r="4.4" fill="#f1ad2f" />
      <rect x="8.5" y="8.5" width="3" height="3" rx="0.8" fill="#1f5c46" />
      <rect x="20.5" y="8.5" width="3" height="3" rx="0.8" fill="#1f5c46" />
      <rect x="8.5" y="20.5" width="3" height="3" rx="0.8" fill="#1f5c46" />
    </svg>
  );
}
