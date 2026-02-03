
# IR Dashboard

https://<your-username>.github.io/ir-dashboard/

This repository hosts the static Interactive Reports (IR) dashboard. The project is already built and can be served by any basic HTTP server without additional tooling or external providers.

## Local preview

Use any static file server to view the dashboard locally, for example:

```bash
python -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000) in your browser. The entry point is `index.html`, and the supporting assets live under `assets/` and `data/`.

## Deploying to GitHub Pages

Because everything is static, you can host the dashboard on GitHub Pages. Enable GitHub Pages for the repository (Settings → Pages), select the `main` branch root as the source, and GitHub will publish the site at the URL above. The repository already includes a `.nojekyll` file, so Pages will serve the assets exactly as they are.
