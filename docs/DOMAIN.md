# Domain: onesixtytwo.win

Production site: **https://onesixtytwo.win**

## Protect WHOIS / registrant contact info

Public WHOIS can expose your name, email, phone, and address. Use **registrar privacy** (or redaction) so those fields are hidden or replaced in the public record. You still must keep accurate contact data on file with the registrar (ICANN requirement).

### If the domain is at **Cloudflare Registrar**

WHOIS redaction is **on by default** at no extra cost.

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Domain Registration** → **onesixtytwo.win**.
2. Confirm **WHOIS redaction** is enabled (it usually cannot be turned off).
3. Under **Contacts**, use a dedicated email (e.g. `registrar+onesixtytwo@yourdomain.com` or a role alias), not a personal inbox, for registrant/admin/tech/billing if you want less exposure in private disputes or data requests.

**What may still be public:** registry policy often leaves **country** and sometimes **state/province** visible even with redaction. Name, email, phone, and street address should show as redacted (e.g. “Data Redacted”) on [Cloudflare RDAP](https://rdap.cloudflare.com/).

### If the domain is at **another registrar** (Namecheap, Porkbun, Google, GoDaddy, etc.)

1. Open the domain’s management page for **onesixtytwo.win**.
2. Enable the privacy product (names vary):
   - **WHOIS Privacy** / **Domain Privacy** / **WhoisGuard** / **Privacy Protection**
3. Pay the annual fee if the registrar charges for it (Porkbun and Cloudflare include it free; others often charge ~$5–15/year).
4. Re-check WHOIS 24–48 hours later with a lookup tool ([ICANN Lookup](https://lookup.icann.org/) or `whois onesixtytwo.win`).

### Stronger privacy (optional)

- **Transfer to Cloudflare Registrar** (at-cost pricing + free redaction) while keeping DNS on Cloudflare. Unlock the domain, get an auth code, initiate transfer in Cloudflare; approval can take a few days.
- **Use a business or trust entity** as registrant only if you already have one set up for that purpose (not required for a hobby project).
- **Never** publish your domain registrar login or auth codes in the repo or chat logs.

### Verify privacy

After enabling privacy, search WHOIS/RDAP and confirm personal email and address are not listed. If they are, contact registrar support — the privacy add-on may not have applied.

---

## Point the domain at Cloudflare Pages

Hosting project name: `onesixtwo` (see `wrangler.toml`).

### 1. Add custom domain in Pages

1. Cloudflare Dashboard → **Workers & Pages** → project **onesixtwo** → **Custom domains**.
2. Add **onesixtytwo.win**.
3. Optionally add **www.onesixtytwo.win** and set a redirect (www → apex or apex → www — pick one canonical host).

### 2. DNS records (zone on Cloudflare)

If the zone **onesixtytwo.win** is on Cloudflare:

| Type  | Name | Content              | Proxy |
|-------|------|----------------------|-------|
| CNAME | `@`  | `onesixtwo.pages.dev` | Proxied (orange cloud) |
| CNAME | `www`| `onesixtwo.pages.dev` | Proxied |

Pages may auto-create these when you attach the custom domain.

If DNS lives elsewhere, create the CNAME targets Pages shows in the custom-domain wizard.

### 3. SSL

Cloudflare issues a certificate automatically once DNS resolves and the custom domain is active. Use **Full** or **Full (strict)** SSL mode if you use additional origin rules later; static Pages only needs the default.

### 4. Canonical URL

The app and `index.html` use `https://onesixtytwo.win` as the canonical site URL. After DNS propagates, open the live site and smoke-test draft → result → copy share text (should include `onesixtytwo.win`).

---

## Checklist

- [ ] WHOIS privacy / redaction enabled at registrar
- [ ] WHOIS lookup shows no personal email or home address
- [ ] Custom domain attached to Pages project `onesixtwo`
- [ ] HTTPS works on `https://onesixtytwo.win`
- [ ] Share text and meta tags reference `onesixtytwo.win`
