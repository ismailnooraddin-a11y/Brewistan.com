import { redirect } from 'next/navigation';

export const metadata = { title: 'Staff' };

export default function StaffHome() {
  redirect('/staff/stamp-requests');
}
