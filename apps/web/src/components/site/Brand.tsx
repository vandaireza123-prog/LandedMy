/**
 * Costavora "Touchdown" mark: a shipment's path landing on the ground line. Below 24 px the dotted path is drawn
 * solid so it still reads in a browser tab.
 */
export function Mark({ size = 32, dark = false, title }: { size?: number; dark?: boolean; title?: string }) {
  const path = dark ? "#9ED3CE" : "#0B5E5A";
  const ground = dark ? "#FFFFFF" : "#15201F";
  const small = size < 24;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true} className="shrink-0">
      {small ? (
        <path d="M7 36 Q20 8 36 28" fill="none" stroke={path} strokeWidth="5" strokeLinecap="round" />
      ) : (
        <path d="M6 36 Q20 4 38 30" fill="none" stroke={path} strokeWidth="4" strokeLinecap="round" strokeDasharray="1 7" />
      )}
      <line x1="4" y1="40" x2="44" y2="40" stroke={ground} strokeWidth={small ? 5 : 4} strokeLinecap="round" />
      <circle cx="38" cy="33" r={small ? 7 : 6} fill="#E0A23B" />
    </svg>
  );
}

export function Wordmark({ size = 24, dark = false, className = "" }: { size?: number; dark?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-display font-bold lowercase tracking-[-0.035em] ${dark ? "text-white" : "text-ink"} ${className}`} style={{ fontSize: size * 0.82 }}>
      <Mark size={size + 6} dark={dark} />
      costavora
    </span>
  );
}

export const SITE = "https://costavora.com";
export const BRAND = "Costavora";
