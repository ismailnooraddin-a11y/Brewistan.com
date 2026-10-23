// Durable, leased, per-device jobs. FCM acceptance is not proof of display/read.
// Network delivery is at-least-once: a crash after FCM accepts but before ack may
// redeliver. deliveryId is stable for client-side deduplication where supported.
import { handler, HttpError, json } from '../_shared/http.ts';
import { admin } from '../_shared/supabase.ts';
import { pushConfigured, sendPush, sendWhatsAppTemplate, TEMPLATES, whatsappConfigured } from '../_shared/messaging.ts';
import { drainQueue } from '../_shared/worker.ts';
type Locale = 'en' | 'ar' | 'ckb';
const REMINDER: Record<Locale, (cafe: string, days: number) => [string, string]> = {
  en: (cafe, days) => ['Your reward is waiting', `Your free coffee at ${cafe} expires in ${days} days.`],
  ar: (cafe, days) => ['مكافأتك بانتظارك', `قهوتك المجانية في ${cafe} تنتهي خلال ${days} يومًا.`],
  ckb: (cafe, days) => ['خەڵاتەکەت چاوەڕێتە', `قاوە بەخۆڕاییەکەت لە ${cafe} لە ماوەی ${days} ڕۆژدا بەسەردەچێت.`],
};

interface Job { userId: string; id: string; claimToken: string; deviceId: string; token: string;
  locale: Locale; cafeId: string; cafeName: string; campaignId: string | null;
  rewardId: string | null; reminderDays: number; title: Record<string,string>; body: Record<string,string> }
async function rpc(name: string, args = {}) {
  const { data, error } = await admin.rpc(name, args);
  if (error) throw error;
  return data;
}
Deno.serve(handler(async (req) => {
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret || req.headers.get('x-cron-secret') !== secret) throw new HttpError(401, 'unauthorized');
  const started=Date.now();
  const expired = await rpc('expire_rewards');
  let notices={claimed:0,processed:0,errors:0};
  if (whatsappConfigured()) {
    type Notice={id:string;claimToken:string;phone:string;templateKey:'staffInvite'|'staffChange'|'cafeApproved'|'cafeRejected';locale:string;params:string[]};
    notices=await drainQueue<Notice>({deadlineMs:started+35000,maxJobs:100,batchSize:10,
      claim:async limit=>await rpc('claim_notice_jobs',{p_limit:limit}) as Notice[],
      handle:async job=>{
        let success=false;
        try {
          const params=[...job.params];
          if(job.templateKey==='staffInvite') params.push(Deno.env.get('APP_DOWNLOAD_URL')??'https://brewistan.com/app');
          if(job.templateKey==='cafeApproved') params.push(Deno.env.get('DASHBOARD_URL')??'https://dashboard.brewistan.com');
          await sendWhatsAppTemplate(job.phone,TEMPLATES[job.templateKey],params,{locale:job.locale}); success=true;
        } catch { /* No phone, template parameters or credentials in logs. */ }
        await rpc('ack_notice_job',{p_id:job.id,p_claim:job.claimToken,p_success:success});
      }});
  }
  if (!pushConfigured()) {
    const operations=await rpc('maintenance_metrics');
    return json({expired,notices,pushConfigured:false,note:'FCM not configured; no push jobs claimed',operations});
  }
  const prepared=await rpc('prepare_push_jobs');
  let accepted=0,retryOrFailed=0,invalidTokens=0;
  const push=await drainQueue<Job>({deadlineMs:started+75000,batchSize:10,maxJobs:1000,
    claim:async limit=>await rpc('claim_push_jobs',{p_limit:limit}) as Job[],
    handle:async job=>{
      const locale:Locale=['en','ar','ckb'].includes(job.locale)?job.locale:'en';
      const [title,body]=job.rewardId?REMINDER[locale](job.cafeName,job.reminderDays):
        [job.title?.[locale]||job.title?.en||'',job.body?.[locale]||job.body?.en||''];
      let result:'sent'|'invalid_token'|'failed'='failed';
      try { result=await sendPush(job.token,title,body,{deliveryId:job.id,cafeId:job.cafeId,userId:job.userId,
        ...(job.rewardId?{rewardId:job.rewardId,type:'reward_reminder'}:{campaignId:job.campaignId!,type:'campaign'})}); }
      catch { /* Lease/retry preserves unknown provider outcomes. */ }
      const acknowledged=await rpc('ack_push_job',{p_id:job.id,p_claim:job.claimToken,p_result:result});
      if(!acknowledged) return;
      if(result==='sent') accepted++;
      else if(result==='invalid_token') {
        invalidTokens++; const {error}=await admin.from('devices').update({push_token:null}).eq('id',job.deviceId).eq('push_token',job.token);
        if(error) throw error;
      } else retryOrFailed++;
    }});
  const completed=await rpc('finish_push_campaigns');
  const operations=await rpc('maintenance_metrics');
  return json({expired,prepared,notices,push,pushConfigured:true,acceptedByFcm:accepted,retryOrFailed,invalidTokens,completed,operations});
}));
