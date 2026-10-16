export function asciiDigits(value: string): string {
  return value.replace(/[\u0660-\u0669\u06f0-\u06f9]/g, (c) => {
    const n=c.charCodeAt(0); return String(n >= 0x06f0 ? n-0x06f0 : n-0x0660);
  });
}
export function baghdadToIso(local: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) throw new Error('Choose a valid date and time.');
  const date = new Date(`${local}:00+03:00`);
  if (!Number.isFinite(date.getTime()) || new Date(date.getTime()+10800000).toISOString().slice(0,16) !== local) throw new Error('Choose a valid date and time.');
  const hour = Number(local.slice(11,13));
  if (hour < 9 || hour >= 21) throw new Error('Choose a time from 09:00 to before 21:00 in Baghdad.');
  if (date.getTime() < Date.now()+600000) throw new Error('Schedule at least ten minutes ahead.');
  return date.toISOString();
}
function luminance(hex: string): number {
  if (!/^#[a-f0-9]{6}$/i.test(hex)) return NaN;
  const c = [1,3,5].map((i) => parseInt(hex.slice(i,i+2),16)/255)
    .map((v) => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4);
  return c[0]*.2126+c[1]*.7152+c[2]*.0722;
}
export function contrastRatio(a: string,b: string): number {
  const x=luminance(a),y=luminance(b);
  return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
