
# IR Dashboard

https://ir-dashboard-05518960-e4d31.web.app/

This repository hosts the static Interactive Reports (IR) dashboard. The project is already built and can be served by any basic HTTP server without additional tooling or external providers.

## Local preview

Use any static file server to view the dashboard locally, for example:

```bash
python -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000) in your browser. The entry point is `index.html`, and the supporting assets live under `assets/` and `data/`.

## Deploying

Because everything is static, you can host the dashboard on any platform that serves static files (e.g., GitHub Pages, Netlify, an S3 bucket, or an internal web server). Upload the repository contents and configure the host to serve `index.html` as the default document.
