interface BrandLogoProps {
  className?: string;
  showWordmark?: boolean;
  variant?: "default" | "light";
}

export function BrandLogo({ className = "", showWordmark = true, variant = "default" }: BrandLogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img
        src="/icons/icon-192.png"
        alt="TillPoint"
        width={40}
        height={40}
        className="h-9 w-9 shrink-0 object-contain"
        loading="lazy"
      />
      {showWordmark && (
        <div className="leading-tight">
          <div className={`text-base font-bold tracking-tight ${variant === "light" ? "text-white" : "text-foreground"}`}>
            TillPoint
          </div>
          <div className={`text-[10px] font-medium uppercase tracking-[0.14em] ${variant === "light" ? "text-white/70" : "text-muted-foreground"}`}>
            Retail OS
          </div>
        </div>
      )}
    </div>
  );
}
