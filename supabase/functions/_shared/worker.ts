/** Claims only the next bounded batch; crashed work stays recoverable through its lease. */
export async function drainQueue<T>(options: {
 claim: (limit:number)=>Promise<T[]>; handle:(job:T)=>Promise<void>;
 deadlineMs:number; batchSize?:number; maxJobs?:number; now?:()=>number;
}):Promise<{claimed:number;processed:number;errors:number}> {
 const now=options.now??Date.now, size=Math.max(1,Math.min(options.batchSize??10,25));
 const cap=Math.max(0,options.maxJobs??1000); let claimed=0,processed=0,errors=0;
 while (claimed<cap && now()<options.deadlineMs-18000) {
  const jobs=await options.claim(Math.min(size,cap-claimed));
  if (!jobs.length) break;
  claimed+=jobs.length;
  const results=await Promise.allSettled(jobs.map(options.handle));
  for (const result of results) { if(result.status==='fulfilled') processed++; else errors++; }
 }
 return {claimed,processed,errors};
}
