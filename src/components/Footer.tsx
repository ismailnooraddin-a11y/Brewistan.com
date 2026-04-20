export default function Footer() {
  return (
    <footer className="border-t border-line bg-paper">
      <div className="container-pad flex flex-col items-center justify-between gap-3 py-8 text-[13px] text-ink-muted sm:flex-row">
        <p>© {new Date().getFullYear()} Brewistan. All rights reserved.</p>
        <p>Made for independent coffee shops.</p>
      </div>
    </footer>
  );
}
