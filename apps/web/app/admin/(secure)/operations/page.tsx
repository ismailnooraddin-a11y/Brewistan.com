import {SupportQuoteForm} from '@/components/SupportQuoteForm';
import {createClient} from '@/lib/supabase/server';
import {PageHeader,StatTile,Notice,formatDate} from '@/components/ui';
export default async function Operations(){const supabase=await createClient();const {data,error}=await supabase.rpc('admin_operations');
 if(error)throw new Error('Operations metrics could not be loaded.');
 return <div className="space-y-6"><PageHeader title="Operations" description="Live database counts. Reload to refresh; these are not delivery receipts."/>
 <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
 <StatTile label="Pending push jobs" value={data.pendingPush}/><StatTile label="Push failures, 24h" value={data.failedPush}/>
 <StatTile label="Pending WhatsApp notices" value={data.pendingNotices}/><StatTile label="Notice failures, 24h" value={data.failedNotices}/>
 <StatTile label="High-volume offline staff-days" value={data.suspiciousOfflineDays} hint="Over 200 offline scans/day in the last 7 days. Review, not proof of fraud."/>
 </div><Notice title="Oldest pending notice">{formatDate(data.oldestNotice,true)}</Notice>
 <Notice tone="warn" title="Operational checks">Investigate failed jobs and growing backlogs. Review GitHub scheduled-job failures, provider limits and database backups. A provider acceptance does not prove receipt.</Notice>
 <SupportQuoteForm/></div>;}
