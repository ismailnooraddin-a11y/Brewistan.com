export const metadata = { title: 'Privacy policy' };

// Operationally accurate draft, not a statement of legal compliance.
// The operator must approve retention periods, provider disclosures and support details before launch.
export default function Privacy() {
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-12 text-sm leading-relaxed">
      <h1 className="text-3xl">Privacy policy</h1>
      <p className="rounded border border-amber-500 p-3" role="note">Pre-launch draft. Brewistan must publish its approved operator details, retention schedule and support contact before accepting real customers.</p>
      <p>Brewistan provides digital loyalty cards for participating cafes in Iraq.</p>
      <h2 className="pt-4 text-xl">Information used by the service</h2>
      <p>We use your phone number for sign-in, your name and language, loyalty visits and rewards, staff assignments where applicable, and device keys and notification tokens. Owner billing and support actions also create payment, quote and audit records.</p>
      <h2 className="pt-4 text-xl">Cafe access</h2>
      <p>Customer reports show a display name, cafe-specific reference and activity at that cafe, not the customer phone number or other cafes&apos; activity. Owners separately manage the phone numbers and assignments of staff they invite. Administrators have additional access for support and security.</p>
      <h2 className="pt-4 text-xl">Messages and service providers</h2>
      <p>Sign-in and administrative notices use WhatsApp. App notifications use Firebase Cloud Messaging. Cafe marketing is limited separately from transactional reward reminders; muting a cafe suppresses its marketing and reminders. Provider acceptance of a message does not prove it was received or read.</p>
      <h2 className="pt-4 text-xl">Data on your phone</h2>
      <p>The app keeps account-scoped wallet and staff caches and pending scanner work. Sensitive queued QR and authorization payloads are encrypted with a key held in secure device storage. Operational metadata is not full-database encrypted. Signing out keeps pending work for the same account; do not erase app data while scans need reconciliation.</p>
      <h2 className="pt-4 text-xl">Deleting your account</h2>
      <p>Deletion is available in app settings after pending scans are resolved and any cafe ownership is transferred. It removes the live account and linked profile, device and membership records. Some business, payment, visit and audit history remains with account links removed where the schema supports this. This is not a promise of complete anonymization of every free-text record.</p>
      <p>Deleting an account does not instantly erase provider records, backups, or cached data on another device. The operator must define retention, restoration safeguards and support handling for those copies. Contact support about a request that cannot be completed in the app.</p>
      <h2 className="pt-4 text-xl">Contact</h2>
      <p>Use the Brewistan support contact published with the service. The operating company and verified support contact must be supplied before launch.</p>
    </main>
  );
}
