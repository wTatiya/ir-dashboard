# IR Dashboard on Cloudflare Pages

This repository hosts the static Interactive Reports (IR) dashboard. The project is now configured for deployment on Cloudflare Pages.

## Local preview

Use the Cloudflare CLI to run the dashboard locally:

```bash
npm install
npm run dev
```

## Deploying to Cloudflare Pages

### Manual deployment

1. Push the repository to GitHub or another Git provider connected to Cloudflare.
2. In the Cloudflare dashboard, create a **Pages** project and select this repository.
3. Set the **Build command** to `npm run deploy` (or `npx wrangler pages deploy .`) so the Pages-specific deploy command is used. **Do not** use `wrangler deploy`, which targets Workers and will fail for this Pages project.
4. Set the **Build output directory** to `.` (the project is already pre-built).
5. Trigger a deployment; Cloudflare Pages will serve `index.html` and the static assets under `assets/` and `data/`.

### GitHub Actions deployment

This repository includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that deploys the current branch to Cloudflare Pages using the correct `wrangler pages deploy` command. To enable it, add these repository secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN` (with permission to create Pages deployments)
- `CLOUDFLARE_PROJECT_NAME` (the target Pages project)

Once configured, pushes to `main` (or manual workflow dispatches) will automatically deploy the static site without hitting the Workers-only `wrangler deploy` command.
