/** The black strap with the golden Ezmora Realty lockup and tagline. */
export function BrandStrap({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`flex flex-col items-center justify-center bg-strap text-center ${
        compact ? "px-4 py-2.5" : "px-6 py-4"
      }`}
    >
      <span
        className={`gold-text font-semibold tracking-[0.34em] uppercase ${
          compact ? "text-sm" : "text-xl sm:text-2xl"
        }`}
      >
        Ezmora Realty
      </span>
      <span
        className={`mt-1 tracking-[0.2em] text-strap-foreground/60 uppercase ${
          compact ? "text-[9px]" : "text-[10px] sm:text-xs"
        }`}
      >
        Driven by Vision · Defined by Ezmora
      </span>
    </div>
  );
}