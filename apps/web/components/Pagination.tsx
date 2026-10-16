import Link from 'next/link';
import { pageHref } from '@/lib/pagination';
export function Pagination({path,page,hasMore,query=''}:{path:string;page:number;hasMore:boolean;query?:string}){
 return <nav aria-label="Pagination" className="mt-5 flex items-center justify-between gap-4">
  {page>1?<Link className="btn-ghost" href={pageHref(path,page-1,query)}>Previous</Link>:<span/>}
  <span className="text-sm" aria-current="page">Page {page}</span>
  {hasMore?<Link className="btn-ghost" href={pageHref(path,page+1,query)}>Next</Link>:<span/>}
 </nav>;
}
