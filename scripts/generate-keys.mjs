// Generates the secrets Brewistan needs. Run once: node scripts/generate-keys.mjs
// Store the output in GitHub Secrets (see README). Never commit it.
import { generateKeyPairSync, randomBytes } from 'node:crypto';

const { privateKey } = generateKeyPairSync('ed25519');
const jwk = privateKey.export({ format: 'jwk' });
const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

console.log('# Supabase Edge Function secret (keep private):');
console.log(`PLATFORM_SIGNING_SEED=${jwk.d}`);
console.log('\n# Mobile app build value (public, safe to ship in the app):');
console.log(`PLATFORM_PUBLIC_KEY=${jwk.x}`);
console.log('\n# Other secrets:');
console.log(`CRON_SECRET=${b64url(randomBytes(32))}`);
console.log(`OTP_HASH_PEPPER=${b64url(randomBytes(32))}`);
