import Link from 'next/link';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {PageHeader,EmptyState,formatDate} from '@/components/ui';
import {OwnershipActions} from '@/components/OwnershipActions';
import {Pagination} from '@/components/Pagination';
import {pageNumber,PAGE_SIZE} from '@/lib/pagination';
export default async function Transfers({searchParams}:{searchParams:Promise<{page?:string}>}){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
 const page=pageNumber((await searchParams).page),from=(page-1)*PAGE_SIZE;
 const {data:rows,error}=await supabase.from('ownership_transfers').select('*').order('created_at',{ascending:false}).order('id').range(from,from+PAGE_SIZE);
 if(error)throw new Error('Transfers could not be loaded.');
 return <main className="mx-auto max-w-4xl space-y-4 px-4 py-8"><PageHeader title="Ownership transfers" description="Acceptance does not transfer access until an administrator completes verification."/>
 <Link className="btn-ghost" href="/dashboard">Dashboard</Link>
 {!rows?.length&&<EmptyState title="No transfer requests"/>}
 {rows?.slice(0,PAGE_SIZE).map(t=><section className="card space-y-3" key={t.id}><p className="break-all">Cafe reference: {t.cafe_id}</p>
 <p>Status: <strong>{t.status}</strong> | Expires {formatDate(t.expires_at,true)}</p>
 {['pending','accepted'].includes(t.status)&&Date.parse(t.expires_at)>Date.now()&&
 t.status==='accepted'&&<OwnershipActions id={t.id} admin/>}
 </section>)}<Pagination path="/admin/ownership" page={page} hasMore={(rows?.length??0)>PAGE_SIZE}/></main>;
}
