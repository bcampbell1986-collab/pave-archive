# Pāvé Archive

Live app: https://pave-archive.vercel.app/

Choose a client, project and folder, then select multiple files. Uploads begin automatically. Dropbox originals are checked by size and Dropbox content hash. Matching duplicates are verified and skipped; conflicting originals are not overwritten. Files are sorted under the configured root by client/project/folder/type/month.

Dropbox OAuth app credentials and refresh token are stored as sensitive production variables in Vercel. No credentials belong in GitHub. Access uses Supabase verified email links and HttpOnly sessions. Email provider configuration is pending. bcampbell1986@gmail.com is the administrator; other approved addresses are configured server-side in PAVE_APPROVED_EMAILS. No shared passcode fallback exists. Phone photo deletion and AI recognition are not implemented.

Large uploads use 3 MB chunks relayed by authenticated server functions. Dropbox bearer tokens stay server-side. Keep the app open during a batch. Refreshing the page does not preserve the file-selection queue. Files must be selected again after a reload.

## Validation

Two originals transferred through the hosted UI and matched Dropbox size/content hash. Duplicate readback verified. A 6 MB transfer exercised the authenticated chunk relay and passed hash verification. The old passcode flow has been removed; email authentication still needs a live provider test. Mismatched hashes were rejected. These tests do not verify native phone deletion.

## Server configuration

Required production variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`, `DROPBOX_REFRESH_TOKEN`, `DROPBOX_ROOT`. The registered OAuth redirect is `https://pave-archive.vercel.app/api/dropbox-callback`. Bootstrap OAuth code capture is an administrator task. Do not expose tokens in screenshots or share them with contributors.

## Email login setup
Configure a Supabase project with email authentication enabled, Site URL and allowed redirect https://pave-archive.vercel.app/, and an email sender capable of delivering to approved team addresses. Set SUPABASE_URL and SUPABASE_ANON_KEY in Vercel Production. No service-role key is required. The administrator signs in by a verified email link, never by entering an email alone. PAVE_APPROVED_EMAILS is a comma-separated contributor allowlist; account administration UI is not implemented yet. No uploads are available until email authentication is configured and tested.
