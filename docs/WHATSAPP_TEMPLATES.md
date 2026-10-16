# WhatsApp message templates

Create these in Meta Business Manager > WhatsApp Manager > Message templates, for English and Arabic (add Sorani if Meta supports it for your account; otherwise Sorani users receive Arabic). Names must match exactly, or override them with the `WA_TEMPLATE_*` function secrets.

Set `WA_TEMPLATE_LANGS` to the languages you got approved, for example `{"en":"en","ar":"ar","ckb":"ar"}`.

| Name | Category | Body | Variables |
| --- | --- | --- | --- |
| `brewistan_otp` | Authentication | Meta's standard authentication body with a **Copy code** button | `{{1}}` = code |
| `brewistan_staff_invite` | Utility | You have been added as a barista at {{1}} on Brewistan. Download the app and sign in with this number: {{2}} | cafe name, app link |
| `brewistan_staff_change` | Utility | Staff change at {{1}}: {{2}}. If you did not make this change, contact Brewistan support now. | cafe name, change |
| `brewistan_cafe_approved` | Utility | {{1}} is approved on Brewistan. Your 14-day trial has started. Open your dashboard: {{2}} | cafe name, dashboard link |
| `brewistan_cafe_rejected` | Utility | {{1}} was not approved on Brewistan. Reason: {{2}}. You can update your details and re-apply after seven days. | cafe name, reason |

The OTP template is also used for the step-up code that approves push campaigns.

## Cost note

Authentication messages to Iraqi numbers are billed per Meta's current rate card. Meta lists Iraq at $0.0079 for authentication and $0.1280 for "authentication-international"; which one applies depends on Meta's eligibility rules for your business. Confirm the rate with Meta in writing before launch. The `OTP_DAILY_CAP` secret (default 2000) pauses sign-in codes for the day if reached, so a bot attack cannot run up the bill.
