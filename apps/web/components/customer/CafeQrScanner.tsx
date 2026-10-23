'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import jsQR from 'jsqr';
import { useCustomerText } from './CustomerProvider';

/** Scan a branch's printed URL from inside the installed PWA (iOS-safe routing). */
export function CafeQrScanner() {
  const router = useRouter();
  const { t } = useCustomerText();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const running = useRef(false);
  const canvas = useRef<HTMLCanvasElement>(null);

  const close = useCallback(() => {
    running.current = false;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setOpen(false);
  }, []);
  useEffect(() => () => close(), [close]);

  const read = useCallback((raw: string): string | null => {
    try {
      const url = new URL(raw);
      const safeOrigin = url.origin === window.location.origin;
      const production = url.protocol === 'https:' && url.hostname === 'app.brewistan.com';
      if (!safeOrigin && !production) return null;
      const path = decodeURI(url.pathname);
      if (!/^\/c\/[a-z0-9-]{2,60}(\/[a-z0-9-]{2,60})?\/?$/.test(path)) return null;
      return path;
    } catch { return null; }
  }, []);

  const capture = useCallback(async () => {
    if (!running.current || !video.current || !canvas.current) return;
    const v = video.current;
    if (v.readyState >= 2 && v.videoWidth) {
      const w = Math.min(700, v.videoWidth);
      const h = Math.round(w * v.videoHeight / v.videoWidth);
      canvas.current.width = w; canvas.current.height = h;
      const ctx = canvas.current.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(v, 0, 0, w, h);
        const found = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' })?.data;
        const path = found ? read(found) : null;
        if (path) { close(); router.push(path); return; }
      }
    }
    if (running.current) window.setTimeout(capture, 250);
  }, [close, read, router]);

  async function start() {
    setError(null); setOpen(true);
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      stream.current = media;
      // React commits the camera panel before getUserMedia resolves.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (!video.current) { media.getTracks().forEach((t) => t.stop()); return; }
      video.current.srcObject = media;
      await video.current.play();
      running.current = true;
      void capture();
    } catch { setError('Camera unavailable. Allow camera access, then try again.'); }
  }

  return (
    <>
      <button onClick={start} type="button"
        className="inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 text-[12.5px] font-medium text-[#e7cf98] transition-colors hover:bg-white/[0.08]">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3m13 5h3a2 2 0 0 0 2-2v-3M4 12h16"/>
        </svg>{t('scanCafeQr')}
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label={t('scanCafeTitle')} className="fixed inset-0 z-50 flex flex-col justify-center bg-[#121110] px-5 py-8">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-5 flex items-center justify-between">
              <div><h2 className="text-xl font-semibold">{t('scanCafeTitle')}</h2><p className="mt-1 text-[13px] cx-muted">{t('scanCafeHint')}</p></div>
              <button onClick={close} className="cx-btn-quiet" type="button">{t('close')}</button>
            </div>
            <div className="aspect-square overflow-hidden rounded-[22px] border border-[#c8a96a]/30 bg-black">
              <video ref={video} playsInline muted className="h-full w-full object-cover" />
              <canvas ref={canvas} className="hidden" />
            </div>
            {error && <p role="alert" className="mt-3 text-[13px] text-[#e8857a]">{error}</p>}
            {error && <button className="cx-btn mt-4" onClick={start}>{t('cameraRetry')}</button>}
          </div>
        </div>
      )}
    </>
  );
}
