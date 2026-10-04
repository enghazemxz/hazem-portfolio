import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(root, 'public-src');
const outputRoot = path.join(root, 'dist');
const maximumFileSize = 25 * 1024 * 1024;

function assertExactChild(base, candidate, expectedName) {
  const resolved = path.resolve(candidate);
  if (path.dirname(resolved) !== path.resolve(base) || path.basename(resolved) !== expectedName) {
    throw new Error(`Refusing to modify unexpected output directory: ${resolved}`);
  }
  return resolved;
}

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(fullPath));
    if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

function readWindowData(source, filename) {
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox, { filename });
  return sandbox.window;
}

function routeKeyForProject(project) {
  const text = `${project?.category || ''} ${(project?.sections || []).join(' ')} ${(project?.tags || []).join(' ')}`.toLowerCase();
  if (text.includes('xr') || text.includes('vr') || text.includes('unreal') || text.includes('spatial') || text.includes('immersive') || text.includes('training simulation')) return 'xr';
  if (text.includes('3d') || text.includes('cgi') || text.includes('render')) return 'cgi';
  if (text.includes('motion') || text.includes('video') || text.includes('vfx') || text.includes('reel') || text.includes('logo')) return 'motion';
  if (/development|developer|website|web app|frontend|front-end|backend|full-stack|software|javascript|typescript|react|python|api|interactive prototype/.test(text)) return 'development';
  return 'work';
}

async function validatePublicSource() {
  const required = ['index.html', 'portfolio-projects.js', 'portfolio-site-content.js'];
  for (const filename of required) await fs.access(path.join(sourceRoot, filename));

  const projectSource = await fs.readFile(path.join(sourceRoot, 'portfolio-projects.js'), 'utf8');
  const siteSource = await fs.readFile(path.join(sourceRoot, 'portfolio-site-content.js'), 'utf8');
  const projectWindow = readWindowData(projectSource, 'public-src/portfolio-projects.js');
  const siteWindow = readWindowData(siteSource, 'public-src/portfolio-site-content.js');
  const navigation = siteWindow.PORTFOLIO_SITE_CONTENT?.navigation || {};

  if (navigation.motion === false && Object.hasOwn(projectWindow.PORTFOLIO_CATEGORY_SECTIONS || {}, 'motion')) {
    throw new Error('The public export contains Motion sections while the Motion route is disabled.');
  }
  for (const project of projectWindow.PORTFOLIO_PROJECTS || []) {
    const routeKey = routeKeyForProject(project);
    if (navigation[routeKey] === false) {
      throw new Error(`The public export contains a project assigned to disabled route: ${routeKey}`);
    }
  }
  if (navigation.store === false) {
    for (const filename of ['portfolio-assets.js', 'portfolio-store.js', 'css/portfolio-store.css']) {
      try {
        await fs.access(path.join(sourceRoot, filename));
        throw new Error(`The public export contains disabled Store code: ${filename}`);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
  }

  for (const filename of await walk(sourceRoot)) {
    const stats = await fs.stat(filename);
    if (stats.size >= maximumFileSize) {
      throw new Error(`File exceeds Cloudflare Pages' 25 MiB limit: ${path.relative(root, filename)}`);
    }
  }
}

async function main() {
  await validatePublicSource();
  const safeOutput = assertExactChild(root, outputRoot, 'dist');
  await fs.rm(safeOutput, { recursive: true, force: true });
  await fs.cp(sourceRoot, outputRoot, {
    recursive: true,
    filter: source => path.basename(source) !== '.publish-manifest.json' && path.basename(source) !== 'tailwind.input.css'
  });

  await fs.writeFile(path.join(outputRoot, '404.html'), `<!doctype html>
<html lang="en" class="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex">
  <title>Page not found | Hazem Essam</title>
  <style>html{color-scheme:dark}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b1326;color:#dae2fd;font-family:Arial,sans-serif}.wrap{width:min(560px,calc(100% - 48px));border-top:1px solid #645af6;padding-top:28px}p{color:#c7c4d7;line-height:1.7}a{display:inline-block;margin-top:12px;color:#c4c0ff;font-weight:700;text-underline-offset:4px}a:focus-visible{outline:2px solid #c4c0ff;outline-offset:4px}</style>
</head>
<body><main class="wrap"><small>HAZEM ESSAM PORTFOLIO</small><h1>Page not found</h1><p>This route is not currently published.</p><a href="/">Return to the portfolio</a></main></body>
</html>
`, 'utf8');
  await fs.writeFile(path.join(outputRoot, '_headers'), `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  Cross-Origin-Opener-Policy: same-origin
  Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'

/media/*
  Cache-Control: public, max-age=31536000, immutable

/*.js
  Cache-Control: public, max-age=3600, must-revalidate

/css/*
  Cache-Control: public, max-age=3600, must-revalidate
`, 'utf8');
  console.log('Validated and copied the sanitized public export to dist/.');
}

main().catch(error => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
