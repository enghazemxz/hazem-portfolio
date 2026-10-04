# Portfolio Deployment

## Production

- Framework: plain HTML, CSS, and JavaScript
- Package manager: npm
- Install: `npm ci`
- Public export: `npm run export:public`
- Production build: `npm run build`
- Validation: `npm run validate`
- Output directory: `dist`
- Cloudflare Worker: `hazem-portfolio`
- Production branch: `main`
- Production URL: `https://hazem-portfolio.hazemtube1.workers.dev`
- GitHub repository: `https://github.com/enghazemxz/hazem-portfolio`

## Architecture

The Python dashboard and editable local source stay on this computer. `npm run export:public` reads that source and regenerates `public-src/` with only dashboard-enabled routes, projects, and referenced media. Disabled routes such as Motion/Reels are removed from project data, navigation, Git, and the deployment output. Visible images are converted to optimized WebP files during export.

Git tracks the sanitized `public-src/`, deployment scripts, tests, and the Cloudflare Worker. Cloudflare Workers Builds runs `npm run build` and publishes `dist/` through the static-assets binding. The Worker handles `/contact/submit`, validates inquiries, and asks Resend to deliver them; no email credential is shipped to the browser.

## Cloudflare Settings

- Repository: `hazem-portfolio`
- Production branch: `main`
- Root directory: `/`
- Build command: `npm run build`
- Build output directory: `dist`
- Node version: `22`

Add these encrypted Worker variables for Production:

- `RESEND_API_KEY`: Resend API key
- `CONTACT_TO_EMAIL`: destination inbox
- `CONTACT_FROM_EMAIL`: verified sender, for example `Portfolio <hello@your-domain.com>`
- `CONTACT_SUCCESS_MESSAGE`: optional success message

Resend requires a verified sending domain. Until the three required variables are configured, the form returns a clear temporary-unavailable response and sends nothing.

## Continuous Deployment

Cloudflare Workers Builds is connected to `enghazemxz/hazem-portfolio`. A successful push to `main` starts a production build automatically. Build logs and deployment history are available under **Workers & Pages > hazem-portfolio > Builds**.

## Publishing Updates

After editing in the local dashboard:

```powershell
npm run export:public
git add .
git commit -m "Update portfolio"
git push
```

Cloudflare Workers Builds then deploys `main` automatically. Always review `.publish-manifest.json` and `git status` before committing when route visibility changed.

## Hidden Content

`public-src/.publish-manifest.json` lists every route and project included in the next deployment. A project whose card is hidden but whose route remains enabled is still exported for direct URL access. A disabled route is excluded completely, including its project data and media.

## Contact Security

The form uses same-origin checks, a honeypot, size limits, server-side validation, HTML escaping, and server-only Resend credentials. It does not yet have durable distributed rate limiting or CAPTCHA. Add Cloudflare Turnstile or a rate-limit binding later if automated abuse becomes a problem.

## Custom Domain

In the `hazem-portfolio` Worker, open **Settings > Domains & Routes**, choose **Add > Custom Domain**, and enter the portfolio hostname. If the domain already uses Cloudflare DNS, Cloudflare creates the route and certificate. Keep the `workers.dev` address active as a fallback and do not hard-code either hostname in the site.
