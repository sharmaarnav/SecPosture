# SecPosture

**SecPosture** is a free, client-side cloud security posture assessment tool. Answer 30 questions across 6 security domains and receive an instant scored report — no backend, no data collection, no sign-up required.

Live at: [secposture.arnav.au](https://secposture.arnav.au)

Part of the [arnav.au security tools](https://arnav.au/tools/) suite alongside [SecFrame](https://secframe.arnav.au) and [SecPolicy](https://secpolicy.arnav.au).

---

## What SecPosture Does

- Guides you through a 30-question security questionnaire covering:
  - Identity & Access (6 questions)
  - Network Security (5 questions)
  - Data Protection (5 questions)
  - Logging & Monitoring (5 questions)
  - Vulnerability Management (5 questions)
  - Governance & Compliance (4 questions)
- Supports Azure, AWS, GCP, and Multi-Cloud
- Scores each domain with a RAG (Red / Amber / Green) rating
- Surfaces Quick Wins (critical controls not yet implemented)
- Provides remediation guidance for each gap
- Optionally generates an AI executive summary using your Anthropic API key
- Downloads a plain-text report

All processing is done in the browser. No data leaves your device (except the optional API call to Anthropic).

---

## Run Locally

No build step required. Just open the file:

```
open index.html
```

Or serve with any local static server:

```bash
npx serve .
# or
python3 -m http.server 8080
```

Then open `http://localhost:8080` in your browser.

> Note: The `fetch('data/questions.json')` call requires a server context. It will not work on `file://` in browsers that block local file fetches (Chrome). Use `python3 -m http.server` or similar.

---

## Deploy to GitHub Pages

1. Push this repository to GitHub (e.g. `github.com/sharmaarnav/secposture`)
2. Go to **Settings → Pages**
3. Set **Source** to `main` branch, root folder `/`
4. GitHub Pages will publish the site and pick up the `CNAME` file automatically

The site will be available at `https://sharmaarnav.github.io/secposture` (and at your custom domain once DNS is configured).

---

## Custom Domain via Cloudflare

To point `secposture.arnav.au` at GitHub Pages, add this DNS record in Cloudflare:

| Field  | Value                       |
|--------|-----------------------------|
| Type   | CNAME                       |
| Name   | `secposture`                |
| Target | `sharmaarnav.github.io`     |
| Proxy  | DNS only (grey cloud — **not** proxied) |

> Important: set to **DNS only** (grey cloud). Proxied (orange cloud) can interfere with GitHub Pages SSL certificate provisioning.

The `CNAME` file in this repo (`secposture.arnav.au`) is already committed and will be picked up by GitHub Pages automatically.

---

## Embed in WordPress via iframe

Add a **Custom HTML** block in the Gutenberg editor and paste:

```html
<iframe 
  src="https://secposture.arnav.au" 
  width="100%" 
  height="900" 
  frameborder="0" 
  scrolling="auto"
  title="SecPosture — Cloud Security Posture Checker by arnav.au"
  loading="lazy">
</iframe>
```

---

## Auto-Resize iframe Height (WordPress)

SecPosture broadcasts its scroll height via `postMessage` so WordPress can dynamically resize the iframe as the user moves between screens.

Add the following script to your WordPress page — either in a **Custom HTML** block or via a theme/plugin script injection:

```html
<script>
window.addEventListener('message', function(e) {
  if (e.origin !== 'https://secposture.arnav.au') return;
  if (e.data && e.data.type === 'resize') {
    var iframe = document.querySelector('iframe[src*="secposture.arnav.au"]');
    if (iframe) iframe.style.height = e.data.height + 'px';
  }
});
</script>
```

Place this script on the same page as the iframe embed. The iframe will automatically grow and shrink as users navigate between the welcome screen, questionnaire, and results.

---

## AI Summary Feature

SecPosture can generate an AI executive summary using Claude (by Anthropic).

1. Complete the questionnaire and view your results
2. Click **Generate AI Summary**
3. Enter your [Anthropic API key](https://console.anthropic.com/settings/keys) (starts with `sk-ant-`)
4. Click **Generate**

Claude will produce:
- A 3-paragraph executive summary of your security posture
- Top 5 prioritised remediation actions with effort estimates

**Privacy:** Your API key is used client-side only. It is held in memory for the duration of the request and is never stored, logged, or transmitted anywhere other than `api.anthropic.com`.

---

## Related Tools

- [SecFrame](https://secframe.arnav.au) — Cloud security control framework and reference library
- [SecPolicy](https://secpolicy.arnav.au) — Security policy templates for cloud environments

---

## License

Free to use. No data is collected or stored.

© 2026 [arnav.au](https://arnav.au)
