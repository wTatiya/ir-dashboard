# IR Dashboard on Cloudflare Pages

This repository hosts the static Interactive Reports (IR) dashboard. The project is configured for deployment on Cloudflare Pages and now also includes a minimal Worker wrapper so environments that call `wrangler deploy` (instead of the Pages-specific `wrangler pages deploy`) succeed. The Pages-specific settings live in `wrangler.pages.toml`, leaving `wrangler.toml` free for Worker/Assets deployments.

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
3. Set the **Build command** to `npm run deploy` (or `npx wrangler pages deploy . --config wrangler.pages.toml`) so the Pages-specific deploy command and config file are used.
4. Set the **Build output directory** to `.` (the project is already pre-built).
5. Trigger a deployment; Cloudflare Pages will serve `index.html` and the static assets under `assets/` and `data/`.

If your CI/CD platform insists on running `wrangler deploy` (a Workers-only command), the included `worker.js` and `wrangler.toml` configuration will deploy the static assets through the Workers Assets feature instead of failing. Pages deployments remain the preferred option, but both commands will now produce a working site.

### Custom CI pipelines

If you are using a CI provider other than GitHub Actions, make sure the deploy step runs the Pages-specific command instead of `wrangler deploy`:

```bash
npm run deploy -- --project-name "$CLOUDFLARE_PROJECT_NAME"
```

Provide the same environment variables used in `.github/workflows/deploy.yml` so authentication and targeting behave identically:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN` (with Pages deploy permissions)
- `CLOUDFLARE_PROJECT_NAME`

With those values set, the pipeline will deploy the repository contents through Cloudflare Pages successfully.

### GitHub Actions deployment

This repository includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that deploys the current branch to Cloudflare Pages using the correct `wrangler pages deploy` command and config file. To enable it, add these repository secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN` (with permission to create Pages deployments)
- `CLOUDFLARE_PROJECT_NAME` (the target Pages project)

Once configured, pushes to `main` (or manual workflow dispatches) will automatically deploy the static site without hitting the Workers-only `wrangler deploy` command.
