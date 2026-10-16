#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
for tool in node npm python3 deno flutter; do
  command -v "$tool" >/dev/null || { echo "Required tool missing: $tool" >&2; exit 2; }
done
npm ci --prefix apps/web
npm ci --prefix supabase/tests
node --test scripts/audit-checks.mjs scripts/final-checks.mjs
node scripts/typecheck-helpers.mjs
python3 scripts/audit-platform-checks.py
npm test --prefix supabase/tests
deno check supabase/functions/*/index.ts
SUPABASE_URL=http://localhost SUPABASE_SERVICE_ROLE_KEY=test SUPABASE_ANON_KEY=test deno test --allow-env supabase/functions/_tests/
npm run typecheck --prefix apps/web
npm run build --prefix apps/web
bash scripts/setup-mobile.sh
(cd apps/mobile && flutter analyze --no-fatal-infos && flutter test)
echo "Full local verification completed. Hosted integration and real-device acceptance remain separate."
