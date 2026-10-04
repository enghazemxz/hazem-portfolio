# Portfolio Deployment

## Production

- Framework: plain HTML, CSS, and JavaScript
- Package manager: npm
- Install: `npm ci`
- Public export: `npm run export:public`
- Production build: `npm run build`
- Validation: `npm run validate`
- Output directory: `dist`
- Cloudflare Pages project: `hazem-portfolio` (create during the one-time Git connection)
- Production branch: `main`
- Production URL: assigned by Cloudflare after the first deployment
- GitHub repository: `https://github.com/enghazemxz/hazem-portfolio`

## Architecture

The Python dashboard and editable local source stay on this computer. `npm run export:public` reads that source and regenerates `public-src/` with only dashboard-enabled routes, projects, and referenced media. Disabled routes such as Motion/Reels are removed from project data, navigation, Git, and the deployment output. Visible images are converted to optimized WebP files during export.

Git tracks the sanitized `public-src/`, deployment scripts, tests, and the Cloudflare Function. Cloudflare runs `npm run build` and publishes `dist/`. A Pages Function at `/contact/submit` validates inquiries and asks Resend to deliver them; no email credential is shipped to the browser.

## Cloudflare Settings

- Repository: `hazem-portfolio`
- Production branch: `main`
- Root directory: `/`
- Build command: `npm run build`
- Build output directory: `dist`
- Node version: `22`

Add these encrypted Pages variables for both Preview and Production:

- `RESEND_API_KEY`: Resend API key
- `CONTACT_TO_EMAIL`: destination inbox
- `CONTACT_FROM_EMAIL`: verified sender, for example `Portfolio <hello@your-domain.com>`
- `CONTACT_SUCCESS_MESSAGE`: optional success message

Resend requires a verified sending domain. Until the three required variables are configured, the form returns a clear temporary-unavailable response and sends nothing.

## One-Time Cloudflare Connection

Wrangler is authenticated, but Cloudflare requires the GitHub App installation to be approved in the dashboard before it can read a repository. Do not create a Direct Upload Pages project; that project type cannot later switch to Git integration.

1. Open **Workers & Pages** in Cloudflare and choose **Create application**.
2. Choose **Pages**, then **Connect to Git**.
3. Install/authorize **Cloudflare Workers and Pages** for `enghazemxz/hazem-portfolio` and select that repository.
4. Set project name `hazem-portfolio`, production branch `main`, build command `npm run build`, output directory `dist`, and leave root directory empty.
5. Add `NODE_VERSION=22` plus the contact variables above, then save and deploy.

This creates the first HTTPS deployment and enables automatic production deployments from `main`.

## Publishing Updates

After editing in the local dashboard:

```powershell
npm run export:public
git add .
git commit -m "Update portfolio"
git push
```

Cloudflare Pages then builds and deploys `main` automatically. Always review `.publish-manifest.json` and `git status` before committing when route visibility changed.

## Hidden Content

`public-src/.publish-manifest.json` lists every route and project included in the next deployment. A project whose card is hidden but whose route remains enabled is still exported for direct URL access. A disabled route is excluded completely, including its project data and media.

## Contact Security

The form uses same-origin checks, a honeypot, size limits, server-side validation, HTML escaping, and server-only Resend credentials. It does not yet have durable distributed rate limiting or CAPTCHA. Add Cloudflare Turnstile or a rate-limit binding later if automated abuse becomes a problem.

## Custom Domain

In Cloudflare Pages, open **Custom domains**, choose **Set up a domain**, and enter the portfolio hostname. If the domain already uses Cloudflare DNS, the record is created automatically. Keep the generated `pages.dev` address active as a fallback and do not hard-code either hostname in the site.
