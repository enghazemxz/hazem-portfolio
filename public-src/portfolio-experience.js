(function () {
  const VIDEO_RE = /\.(mp4|webm|mov|m4v)(?:[?#].*)?$/i;
  const STORAGE_KEY = 'hazem-portfolio-shortlist-v1';
  const content = window.PORTFOLIO_SITE_CONTENT || {};
  const config = {
    shortlistEnabled: true,
    visualPlaylistEnabled: true,
    surpriseProjectEnabled: true,
    workFiltersEnabled: true,
    scrollProgressEnabled: true,
    shortlistLabel: 'Project Shortlist',
    playlistLabel: 'Play Visual Selection',
    ...(content.experience || {})
  };
  const projects = Array.isArray(window.PORTFOLIO_PROJECTS) ? window.PORTFOLIO_PROJECTS : [];
  const bySlug = window.PORTFOLIO_PROJECT_BY_SLUG || Object.fromEntries(projects.map(project => [project.slug, project]));
  let selected = loadSelection();
  let playlistItems = [];
  let playlistIndex = 0;
  let toastTimer = 0;

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[character]));
  }

  function isVideo(path) {
    return VIDEO_RE.test(String(path || '').split('?')[0]);
  }

  function mainMedia(project) {
    const gallery = Array.isArray(project?.media?.gallery) ? project.media.gallery : [];
    return project?.thumbnail || project?.media?.hero || gallery[0] || '';
  }

  function loadSelection() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value.filter(slug => bySlug[slug]).slice(0, 24) : [];
    } catch (error) {
      return [];
    }
  }

  function saveSelection() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(selected)); } catch (error) {}
  }

  function projectUrl(slug) {
    const url = new URL(window.location.href);
    url.hash = slug;
    return url.href;
  }

  function routeEnabled(slug) {
    return typeof window.isPortfolioRouteEnabled !== 'function' || window.isPortfolioRouteEnabled(slug);
  }

  function contactRouteEnabled() {
    return typeof window.isPortfolioRouteEnabled !== 'function' || window.isPortfolioRouteEnabled('contact');
  }

  function navigateTo(slug) {
    if (!routeEnabled(slug)) return;
    closeDrawer();
    closePlaylist();
    if (typeof window.navigate === 'function') window.navigate(slug);
    else window.location.hash = slug;
  }

  function showToast(message) {
    const toast = document.getElementById('experience-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2200);
  }

  function copyText(value, successMessage) {
    const fallback = () => {
      const input = document.createElement('textarea');
      input.value = value;
      input.setAttribute('readonly', '');
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(value).catch(fallback);
    } else {
      fallback();
    }
    showToast(successMessage);
  }

  function toggleSelection(slug) {
    if (!bySlug[slug] || !routeEnabled(slug)) return;
    if (selected.includes(slug)) {
      selected = selected.filter(value => value !== slug);
      showToast('Removed from shortlist');
    } else {
      selected = selected.concat(slug).slice(-24);
      showToast('Added to shortlist');
    }
    saveSelection();
    refreshSelectionUI();
  }

  function selectionButton(slug, compact) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = compact ? 'project-shortlist-toggle' : 'experience-shortlist-action';
    button.dataset.shortlistSlug = slug;
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      toggleSelection(slug);
    });
    return button;
  }

  function refreshSelectionButton(button) {
    const saved = selected.includes(button.dataset.shortlistSlug);
    button.classList.toggle('is-saved', saved);
    button.setAttribute('aria-pressed', String(saved));
    button.setAttribute('aria-label', saved ? 'Remove project from shortlist' : 'Add project to shortlist');
    button.innerHTML = `<span class="material-symbols-outlined">${saved ? 'bookmark_added' : 'bookmark_add'}</span>${button.classList.contains('experience-shortlist-action') ? `<span>${saved ? 'Saved to shortlist' : 'Save project'}</span>` : ''}`;
  }

  function decorateProjectCards(root) {
    if (!config.shortlistEnabled) return;
    root.querySelectorAll('[data-nav]').forEach(card => {
      const slug = card.dataset.nav;
      if (!bySlug[slug] || !routeEnabled(slug) || card.querySelector(':scope > .project-shortlist-toggle')) return;
      card.appendChild(selectionButton(slug, true));
    });
  }

  function decorateProjectDetail(root) {
    const slug = currentProjectSlug();
    if (!slug || !bySlug[slug] || !routeEnabled(slug)) return;
    const target = root.querySelector('.case-hero-content, .case-3d-hero');
    if (!target || target.querySelector('.experience-case-actions')) return;
    const actions = document.createElement('div');
    actions.className = 'experience-case-actions';
    if (contactRouteEnabled()) {
      const discuss = document.createElement('button');
      discuss.type = 'button';
      discuss.className = 'experience-inquiry-action';
      discuss.innerHTML = '<span class="material-symbols-outlined">forum</span><span>Discuss something similar</span>';
      discuss.addEventListener('click', () => startInquiry([bySlug[slug]], 'similar'));
      actions.appendChild(discuss);
    }
    if (config.shortlistEnabled) actions.appendChild(selectionButton(slug, false));
    const share = document.createElement('button');
    share.type = 'button';
    share.innerHTML = '<span class="material-symbols-outlined">ios_share</span><span>Share project</span>';
    share.addEventListener('click', () => shareProject(bySlug[slug]));
    actions.appendChild(share);
    target.appendChild(actions);
  }

  async function shareProject(project) {
    const data = {
      title: project.title,
      text: project.description || project.concept || 'Portfolio project',
      url: projectUrl(project.slug)
    };
    if (navigator.share) {
      try { await navigator.share(data); return; } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }
    copyText(data.url, 'Project link copied');
  }

  function refreshSelectionUI() {
    const items = selectedProjects();
    document.querySelectorAll('[data-shortlist-slug]').forEach(refreshSelectionButton);
    const count = document.getElementById('experience-count');
    if (count) count.textContent = String(items.length);
    const open = document.getElementById('experience-open-shortlist');
    if (open) open.disabled = items.length === 0;
    renderDrawerList();
  }

  function selectedProjects() {
    const enabled = selected.map(slug => bySlug[slug]).filter(project => project && routeEnabled(project.slug));
    const enabledSlugs = enabled.map(project => project.slug);
    if (enabledSlugs.length !== selected.length) {
      selected = enabledSlugs;
      saveSelection();
    }
    return enabled;
  }

  function renderDrawerList() {
    const list = document.getElementById('experience-list');
    if (!list) return;
    const items = selectedProjects();
    if (!items.length) {
      list.innerHTML = '<div class="experience-list-empty">Save projects while browsing.<br>Your selection stays on this device.</div>';
      return;
    }
    list.innerHTML = items.map(project => {
      const media = mainMedia(project);
      const asset = isVideo(media)
        ? `<video src="${esc(media)}#t=0.001" muted playsinline preload="metadata" controlsList="nodownload"></video>`
        : `<img src="${esc(media)}" alt="" loading="lazy" decoding="async">`;
      return `<article class="experience-list-item">
        <button class="experience-list-media" type="button" data-open-project="${esc(project.slug)}" aria-label="Open ${esc(project.title)}">${asset}</button>
        <button class="experience-list-copy" type="button" data-open-project="${esc(project.slug)}"><strong>${esc(project.title)}</strong><span>${esc(project.category || 'Project')}</span></button>
        <button class="experience-icon-button" type="button" data-remove-project="${esc(project.slug)}" aria-label="Remove ${esc(project.title)}"><span class="material-symbols-outlined">close</span></button>
      </article>`;
    }).join('');
    list.querySelectorAll('[data-open-project]').forEach(button => button.addEventListener('click', () => navigateTo(button.dataset.openProject)));
    list.querySelectorAll('[data-remove-project]').forEach(button => button.addEventListener('click', () => toggleSelection(button.dataset.removeProject)));
  }

  function openDrawer() {
    if (!selectedProjects().length) return;
    document.getElementById('experience-backdrop')?.classList.add('is-open');
    document.getElementById('experience-drawer')?.classList.add('is-open');
    document.body.classList.add('experience-modal-open');
    renderDrawerList();
    window.setTimeout(() => document.querySelector('#experience-drawer [data-close-drawer]')?.focus(), 50);
  }

  function closeDrawer() {
    document.getElementById('experience-backdrop')?.classList.remove('is-open');
    document.getElementById('experience-drawer')?.classList.remove('is-open');
    if (!document.getElementById('experience-playlist')?.classList.contains('is-open')) document.body.classList.remove('experience-modal-open');
  }

  function copySelection() {
    const value = selectedProjects().map(project => `${project.title}: ${projectUrl(project.slug)}`).join('\n');
    if (value) copyText(value, 'Shortlist links copied');
  }

  function startInquiry(items, intent) {
    const references = (items || []).filter(project => project && routeEnabled(project.slug));
    if (!references.length || !contactRouteEnabled()) return;
    closeDrawer();
    if (typeof window.openPortfolioInquiry === 'function') window.openPortfolioInquiry(references, intent);
    else navigateTo('contact');
  }

  function clearSelection() {
    selected = [];
    saveSelection();
    refreshSelectionUI();
    showToast('Shortlist cleared');
  }

  function openPlaylist() {
    playlistItems = selectedProjects().filter(project => mainMedia(project));
    if (!playlistItems.length) playlistItems = projects.filter(project => project.featured && routeEnabled(project.slug) && mainMedia(project)).slice(0, 6);
    if (!playlistItems.length) return;
    playlistIndex = 0;
    closeDrawer();
    document.getElementById('experience-playlist')?.classList.add('is-open');
    document.body.classList.add('experience-modal-open');
    renderPlaylistItem();
    window.setTimeout(() => document.querySelector('#experience-playlist [data-close-playlist]')?.focus(), 50);
  }

  function closePlaylist() {
    const playlist = document.getElementById('experience-playlist');
    if (!playlist) return;
    const video = playlist.querySelector('video');
    if (video) {
      video.pause();
      video.removeAttribute('src');
    }
    playlist.classList.remove('is-open');
    document.body.classList.remove('experience-modal-open');
  }

  function movePlaylist(direction) {
    if (!playlistItems.length) return;
    playlistIndex = (playlistIndex + direction + playlistItems.length) % playlistItems.length;
    renderPlaylistItem();
  }

  function renderPlaylistItem() {
    const project = playlistItems[playlistIndex];
    if (!project) return;
    const media = mainMedia(project);
    const stage = document.getElementById('experience-playlist-media');
    if (stage) {
      stage.replaceChildren();
      if (isVideo(media)) {
        const video = document.createElement('video');
        video.src = media;
        video.controls = true;
        video.playsInline = true;
        video.autoplay = true;
        video.setAttribute('controlsList', 'nodownload noplaybackrate');
        video.setAttribute('disablePictureInPicture', '');
        video.addEventListener('contextmenu', event => event.preventDefault());
        video.addEventListener('ended', () => movePlaylist(1));
        stage.appendChild(video);
      } else {
        const image = document.createElement('img');
        image.src = media;
        image.alt = `${project.title} preview`;
        stage.appendChild(image);
      }
    }
    const title = document.getElementById('experience-playlist-title');
    const meta = document.getElementById('experience-playlist-meta');
    const counter = document.getElementById('experience-playlist-counter');
    const open = document.getElementById('experience-playlist-open');
    if (title) title.textContent = project.title;
    if (meta) meta.textContent = project.category || 'Project';
    if (counter) counter.textContent = `${playlistIndex + 1} / ${playlistItems.length}`;
    if (open) open.dataset.openProject = project.slug;
  }

  function surpriseProject() {
    const current = currentProjectSlug();
    const pool = projects.filter(project => project.slug && project.showInListings !== false && routeEnabled(project.slug) && project.slug !== current && project.type !== 'collection');
    if (!pool.length) return;
    const project = pool[Math.floor(Math.random() * pool.length)];
    navigateTo(project.slug);
    showToast(`Opening ${project.title}`);
  }

  function bindWorkFilters(root) {
    if (!config.workFiltersEnabled) return;
    root.querySelectorAll('.work-discovery').forEach(toolbar => {
      if (toolbar.dataset.bound) return;
      toolbar.dataset.bound = 'true';
      const grid = root.querySelector('#work-archive-grid');
      if (!grid) return;
      const buttons = toolbar.querySelectorAll('[data-work-filter]');
      const count = toolbar.querySelector('.work-filter-count');
      buttons.forEach(button => button.addEventListener('click', () => {
        buttons.forEach(item => item.classList.toggle('is-active', item === button));
        const filter = button.dataset.workFilter;
        let visible = 0;
        grid.querySelectorAll('.project-card').forEach(card => {
          const matches = filter === 'all' || String(card.dataset.filterTokens || '').split(' ').includes(filter);
          card.classList.toggle('is-filtered-out', !matches);
          if (matches) visible += 1;
        });
        if (count) count.textContent = `${visible} project${visible === 1 ? '' : 's'}`;
      }));
    });
  }

  function currentProjectSlug() {
    const route = decodeURIComponent(window.location.hash.replace(/^#/, '').split('?')[0]);
    return bySlug[route] ? route : '';
  }

  function updateMetadata() {
    const project = bySlug[currentProjectSlug()];
    const seo = content.seo || {};
    const title = project ? `${project.title} | ${seo.siteName || 'Hazem Essam'}` : (seo.siteTitle || 'Hazem Essam | 3D, XR & Motion Artist');
    const description = project
      ? (project.description || project.concept || seo.description || '')
      : (seo.description || document.querySelector('meta[name="description"]')?.content || '');
    document.title = title;
    setMeta('meta[name="description"]', description);
    setMeta('meta[property="og:title"]', title);
    setMeta('meta[property="og:description"]', description);
    setMeta('meta[name="twitter:title"]', title);
    setMeta('meta[name="twitter:description"]', description);
    const image = project && !isVideo(mainMedia(project)) ? mainMedia(project) : (seo.socialImage || '');
    if (image) {
      let absoluteImage = image;
      try { absoluteImage = new URL(image, window.location.href).href; } catch (error) {}
      setMeta('meta[property="og:image"]', absoluteImage);
      setMeta('meta[name="twitter:image"]', absoluteImage, true);
    }
  }

  function setMeta(selector, value, create) {
    if (!value) return;
    let element = document.querySelector(selector);
    if (!element && create) {
      element = document.createElement('meta');
      const match = selector.match(/meta\[(name|property)="([^"]+)"\]/);
      if (!match) return;
      element.setAttribute(match[1], match[2]);
      document.head.appendChild(element);
    }
    if (element) element.setAttribute('content', value);
  }

  function updateScrollProgress() {
    const progress = document.getElementById('portfolio-scroll-progress');
    if (!progress) return;
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const ratio = Math.min(1, Math.max(0, window.scrollY / max));
    progress.style.transform = `scaleX(${ratio})`;
  }

  function ensureExperienceShell() {
    if (document.getElementById('experience-command')) return;
    if (config.scrollProgressEnabled) {
      const progress = document.createElement('div');
      progress.id = 'portfolio-scroll-progress';
      progress.className = 'portfolio-scroll-progress';
      document.body.appendChild(progress);
      window.addEventListener('scroll', updateScrollProgress, { passive: true });
      window.addEventListener('resize', updateScrollProgress);
      updateScrollProgress();
    }

    const command = document.createElement('div');
    command.id = 'experience-command';
    command.className = 'experience-command';
    command.setAttribute('aria-label', 'Portfolio experience tools');
    const surprise = config.surpriseProjectEnabled
      ? '<button class="experience-command-button" type="button" id="experience-surprise"><span class="material-symbols-outlined">shuffle</span><span class="experience-command-label">Surprise me</span></button>'
      : '';
    const shortlist = config.shortlistEnabled
      ? '<button class="experience-command-button" type="button" id="experience-open-shortlist"><span class="material-symbols-outlined">bookmarks</span><span class="experience-command-label">Shortlist</span><span class="experience-count" id="experience-count">0</span></button>'
      : '';
    command.innerHTML = surprise + shortlist;
    if (command.childElementCount) document.body.appendChild(command);

    const backdrop = document.createElement('div');
    backdrop.id = 'experience-backdrop';
    backdrop.className = 'experience-backdrop';
    document.body.appendChild(backdrop);

    const drawer = document.createElement('aside');
    drawer.id = 'experience-drawer';
    drawer.className = 'experience-drawer';
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'true');
    drawer.setAttribute('aria-label', config.shortlistLabel);
    drawer.innerHTML = `<div class="experience-drawer-head">
      <div class="experience-drawer-title-row"><div><h2>${esc(config.shortlistLabel)}</h2><p>Build a focused reference list for your visit.</p></div><button class="experience-icon-button" type="button" data-close-drawer aria-label="Close shortlist"><span class="material-symbols-outlined">close</span></button></div>
    </div>
    <div class="experience-list" id="experience-list"></div>
    <div class="experience-drawer-foot">
    ${contactRouteEnabled() ? '<button class="experience-primary-action experience-reference-action" type="button" id="experience-send-selection"><span class="material-symbols-outlined">send</span>Send as references</button>' : ''}
    <div class="experience-drawer-actions">
      ${config.visualPlaylistEnabled ? `<button class="experience-secondary-action" type="button" id="experience-play-selection"><span class="material-symbols-outlined">play_arrow</span>${esc(config.playlistLabel)}</button>` : ''}
      <button class="experience-secondary-action" type="button" id="experience-copy-selection"><span class="material-symbols-outlined">link</span>Copy links</button>
      <button class="experience-secondary-action" type="button" id="experience-clear-selection" aria-label="Clear shortlist"><span class="material-symbols-outlined">delete_sweep</span></button>
    </div></div>`;
    document.body.appendChild(drawer);

    const playlist = document.createElement('div');
    playlist.id = 'experience-playlist';
    playlist.className = 'experience-playlist';
    playlist.setAttribute('role', 'dialog');
    playlist.setAttribute('aria-modal', 'true');
    playlist.setAttribute('aria-label', 'Visual project playlist');
    playlist.innerHTML = `<div class="experience-playlist-top">
      <div class="experience-playlist-copy"><strong id="experience-playlist-title"></strong><span id="experience-playlist-meta"></span></div>
      <button class="experience-icon-button" type="button" data-close-playlist aria-label="Close visual playlist"><span class="material-symbols-outlined">close</span></button>
    </div>
    <div class="experience-playlist-stage"><div class="experience-playlist-media" id="experience-playlist-media"></div></div>
    <div class="experience-playlist-bottom">
      <span class="work-filter-count" id="experience-playlist-counter"></span>
      <div class="experience-playlist-controls">
        <button class="experience-secondary-action" type="button" id="experience-playlist-prev" aria-label="Previous project"><span class="material-symbols-outlined">west</span></button>
        <button class="experience-primary-action" type="button" id="experience-playlist-open">Open case study</button>
        <button class="experience-secondary-action" type="button" id="experience-playlist-next" aria-label="Next project"><span class="material-symbols-outlined">east</span></button>
      </div>
    </div>`;
    document.body.appendChild(playlist);

    const toast = document.createElement('div');
    toast.id = 'experience-toast';
    toast.className = 'experience-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);

    document.getElementById('experience-surprise')?.addEventListener('click', surpriseProject);
    document.getElementById('experience-open-shortlist')?.addEventListener('click', openDrawer);
    backdrop.addEventListener('click', closeDrawer);
    drawer.querySelector('[data-close-drawer]')?.addEventListener('click', closeDrawer);
    document.getElementById('experience-send-selection')?.addEventListener('click', () => startInquiry(selectedProjects(), 'references'));
    document.getElementById('experience-play-selection')?.addEventListener('click', openPlaylist);
    document.getElementById('experience-copy-selection')?.addEventListener('click', copySelection);
    document.getElementById('experience-clear-selection')?.addEventListener('click', clearSelection);
    playlist.querySelector('[data-close-playlist]')?.addEventListener('click', closePlaylist);
    document.getElementById('experience-playlist-prev')?.addEventListener('click', () => movePlaylist(-1));
    document.getElementById('experience-playlist-next')?.addEventListener('click', () => movePlaylist(1));
    document.getElementById('experience-playlist-open')?.addEventListener('click', event => navigateTo(event.currentTarget.dataset.openProject));
  }

  function hydrateExperience(root) {
    decorateProjectCards(root);
    decorateProjectDetail(root);
    bindWorkFilters(root);
    refreshSelectionUI();
    updateMetadata();
    updateScrollProgress();
  }

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeDrawer();
      closePlaylist();
    }
    if (document.getElementById('experience-playlist')?.classList.contains('is-open')) {
      if (event.key === 'ArrowLeft') movePlaylist(-1);
      if (event.key === 'ArrowRight') movePlaylist(1);
    }
  });

  document.addEventListener('portfolio:rendered', event => hydrateExperience(event.detail?.root || document));
  window.addEventListener('hashchange', () => window.setTimeout(() => hydrateExperience(document), 0));
  document.addEventListener('DOMContentLoaded', () => {
    ensureExperienceShell();
    hydrateExperience(document);
  });
})();
