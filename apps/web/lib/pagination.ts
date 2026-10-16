export const PAGE_SIZE = 50;
export function pageNumber(value: unknown): number {
 if (typeof value !== 'string' || !/^[1-9]\d{0,5}$/.test(value)) return 1;
 return Math.min(Number(value),100000);
}
export function pageHref(path: string, page: number, query = ''): string {
 const params=new URLSearchParams(); params.set('page',String(Math.max(1,page)));
 if(query)params.set('q',query.slice(0,100));
 return `${path}?${params.toString()}`;
}
