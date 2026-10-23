export const metadata = { title: 'Privacy policy' };

// Draft must be completed by the operator/legal owner before public launch.
export default function Privacy() {
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-12 text-sm leading-relaxed">
      <h1 className="text-3xl">Privacy policy</h1>
      <p className="rounded border border-amber-500 p-3" role="note">Pre-launch draft. The service operator must approve its legal identity, retention periods, contact details, and provider disclosures before public launch.</p>
      <p>Brewistan provides loyalty cards and rewards for participating cafés in Iraq.</p>
      <h2 className="pt-4 text-xl">Information we use</h2>
      <p>We use your phone number for account creation and phone OTP sign-in, the email you choose to register or verify for email OTP sign-in, your name, gender, language, café visits, stamp progress and rewards. We also record account sessions, scanner and device information, and security events. Café owners and staff generate business verification, payment and audit records.</p>
      <h2 className="pt-4 text-xl">Who sees what</h2>
      <p>Participating café owners may view café-specific customer names, references and loyalty activity; they do not receive customer phone numbers or activity at unrelated cafés from the standard owner reports. Staff see the information needed to confirm a stamp or redemption. Brewistan administrators have additional operational and security access.</p>
      <h2 className="pt-4 text-xl">Message and infrastructure providers</h2>
      <p>Phone OTPs may be sent through WhatsApp or SMS. Verified email login requires Supabase Auth email delivery. Native mobile notifications, where enabled, use Firebase Cloud Messaging. The current browser PWA does not yet offer an independent push-notification subscription flow. Message acceptance by a provider does not confirm delivery or reading.</p>
      <h2 className="pt-4 text-xl">Information on your device</h2>
      <p>The browser PWA stores an account-scoped display cache of loyalty cards and profile completion, as well as a local device signing key and certificate in browser storage. Browser local storage is not encrypted at rest by this app. Clear it to discard those local copies, but this does not delete server-side loyalty records. The separate Flutter client stores local pending scans and sensitive queued payloads in encrypted device storage; queued actions require reconciliation before device data is erased.</p>
      <h2 className="pt-4 text-xl">Your account and data requests</h2>
      <p>Customers may unlink local sessions by signing out. Email verification is available in account settings. Account deletion and device management are not yet exposed as complete self-service flows in the browser PWA; request assistance from Brewistan support until those controls launch. Café owners must resolve ownership transfer and required record retention before account removal.</p>
      <p>Some financial, transaction and security records may be retained subject to approved retention rules. Deletion does not instantly remove backups or third-party provider data. The operator must publish the final terms and verified contact before launch.</p>
      <h2 className="pt-4 text-xl">Contact</h2>
      <p>Use the verified Brewistan support contact published by the service operator. Contact and legal-operator information must be added before production use.</p>
    </main>
  );
}
