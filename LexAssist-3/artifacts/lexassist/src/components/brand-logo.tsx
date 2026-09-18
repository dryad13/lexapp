type BrandLogoProps = {
  className?: string;
  size?: number;
  alt?: string;
};

/** Public asset path that respects Vite BASE_URL / Render BASE_PATH. */
export function brandLogoSrc() {
  const base = import.meta.env.BASE_URL || "/";
  return `${base.endsWith("/") ? base : `${base}/`}logo.png`;
}

export function BrandLogo({ className, size = 40, alt = "LexAssist" }: BrandLogoProps) {
  return (
    <img
      src={brandLogoSrc()}
      alt={alt}
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, objectFit: "contain" }}
      decoding="async"
    />
  );
}
