# Operations and support procedures

## Devices, sessions and pending work

Device settings list the account's active installs. Revocation invalidates the device and blocks sessions already linked to it. Synchronize pending work first unless immediate containment of a suspected compromise takes priority. A security incident can require Auth-level revocation of every account session, especially for historical unlinked sessions; do not assume one device mapping identifies every bearer token.

Sign-out detaches the push token where possible, stops local sync/listeners and retains account-bound queues and their encryption key. Returning to the same account can reconcile that work. The renewal action signs out, rotates the device key and requires a fresh WhatsApp login; it does not erase the separate payload-encryption key. Revoked-device queued actions can still need manual review.

If secure storage loses the payload key while encrypted work exists, the app must show recovery guidance. Preserve the device and database; do not generate a substitute key and mark unreadable work delivered. Ciphertext cannot be restored without its key or an appropriate protected backup. AES-GCM covers sensitive payloads, not all SQLite metadata or every forensic copy left by flash storage/backups.

## Historical entitlement correction

Use a verified documentary record for an interval missing from the migration-observed history. Under a currently authenticated AAL2 administrator, call:

```javascript
await supabase.rpc('admin_record_entitlement', {
  p_cafe: '<cafe UUID>',
  p_start: '<ISO timestamp>',
  p_end: '<ISO timestamp>',
  p_reason: '<at least 10 characters describing the evidence and approval>'
});
```

Check the actual function signature in migration 07 before automating this support call. The record and reason are audited. This establishes a reviewed business entitlement, not proof that a particular purchase or offline scan occurred. The existing scan-age bound, staff authorization, replay checks and limits still apply. Never extend a historic period merely to suppress a rejected scan.

## Billing

The owner selects a period and obtains a 24-hour quote before reporting a transfer. Reporting is exact-amount and quote-bound; reference values are normalized and protected against reuse. Confirmation is idempotent and uses the frozen quote. A changed plan tier requires explicit review instead of silently switching plans.

For a documented discount or agreed exception, use **Admin > Operations > Evidence-backed payment exception**. Provide the cafe UUID, duration, exact IQD amount and reason, then share the resulting quote ID with the owner. The owner loads it with **Billing > Use a quote from support** and reports the payment. Verify the bank/wallet receipt independently before approval.

A legacy pending report without a quote is not auto-approved at today's price. Review its original terms and use the admin reconciliation action with the required amount and evidence. Duplicate confirmed references remain blocked. Overpayments, refunds, credits, tax treatment and disputes need the operator's approved process; this source does not invent an accounting ledger for them.

## Ownership transfer

The current owner requests a transfer under **Dashboard > Account** using the recipient's verified account phone. The recipient signs in and opens `/ownership` to accept. An AAL2 administrator verifies both parties and completes it under **Admin > Transfers** with a reason. The operation changes the cafe owner and owner membership atomically, cancels pending old-owner marketing and records the decision.

Check the staff roster, provider/billing contacts, branding and historical obligations with both parties after completion. In-flight external messages cannot be recalled merely because database jobs were cancelled. Historical transfer/payment/marketing records remain as appropriate while former owner identifiers may be nulled on deletion.

## Notifications, retries and monitoring

The scheduled workflow launches four independent workers every five minutes. Jobs use lease tokens, bounded attempts and expiry checks. The drain loop repeatedly claims bounded batches while retaining deadline headroom. FCM access-token refreshes are coalesced per function instance. These controls improve the source architecture; actual capacity has not been measured.

Inspect GitHub job failures, function responses and **Admin > Operations**. Suggested initial operational thresholds, to be calibrated in staging: investigate a growing queue over two scheduled intervals; alert on provider authentication errors, repeated claim/ack failures or any unexplained sustained rise in failed jobs. Separate payment/OTP security events from ordinary marketing failures. Store only redacted diagnostic fields, not QR payloads, bearer tokens or OTPs.

Do not label `acceptedByFcm` as device delivery. The provider and OS may coalesce or repeat notifications. Mobile delivery-ID deduplication applies to the implemented callbacks and does not guarantee universal exactly-once display. High-volume offline staff-day counts are review flags, not fraud verdicts.

Terminal WhatsApp outbox rows older than 30 days are eligible for bounded cleanup; account-session mapping cleanup is bounded per invocation. Financial, reward and audit ledgers are not automatically purged by this housekeeping. The operator must approve a broader retention policy rather than infer it from one cleanup query.

## Release, backup and incident ownership

Maintain a restore-tested encrypted backup, a named incident owner and reviewed access to service/signing keys. Record full-stack acceptance for every deployed commit. Configure production environment approvals and hosting controls yourself; no cloud settings were changed here. Store the tested Flutter lockfile, native platform baseline and signing identity in the maintained private repository/secret manager as appropriate, not in chat or plaintext public configuration.

Platform-signing-key rotation requires a coordinated certificate/voucher compatibility plan; the current QR protocol is not a multi-key rollover system. A single compromised signing key, loss of payload keys, or evidence of fabricated sales requires containment and a specific recovery plan. Do not claim that signed QR codes provide hardware attestation or verify a real purchase.

The privacy and terms screens intentionally remain visibly marked as pre-launch drafts until the operator supplies approved policies, identity and contact details. Native copy, RTL/accessibility and provider-policy review must be completed before release.
