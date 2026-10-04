import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { load } from 'cheerio';
import sharp from 'sharp';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, '..');
const outputRoot = path.join(root, 'public-src');
const mediaPattern = /\.(?:avif|gif|jpe?g|m4v|mov|mp4|png|webm|webp)$/i;
const imagePattern = /\.(?:jpe?g|png)$/i;
const maxCloudflareFileSize = 25 * 1024 * 1024;

const sourceFiles = {
  html: path.join(root, 'portfolio (22).html'),
  projects: path.join(root, 'portfolio-projects.js'),
  site: path.join(root, 'portfolio-site-content.js'),
  redesign: path.join(root, 'portfolio-redesign.js'),
  experience: path.join(root, 'portfolio-experience.js'),
  experienceCss: path.join(root, 'css', 'portfolio-experience.css')
};

function assertWithin(base, candidate) {
  const resolvedBase = path.resolve(base);
  const resolvedCandidate = path.resolve(candidate);
  const relative = path.relative(resolvedBase, resolvedCandidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Refusing to access a path outside ${resolvedBase}: ${resolvedCandidate}`);
  }
  return resolvedCandidate;
}

async function ensureSourceFiles() {
  for (const [label, filename] of Object.entries(sourceFiles)) {
    try {
      await fs.access(filename);
    } catch {
      throw new Error(`Missing ${label} source file: ${filename}`);
    }
  }
}

async function loadWindowData(filename) {
  const source = await fs.readFile(filename, 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox, { filename });
  return JSON.parse(JSON.stringify(sandbox.window));
}

function routeKeyForProject(project) {
  const text = `${project?.category || ''} ${(project?.sections || []).join(' ')} ${(project?.tags || []).join(' ')}`.toLowerCase();
  if (text.includes('xr') || text.includes('vr') || text.includes('unreal') || text.includes('spatial') || text.includes('immersive') || text.includes('training simulation')) return 'xr';
  if (text.includes('3d') || text.includes('cgi') || text.includes('render')) return 'cgi';
  if (text.includes('motion') || text.includes('video') || text.includes('vfx') || text.includes('reel') || text.includes('logo')) return 'motion';
  if (/development|developer|website|web app|frontend|front-end|backend|full-stack|software|javascript|typescript|react|python|api|interactive prototype/.test(text)) return 'development';
  return 'work';
}

function navIdForProject(project) {
  return {
    xr: 'nav-uiux-xr',
    cgi: 'nav-3d-lab',
    motion: 'nav-motion',
    development: 'nav-development',
    work: 'nav-case-studies'
  }[routeKeyForProject(project)];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeMediaReference(value) {
  if (typeof value !== 'string') return null;
  const withoutQuery = value.trim().split(/[?#]/, 1)[0].replaceAll('\\', '/');
  if (!withoutQuery || /^(?:[a-z]+:|\/\/|data:|blob:|#)/i.test(withoutQuery)) return null;
  const normalized = withoutQuery.replace(/^\.\//, '').replace(/^\//, '');
  if (!mediaPattern.test(normalized)) return null;
  return normalized;
}

function collectMediaReferences(value, references = new Set()) {
  if (typeof value === 'string') {
    const media = normalizeMediaReference(value);
    if (media) references.add(media);
    return references;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectMediaReferences(item, references);
    return references;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectMediaReferences(item, references);
  }
  return references;
}

function rewriteMediaReferences(value, replacements) {
  if (typeof value === 'string') {
    const normalized = normalizeMediaReference(value);
    if (!normalized || !replacements.has(normalized)) return value;
    const prefix = value.trim().startsWith('./') ? './' : value.trim().startsWith('/') ? '/' : '';
    return `${prefix}${replacements.get(normalized)}`;
  }
  if (Array.isArray(value)) return value.map(item => rewriteMediaReferences(item, replacements));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewriteMediaReferences(item, replacements)]));
  }
  return value;
}

function projectRouteIsEnabled(project, navigation) {
  return navigation[routeKeyForProject(project)] !== false;
}

function routeIsEnabled(route, navigation, publicBySlug, aliases) {
  const fixedRoutes = {
    home: 'home',
    work: 'work',
    'case-studies': 'work',
    motion: 'motion',
    '3d-lab': 'cgi',
    'uiux-xr': 'xr',
    development: 'development',
    about: 'about',
    contact: 'contact',
    store: 'store',
    assets: 'store'
  };
  const fixedKey = fixedRoutes[route];
  if (fixedKey) return navigation[fixedKey] !== false;
  if (/^(?:product|asset)\//.test(route)) return navigation.store !== false;
  const resolved = aliases[route] || route;
  return publicBySlug.has(resolved);
}

function sanitizeSiteContent(siteContent, navigation, publicSlugs) {
  const result = clone(siteContent);
  const domainRoute = { uiux: 'xr', '3d': 'cgi', motion: 'motion', development: 'development' };

  result.navigation = { ...result.navigation, ...navigation };
  result.navigationVisibility = result.navigationVisibility || {};
  for (const key of Object.keys(navigation)) {
    if (navigation[key] === false) result.navigationVisibility[key] = false;
  }

  result.home = result.home || {};
  result.home.domainVisibility = result.home.domainVisibility || {};
  for (const [domain, routeKey] of Object.entries(domainRoute)) {
    result.home.domainVisibility[domain] = navigation[routeKey] !== false && result.home.domainVisibility[domain] !== false;
  }
  result.home.featuredProjectSlugs = (result.home.featuredProjectSlugs || []).filter(slug => publicSlugs.has(slug));
  result.home.domainProjectSlugs = Object.fromEntries(
    Object.entries(result.home.domainProjectSlugs || {})
      .filter(([domain]) => navigation[domainRoute[domain]] !== false)
      .map(([domain, slugs]) => [domain, slugs.filter(slug => publicSlugs.has(slug))])
  );

  const pageRoute = { work: 'work', motion: 'motion', cgi: 'cgi', xr: 'xr', development: 'development' };
  result.portfolioPages = Object.fromEntries(
    Object.entries(result.portfolioPages || {})
      .filter(([key]) => navigation[pageRoute[key]] !== false)
      .map(([key, page]) => {
        const nextPage = { ...page };
        if (nextPage.heroProjectSlug && !publicSlugs.has(nextPage.heroProjectSlug)) {
          nextPage.heroProjectSlug = result.home.featuredProjectSlugs[0] || '';
        }
        return [key, nextPage];
      })
  );
  result.contact = { ...(result.contact || {}), endpoint: '' };
  return result;
}

function buildStaticPages(navigation, projectCount) {
  const pages = {};
  if (navigation.home !== false) pages.home = { id: 'page-home', title: 'Workspace', nav: 'nav-home' };
  if (navigation.work !== false) {
    pages.work = { id: 'page-case-studies', title: 'Work', nav: 'nav-case-studies' };
    pages['case-studies'] = pages.work;
  }
  if (navigation.motion !== false) pages.motion = { id: 'page-motion', title: 'Motion / Video', nav: 'nav-motion' };
  if (navigation.cgi !== false) pages['3d-lab'] = { id: 'page-3d-lab', title: '3D / CGI', nav: 'nav-3d-lab' };
  if (navigation.xr !== false) pages['uiux-xr'] = { id: 'page-uiux-xr', title: 'XR', nav: 'nav-uiux-xr' };
  if (navigation.development !== false) pages.development = { id: 'page-development', title: 'Development', nav: 'nav-development' };
  if (navigation.store !== false) {
    pages.store = { id: 'page-assets', title: 'Asset Store', nav: 'nav-assets' };
    pages.assets = pages.store;
  }
  if (navigation.about !== false) pages.about = { id: 'page-about', title: 'About', nav: 'nav-about' };
  if (navigation.contact !== false) pages.contact = { id: 'page-contact', title: 'Contact', nav: 'nav-contact' };
  if (projectCount) pages['project-detail'] = { id: 'page-project-detail', title: 'Case Study', nav: 'nav-case-studies' };
  return pages;
}

function pruneHtml(source, navigation, navigationVisibility, siteContent, staticPages) {
  const $ = load(source, { decodeEntities: false });

  $('script[src*="cdn.tailwindcss.com"]').remove();
  $('script').filter((_, element) => $(element).html()?.includes('tailwind.config =')).remove();
  $('head').append('<link href="./css/tailwind.css" rel="stylesheet">');

  if (navigation.store === false) {
    $('script[src*="lemonsqueezy.com"]').remove();
    $('script[src*="portfolio-assets.js"]').remove();
    $('script[src*="portfolio-store.js"]').remove();
    $('link[href*="portfolio-store.css"]').remove();
    $('#page-assets, #page-asset-detail, #page-legal').remove();
  }

  const routeDom = {
    home: { nav: '#nav-home', page: '#page-home' },
    work: { nav: '#nav-case-studies', page: '#page-case-studies' },
    motion: { nav: '#nav-motion', page: '#page-motion', domain: 'motion' },
    cgi: { nav: '#nav-3d-lab', page: '#page-3d-lab', domain: '3d' },
    xr: { nav: '#nav-uiux-xr', page: '#page-uiux-xr', domain: 'uiux' },
    development: { nav: '#nav-development', page: '#page-development', domain: 'development' },
    store: { nav: '#nav-assets' },
    about: { nav: '#nav-about', page: '#page-about' },
    contact: { nav: '#nav-contact', page: '#page-contact' }
  };

  for (const [key, selectors] of Object.entries(routeDom)) {
    const enabled = navigation[key] !== false;
    const iconVisible = enabled && navigationVisibility[key] !== false;
    if (!iconVisible && selectors.nav) $(selectors.nav).remove();
    if (!enabled && selectors.page) $(selectors.page).remove();
    if (selectors.domain && (!enabled || siteContent.home?.domainVisibility?.[selectors.domain] === false)) {
      $(`[data-domain="${selectors.domain}"]`).remove();
    }
  }

  $('[onclick]').each((_, element) => {
    const handler = $(element).attr('onclick') || '';
    const match = handler.match(/navigate\(['"]([^'"]+)['"]\)/);
    if (match && !Object.hasOwn(staticPages, match[1])) $(element).remove();
  });

  if (!$('link[rel="icon"]').length) $('head').append('<link rel="icon" href="./favicon.png" type="image/png">');
  const serialized = $.html();
  const pageBlock = /  const pages = \{[\s\S]*?\n  \};\n\n  function navForProject/;
  if (!pageBlock.test(serialized)) throw new Error('Could not locate the inline route map in the portfolio HTML.');
  return serialized.replace(
    pageBlock,
    `  const pages = ${JSON.stringify(staticPages, null, 2)};\n\n  function navForProject`
  );
}

function collectHtmlMedia(html, references) {
  const $ = load(html, { decodeEntities: false });
  $('[src], [poster], meta[content]').each((_, element) => {
    for (const attribute of ['src', 'poster', 'content']) {
      const media = normalizeMediaReference($(element).attr(attribute));
      if (media) references.add(media);
    }
  });
}

function rewriteHtmlMedia(html, replacements) {
  let output = html;
  const ordered = [...replacements.entries()].sort(([left], [right]) => right.length - left.length);
  for (const [source, destination] of ordered) {
    output = output.replaceAll(`./${source}`, `./${destination}`);
    output = output.replaceAll(`/${source}`, `/${destination}`);
    output = output.replaceAll(source, destination);
  }
  return output;
}

async function copyFile(source, destination) {
  assertWithin(root, source);
  assertWithin(outputRoot, destination);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(source, destination);
}

async function publishMedia(reference, destinationReference) {
  const source = assertWithin(root, path.join(root, reference));
  const destination = assertWithin(outputRoot, path.join(outputRoot, destinationReference));
  const stats = await fs.stat(source).catch(() => null);
  if (!stats?.isFile()) throw new Error(`Published content references a missing media file: ${reference}`);
  await fs.mkdir(path.dirname(destination), { recursive: true });

  if (imagePattern.test(reference)) {
    await sharp(source)
      .rotate()
      .resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 84, effort: 5, smartSubsample: true })
      .toFile(destination);
  } else {
    if (stats.size >= maxCloudflareFileSize) {
      throw new Error(`Published media exceeds Cloudflare Pages' 25 MiB file limit: ${reference}`);
    }
    await fs.copyFile(source, destination);
  }

  const outputStats = await fs.stat(destination);
  if (outputStats.size >= maxCloudflareFileSize) {
    throw new Error(`Generated media exceeds Cloudflare Pages' 25 MiB file limit: ${destinationReference}`);
  }
  return outputStats.size;
}

