# Customer web app (app.brewistan.com)

Customers use Brewistan in the browser. No App Store or Google Play download is needed.

## Customer flow
1. Scan a branch QR: `https://app.brewistan.com/c/<cafe>/<branch>`.
2. Enter the phone number (+964 by default) and the 6-digit code. No password.
3. First time only: first name, last name, gender, optional email.
4. The café's card opens (`/cards/<cafeId>`) with a code that changes every 30 seconds.
5. Returning customers stay signed in, and scanning a QR opens their card directly.

Scanning a branch QR **never** adds a stamp. Stamps are added only when staff scan the customer's code.

## Branches
- Each branch has a permanent QR (Dashboard > Branches). Addresses are created once and never change.
- All branches of a café share one card and one stamp balance; every stamp records its branch.

## Staff
Baristas open `https://app.brewistan.com/scan`, sign in with their phone, choose the branch, and scan.
The web scanner works online (the native app adds offline scanning later).

## Not included yet (needs accounts or approval)
| Feature | What is needed |
| --- | --- |
| Apple Wallet pass | Apple Developer Program, a Pass Type ID certificate, a pass-update service |
| Google Wallet pass | Google Wallet issuer account (approval by Google) and a service account |
| Push notifications | Firebase project + web push (VAPID) key |
| Branch managers (limited owner role) | Planned as the next database change |

## Setup checklist
- Vercel project `brewistan-com-l2as`: add the domain `app.brewistan.com`; Cloudflare `app` CNAME to the value Vercel shows (DNS only).
- Defaults already use `app.brewistan.com` (`NEXT_PUBLIC_CUSTOMER_URL`, `CUSTOMER_HOSTS` only needed to change it).
- GitHub variable `ALLOWED_ORIGINS` must include `https://app.brewistan.com`.
- Full reference: `PROJECT_REFERENCE.md` in the repository root.
