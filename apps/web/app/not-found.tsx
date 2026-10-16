import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <div className="font-display text-3xl">Page not found</div>
      <Link href="/" className="text-sm underline">Go to your dashboard</Link>
    </main>
  );
}
