import Link from 'next/link';
import {requireOwnerContext} from '@/lib/server-context';
import {PageHeader} from '@/components/ui';
import {RequestOwnership} from '@/components/OwnershipActions';
export default async function Account(){const {cafe}=await requireOwnerContext();return <div className="space-y-6">
 <PageHeader title="Account and ownership"/><Link className="btn-ghost" href="/ownership">View transfer requests</Link>
 <RequestOwnership cafeId={cafe.id}/></div>;}
