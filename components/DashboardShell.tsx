import Link from 'next/link';
import { BarChart3, Building2, Coffee, LayoutDashboard, Palette, Settings, ShieldCheck, Users } from 'lucide-react';

const links = [
  ['Dashboard','/dashboard',LayoutDashboard],
  ['Brand & card','/dashboard/brand',Palette],
  ['Campaigns','/dashboard/campaigns',Coffee],
  ['Staff & roles','/dashboard/staff',Users],
  ['Branches','/dashboard/branches',Building2],
  ['Settings','/dashboard/settings',Settings],
];

export default function DashboardShell({children}:{children:React.ReactNode}){
 return <div className="dashboard"><aside className="sidebar"><div className="side-brand">Brewistan</div>{links.map(([label,href,Icon])=><Link key={href as string} className="side-link" href={href as string}><Icon size={18}/>{label}</Link>)}<div className="panel" style={{background:'rgba(255,255,255,.08)',borderColor:'rgba(255,255,255,.12)',boxShadow:'none',marginTop:24}}><ShieldCheck size={22}/><p style={{color:'rgba(255,255,255,.72)'}}>Owner controls branding, campaigns, branches, and permissions.</p></div></aside><main className="dash-main">{children}</main></div>
}
