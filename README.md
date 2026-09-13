# Qashio product audit

An audit of Qashio's ERP API and web application, built entirely from public
evidence. No account, no credentials, nothing behind a login.

**Live:** https://qashio.yazan-ali.net

## What's here

| Path | What it is |
|---|---|
| `index.html` | The case study. Self-contained, no build step. |
| `findings.json` | The findings register. Every claim on the site originates here, with its source and status. |
| `verify.mjs` | Unit tests that reproduce several findings against Qashio's own published example payloads. |
| `patches/` | Proposed NestJS fixes. Each file cites the finding IDs it addresses. |
| `vercel.json` | Security headers, including a hash-based CSP. See note below. |

## Run the tests

```bash
npm test
```

Ten tests. They don't assert the findings, they reproduce them: the published
example's line items totalling 240 against a 102 header, offset pagination
returning a row twice on insert and skipping one on delete, float drift when
500 monetary rows are summed as JSON numbers.

## Sources

1. Integration guide, `developers.qashio.com` (public)
2. OpenAPI specification, `erp.qashio.com/api/docs`, linked publicly from that guide
3. Response headers and JavaScript coverage profile of the unauthenticated login page
4. Chrome User Experience Report field data for that page

No requests were issued against the API. Nothing was probed, fuzzed or
load-tested. One open question is withheld from the public register and was
sent to Qashio privately.

## About the headers on this site

`vercel.json` sets `Content-Security-Policy` with SHA-256 hashes for the inline
style and script rather than `unsafe-inline`, plus HSTS with preload,
`nosniff`, `Permissions-Policy`, COOP and `frame-ancestors 'none'`.

Finding QF-30 is that Qashio's own authentication origin has no CSP. It seemed
fair to demonstrate the fix rather than just recommend it.

**If you edit `index.html`, the hashes break and the page renders unstyled.**
Recompute them:

```bash
node -e "const fs=require('fs'),c=require('crypto'),s=fs.readFileSync('index.html','utf8');
for(const t of ['style','script']){const m=s.match(new RegExp('<'+t+'>([\\\\s\\\\S]*?)</'+t+'>'));
console.log(t, \"'sha256-\"+c.createHash('sha256').update(m[1]).digest('base64')+\"'\");}"
```

Then update the `script-src` and `style-src` values in `vercel.json`.

---

Yazan Ali · yazan.ali.dev@gmail.com
