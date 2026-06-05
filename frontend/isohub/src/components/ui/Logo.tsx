interface LogoProps {
  /** Pixel height (and width — the asset is square). Default 40. */
  size?: number;
  /**
   * Kept for compatibility with existing callers. All variants currently
   * render the same combined-mark asset at `/logo.svg`; if a separate
   * icon-only or wordmark-only file is added later, branch on this prop.
   */
  variant?: "icon" | "full" | "wordmark";
  className?: string;
}

/**
 * ISOLeaf brand mark. Sources the SVG from /logo.svg (served via Vite's
 * public/ folder → wwwroot/ in production). Using an <img> keeps the asset
 * editable in design tools without touching this file, and lets the browser
 * cache it independently of the JS bundle.
 */
export function Logo({ size = 40, variant: _variant = "icon", className }: LogoProps) {
  return (
    <img
      src="/logo.svg"
      alt="ISOLeaf"
      width={size}
      height={size}
      className={className}
      draggable={false}
    />
  );
}