async function main() {
  await ensureSourceFiles();
  const projectWindow = await loadWindowData(sourceFiles.projects);
  const siteWindow = await loadWindowData(sourceFiles.site);
  const originalSiteContent = siteWindow.PORTFOLIO_SITE_CONTENT || {};
  const navigation = { ...(originalSiteContent.navigation || {}) };
  if (navigation.store === false) {
    for (const key of ['storeFreeAssets', 'storeLicensing', 'storeTerms', 'storePrivacy']) navigation[key] = false;
  }
  const navigationVisibility = { ...(originalSiteContent.navigationVisibility || {}) };
  const allProjects = projectWindow.PORTFOLIO_PROJECTS || [];
  const publicProjects = allProjects.filter(project => projectRouteIsEnabled(project, navigation));
  const publicSlugs = new Set(publicProjects.map(project => project.slug));
  const publicBySlug = new Map(publicProjects.map(project => [project.slug, project]));
  const aliases = Object.fromEntries(
    Object.entries(projectWindow.PORTFOLIO_PROJECT_ALIASES || {}).filter(([, slug]) => publicSlugs.has(slug))
  );

  const categoryRoute = { motion: 'motion', cgi: 'cgi', uiux: 'xr', development: 'development' };
  const categorySections = Object.fromEntries(
    Object.entries(projectWindow.PORTFOLIO_CATEGORY_SECTIONS || {})
      .filter(([category]) => navigation[categoryRoute[category]] !== false)
      .map(([category, sections]) => [category, sections
        .map(section => ({ ...section, slugs: (section.slugs || []).filter(slug => publicSlugs.has(slug)) }))
        .filter(section => section.slugs.length)])
  );

  const domainRoute = { uiux: 'xr', '3d': 'cgi', motion: 'motion', development: 'development' };
  const homeDomainData = Object.fromEntries(
    Object.entries(projectWindow.PORTFOLIO_HOME_DOMAIN_DATA || {})
      .filter(([domain]) => navigation[domainRoute[domain]] !== false && originalSiteContent.home?.domainVisibility?.[domain] !== false)
      .map(([domain, data]) => [domain, {
        ...data,
        cards: (data.cards || []).filter(card => routeIsEnabled(card.nav, navigation, publicBySlug, aliases)),
        projects: (data.projects || []).filter(project => publicSlugs.has(project.nav))
      }])
  );

  const siteContent = sanitizeSiteContent(originalSiteContent, navigation, publicSlugs);
  const staticPages = buildStaticPages(navigation, publicProjects.length);
  let html = pruneHtml(
    await fs.readFile(sourceFiles.html, 'utf8'),
    navigation,
    navigationVisibility,
    siteContent,
    staticPages
  );

  const mediaReferences = collectMediaReferences([publicProjects, homeDomainData, siteContent]);
  collectHtmlMedia(html, mediaReferences);
  const replacements = new Map();
  for (const reference of mediaReferences) {
    const destination = imagePattern.test(reference) ? reference.replace(imagePattern, '.webp') : reference;
    if ([...replacements.values()].includes(destination) && replacements.get(reference) !== destination) {
      throw new Error(`Two media files would produce the same public path: ${destination}`);
    }
    replacements.set(reference, destination);
  }

  const publishedProjects = rewriteMediaReferences(publicProjects, replacements);
  const publishedHomeDomainData = rewriteMediaReferences(homeDomainData, replacements);
  const publishedSiteContent = rewriteMediaReferences(siteContent, replacements);
  html = rewriteHtmlMedia(html, replacements);

  const safeOutputRoot = assertWithin(root, outputRoot);
  await fs.rm(safeOutputRoot, { recursive: true, force: true });
  await fs.mkdir(path.join(outputRoot, 'css'), { recursive: true });

  const projectData = `(() => {\n  const projects = ${JSON.stringify(publishedProjects, null, 2)};\n  const bySlug = Object.fromEntries(projects.map(project => [project.slug, project]));\n  window.PORTFOLIO_PROJECTS = projects;\n  window.PORTFOLIO_PROJECT_BY_SLUG = bySlug;\n  window.PORTFOLIO_PROJECT_ALIASES = ${JSON.stringify(aliases, null, 2)};\n  window.PORTFOLIO_CATEGORY_SECTIONS = ${JSON.stringify(categorySections, null, 2)};\n  window.PORTFOLIO_HOME_DOMAIN_DATA = ${JSON.stringify(publishedHomeDomainData, null, 2)};\n})();\n`;
  const siteData = `window.PORTFOLIO_SITE_CONTENT = ${JSON.stringify(publishedSiteContent, null, 2)};\n`;

  await fs.writeFile(path.join(outputRoot, 'index.html'), html, 'utf8');
  await fs.writeFile(path.join(outputRoot, 'portfolio-projects.js'), projectData, 'utf8');
  await fs.writeFile(path.join(outputRoot, 'portfolio-site-content.js'), siteData, 'utf8');
  await fs.writeFile(path.join(outputRoot, 'css', 'tailwind.input.css'), '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n', 'utf8');
  let redesignSource = await fs.readFile(sourceFiles.redesign, 'utf8');
  if (navigation.motion === false) {
    redesignSource = redesignSource.replace(
      /    if \(kind === 'motion'\) \{[\s\S]*?\n    \}\n\n    html \+= list/,
      '    html += list'
    );
  }
  await fs.writeFile(path.join(outputRoot, 'portfolio-redesign.js'), redesignSource, 'utf8');
  await copyFile(sourceFiles.experience, path.join(outputRoot, 'portfolio-experience.js'));
  await copyFile(sourceFiles.experienceCss, path.join(outputRoot, 'css', 'portfolio-experience.css'));

  let mediaBytes = 0;
  for (const [reference, destination] of replacements) {
    mediaBytes += await publishMedia(reference, destination);
  }

  const faviconSource = publishedSiteContent.about?.portrait || publishedSiteContent.seo?.socialImage;
  if (faviconSource) {
    const portrait = assertWithin(outputRoot, path.join(outputRoot, normalizeMediaReference(faviconSource)));
    await sharp(portrait).resize(96, 96, { fit: 'cover' }).png().toFile(path.join(outputRoot, 'favicon.png'));
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    enabledRoutes: Object.entries(navigation).filter(([, enabled]) => enabled !== false).map(([key]) => key),
    projects: publicProjects.map(project => ({ slug: project.slug, route: routeKeyForProject(project) })),
    mediaFiles: replacements.size,
    mediaBytes
  };
  await fs.writeFile(path.join(outputRoot, '.publish-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  const hiddenCount = allProjects.length - publicProjects.length;
  console.log(`Public export created with ${publicProjects.length} projects and ${replacements.size} media files.`);
  console.log(`${hiddenCount} project(s) on disabled routes were excluded from the export.`);
  console.log(`Optimized public media: ${(mediaBytes / 1024 / 1024).toFixed(2)} MiB.`);
}

main().catch(error => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
