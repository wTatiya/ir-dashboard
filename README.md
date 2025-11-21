# IR Dashboard on Cloudflare Pages

This repository hosts the static Interactive Reports (IR) dashboard. The project is now configured for deployment on Cloudflare Pages.

## Local preview

Use the Cloudflare CLI to run the dashboard locally:

```bash
npm install -g wrangler
wrangler pages dev .
```

## Deploying to Cloudflare Pages

1. Push the repository to GitHub or another Git provider connected to Cloudflare.
2. In the Cloudflare dashboard, create a **Pages** project and select this repository.
3. Set the **Build output directory** to `.` (the project is already pre-built).
4. Trigger a deployment; Cloudflare Pages will serve `index.html` and the static assets under `assets/` and `data/`.
