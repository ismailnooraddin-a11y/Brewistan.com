export default function PhoneMockup({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto w-[320px]">
      {/* Device frame */}
      <div className="relative rounded-[48px] bg-ink p-3 shadow-lift ring-1 ring-black/20">
        {/* Screen */}
        <div className="relative overflow-hidden rounded-[36px] bg-paper aspect-[9/19.5]">
          {/* Notch */}
          <div className="absolute left-1/2 top-2 z-10 h-6 w-24 -translate-x-1/2 rounded-full bg-ink" />
          {/* Content */}
          <div className="relative h-full w-full overflow-y-auto px-4 pt-12 pb-6">
            {children}
          </div>
        </div>
      </div>
      {/* Side buttons */}
      <span className="absolute -left-[3px] top-24 h-8 w-[3px] rounded-l bg-ink/70" />
      <span className="absolute -left-[3px] top-36 h-12 w-[3px] rounded-l bg-ink/70" />
      <span className="absolute -right-[3px] top-28 h-16 w-[3px] rounded-r bg-ink/70" />
    </div>
  );
}
