/**
 * Folio — EPUB Engine (epub.js wrapper)
 * Renders EPUB books, manages TOC, navigation, annotations, and in-book search.
 */

const EpubLoader = (() => {
  let currentBook = null;
  let rendition = null;
  let currentBookData = null;
  let tocItems = [];
  let isBookLoaded = false;
  let searchResults = [];
  let currentSearchIdx = -1;
  let activeSelection = null; // { cfiRange, text, chapter }

  const HIGHLIGHT_COLORS = {
    yellow: '#FBBF24',
    blue: '#60A5FA',
    green: '#34D399',
    pink: '#F472B6',
    purple: '#A78BFA',
    orange: '#FB923C'
  };

  async function openBook(bookRecord, targetCfi = null) {
    if (!bookRecord || !bookRecord.fileData) {
      Utils.toast('Book file data is missing or corrupted', 'error');
      return false;
    }

    currentBookData = bookRecord;
    showLoading(true, 'Opening book...');

    // Clean up previous book & rendition to prevent memory leaks
    try {
      if (rendition) {
        rendition.destroy();
        rendition = null;
      }
      if (currentBook) {
        currentBook.destroy();
        currentBook = null;
      }
    } catch (cleanErr) {
      console.warn('Previous book cleanup warning:', cleanErr);
    }

    // Clear previous rendition DOM container
    const container = document.getElementById('epub-container');
    if (container) container.innerHTML = '';

    try {
      // Initialize ePub instance from ArrayBuffer
      currentBook = ePub(bookRecord.fileData);

      const settings = ReaderSettings.getSettings();

      // Render book into container
      rendition = currentBook.renderTo('epub-container', {
        width: '100%',
        height: '100%',
        flow: settings.flow || 'paginated',
        spread: settings.spread || 'auto',
        allowScriptedContent: false
      });

      // Update toolbar metadata
      document.getElementById('reader-title').textContent = bookRecord.title || 'Untitled';
      document.getElementById('reader-author').textContent = bookRecord.author ? `by ${bookRecord.author}` : '';

      // Bind rendition lifecycle events
      bindRenditionEvents();

      // Display initial location (saved CFI or target or beginning)
      const startCfi = targetCfi || bookRecord.currentCfi || undefined;
      await rendition.display(startCfi);

      // Extract TOC navigation
      loadTableOfContents();

      // Apply active theme and settings to rendition
      applyTheme(ThemeManager.getReaderTheme());
      applySettings(settings);

      // Load and render existing annotations
      loadAnnotations(bookRecord.id);

      // Generate locations in background for accurate page & progress calculation
      currentBook.ready.then(() => {
        return currentBook.locations.generate(1000);
      }).then(() => {
        updateProgress();
      }).catch(err => {
        console.warn('Location generation warning:', err);
      });

      isBookLoaded = true;
      showLoading(false);
      return true;

    } catch (err) {
      console.error('Error rendering book:', err);
      showLoading(false);
      Utils.toast('Failed to load EPUB: ' + (err.message || 'Invalid format'), 'error');
      return false;
    }
  }

  function bindRenditionEvents() {
    if (!rendition) return;

    // Relocated event: triggers on page turns
    rendition.on('relocated', (location) => {
      updateProgress(location);

      // Hide selection toolbar on page turn
      hideSelectionToolbar();
    });

    // Content rendered in iframe: hook fonts, styles & keyboard events
    rendition.on('rendered', (section, view) => {
      injectIframeStyles(view.document);
      bindIframeKeyboard(view.document);
    });

    // Text selection inside the EPUB iframe
    rendition.on('selected', (cfiRange, contents) => {
      const selection = contents.window.getSelection();
      const text = selection ? selection.toString().trim() : '';

      if (!text || text.length === 0) {
        hideSelectionToolbar();
        return;
      }

      // Determine current chapter title
      const chapter = document.getElementById('progress-chapter').textContent || '';
      activeSelection = { cfiRange, text, chapter };

      // Position selection toolbar near mouse / range
      positionSelectionToolbar(contents.window, selection);
    });

    // Tap or click outside selection
    rendition.on('click', () => {
      hideSelectionToolbar();
    });
  }

  function injectIframeStyles(doc) {
    if (!doc || !doc.head) return;

    // Ensure Google Fonts link is present in iframe
    if (!doc.getElementById('folio-iframe-fonts')) {
      const fontLink = doc.createElement('link');
      fontLink.id = 'folio-iframe-fonts';
      fontLink.rel = 'stylesheet';
      fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;500&display=swap';
      doc.head.appendChild(fontLink);
    }

    // Add base reset and smoothing inside iframe
    if (!doc.getElementById('folio-iframe-base')) {
      const style = doc.createElement('style');
      style.id = 'folio-iframe-base';
      style.textContent = `
        * { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
        body { margin: 0 !important; }
        img, svg, video { max-width: 100% !important; height: auto !important; }
        p { margin-bottom: 1.15em !important; }
      `;
      doc.head.appendChild(style);
    }

    // Inject live custom typography & theme overrides
    injectPageStyles(doc);
  }

  function injectPageStyles(doc) {
    if (!doc || !doc.head) return;

    const themeName = ThemeManager.getReaderTheme();
    const colors = ThemeManager.getThemeColors(themeName);
    const settings = ReaderSettings.getSettings();

    const fontFam = settings.fontFamily === 'Original' ? 'inherit' : `'${settings.fontFamily}', Georgia, serif`;
    const headingFam = settings.fontFamily === 'Playfair Display' ? "'Playfair Display', Georgia, serif" : fontFam;
    const fontSize = settings.fontSize || 18;
    const alignment = settings.alignment || 'left';
    const lineHeight = settings.lineHeight || 1.6;
    const margin = settings.margin ? `${settings.margin * 3}px` : '30px';

    let styleEl = doc.getElementById('folio-page-custom-style');
    if (!styleEl) {
      styleEl = doc.createElement('style');
      styleEl.id = 'folio-page-custom-style';
      doc.head.appendChild(styleEl);
    }

    styleEl.textContent = `
      html, body {
        background-color: ${colors.bg} !important;
        color: ${colors.text} !important;
        transition: background-color 0.15s ease, color 0.15s ease;
      }
      body {
        font-family: ${fontFam} !important;
        font-size: ${fontSize}px !important;
        line-height: ${lineHeight} !important;
        padding-left: ${margin} !important;
        padding-right: ${margin} !important;
      }
      p, div, li, blockquote, dd, dt, span {
        font-family: ${fontFam} !important;
        color: ${colors.text} !important;
        line-height: ${lineHeight} !important;
        text-align: ${alignment} !important;
      }
      small, figcaption, cite, .muted, .secondary, [class*="muted"], [class*="secondary"] {
        color: ${colors.muted} !important;
      }
      p, li, blockquote {
        font-size: ${fontSize}px !important;
      }
      h1, h2, h3, h4, h5, h6 {
        color: ${colors.text} !important;
        font-family: ${headingFam} !important;
      }
      a, a:link, a:visited {
        color: ${colors.link} !important;
      }
      ::selection {
        background: ${colors.selection} !important;
        color: ${colors.selectionText} !important;
      }
    `;
  }

  function bindIframeKeyboard(doc) {
    if (!doc) return;
    doc.addEventListener('keydown', (e) => {
      // Forward keydown event to main window handler
      window.dispatchEvent(new KeyboardEvent('keydown', {
        key: e.key,
        code: e.code,
        keyCode: e.keyCode,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        bubbles: true
      }));
    });
  }

  function positionSelectionToolbar(iframeWindow, selection) {
    const toolbar = document.getElementById('selection-toolbar');
    if (!toolbar) return;

    try {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const iframeRect = document.querySelector('#epub-container iframe')?.getBoundingClientRect() || { top: 0, left: 0 };

      const top = iframeRect.top + rect.top - 48;
      const left = iframeRect.left + rect.left + (rect.width / 2);

      toolbar.style.top = `${Math.max(60, top)}px`;
      toolbar.style.left = `${Math.min(window.innerWidth - 180, Math.max(160, left))}px`;
      toolbar.style.transform = 'translateX(-50%)';
      toolbar.classList.add('visible');
    } catch (e) {
      console.warn('Could not position selection toolbar:', e);
    }
  }

  function hideSelectionToolbar() {
    const toolbar = document.getElementById('selection-toolbar');
    if (toolbar) toolbar.classList.remove('visible');
    activeSelection = null;
  }

  function updateProgress(location) {
    if (!location && rendition) {
      location = rendition.currentLocation();
    }
    if (!location || !location.start) return;

    const currentCfi = location.start.cfi;
    let percent = 0;

    if (currentBook && currentBook.locations && currentBook.locations.total > 0) {
      percent = Math.round(currentBook.locations.percentageFromCfi(currentCfi) * 100);
      if (isNaN(percent)) percent = 0;
    }

    // Find current chapter from TOC
    let currentChapter = 'Reading';
    if (tocItems.length > 0 && location.start.href) {
      const match = tocItems.find(item => location.start.href.includes(item.href) || item.href.includes(location.start.href));
      if (match) currentChapter = match.label.trim();
    }

    // Update UI elements
    const chapterEl = document.getElementById('progress-chapter');
    const pageInfoEl = document.getElementById('page-info');
    const fillEl = document.getElementById('reading-stripe-fill');
    const statusChapter = document.getElementById('status-chapter-name');
    const statusPct = document.getElementById('status-progress-pct');

    if (chapterEl) chapterEl.textContent = currentChapter;
    if (pageInfoEl) pageInfoEl.textContent = `${percent}%`;
    if (fillEl) fillEl.style.width = `${percent}%`;
    if (statusChapter) statusChapter.textContent = currentChapter;
    if (statusPct) statusPct.textContent = `${percent}% read`;

    // Check if current location is bookmarked
    checkBookmarkStatus(currentCfi);

    // Persist reading progress to FolioDB
    if (currentBookData && currentBookData.id) {
      FolioDB.updateProgress(currentBookData.id, {
        currentCfi,
        progressPercent: percent,
        currentChapter
      });
    }
  }

  async function checkBookmarkStatus(cfi) {
    if (!currentBookData) return;
    const annotations = await FolioDB.getAnnotations(currentBookData.id);
    const isBookmarked = annotations.some(a => a.type === 'bookmark' && a.cfiRange === cfi);
    const bmBtn = document.getElementById('bookmark-btn');
    if (bmBtn) {
      bmBtn.classList.toggle('active', isBookmarked);
      bmBtn.style.color = isBookmarked ? 'var(--accent-text)' : '';
    }
  }

  async function loadTableOfContents() {
    if (!currentBook) return;

    try {
      const navigation = await currentBook.loaded.navigation;
      tocItems = [];

      function flattenToc(items, depth = 0) {
        items.forEach(item => {
          tocItems.push({
            label: item.label,
            href: item.href,
            depth
          });
          if (item.subitems && item.subitems.length > 0) {
            flattenToc(item.subitems, depth + 1);
          }
        });
      }

      flattenToc(navigation.toc);
      renderTocUI(tocItems);

    } catch (err) {
      console.warn('Could not load TOC:', err);
    }
  }

  function renderTocUI(items) {
    const listEl = document.getElementById('toc-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (items.length === 0) {
      listEl.innerHTML = '<p class="empty-state" style="padding:var(--sp-6);">No Table of Contents found</p>';
      return;
    }

    items.forEach(item => {
      const btn = document.createElement('button');
      btn.className = `toc-entry depth-${Math.min(2, item.depth)}`;
      btn.innerHTML = `
        <span class="toc-progress-dot"></span>
        <span class="toc-text">${Utils.escapeHTML(item.label.trim())}</span>
      `;
      btn.addEventListener('click', () => {
        goTo(item.href);
        // Close TOC panel
        document.getElementById('toc-panel')?.classList.remove('open');
        document.getElementById('panel-overlay')?.classList.remove('visible');
      });
      listEl.appendChild(btn);
    });

    // TOC filter input handler
    const filterInput = document.getElementById('toc-filter-input');
    if (filterInput) {
      filterInput.oninput = (e) => {
        const q = e.target.value.toLowerCase().trim();
        listEl.querySelectorAll('.toc-entry').forEach(entry => {
          const match = entry.textContent.toLowerCase().includes(q);
          entry.style.display = match ? 'block' : 'none';
        });
      };
    }
  }

  function applyStylesToAllContents() {
    if (!rendition) return;

    try {
      // 1. Update all contents tracked by epub.js
      const contents = rendition.getContents();
      if (contents && contents.length) {
        contents.forEach(content => {
          if (content && content.document) {
            injectPageStyles(content.document);
          }
        });
      }

      // 2. Also check any visible iframe elements in epub-container
      const iframes = document.querySelectorAll('#epub-container iframe');
      iframes.forEach(iframe => {
        try {
          if (iframe.contentDocument) {
            injectPageStyles(iframe.contentDocument);
          }
        } catch (e) {}
      });
    } catch (e) {
      console.warn('Could not inject styles to all contents:', e);
    }
  }

  function scheduleLiveStyleRefresh() {
    applyStylesToAllContents();
    requestAnimationFrame(() => {
      applyStylesToAllContents();
      setTimeout(applyStylesToAllContents, 80);
    });
  }

  function applyTheme(themeName) {
    if (!rendition) return;

    // Force style injection directly to live iframe DOM
    scheduleLiveStyleRefresh();
  }

  function applySettings(settings) {
    if (!rendition) return;

    if (settings.fontSize) {
      rendition.themes.fontSize(`${settings.fontSize}px`);
    }

    if (settings.fontFamily) {
      const font = settings.fontFamily === 'Original' ? 'inherit' : `'${settings.fontFamily}', serif`;
      rendition.themes.font(font);
    }

    // Force style injection directly to live iframe DOM
    scheduleLiveStyleRefresh();
  }

  function reRender() {
    if (!currentBookData) return;
    const currentLocation = rendition ? rendition.currentLocation() : null;
    const cfi = currentLocation ? currentLocation.start.cfi : currentBookData.currentCfi;
    openBook(currentBookData, cfi);
  }

  // Navigation
  function next() {
    if (rendition) rendition.next();
  }

  function prev() {
    if (rendition) rendition.prev();
  }

  function goTo(target) {
    if (rendition) rendition.display(target);
  }

  // Annotations & Highlights
  async function addHighlight(color = 'yellow', note = '') {
    if (!activeSelection || !currentBookData) return;

    const { cfiRange, text, chapter } = activeSelection;
    const annotation = {
      id: Utils.generateId(),
      bookId: currentBookData.id,
      type: note ? 'note' : 'highlight',
      cfiRange,
      text,
      note,
      color,
      chapter,
      dateAdded: Date.now()
    };

    await FolioDB.saveAnnotation(annotation);
    renderHighlightOnPage(annotation);
    hideSelectionToolbar();
    refreshAnnotationsPanel();
    Utils.toast('Highlight saved', 'success');
  }

  function renderHighlightOnPage(ann) {
    if (!rendition || !ann.cfiRange) return;
    const hex = HIGHLIGHT_COLORS[ann.color] || HIGHLIGHT_COLORS.yellow;

    try {
      rendition.annotations.highlight(
        ann.cfiRange,
        {},
        () => {
          // Click highlight opens annotations drawer
          document.getElementById('annotations-toggle-btn')?.click();
        },
        'hl-' + ann.id,
        {
          fill: hex,
          'fill-opacity': '0.38'
        }
      );
    } catch (e) {
      console.warn('Highlight render exception:', e);
    }
  }

  async function loadAnnotations(bookId) {
    const annotations = await FolioDB.getAnnotations(bookId);
    annotations.forEach(ann => {
      if (ann.type === 'highlight' || ann.type === 'note') {
        renderHighlightOnPage(ann);
      }
    });
  }

  async function toggleBookmark() {
    if (!rendition || !currentBookData) return;
    const loc = rendition.currentLocation();
    if (!loc || !loc.start) return;

    const cfi = loc.start.cfi;
    const annotations = await FolioDB.getAnnotations(currentBookData.id);
    const existing = annotations.find(a => a.type === 'bookmark' && a.cfiRange === cfi);

    if (existing) {
      await FolioDB.deleteAnnotation(existing.id);
      Utils.toast('Bookmark removed');
    } else {
      const chapter = document.getElementById('progress-chapter').textContent || 'Bookmark';
      const bm = {
        id: Utils.generateId(),
        bookId: currentBookData.id,
        type: 'bookmark',
        cfiRange: cfi,
        text: `Page bookmark at ${loc.start.displayed?.page || ''}`,
        note: '',
        color: 'purple',
        chapter,
        dateAdded: Date.now()
      };
      await FolioDB.saveAnnotation(bm);
      Utils.toast('Page bookmarked', 'success');
    }

    checkBookmarkStatus(cfi);
    refreshAnnotationsPanel();
  }

  async function refreshAnnotationsPanel() {
    if (!currentBookData) return;
    const listEl = document.getElementById('ann-list-content');
    if (!listEl) return;

    const annotations = await FolioDB.getAnnotations(currentBookData.id);
    const activeTab = document.querySelector('.ann-tab.active')?.dataset.tab || 'highlights';

    let filtered = [];
    if (activeTab === 'highlights') {
      filtered = annotations.filter(a => a.type === 'highlight');
    } else if (activeTab === 'notes') {
      filtered = annotations.filter(a => a.type === 'note');
    } else if (activeTab === 'bookmarks') {
      filtered = annotations.filter(a => a.type === 'bookmark');
    }

    listEl.innerHTML = '';
    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="empty-state" style="padding:var(--sp-8);">
        <p>No ${activeTab} yet.</p>
      </div>`;
      return;
    }

    filtered.forEach(item => {
      const card = document.createElement('div');
      card.className = item.type === 'bookmark' ? 'bookmark-item' : 'ann-item';

      if (item.type === 'bookmark') {
        card.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <div class="bookmark-label">🔖 ${Utils.escapeHTML(item.chapter)}</div>
              <div class="bookmark-date">${Utils.formatDate(item.dateAdded)}</div>
            </div>
            <button class="btn btn-ghost icon-btn btn-sm delete-ann-btn" title="Delete bookmark">✕</button>
          </div>
        `;
      } else {
        const hex = HIGHLIGHT_COLORS[item.color] || HIGHLIGHT_COLORS.yellow;
        card.innerHTML = `
          <div class="ann-highlight-bar" style="background:${hex};"></div>
          <p class="ann-text">"${Utils.escapeHTML(item.text)}"</p>
          ${item.note ? `<div class="ann-note-text">Note: ${Utils.escapeHTML(item.note)}</div>` : ''}
          <div class="ann-meta">
            <span class="ann-chapter">${Utils.escapeHTML(item.chapter)} · ${Utils.formatDate(item.dateAdded)}</span>
            <div class="ann-actions">
              <button class="btn btn-ghost icon-btn btn-sm delete-ann-btn" title="Delete">✕</button>
            </div>
          </div>
        `;
      }

      // Jump to annotation on click
      card.addEventListener('click', (e) => {
        if (e.target.closest('.delete-ann-btn')) return;
        goTo(item.cfiRange);
        document.getElementById('annotations-panel')?.classList.remove('open');
        document.getElementById('panel-overlay')?.classList.remove('visible');
      });

      // Delete annotation handler
      const delBtn = card.querySelector('.delete-ann-btn');
      if (delBtn) {
        delBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await FolioDB.deleteAnnotation(item.id);
          refreshAnnotationsPanel();
          if (currentBookData) {
            checkBookmarkStatus(rendition?.currentLocation()?.start?.cfi);
          }
        });
      }

      listEl.appendChild(card);
    });
  }

  // In-book Search
  async function searchBook(query) {
    if (!currentBook || !query || query.trim().length < 2) return;

    const countEl = document.getElementById('search-count');
    const resultsEl = document.getElementById('search-results');
    if (countEl) countEl.textContent = 'Searching...';
    if (resultsEl) resultsEl.innerHTML = '<div class="search-empty">Searching book chapters...</div>';

    searchResults = [];
    currentSearchIdx = -1;

    try {
      // Search through each spine section
      const spine = currentBook.spine?.spineItems || [];
      const promises = spine.map(item => {
        return item.load(currentBook.load.bind(currentBook)).then(doc => {
          const results = item.find(query.trim());
          item.unload();
          return results || [];
        }).catch(err => {
          console.warn('Spine item search skipped:', err);
          try { item.unload(); } catch (_) {}
          return [];
        });
      });

      const allFound = await Promise.all(promises);
      allFound.forEach(arr => {
        if (arr && arr.length) {
          searchResults.push(...arr);
        }
      });

      if (countEl) countEl.textContent = `${searchResults.length} results`;

      if (searchResults.length === 0) {
        if (resultsEl) resultsEl.innerHTML = '<div class="search-empty">No occurrences found.</div>';
        return;
      }

      renderSearchResults(searchResults, query);

    } catch (e) {
      console.error('In-book search error:', e);
      if (countEl) countEl.textContent = 'Search failed';
    }
  }

  function renderSearchResults(results, query) {
    const resultsEl = document.getElementById('search-results');
    if (!resultsEl) return;
    resultsEl.innerHTML = '';

    results.slice(0, 100).forEach((item, idx) => {
      const div = document.createElement('div');
      div.className = 'search-result';
      div.innerHTML = `
        <div class="search-result-excerpt">
          ${item.excerpt.replace(new RegExp(`(${escapeRegex(query)})`, 'gi'), '<mark>$1</mark>')}
        </div>
      `;
      div.addEventListener('click', () => {
        currentSearchIdx = idx;
        goTo(item.cfi);
        highlightSearchResult(idx);
      });
      resultsEl.appendChild(div);
    });
  }

  function highlightSearchResult(idx) {
    const items = document.querySelectorAll('.search-result');
    items.forEach((item, i) => {
      item.classList.toggle('active', i === idx);
    });
  }

  function nextSearchResult() {
    if (searchResults.length === 0) return;
    currentSearchIdx = (currentSearchIdx + 1) % searchResults.length;
    goTo(searchResults[currentSearchIdx].cfi);
    highlightSearchResult(currentSearchIdx);
  }

  function prevSearchResult() {
    if (searchResults.length === 0) return;
    currentSearchIdx = (currentSearchIdx - 1 + searchResults.length) % searchResults.length;
    goTo(searchResults[currentSearchIdx].cfi);
    highlightSearchResult(currentSearchIdx);
  }

  function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function showLoading(show, text = 'Loading...') {
    const loader = document.getElementById('reader-loading');
    const label = document.getElementById('reader-loading-text');
    if (loader) loader.classList.toggle('hidden', !show);
    if (label && text) label.textContent = text;
  }

  function isLoaded() {
    return isBookLoaded;
  }

  function getActiveSelection() {
    return activeSelection;
  }

  return {
    openBook,
    applyTheme,
    applySettings,
    reRender,
    next,
    prev,
    goTo,
    addHighlight,
    toggleBookmark,
    refreshAnnotationsPanel,
    searchBook,
    nextSearchResult,
    prevSearchResult,
    isLoaded,
    getActiveSelection
  };
})();
