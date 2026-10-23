'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { customerClient, callFunction, CustomerApiError } from '@/lib/customer/supabase';
import { pickLabel } from '@/lib/customer/strings';
import { useCustomerText } from './CustomerProvider';
import { useCustomer } from './useCustomer';
import { PhoneAuth } from './PhoneAuth';
import { BrandBar } from './BrandBar';
import { Spinner } from './CafeEntry';

interface StaffCafe { cafeId: string; name: string; assignedBranchId: string | null; branches: { id: string; name: string }[] }
interface Preview { prompt: 'stamp' | 'redeem'; customerName: string; availableRewardId: string | null; rewardLabel: Record<string, string> | null }
interface ScanResult { type: 'stamp' | 'redeem'; status: string; reason?: string; stamps?: number; required?: number; puzzle_completed?: boolean }

const REASONS: Record<string, string> = {
  cooldown: 'this customer was stamped recently',
  qr_expired: 'the code expired, ask the customer to show it again',
  invalid_qr: 'this is not a Brewistan customer code',
  self_scan: 'you cannot scan your own card',
  staff_account: 'staff cannot collect stamps at their own café',
  subscription_inactive: 'the café plan needs renewing',
  not_staff: 'you are not active staff at this café',
  branch_mismatch: 'you are not assigned to this branch',
  device_revoked: 'the customer must sign in again',
  device_unknown: 'the customer must sign in again',
};

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };

