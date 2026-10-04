(function () {
  const VIDEO_RE = /\.(mp4|webm|mov|m4v)(?:[?#].*)?$/i;
  const IMAGE_RE = /\.(png|jpe?g|webp|gif|avif|svg)(?:[?#].*)?$/i;
  const NO_DOWNLOAD = 'nodownload noplaybackrate';

  function projects() {
    return Array.isArray(window.PORTFOLIO_PROJECTS) ? window.PORTFOLIO_PROJECTS : [];
  }

  function bySlug() {
    return window.PORTFOLIO_PROJECT_BY_SLUG || {};
  }

  function aliases() {
    return window.PORTFOLIO_PROJECT_ALIASES || {};
  }

  function sections() {
    return window.PORTFOLIO_CATEGORY_SECTIONS || {};
  }

  function pageContent(key, fallback) {
    return { ...(fallback || {}), ...((window.PORTFOLIO_SITE_CONTENT || {}).portfolioPages?.[key] || {}) };
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[ch]));
  }

  function list(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
  }

  function isVideo(path) {
    return VIDEO_RE.test(String(path || '').split('?')[0]);
  }

  function isImage(path) {
    return IMAGE_RE.test(String(path || '').split('?')[0]);
  }

  function withFirstFrame(path) {
    const src = String(path || '');
    if (!src || !isVideo(src) || src.includes('#')) return src;
    return `${src}#t=0.001`;
  }

  function uniqueMedia(items) {
    const seen = new Set();
    return list(items).filter(item => {
      const key = String(item || '').trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function projectForRoute(route) {
    const key = String(route || '').replace(/^#/, '');
    const direct = bySlug()[key];
    if (direct) return direct;
    const alias = aliases()[key];
    return alias ? bySlug()[alias] : null;
  }

  function accentForProject(project) {
    const text = `${project?.category || ''} ${list(project?.sections).join(' ')} ${list(project?.tags).join(' ')}`.toLowerCase();
    if (text.includes('3d') || text.includes('cgi') || text.includes('render')) {
      return { color: '#ecb2ff', soft: 'rgba(236,178,255,0.14)', border: 'rgba(236,178,255,0.24)' };
    }
    if (text.includes('motion') || text.includes('video') || text.includes('vfx') || text.includes('reel') || text.includes('logo')) {
      return { color: '#b5c8df', soft: 'rgba(181,200,223,0.14)', border: 'rgba(181,200,223,0.24)' };
    }
    return { color: '#c4c0ff', soft: 'rgba(196,192,255,0.14)', border: 'rgba(196,192,255,0.24)' };
  }

  function cssVars(accent) {
    return `--accent:${accent.color};--accent-soft:${accent.soft};--accent-border:${accent.border};`;
  }

  function mainMedia(project) {
    return project?.thumbnail || project?.media?.hero || list(project?.media?.gallery)[0] || '';
  }

  function isListed(project) {
    return Boolean(project) && project.showInListings !== false;
  }

  function mediaFrame(path, label, className, options) {
    const opts = options || {};
    const safePath = String(path || '');
    const type = isVideo(safePath) ? 'video' : 'image';
    const poster = type === 'video' ? String(opts.poster || '') : '';
    const posterAttr = poster ? ` poster="${esc(poster)}"` : '';
    const openAttrs = opts.openVideo && type === 'video'
      ? ` data-video-src="${esc(safePath)}" data-video-title="${esc(label)}" data-video-shape="${esc(opts.shape || 'landscape')}"`
      : '';
    const openClass = opts.openVideo && type === 'video' ? ' js-open-video' : '';
    const asset = type === 'video'
      ? `<video class="media-asset" src="${esc(withFirstFrame(safePath))}"${posterAttr} muted loop playsinline preload="metadata" controlsList="${NO_DOWNLOAD}" disablePictureInPicture aria-label="${esc(label)}"></video>`
      : `<img class="media-asset" src="${esc(safePath)}" loading="lazy" decoding="async" alt="${esc(label)}">`;
    return `<div class="media-frame ${esc(className || '')} ${type === 'video' ? 'video-media-frame' : 'image-media-frame'}${openClass}" data-media-type="${type}"${openAttrs}>
      ${safePath ? asset : ''}
      <div class="media-fallback"><span>${esc(label || 'Media preview')}</span><small>${safePath ? 'Media preview unavailable' : 'Media coming soon'}</small></div>
    </div>`;
  }

  function tagList(tags) {
    return list(tags).slice(0, 5).map(tag => `<span>${esc(tag)}</span>`).join('');
  }

  function mediaPoster(project, path) {
    if (!path || !isVideo(path)) return '';
    const media = project?.media || {};
    if (path === media.hero && media.poster) return media.poster;
    if (Array.isArray(media.posters)) {
      const index = list(media.gallery).indexOf(path);
      return index >= 0 ? String(media.posters[index] || '') : '';
    }
    return String(media.posters?.[path] || '');
  }

  function projectCard(project, index, extraClass) {
    if (!isListed(project)) return '';
    const accent = accentForProject(project);
    const size = extraClass || (index === 0 ? 'feature' : index === 1 ? 'tall' : '');
    const media = mainMedia(project);
    const video = isVideo(media) || project.type === 'collection' || project.media?.type === 'video';
    return `<article class="project-card ${esc(size)} ${video ? 'video' : ''}" style="${cssVars(accent)}" data-nav="${esc(project.slug)}" data-filter-tokens="${esc(projectFilterTokens(project))}" role="button" tabindex="0">
      <div class="project-visual">
        ${mediaFrame(media, project.title, 'project-media-frame')}
      </div>
      <div class="project-body">
        <div class="project-meta">${esc(project.category || 'Project')} / ${esc(project.year || '')}</div>
        <h3 class="project-title">${esc(project.title)}</h3>
        <p class="project-desc">${esc(project.description || project.concept || '')}</p>
        <div class="project-tags">${tagList(project.tags)}</div>
        <div class="project-action">Open project <span class="material-symbols-outlined">east</span></div>
      </div>
    </article>`;
  }

  function infoRow(label, value) {
    const content = Array.isArray(value) ? value.join(', ') : value;
    if (!content) return '';
    return `<div class="case-info-row"><div class="case-info-label">${esc(label)}</div><div class="case-info-value">${esc(content)}</div></div>`;
  }

  function processCards(process) {
    return list(process).map(step => `<div class="process-card"><strong>${esc(step.title)}</strong><span>${esc(step.description)}</span></div>`).join('');
  }

  function renderShell(kicker, title, copy, stats, bodyClass) {
    return `<div class="portfolio-shell nav-projects-first ${esc(bodyClass || '')}">
      <section class="portfolio-hero">
        <div>
          <div class="portfolio-kicker">${esc(kicker)}</div>
          <h2 class="portfolio-title">${esc(title)}</h2>
        </div>
        <div>
          <p class="portfolio-copy">${esc(copy)}</p>
          <div class="portfolio-stat-grid">
            ${(stats || []).map(stat => `<div class="portfolio-stat"><strong>${esc(stat.value)}</strong><span>${esc(stat.label)}</span></div>`).join('')}
          </div>
        </div>
      </section>`;
  }

  function projectMatchesDomain(project, domain) {
    const text = `${project.title || ''} ${project.category || ''} ${project.description || ''} ${list(project.sections).join(' ')} ${list(project.tags).join(' ')}`.toLowerCase();
    if (domain === 'motion') return /motion|video|vfx|reel|logo/.test(text);
    if (domain === 'cgi') return /3d|cgi|render|product visualization|miniature|food visualization|game ready|pbr|hard-surface|hard surface|lookdev|asset/.test(text);
    if (domain === 'xr') return /xr|vr|unreal|spatial|immersive|training simulation|headset|simulation/.test(text);
    if (domain === 'development') return /development|developer|website|web app|frontend|front-end|backend|full-stack|software|javascript|typescript|react|python|\bapi\b|\bapp\b|application|dashboard|landing page|interactive prototype/.test(text);
    return true;
  }

  function projectFilterTokens(project) {
    const tokens = [];
    if (projectMatchesDomain(project, 'motion')) tokens.push('motion');
    if (projectMatchesDomain(project, 'cgi')) tokens.push('cgi');
    if (projectMatchesDomain(project, 'xr')) tokens.push('xr');
    if (projectMatchesDomain(project, 'development')) tokens.push('development');
    tokens.push(isVideo(mainMedia(project)) || project.type === 'collection' ? 'video' : 'image');
    return Array.from(new Set(tokens)).join(' ');
  }

  function sectionGrid(section, sectionIndex) {
    const cards = list(section.slugs).map(slug => bySlug()[slug]).filter(isListed);
    if (!cards.length) return '';
    const countLabel = `${cards.length} ${cards.length === 1 ? 'project' : 'projects'}`;
    return `<section class="portfolio-section project-section-layout">
      <div class="section-heading section-heading-editorial">
        <div class="section-heading-title"><span class="section-index">${String((sectionIndex || 0) + 1).padStart(2, '0')}</span><h3>${esc(section.title)}</h3></div>
        <div class="section-heading-aside"><span class="section-count">${esc(countLabel)}</span><p>${esc(section.desc || '')}</p></div>
      </div>
      <div class="project-grid section-project-grid count-${Math.min(cards.length, 5)}">${cards.map((project, index) => projectCard(project, index)).join('')}</div>
    </section>`;
  }

  function leadProject(page, fallback) {
    const selected = bySlug()[page?.heroProjectSlug];
    return isListed(selected) ? selected : fallback;
  }

  function renderLeadProject(project, label) {
    if (!isListed(project)) return '';
    const media = mainMedia(project);
    return `<article class="route-lead" data-nav="${esc(project.slug)}" role="button" tabindex="0" aria-label="Open ${esc(project.title)}">
      <div class="route-lead-media">${mediaFrame(media, project.title, 'route-lead-frame')}</div>
      <div class="route-lead-copy">
        <span class="route-lead-index">${esc(label || 'Lead project')}</span>
        <h3>${esc(project.title)}</h3>
        <p>${esc(project.description || project.concept || '')}</p>
        <div class="route-lead-meta">${tagList(project.tags)}</div>
        <span class="route-lead-action">Open project <span class="material-symbols-outlined">east</span></span>
      </div>
    </article>`;
  }

  function renderWorkPage() {
    const all = projects().filter(project => isListed(project) && (project.type !== 'collection' || list(project.sections).includes('work')));
    const page = pageContent('work', {
      kicker: 'Selected Portfolio',
      title: '3D visualization, game assets, XR experiences, and creative tools.',
      copy: 'Browse selected product visuals, optimized assets, immersive experiences, and working tools, then open each project for its visual breakdown.'
    });
    const selectedLead = leadProject(page, all[0]);
    const featuredPool = all.filter(project => project.featured);
    const featured = [selectedLead, ...featuredPool.filter(project => project !== selectedLead)].filter(Boolean).slice(0, 6);
    const filtersEnabled = (window.PORTFOLIO_SITE_CONTENT || {}).experience?.workFiltersEnabled !== false;
    const filterToolbar = filtersEnabled ? `<div class="work-discovery" aria-label="Filter full project archive">
      <div class="work-filter-list">
        <button class="work-filter-button is-active" type="button" data-work-filter="all">All</button>
        <button class="work-filter-button" type="button" data-work-filter="motion">Motion</button>
        <button class="work-filter-button" type="button" data-work-filter="cgi">3D + Assets</button>
        <button class="work-filter-button" type="button" data-work-filter="xr">XR</button>
        <button class="work-filter-button" type="button" data-work-filter="development">Development</button>
        <button class="work-filter-button" type="button" data-work-filter="video">Video</button>
        <button class="work-filter-button" type="button" data-work-filter="image">Still Image</button>
      </div>
      <span class="work-filter-count">${all.length} projects</span>
    </div>` : '';
    const html = renderShell(
      page.kicker,
      page.title,
      page.copy,
      [
        { value: all.length, label: 'Selected projects' },
        { value: featured.length, label: 'Featured stories' },
        { value: '4', label: 'Creative domains' }
      ],
      ''
    ) + `<section class="portfolio-section">
      <div class="section-heading"><h3>Featured Work</h3><p>A curated first pass through the strongest current work.</p></div>
      <div class="project-grid">${(featured.length ? featured : all.slice(0, 6)).map((project, index) => projectCard(project, index)).join('')}</div>
    </section>
    <section class="portfolio-section">
      <div class="section-heading"><h3>Full Archive</h3><p>The complete project set currently shown on the portfolio.</p></div>
      ${filterToolbar}
      <div class="project-grid" id="work-archive-grid">${all.map((project, index) => projectCard(project, index)).join('')}</div>
    </section></div>`;
    setPage('page-case-studies', html);
  }

  function renderCategoryPage(kind) {
    const map = {
      motion: {
        page: 'page-motion',
        shell: 'motion-shell',
        kicker: 'Motion / Video',
        title: 'Reels, commercials, logo motion, and VFX cuts.',
        copy: 'Commercial videos, reels, logo systems, and VFX spots arranged so visitors can scan the work visually before opening details.',
        sectionKey: 'motion',
        stats: [
          { label: 'Motion pieces' },
          { label: 'Showcase groups' },
          { value: 'Play', label: 'Playable previews' }
        ]
      },
      xr: {
        page: 'page-uiux-xr',
        shell: '',
        kicker: 'XR',
        title: 'Immersive training, spatial UI, and XR demo captures.',
        copy: 'XR work is presented through readable headset captures, spatial interface moments, and guided training demos that make immersive projects easy to understand.',
        sectionKey: 'uiux',
        stats: [
          { label: 'XR projects' },
          { label: 'XR sections' },
          { value: 'View', label: 'Immersive demos' }
        ]
      },
      development: {
        page: 'page-development',
        shell: 'development-shell',
        kicker: 'Development',
        title: 'Creative tools and interactive products for designers.',
        copy: 'Selected development work presented through working interfaces, responsive prototypes, and the design decisions that improve creative workflows.',
        sectionKey: 'development',
        stats: [
          { label: 'Development projects' },
          { label: 'Project groups' },
          { value: 'Live', label: 'Working tools' }
        ]
      }
    };
    const cfg = map[kind];
    if (!cfg) return;
    const page = pageContent(kind, { kicker: cfg.kicker, title: cfg.title, copy: cfg.copy });
    const all = projects().filter(project => isListed(project) && projectMatchesDomain(project, kind));
    let html = renderShell(page.kicker, page.title, page.copy, cfg.stats.map((stat, index) => ({
      value: stat.value || (index === 0 ? all.length : list(sections()[cfg.sectionKey]).length),
      label: stat.label
    })), cfg.shell);
    const selectedLead = leadProject(page, all[0]);
    html += renderLeadProject(selectedLead, `${cfg.kicker} / Lead project`);

    html += list(sections()[cfg.sectionKey]).map((section, index) => sectionGrid(section, index)).join('');
    html += `<section class="portfolio-section">
      <div class="section-heading"><h3>All ${esc(cfg.kicker)}</h3><p>More projects from this portfolio domain.</p></div>
      <div class="project-grid">${all.map((project, index) => projectCard(project, index)).join('')}</div>
    </section></div>`;
    setPage(cfg.page, html);
  }

  function render3DLabPage() {
    const cgiProjects = projects().filter(project => isListed(project) && projectMatchesDomain(project, 'cgi'));
    const page = pageContent('cgi', {
      kicker: '3D / CGI Portfolio',
      title: '3D visualization and production-ready game assets.',
      copy: 'Product renders, optimized game assets, hard-surface props, material studies, and look-development work presented for fast visual review.'
    });
    const featured = leadProject(page, cgiProjects[0]);
    const featuredMedia = mainMedia(featured);
    const html = `<div class="portfolio-shell lab-shell nav-projects-first">
      <section class="lab-hero-grid">
        <aside class="lab-command-panel">
          <div><div class="portfolio-kicker">${esc(page.kicker)}</div><h3 class="lab-panel-title">${esc(page.title)}</h3><p class="lab-panel-copy">${esc(page.copy)}</p>
            <div class="lab-selected-project" data-nav="${esc(featured?.slug || 'work')}" role="button" tabindex="0"><span class="route-lead-index">Current hero project</span><strong>${esc(featured?.title || '3D / CGI')}</strong><span class="lab-cta">Open project <span class="material-symbols-outlined">east</span></span></div>
          </div>
          <div class="lab-spec-list">
            <div class="lab-spec-row"><span>Selected 3D work</span><strong>${cgiProjects.length}</strong></div>
            <div class="lab-spec-row"><span>Focus</span><strong>Visualization + assets</strong></div>
            <div class="lab-spec-row"><span>Details</span><strong>Mesh stats</strong></div>
          </div>
        </aside>
        <article class="lab-featured-card" data-nav="${esc(featured?.slug || 'work')}" role="button" tabindex="0">
          ${mediaFrame(featuredMedia, featured?.title || 'Featured 3D project', 'project-media-frame')}
          <span class="lab-featured-label">Featured 3D / CGI</span>
        </article>
      </section>
      ${list(sections().cgi).map((section, index) => sectionGrid(section, index)).join('')}
      <section class="portfolio-section">
        <div class="section-heading"><h3>All 3D / CGI Work</h3><p>Product renders, CGI ads, game-ready assets, hard-surface props, scenes, and visualization work from the portfolio.</p></div>
        <div class="project-grid">${cgiProjects.map((project, index) => projectCard(project, index)).join('')}</div>
      </section>
    </div>`;
    setPage('page-3d-lab', html);
  }

  function renderCollection(project) {
    const kind = project.collectionKind === 'reels' ? 'reels' : 'logo';
    const items = list(project.items);
    const filters = Array.from(new Set(items.flatMap(item => list(item.tags).concat(item.filter || item.style || '')).filter(Boolean))).slice(0, 12);
    const html = renderShell(
      kind === 'reels' ? 'Reels Collection' : 'Logo Animation Collection',
      project.title,
      project.description || project.concept || '',
      [
        { value: items.length, label: 'Collection items' },
        { value: project.year || 'Now', label: 'Archive range' },
        { value: 'Click', label: 'Open player' }
      ],
      `collection-shell ${kind}-collection-shell`
    ) + `<section class="portfolio-section">
      <div class="collection-filter">${filters.map(filter => `<span>${esc(filter)}</span>`).join('')}</div>
      <div class="collection-grid reels-grid">
        ${items.map((item, index) => collectionCard(item, index, kind)).join('')}
      </div>
    </section>
    ${caseDetails(project)}
    </div>`;
    setPage('page-project-detail', html);
  }

  function collectionCard(item, index, kind) {
    const path = item.path || '';
    const title = item.title || `Video ${index + 1}`;
    const shape = kind === 'reels' ? 'portrait' : 'landscape';
    const playable = isVideo(path);
    const openAttrs = playable ? ` data-video-src="${esc(path)}" data-video-title="${esc(title)}" data-video-shape="${shape}" tabindex="0" role="button"` : '';
    return `<article class="collection-card reel-card ${kind === 'logo' ? 'logo' : ''}${playable ? ' js-open-video' : ' collection-still'}"${openAttrs}>
      <div class="collection-preview reel-preview">
        ${mediaFrame(path, title, 'collection-media-frame reel-media-frame')}
      </div>
      <div>
        <div class="project-meta">${esc(item.filter || item.style || item.duration || 'Video')}</div>
        <h3 class="project-title">${esc(title)}</h3>
        <div class="project-tags">${tagList(item.tags)}</div>
        <span class="reel-open">${playable ? 'Open video' : 'Preview frame'} <span class="material-symbols-outlined">${playable ? 'open_in_full' : 'image'}</span></span>
      </div>
    </article>`;
  }

  function meshStats(project) {
    const stats = project.meshStats || {};
    const rows = [
      ['Triangles', stats.triangles, 'change_history'],
      ['Faces', stats.faces, 'polyline']
    ].filter(row => row[1]);
    if (!rows.length) return '';
    return `<div class="mesh-stat-grid">${rows.map(row => `<div class="mesh-stat-card"><span class="material-symbols-outlined">${row[2]}</span><div><strong>${esc(row[1])}</strong><small>${esc(row[0])}</small></div></div>`).join('')}</div>`;
  }

  function render3DProject(project) {
    const accent = accentForProject(project);
    const gallery = list(project.media?.gallery);
    const heroIsOrdered = project.media?.hero && gallery.includes(project.media.hero);
    const visuals = uniqueMedia(heroIsOrdered ? gallery : [project.media?.hero].concat(gallery));
    const html = `<div class="case-shell-3d" style="${cssVars(accent)}">
      <section class="case-3d-hero">
        <div class="case-pills">${list(project.tags).slice(0, 5).map(tag => `<span class="case-pill">${esc(tag)}</span>`).join('')}</div>
        <h2 class="case-3d-title">${esc(project.title)}</h2>
        <p class="case-3d-sub">${esc(project.concept || project.description || '')}</p>
        ${meshStats(project)}
      </section>
      <section class="case-3d-visual-stack">
        ${visuals.map((path, index) => render3DFrame(path, project, index)).join('')}
      </section>
      <section class="case-3d-details">
        <div class="case-3d-story">
          ${caseStory(project)}
        </div>
        ${infoPanel(project)}
      </section>
      ${nextProjects(project)}
    </div>`;
    setPage('page-project-detail', html);
  }

  function render3DFrame(path, project, index) {
    const video = isVideo(path);
    const caption = index === 0 ? 'Hero Media' : `Gallery ${String(index + 1).padStart(2, '0')}`;
    const attrs = video ? ` data-video-src="${esc(path)}" data-video-title="${esc(project.title)} - ${esc(caption)}" data-video-shape="landscape" tabindex="0" role="button"` : '';
    return `<figure class="case-3d-frame ${video ? 'video-frame js-open-video' : 'image-frame'}"${attrs}>
      ${mediaFrame(path, `${project.title} ${caption}`, 'case-3d-media-frame', { openVideo: false })}
      ${video ? '<span class="case-video-open-badge"><span class="material-symbols-outlined">play_arrow</span> Open video</span>' : ''}
      <figcaption><span>${esc(caption)}</span><strong>${video ? 'HD video frame' : 'Image reference'}</strong></figcaption>
    </figure>`;
  }

  function caseStory(project) {
    return `<article class="case-block"><div class="case-block-label">Concept</div><h3>${esc(project.concept || project.title)}</h3><p>${esc(project.description || '')}</p></article>
      <article class="case-block"><div class="case-block-label">Challenge</div><h3>What had to work</h3><p>${esc(project.challenge || 'The work needed to communicate fast while keeping the visual quality high.')}</p></article>
      <article class="case-block"><div class="case-block-label">Direction</div><h3>How it was shaped</h3><p>${esc(project.direction || project.outcome || '')}</p></article>
      <article class="case-block"><div class="case-block-label">Process</div><div class="process-grid">${processCards(project.process)}</div></article>`;
  }

  function infoPanel(project) {
    return `<aside class="case-info">
      ${infoRow('Role', project.role)}
      ${infoRow('Year', project.year)}
      ${infoRow('Duration', project.duration)}
      ${infoRow('Tools', project.tools)}
      ${infoRow('Deliverables', project.deliverables)}
      ${infoRow('Outcome', project.outcome)}
    </aside>`;
  }

  function caseDetails(project) {
    return `<section class="case-grid" id="case-story" style="${cssVars(accentForProject(project))}">
      <div class="case-content">${caseStory(project)}</div>
      ${infoPanel(project)}
    </section>`;
  }

  function renderProject(project) {
    const accent = accentForProject(project);
    const hero = project.media?.hero || project.thumbnail || '';
    const gallery = uniqueMedia(list(project.media?.gallery));
    const firstGallery = gallery[0] || '';
    const mediaCount = uniqueMedia([hero].concat(gallery)).length;
    const html = `<div class="case-shell" style="${cssVars(accent)}">
      <section class="case-hero" id="case-overview">
        <div class="case-glow"></div>
        <div class="case-media ${isVideo(hero) ? 'project-video-slot' : ''}">
          ${mediaFrame(hero, `${project.title} hero`, 'case-media-frame', { openVideo: isVideo(hero), shape: 'landscape', poster: mediaPoster(project, hero) })}
          ${isVideo(hero) ? '<span class="case-play-prompt"><span class="material-symbols-outlined">play_arrow</span><span><strong>Play hero film</strong><small>Open full screen</small></span></span>' : ''}
        </div>
        <div class="case-hero-content">
          <div class="case-index"><span>${esc(project.category || 'Case study')} / ${esc(project.year || 'Selected work')}</span><span>${String(mediaCount).padStart(2, '0')} visual${mediaCount === 1 ? '' : 's'}</span></div>
          <div class="case-pills">${list(project.tags).slice(0, 5).map(tag => `<span class="case-pill">${esc(tag)}</span>`).join('')}</div>
          <h2 class="case-title">${esc(project.title)}</h2>
          <p class="case-concept">${esc(project.concept || project.description || '')}</p>
        </div>
      </section>
      <nav class="case-chapter-nav" aria-label="Case study chapters">
        <button type="button" data-case-jump="case-overview"><span>01</span>Overview</button>
        <button type="button" data-case-jump="case-story"><span>02</span>Story + process</button>
        ${mediaCount ? '<button type="button" data-case-jump="case-media-gallery"><span>03</span>Project media</button>' : ''}
      </nav>
      ${caseDetails(project)}
      <section class="case-gallery" id="case-media-gallery">
        <div class="section-heading"><h3>Project Media</h3><p>${mediaCount} selected visual${mediaCount === 1 ? '' : 's'}. Hover to preview video or open it in the portfolio player.</p></div>
        ${firstGallery ? `<div class="gallery-feature ${isVideo(firstGallery) ? 'project-video-slot js-open-video' : ''}" ${isVideo(firstGallery) ? `data-video-src="${esc(firstGallery)}" data-video-title="${esc(project.title)} - Featured media" data-video-shape="landscape" tabindex="0" role="button"` : ''}>${mediaFrame(firstGallery, `${project.title} featured media`, 'gallery-feature-frame', { poster: mediaPoster(project, firstGallery) })}${isVideo(firstGallery) ? '<span class="case-play-prompt compact"><span class="material-symbols-outlined">play_arrow</span><span><strong>Play featured clip</strong></span></span>' : ''}</div>` : ''}
        <div class="gallery-grid">${gallery.slice(1).map((path, index) => `<div class="gallery-tile ${isVideo(path) ? 'project-video-slot js-open-video' : ''}" ${isVideo(path) ? `data-video-src="${esc(path)}" data-video-title="${esc(project.title)} - Media ${index + 2}" data-video-shape="landscape" tabindex="0" role="button"` : ''}>${mediaFrame(path, `${project.title} media ${index + 2}`, 'gallery-tile-frame', { poster: mediaPoster(project, path) })}<div class="project-meta">${isVideo(path) ? 'Open video' : `Media ${index + 2}`}</div></div>`).join('')}</div>
      </section>
      ${nextProjects(project)}
    </div>`;
    setPage('page-project-detail', html);
  }

  function nextProjects(project) {
    const projectTags = new Set(list(project.tags).map(tag => String(tag).toLowerCase()));
    const projectSections = new Set(list(project.sections).map(section => String(section).toLowerCase()));
    const projectTokens = projectFilterTokens(project).split(' ');
    const pool = projects().filter(item => isListed(item) && item.slug !== project.slug).map((item, index) => {
      const commonTags = list(item.tags).filter(tag => projectTags.has(String(tag).toLowerCase())).length;
      const commonSections = list(item.sections).filter(section => projectSections.has(String(section).toLowerCase())).length;
      const sameCategory = item.category && item.category === project.category ? 5 : 0;
      const sameMediaDomain = projectFilterTokens(item).split(' ').some(token => projectTokens.includes(token)) ? 1 : 0;
      return { item, score: sameCategory + commonTags * 3 + commonSections * 2 + sameMediaDomain, index };
    }).sort((a, b) => b.score - a.score || a.index - b.index).slice(0, 2).map(entry => entry.item);
    if (!pool.length) return '';
    return `<section class="next-project">${pool.map(item => `<article class="next-card" data-nav="${esc(item.slug)}" role="button" tabindex="0">
      <div class="project-meta">Related project</div><h3 class="project-title">${esc(item.title)}</h3><p class="project-desc">${esc(item.description || '')}</p>
    </article>`).join('')}</section>`;
  }

  function setPage(id, html) {
    const node = document.getElementById(id);
    if (!node) return;
    node.innerHTML = html;
    hydrate(node);
  }

  function routeIs3D(project) {
    return projectMatchesDomain(project, 'cgi');
  }

  function renderPortfolioRoute(route) {
    if (route === 'work' || route === 'case-studies') return renderWorkPage();
    if (route === 'motion') return renderCategoryPage('motion');
    if (route === '3d-lab') return render3DLabPage();
    if (route === 'uiux-xr') return renderCategoryPage('xr');
    if (route === 'development') return renderCategoryPage('development');
    const project = projectForRoute(route);
    if (!project) return;
    if (project.type === 'collection') return renderCollection(project);
    if (routeIs3D(project)) return render3DProject(project);
    return renderProject(project);
  }

  function navigateTo(slug) {
    if (typeof window.navigate === 'function') {
      window.navigate(slug);
      return;
    }
    window.location.hash = slug;
  }

  function hydrate(root) {
    hydrateMedia(root);
    bindCards(root);
    bindVideoOpeners(root);
    bindCaseChapters(root);
    document.dispatchEvent(new CustomEvent('portfolio:rendered', { detail: { root } }));
  }

  function hydrateMedia(root) {
    root.querySelectorAll('.media-frame').forEach(frame => {
      const img = frame.querySelector('img.media-asset');
      const video = frame.querySelector('video.media-asset');
      if (img) {
        if (img.complete) frame.classList.add('media-loaded');
        img.addEventListener('load', () => frame.classList.add('media-loaded'), { once: true });
        img.addEventListener('error', () => frame.classList.add('media-error'), { once: true });
      }
      if (video) {
        video.controls = false;
        video.setAttribute('controlsList', NO_DOWNLOAD);
        video.setAttribute('disablePictureInPicture', '');
        video.addEventListener('contextmenu', event => event.preventDefault());
        const ready = () => {
          frame.classList.add('media-loaded');
          try { if (!video.poster && video.currentTime < 0.001) video.currentTime = 0.001; } catch (error) {}
        };
        video.addEventListener('loadedmetadata', ready, { once: true });
        video.addEventListener('error', () => {
          frame.classList.add('media-error');
          const holder = video.closest('.js-open-video');
          if (holder) {
            holder.classList.add('media-source-missing');
            holder.removeAttribute('tabindex');
            holder.setAttribute('aria-disabled', 'true');
            const label = holder.querySelector('.project-meta, .case-play-prompt strong');
            if (label) label.textContent = video.poster ? 'Preview image / video pending' : 'Media unavailable';
          }
        }, { once: true });
        if (video.readyState > 0) ready();
      }
    });
    initHoverPlayback(root);
  }

  function initHoverPlayback(root) {
    const hover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    root.querySelectorAll('video.media-asset').forEach(video => {
      const holder = video.closest('.project-card, .collection-card, .case-media, .gallery-feature, .gallery-tile, .case-3d-frame') || video.parentElement;
      const pause = () => {
        video.pause();
        try {
          if (video.poster) video.load();
          else video.currentTime = 0.001;
        } catch (error) {}
      };
      if (hover && holder) {
        holder.addEventListener('mouseenter', () => video.play().catch(() => {}));
        holder.addEventListener('mouseleave', pause);
      }
      pause();
    });

    if (!hover && 'IntersectionObserver' in window) {
      if (window.__portfolioVideoObserver) window.__portfolioVideoObserver.disconnect();
      window.__portfolioVideoObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          const video = entry.target;
          if (entry.isIntersecting && entry.intersectionRatio > 0.62) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        });
      }, { threshold: [0, 0.62, 1] });
      root.querySelectorAll('.collection-card video.media-asset, .case-3d-frame.video-frame video.media-asset, .gallery-tile.project-video-slot video.media-asset, .gallery-feature.project-video-slot video.media-asset').forEach(video => {
        window.__portfolioVideoObserver.observe(video);
      });
    }
  }

  function bindCards(root) {
    root.querySelectorAll('[data-nav]').forEach(card => {
      if (card.__portfolioBound) return;
      card.__portfolioBound = true;
      card.addEventListener('click', event => {
        if (event.target.closest('.js-open-video, button, a')) return;
        navigateTo(card.dataset.nav);
      });
      card.addEventListener('keydown', event => {
        if (event.target !== card) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          navigateTo(card.dataset.nav);
        }
      });
    });
  }

  function bindVideoOpeners(root) {
    root.querySelectorAll('.js-open-video').forEach(opener => {
      if (opener.__videoOpenBound) return;
      opener.__videoOpenBound = true;
      const open = event => {
        event.preventDefault();
        event.stopPropagation();
        if (opener.classList.contains('media-source-missing')) return;
        const src = opener.dataset.videoSrc || opener.querySelector('video')?.getAttribute('src') || '';
        if (!src) return;
        openVideoLightbox(src.replace(/#t=0\.001$/, ''), opener.dataset.videoTitle || 'Video', opener.dataset.videoShape || 'portrait');
      };
      opener.addEventListener('click', open);
      opener.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') open(event);
      });
    });
  }

  function bindCaseChapters(root) {
    root.querySelectorAll('[data-case-jump]').forEach(button => {
      if (button.__caseJumpBound) return;
      button.__caseJumpBound = true;
      button.addEventListener('click', () => {
        const target = document.getElementById(button.dataset.caseJump);
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  function ensureLightbox() {
    let box = document.getElementById('video-lightbox');
    if (box) return box;
    box = document.createElement('div');
    box.id = 'video-lightbox';
    box.className = 'video-lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.innerHTML = `<div class="video-lightbox-backdrop" data-close-video></div>
      <div class="video-lightbox-panel">
        <div class="video-lightbox-top">
          <div class="video-lightbox-title"></div>
          <button class="video-lightbox-close" type="button" data-close-video aria-label="Close video"><span class="material-symbols-outlined">close</span></button>
        </div>
        <div class="video-lightbox-frame"><video playsinline controls controlsList="${NO_DOWNLOAD}" disablePictureInPicture></video></div>
      </div>`;
    document.body.appendChild(box);
    box.addEventListener('click', event => {
      if (event.target.closest('[data-close-video]')) closeVideoLightbox();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && box.classList.contains('open')) closeVideoLightbox();
    });
    return box;
  }

  function openVideoLightbox(src, title, shape) {
    const box = ensureLightbox();
    const video = box.querySelector('video');
    const frame = box.querySelector('.video-lightbox-frame');
    box.querySelector('.video-lightbox-title').textContent = title || 'Video';
    box.classList.toggle('project-video-mode', shape === 'landscape');
    box.classList.toggle('reel-video-mode', shape !== 'landscape');
    frame.classList.toggle('landscape', shape === 'landscape');
    frame.classList.toggle('portrait', shape !== 'landscape');
    video.src = src;
    video.setAttribute('controlsList', NO_DOWNLOAD);
    video.setAttribute('disablePictureInPicture', '');
    video.addEventListener('contextmenu', event => event.preventDefault());
    box.classList.add('open');
    document.body.classList.add('media-modal-open');
    video.play().catch(() => {});
  }

  function closeVideoLightbox() {
    const box = document.getElementById('video-lightbox');
    if (!box) return;
    const video = box.querySelector('video');
    video.pause();
    video.removeAttribute('src');
    video.load();
    box.classList.remove('open', 'project-video-mode', 'reel-video-mode');
    document.body.classList.remove('media-modal-open');
  }

  function buildSearchIndex() {
    return projects().filter(isListed).map(project => {
      const details = [
        project.title,
        project.category,
        project.description,
        project.concept,
        project.challenge,
        project.direction,
        project.outcome,
        project.year,
        project.role,
        project.duration,
        list(project.tags).join(' '),
        list(project.sections).join(' '),
        list(project.tools).join(' '),
        list(project.deliverables).join(' '),
        list(project.process).map(step => `${step.title || ''} ${step.description || ''}`).join(' '),
        list(project.media?.gallery).join(' '),
        list(project.items).map(item => `${item.title || ''} ${item.filter || ''} ${item.style || ''} ${item.duration || ''} ${list(item.tags).join(' ')} ${item.path || ''}`).join(' ')
      ].join(' ');
      return {
        title: project.title,
        category: project.category,
        desc: project.description || project.concept || '',
        terms: details,
        nav: project.slug,
        img: isVideo(mainMedia(project)) ? (project.thumbnail && !isVideo(project.thumbnail) ? project.thumbnail : '') : mainMedia(project)
      };
    });
  }

  window.getPortfolioProjectForRoute = projectForRoute;
  window.renderPortfolioRoute = renderPortfolioRoute;
  window.getPortfolioSearchIndex = buildSearchIndex;
  window.openPortfolioVideo = openVideoLightbox;

  document.addEventListener('DOMContentLoaded', () => hydrate(document));
})();
