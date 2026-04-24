import DashboardShell from '@/components/DashboardShell';
import { createClient } from '@/lib/supabase-server';

export default async function Dashboard(){
 const supabase = await createClient();
 const { data: { user } } = await supabase.auth.getUser();
 const { data: cafes } = await supabase.from('cafes').select('*').limit(1);
 const cafe = cafes?.[0];
 return <DashboardShell><div className="dash-head"><div><div className="eyebrow">Cafe owner dashboard</div><h1>{cafe?.cafe_name || 'Your café'} control center</h1><p className="hint">Manage loyalty cards, staff, branches, and customer stamp activity.</p></div><a className="btn" href="/get-started">Sign out</a></div><div className="dash-grid"><div className="stat"><span className="hint">Active customers</span><br/><b>0</b><p>Connect live customer activity after QR launch.</p></div><div className="stat"><span className="hint">Pending stamp requests</span><br/><b>0</b><p>Baristas approve customer stamp requests from phone.</p></div><div className="stat"><span className="hint">Active campaigns</span><br/><b>0</b><p>Create 8, 10, 12, or custom stamp campaigns.</p></div><div className="stat"><span className="hint">Logged in as</span><br/><b style={{fontSize:18}}>{user?.email}</b><p>Owner access with full café settings.</p></div></div></DashboardShell>
}