/** Web scanner for baristas (online). Uses the camera; nothing is stamped without a tap. */
export function StaffScanner() {
  const { t, lang } = useCustomerText();
  const customer = useCustomer();
  const [cafes, setCafes] = useState<StaffCafe[] | null>(null);
  const [cafeId, setCafeId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [camera, setCamera] = useState<'off' | 'on' | 'blocked'>('off');
  const [qr, setQr] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanning = useRef(false);

  useEffect(() => {
    if (customer.status !== 'signedIn') return;
    customerClient().rpc('my_staff_cafes').then(({ data }) => {
      const list = (data ?? []) as StaffCafe[];
      setCafes(list);
      let saved: { cafeId?: string; branchId?: string } = {};
      try { saved = JSON.parse(localStorage.getItem('bw.scan.selection') ?? '{}'); } catch { /* ignore */ }
      const cafe = list.find((c) => c.cafeId === saved.cafeId) ?? list[0];
      if (cafe) {
        setCafeId(cafe.cafeId);
        const branch = cafe.branches.find((b) => b.id === saved.branchId) ?? cafe.branches.find((b) => b.id === cafe.assignedBranchId) ?? cafe.branches[0];
        setBranchId(branch?.id ?? '');
      }
    });
  }, [customer.status]);

  useEffect(() => {
    if (cafeId) try { localStorage.setItem('bw.scan.selection', JSON.stringify({ cafeId, branchId })); } catch { /* ignore */ }
  }, [cafeId, branchId]);

  const stopCamera = useCallback(() => {
    scanning.current = false;
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    setCamera('off');
  }, []);
  useEffect(() => () => stopCamera(), [stopCamera]);

  const onCode = useCallback(async (value: string) => {
    scanning.current = false;
    setQr(value); setBusy(true); setResult(null);
    try {
      const p = await callFunction<Preview>('scan', { action: 'preview', qr: value, cafeId, branchId: branchId || null, eventId: crypto.randomUUID() });
      setPreview(p);
    } catch (e) {
      const code = e instanceof CustomerApiError ? e.code : 'unavailable';
      setResult({ ok: false, text: t('scanRefused', { reason: REASONS[code] ?? code }) });
    } finally { setBusy(false); }
  }, [cafeId, branchId, t]);

  const loop = useCallback(async () => {
    const video = videoRef.current, canvas = canvasRef.current;
    if (!scanning.current || !video || !canvas) return;
    if (video.readyState >= 2) {
      let found: string | null = null;
      const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
      try {
        if (BD) {
          const codes = await new BD({ formats: ['qr_code'] }).detect(video);
          found = codes[0]?.rawValue ?? null;
        } else {
          const w = video.videoWidth, h = video.videoHeight;
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, w, h);
            found = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' })?.data ?? null;
          }
        }
      } catch { /* try the next frame */ }
      if (found && found.startsWith('BW1~')) { onCode(found); return; }
    }
    setTimeout(loop, 180);
  }, [onCode]);

  async function startCamera() {
    setResult(null); setPreview(null); setQr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setCamera('on'); scanning.current = true; loop();
    } catch {
      setCamera('blocked');
    }
  }

  async function act(action: 'stamp' | 'redeem') {
    if (!qr) return;
    setBusy(true);
    try {
      const r = await callFunction<ScanResult>('scan', {
        action, qr, cafeId, branchId: branchId || null, eventId: crypto.randomUUID(),
        rewardId: action === 'redeem' ? preview?.availableRewardId ?? null : null,
      });
      if (r.status === 'accepted') {
        setResult({ ok: true, text: r.type === 'redeem' ? t('rewardRedeemed') : r.puzzle_completed ? t('cardCompleted') : t('stampAdded', { n: r.stamps ?? 0, m: r.required ?? 0 }) });
      } else {
        setResult({ ok: false, text: t('scanRefused', { reason: REASONS[r.reason ?? ''] ?? r.reason ?? r.status }) });
      }
    } catch (e) {
      const code = e instanceof CustomerApiError ? e.code : 'unavailable';
      setResult({ ok: false, text: t('scanRefused', { reason: REASONS[code] ?? code }) });
    } finally { setBusy(false); setPreview(null); }
  }

  function next() { setResult(null); setPreview(null); setQr(null); if (streamRef.current) { scanning.current = true; loop(); } else startCamera(); }

  const cafe = cafes?.find((c) => c.cafeId === cafeId);
  return (
    <main className="mx-auto w-full max-w-md px-5 pb-16" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
      <BrandBar />
      <h1 className="mt-6 text-[24px] font-semibold tracking-[-0.01em]">{t('scanner')}</h1>
      {customer.status === 'loading' && <div className="mt-10"><Spinner label="…" /></div>}
      {customer.status === 'signedOut' && <section className="cx-surface mt-6 p-5"><PhoneAuth onSignedIn={customer.refresh} /></section>}
      {customer.status === 'signedIn' && cafes === null && <div className="mt-10"><Spinner label={t('checking')} /></div>}
      {customer.status === 'signedIn' && cafes?.length === 0 && <p className="cx-surface mt-6 p-5 text-[14px] cx-muted">{t('notBarista')}</p>}

      {cafe && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="block"><span className="cx-label">{t('scannerFor')}</span>
              <select className="cx-input" value={cafeId} onChange={(e) => { setCafeId(e.target.value); setBranchId(cafes!.find((c) => c.cafeId === e.target.value)?.branches[0]?.id ?? ''); }}>
                {cafes!.map((c) => <option key={c.cafeId} value={c.cafeId} className="bg-[#1b1916]">{c.name}</option>)}
              </select></label>
            <label className="block"><span className="cx-label">{t('branch')}</span>
              <select className="cx-input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                {cafe.branches.map((b) => <option key={b.id} value={b.id} className="bg-[#1b1916]">{b.name}</option>)}
              </select></label>
          </div>

          <div className="relative mt-5 aspect-square w-full overflow-hidden rounded-2xl border border-white/[0.07] bg-black">
            <video ref={videoRef} playsInline muted className={`h-full w-full object-cover ${camera === 'on' ? '' : 'hidden'}`} />
            <canvas ref={canvasRef} className="hidden" />
            {camera === 'on' && !preview && !result && (
              <div aria-hidden="true" className="pointer-events-none absolute inset-[18%] rounded-2xl border-2 border-[#c8a96a]/80" />
            )}
            {camera !== 'on' && (
              <div className="absolute inset-0 grid place-items-center p-6 text-center">
                {camera === 'blocked'
                  ? <p className="text-[14px] cx-muted">{t('cameraBlocked')}</p>
                  : <button className="cx-btn max-w-[220px]" onClick={startCamera}>{t('startCamera')}</button>}
              </div>
            )}
            {busy && <div className="absolute inset-0 grid place-items-center bg-black/60"><Spinner label={t('checking')} /></div>}
          </div>
          {camera === 'on' && !preview && !result && <p className="mt-3 text-center text-[13.5px] cx-muted">{t('pointCamera')}</p>}

          {preview && (
            <section className="cx-surface mt-5 space-y-3 p-5">
              <div className="text-[18px] font-semibold">{preview.customerName}</div>
              {preview.availableRewardId && (
                <button className="cx-btn" disabled={busy} onClick={() => act('redeem')}>
                  {t('redeemReward', { reward: pickLabel(preview.rewardLabel, lang) })}
                </button>
              )}
              <button className={preview.availableRewardId ? 'cx-btn-quiet w-full' : 'cx-btn'} disabled={busy} onClick={() => act('stamp')}>{t('addStamp')}</button>
              <button className="cx-link block w-full text-center" onClick={next}>{t('cancel')}</button>
            </section>
          )}
          {result && (
            <section className={`mt-5 rounded-2xl border p-5 ${result.ok ? 'border-[#6fbf8a]/40 bg-[#6fbf8a]/10' : 'border-[#e8857a]/40 bg-[#e8857a]/10'}`}>
              <div role="status" className="text-[16px] font-semibold">{result.text}</div>
              <button className="cx-btn mt-4" onClick={next}>{t('scanNext')}</button>
            </section>
          )}
        </>
      )}
    </main>
  );
}
