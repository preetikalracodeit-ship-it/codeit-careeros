const LOGO_SRC = "/images/codeit-logo.png";

/**
 * The CareerOS logo mark.
 *
 * `size` is the rendered square size in pixels. On dark surfaces the white
 * background baked into the artwork is cropped to a rounded tile by the
 * shared `.logo` styles, which keeps the mark readable everywhere.
 */
export function Logo({ size = 32, className = "", alt = "CareerOS logo" }) {
  return (
    <img
      src={LOGO_SRC}
      alt={alt}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={["logo", className].filter(Boolean).join(" ")}
    />
  );
}

/**
 * Logo mark + "CODEIT CareerOS" wordmark.
 *
 * `tone="light"` is used on dark backgrounds (auth art panel, footer,
 * sidebar) and flips the wordmark to white.
 */
export function LogoWordmark({ tone = "dark", size = 28, className = "" }) {
  return (
    <span className={["logo-wordmark", className].filter(Boolean).join(" ")}>
      <Logo size={size} alt="" />
      <span className={["logo-wordmark-text", tone === "light" && "is-light"].filter(Boolean).join(" ")}>
        CODEIT&nbsp;<span className="logo-wordmark-accent">CareerOS</span>
      </span>
    </span>
  );
}
