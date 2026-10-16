"use client";
export default function ErrorPage({reset}:{error:Error & {digest?:string};reset:()=>void}) {
  return <main className="mx-auto max-w-xl px-6 py-20"><h1 className="text-2xl">This page could not be loaded</h1>
    <p role="alert" className="my-4 text-ink-muted">No changes are confirmed by this message. Check your connection and try again.</p>
    <button type="button" className="btn-primary" onClick={reset}>Try again</button></main>;
}
