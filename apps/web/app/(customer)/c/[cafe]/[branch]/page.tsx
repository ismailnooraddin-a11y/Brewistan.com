import { notFound } from 'next/navigation';
import { CafeEntry } from '@/components/customer/CafeEntry';
import { getPublicCafePage } from '@/lib/customer/public';

export const revalidate = 60;

export default async function BranchQrPage({ params }: { params: Promise<{ cafe: string; branch: string }> }) {
  const { cafe, branch } = await params;
  const page = await getPublicCafePage(cafe, branch);
  if (!page) notFound();
  return <CafeEntry page={page} />;
}
