import { notFound } from 'next/navigation';
import { CafeEntry } from '@/components/customer/CafeEntry';
import { getPublicCafePage } from '@/lib/customer/public';

export const revalidate = 60;

export default async function CafeQrPage({ params }: { params: Promise<{ cafe: string }> }) {
  const { cafe } = await params;
  const page = await getPublicCafePage(cafe, null);
  if (!page) notFound();
  return <CafeEntry page={page} />;
}
