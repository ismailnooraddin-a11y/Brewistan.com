export const metadata = { title: 'Terms' };

// Draft product rules; the operator must obtain appropriate review before publication.
export default function Terms() {
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-12 text-sm leading-relaxed">
      <h1 className="text-3xl">Terms of service</h1>
      <p className="rounded border border-amber-500 p-3" role="note">Pre-launch draft. The operator must approve these terms and its payment, dispute and retention policies before launch.</p>
      <h2 className="pt-4 text-xl">Loyalty rewards</h2>
      <p>A participating cafe defines the required stamps, cooldown and reward expiry. A puzzle already in progress keeps its recorded campaign terms; the next puzzle uses the then-current campaign. Rewards have no cash value.</p>
      <p>A scan saved offline is provisional until the server accepts it. Duplicate requests, revoked staff or devices, expiry, offline limits and eligibility checks can affect acceptance. Check the scan history instead of rescanning an uncertain transaction. Contact support about a rejected or legacy scan.</p>
      <h2 className="pt-4 text-xl">For cafes</h2>
      <p>Cafes require approval before activation and a valid trial or paid entitlement to issue new stamps. Historical entitlement is checked for eligible delayed offline stamps. At an active cafe, an already-earned reward remains redeemable within its recorded terms after subscription expiry.</p>
      <p>Owners are responsible for staff access and lawful, appropriate messaging. Ownership transfer requires initiation by the current owner, acceptance by the verified recipient, and administrator review. Pending marketing authorizations do not transfer to the new owner.</p>
      <h2 className="pt-4 text-xl">Payments</h2>
      <p>Payments are reported in Iraqi dinar against a recorded quote specifying the plan, months, amount and deadline. A later price-table change does not reprice that quote. Transfers are verified by an administrator; filing a report is not payment confirmation. Discounts or historical exceptions need a recorded support quote and reason. Refunds and disputed transfers require operator review.</p>
      <h2 className="pt-4 text-xl">Support and enforcement</h2>
      <p>Brewistan may restrict access while investigating misuse. Operational records assist that review but do not independently prove that a purchase occurred. The operator must publish its identity, support contact and dispute process with the approved terms.</p>
    </main>
  );
}
