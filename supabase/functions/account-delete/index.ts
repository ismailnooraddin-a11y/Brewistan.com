// Auth deletion cascades profiles, devices and linked memberships. Event ledgers
// retain rows with user/staff references set to null; see the retention review in AUDIT_REPORT.md.
import { handler, HttpError, json } from '../_shared/http.ts';
import { admin, audit, requireUser } from '../_shared/supabase.ts';

Deno.serve(handler(async (req) => {
  const { user } = await requireUser(req);

  const { data: owned, error: ownedError } = await admin.from('cafes').select('id').eq('owner_id', user.id).limit(1);
  if (ownedError) throw ownedError;
  if (owned?.length) {
    throw new HttpError(409, 'owner_account', 'Transfer cafe ownership through support before deleting the account. Closing a cafe does not release its ownership.');
  }

  // Linked memberships and devices cascade with the profile. Do not revoke
  // staff first: an Auth failure must not partially deactivate the account.

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) throw error;

  await audit({ action: 'account_deleted', entity: 'user', reason: 'Customer requested deletion' });
  return json({ ok: true });
}));
