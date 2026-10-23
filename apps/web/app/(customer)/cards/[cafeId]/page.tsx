import { notFound } from 'next/navigation';
import { CardView } from '@/components/customer/CardView';

export default async function CardPage({ params }: { params: Promise<{ cafeId: string }> }) {
  const { cafeId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(cafeId)) notFound();
  return <CardView cafeId={cafeId} />;
}
