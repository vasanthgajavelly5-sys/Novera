/**
 * Lirune Reader — Main Application Coordinator
 * Boots app, manages view transitions, drawer panels, modals, and hotkeys.
 */

const App = (() => {
  let activeView = 'library'; // 'library' | 'reader'
  let currentBookId = null;
  let focusMode = false;
  let nativeFullscreen = false;

  async function init() {
    // Initialize subsystem managers in parallel (they share a single cached DB
    // connection, so parallel init avoids sequential IndexedDB round-trips)
    showLibraryLoading(true);
    await Promise.all([
      ThemeManager.init(),
      ReaderSettings.init(),
      Library.init()
    ]);
    hideLibraryLoading();

    window.noveraDesktop?.getVersion?.().then(version => {
      const versionEl = document.getElementById('about-version');
      if (versionEl) versionEl.textContent = version;
    }).catch(() => {});

    bindNavigationEvents();
    bindDrawersAndModals();
    bindSelectionToolbar();
    bindKeyboardShortcuts();
    bindSearchOverlay();
    bindFullscreenState();
    bindWindowControls();

    console.log('Lirune Reader successfully initialized');
  }

  // View Switching
  function openLibrary() {
    activeView = 'library';
    closeAllPanels();

    const libView = document.getElementById('library-view');
    const readerView = document.getElementById('reader-view');

    if (readerView) {
      readerView.classList.remove('active');
      readerView.classList.add('hidden');
    }
    if (libView) {
      libView.classList.remove('hidden');
      libView.classList.add('active');
    }

    // Refresh library state (progress, recent books)
    Library.loadAndRenderBooks();
  }

  async function openReader(bookId) {
    const book = await NoveraDB.getBook(bookId);
    if (!book) {
      Utils.toast('Could not find book in storage', 'error');
      return;
    }

    currentBookId = bookId;
    activeView = 'reader';
    closeAllPanels();

    const libView = document.getElementById('library-view');
    const readerView = document.getElementById('reader-view');

    if (libView) {
      libView.classList.remove('active');
      libView.classList.add('hidden');
    }
    if (readerView) {
      readerView.classList.remove('hidden');
      readerView.classList.add('active');
    }

    const success = await EpubLoader.openBook(book);
    if (!success) {
      openLibrary();
    }
  }

  function bindNavigationEvents() {
    // Back to library button
    const backBtn = document.getElementById('back-to-library-btn');
    if (backBtn) {
      backBtn.addEventListener('click', openLibrary);
    }

    // Prev / Next page buttons
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    if (prevBtn) prevBtn.addEventListener('click', () => EpubLoader.prev());
    if (nextBtn) nextBtn.addEventListener('click', () => EpubLoader.next());

    // Bookmark button
    const bmBtn = document.getElementById('bookmark-btn');
    if (bmBtn) {
      bmBtn.addEventListener('click', () => EpubLoader.toggleBookmark());
    }

    // Fullscreen toggle button
    const fsBtn = document.getElementById('fullscreen-btn');
    if (fsBtn) {
      fsBtn.addEventListener('click', toggleFullscreen);
    }

    // Full Settings Expand button
    const fullSettingsBtn = document.getElementById('full-settings-btn');
    if (fullSettingsBtn) {
      fullSettingsBtn.addEventListener('click', openFullSettings);
    }

    const focusSettingsBtn = document.getElementById('focus-settings-btn');
    if (focusSettingsBtn) {
      document.getElementById('reader-view')?.appendChild(focusSettingsBtn);
    }
  }

  async function toggleFullscreen() {
    const entering = !focusMode;
    setFocusMode(entering);

    if (window.noveraDesktop?.toggleNativeFullscreen) {
      const isNative = await window.noveraDesktop.isNativeFullscreen();
      if (isNative !== entering) await window.noveraDesktop.toggleNativeFullscreen();
      return;
    }

    if (entering && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(err => {
        setFocusMode(false);
        console.warn('Fullscreen request failed:', err);
      });
    } else if (!entering && document.fullscreenElement && document.exitFullscreen) {
      await document.exitFullscreen();
    }
  }

  function setFocusMode(enabled) {
    focusMode = Boolean(enabled);
    document.body.classList.toggle('focus-mode', focusMode);
    const button = document.getElementById('fullscreen-btn');
    if (button) {
      button.classList.toggle('active', focusMode);
      button.setAttribute('aria-label', focusMode ? 'Exit focused fullscreen' : 'Enter focused fullscreen');
      button.title = focusMode ? 'Exit Fullscreen (F)' : 'Toggle Fullscreen (F)';
    }
  }

  function bindFullscreenState() {
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement && !nativeFullscreen) setFocusMode(false);
    });

    window.noveraDesktop?.onNativeFullscreenChanged((isFullscreen) => {
      nativeFullscreen = isFullscreen;
      setFocusMode(isFullscreen);
    });
  }

  function bindWindowControls() {
    document.addEventListener('click', (event) => {
      const control = event.target.closest('[data-window-action]');
      if (!control || !window.noveraDesktop) return;

      const action = control.dataset.windowAction;
      if (action === 'minimize') window.noveraDesktop.minimizeWindow();
      if (action === 'maximize') window.noveraDesktop.maximizeWindow();
      if (action === 'close') window.noveraDesktop.closeWindow();
    });
  }

  function bindDrawersAndModals() {
    const overlay = document.getElementById('panel-overlay');

    // TOC drawer
    const tocBtn = document.getElementById('toc-toggle-btn');
    const closeTocBtn = document.getElementById('close-toc-btn');
    const tocPanel = document.getElementById('toc-panel');

    if (tocBtn) {
      tocBtn.addEventListener('click', () => toggleDrawer(tocPanel));
    }
    if (closeTocBtn) {
      closeTocBtn.addEventListener('click', () => closeDrawer(tocPanel));
    }

    // Settings drawer
    const settingsButtons = [
      document.getElementById('settings-btn'),
      document.getElementById('library-settings-btn'),
      document.getElementById('focus-settings-btn')
    ].filter(Boolean);
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    const settingsPanel = document.getElementById('settings-panel');

    settingsButtons.forEach(button => {
      button.addEventListener('click', () => toggleDrawer(settingsPanel));
    });
    if (closeSettingsBtn) {
      closeSettingsBtn.addEventListener('click', () => closeDrawer(settingsPanel));
    }

    // Annotations drawer
    const annBtn = document.getElementById('annotations-toggle-btn');
    const closeAnnBtn = document.getElementById('close-annotations-btn');
    const annPanel = document.getElementById('annotations-panel');

    if (annBtn) {
      annBtn.addEventListener('click', () => {
        EpubLoader.refreshAnnotationsPanel();
        toggleDrawer(annPanel);
      });
    }
    if (closeAnnBtn) {
      closeAnnBtn.addEventListener('click', () => closeDrawer(annPanel));
    }

    // Annotations tab switcher
    document.querySelectorAll('.ann-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.ann-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        EpubLoader.refreshAnnotationsPanel();
      });
    });

    // Clicking overlay closes all sliding panels
    if (overlay) {
      overlay.addEventListener('click', closeAllPanels);
    }

    // Shortcuts modal
    const shortcutsModal = document.getElementById('shortcuts-modal');
    const closeShortcutsBtn = document.getElementById('close-shortcuts-btn');
    if (closeShortcutsBtn) {
      closeShortcutsBtn.addEventListener('click', () => {
        shortcutsModal?.classList.add('hidden');
      });
    }
    if (shortcutsModal) {
      shortcutsModal.addEventListener('click', (e) => {
        if (e.target === shortcutsModal) shortcutsModal.classList.add('hidden');
      });
    }

    // Note Modal
    const noteModal = document.getElementById('note-modal');
    const closeNoteBtn = document.getElementById('close-note-btn');
    const cancelNoteBtn = document.getElementById('note-cancel-btn');
    const saveNoteBtn = document.getElementById('note-save-btn');

    [closeNoteBtn, cancelNoteBtn].forEach(btn => {
      if (btn) btn.addEventListener('click', () => noteModal?.classList.add('hidden'));
    });

    if (noteModal) {
      noteModal.addEventListener('click', (e) => {
        if (e.target === noteModal) noteModal.classList.add('hidden');
      });
    }

    if (saveNoteBtn) {
      saveNoteBtn.addEventListener('click', async () => {
        const textarea = document.getElementById('note-textarea');
        const note = textarea ? textarea.value.trim() : '';
        await EpubLoader.addHighlight('yellow', note);
        noteModal?.classList.add('hidden');
        if (textarea) textarea.value = '';
      });
    }

    // Full Settings Modal
    const fullSettingsModal = document.getElementById('full-settings-modal');
    const closeFullSettingsBtn = document.getElementById('close-full-settings-btn');
    const fullSettingsNavBtns = document.querySelectorAll('.full-settings-nav-btn');

    if (closeFullSettingsBtn) {
      closeFullSettingsBtn.addEventListener('click', closeFullSettings);
    }
    if (fullSettingsModal) {
      fullSettingsModal.addEventListener('click', (e) => {
        if (e.target === fullSettingsModal) closeFullSettings();
      });
    }

    fullSettingsNavBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const section = btn.dataset.section;
        switchFullSettingsSection(section);
      });
    });

    // Full Settings - Appearance section bindings
    bindFullSettingsAppearance();

    // Full Settings - Reading section bindings
    bindFullSettingsReading();
  }

  function bindFullSettingsAppearance() {
    // Application theme radio buttons
    document.querySelectorAll('[data-app-theme]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (typeof ThemeManager !== 'undefined') {
          ThemeManager.setAppTheme(btn.dataset.appTheme);
        }
      });
    });

    // Accent color input
    const accentInput = document.getElementById('full-app-accent-color');
    if (accentInput) {
      accentInput.addEventListener('input', (e) => {
        if (typeof ThemeManager !== 'undefined') {
          ThemeManager.applyAccent(e.target.value);
        }
      });
    }

    // Reset accent button
    const resetAccentBtn = document.getElementById('full-reset-accent-btn');
    if (resetAccentBtn && typeof ThemeManager !== 'undefined') {
      resetAccentBtn.addEventListener('click', () => {
        ThemeManager.applyAccent(ThemeManager.DEFAULT_ACCENT);
      });
    }

    // Reader theme presets
    document.querySelectorAll('#appearance-panel .theme-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        if (typeof ThemeManager !== 'undefined') {
          ThemeManager.setReaderTheme(btn.dataset.theme);
        }
      });
    });

    // Custom theme color inputs
    document.querySelectorAll('#appearance-panel [data-custom-color]').forEach(input => {
      input.addEventListener('input', (e) => {
        if (typeof ThemeManager !== 'undefined') {
          ThemeManager.setCustomColor(e.target.dataset.customColor, e.target.value);
        }
      });
    });

    // Reset custom theme button
    const resetCustomBtn = document.getElementById('full-reset-custom-theme-btn');
    if (resetCustomBtn && typeof ThemeManager !== 'undefined') {
      resetCustomBtn.addEventListener('click', () => {
        ThemeManager.resetCustomTheme();
      });
    }

    // Sync UI when Full Settings Appearance panel is opened
    const appearanceNavBtn = document.querySelector('[data-section="appearance"]');
    if (appearanceNavBtn) {
      appearanceNavBtn.addEventListener('click', syncFullSettingsAppearanceUI);
    }
  }

  function syncFullSettingsAppearanceUI() {
    if (typeof ThemeManager === 'undefined') return;

    // Sync app theme radios
    const appTheme = ThemeManager.getAppTheme();
    document.querySelectorAll('[data-app-theme]').forEach(btn => {
      const isActive = btn.dataset.appTheme === appTheme;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    // Sync accent color input
    const accentInput = document.getElementById('full-app-accent-color');
    if (accentInput) {
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      if (accent) accentInput.value = accent;
    }

    // Sync reader theme presets
    const readerTheme = ThemeManager.getReaderTheme();
    document.querySelectorAll('#appearance-panel .theme-preset').forEach(btn => {
      const isActive = btn.dataset.theme === readerTheme;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    // Sync custom theme inputs
    const colors = ThemeManager.getThemeColors(readerTheme);
    document.querySelectorAll('#appearance-panel [data-custom-color]').forEach(input => {
      const key = input.dataset.customColor;
      if (colors[key]) input.value = colors[key];
    });
  }

  function bindFullSettingsReading() {
    // Font size stepper
    const decBtn = document.getElementById('full-font-decrease');
    const incBtn = document.getElementById('full-font-increase');
    if (decBtn && typeof ReaderSettings !== 'undefined') {
      decBtn.addEventListener('click', () => {
        const s = ReaderSettings.getSettings();
        if (s.fontSize > 12) {
          ReaderSettings.setSetting('fontSize', s.fontSize - 2);
        }
      });
    }
    if (incBtn && typeof ReaderSettings !== 'undefined') {
      incBtn.addEventListener('click', () => {
        const s = ReaderSettings.getSettings();
        if (s.fontSize < 36) {
          ReaderSettings.setSetting('fontSize', s.fontSize + 2);
        }
      });
    }

    // Font family grid
    document.querySelectorAll('#reading-panel .font-opt').forEach(opt => {
      opt.addEventListener('click', () => {
        if (typeof ReaderSettings !== 'undefined') {
          ReaderSettings.setSetting('fontFamily', opt.dataset.font);
        }
      });
    });

    // Text alignment
    document.querySelectorAll('#reading-panel [data-alignment]').forEach(option => {
      option.addEventListener('click', () => {
        if (typeof ReaderSettings !== 'undefined') {
          ReaderSettings.setSetting('alignment', option.dataset.alignment);
        }
      });
    });

    // Line spacing slider
    const spacingSlider = document.getElementById('full-spacing-slider');
    if (spacingSlider && typeof ReaderSettings !== 'undefined') {
      spacingSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        ReaderSettings.setSetting('lineHeight', val);
      });
    }

    // Page margins slider
    const marginSlider = document.getElementById('full-margin-slider');
    if (marginSlider && typeof ReaderSettings !== 'undefined') {
      marginSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        ReaderSettings.setSetting('margin', val);
      });
    }

    // Flow mode buttons
    const flowPaginated = document.getElementById('full-flow-paginated-btn');
    const flowScrolled = document.getElementById('full-flow-scrolled-btn');
    if (flowPaginated && typeof ReaderSettings !== 'undefined') {
      flowPaginated.addEventListener('click', () => {
        const s = ReaderSettings.getSettings();
        if (s.flow !== 'paginated') {
          ReaderSettings.setSetting('flow', 'paginated');
          if (typeof EpubLoader !== 'undefined' && EpubLoader.isLoaded()) {
            EpubLoader.reRender();
          }
        }
      });
    }
    if (flowScrolled && typeof ReaderSettings !== 'undefined') {
      flowScrolled.addEventListener('click', () => {
        const s = ReaderSettings.getSettings();
        if (s.flow !== 'scrolled') {
          ReaderSettings.setSetting('flow', 'scrolled');
          if (typeof EpubLoader !== 'undefined' && EpubLoader.isLoaded()) {
            EpubLoader.reRender();
          }
        }
      });
    }

    // Spread buttons
    const spreadAuto = document.getElementById('full-spread-auto-btn');
    const spreadSingle = document.getElementById('full-spread-single-btn');
    if (spreadAuto && typeof ReaderSettings !== 'undefined') {
      spreadAuto.addEventListener('click', () => {
        const s = ReaderSettings.getSettings();
        if (s.spread !== 'auto') {
          ReaderSettings.setSetting('spread', 'auto');
          if (typeof EpubLoader !== 'undefined' && EpubLoader.isLoaded()) {
            EpubLoader.reRender();
          }
        }
      });
    }
    if (spreadSingle && typeof ReaderSettings !== 'undefined') {
      spreadSingle.addEventListener('click', () => {
        const s = ReaderSettings.getSettings();
        if (s.spread !== 'none') {
          ReaderSettings.setSetting('spread', 'none');
          if (typeof EpubLoader !== 'undefined' && EpubLoader.isLoaded()) {
            EpubLoader.reRender();
          }
        }
      });
    }

    // Reset reading preferences button
    const resetButton = document.getElementById('full-reset-reader-settings-btn');
    if (resetButton && typeof ReaderSettings !== 'undefined') {
      resetButton.addEventListener('click', () => {
        ReaderSettings.setSetting('fontSize', 18);
        ReaderSettings.setSetting('fontFamily', 'Cormorant Garamond');
        ReaderSettings.setSetting('alignment', 'left');
        ReaderSettings.setSetting('lineHeight', 1.6);
        ReaderSettings.setSetting('margin', 10);
        ReaderSettings.setSetting('flow', 'paginated');
        ReaderSettings.setSetting('spread', 'auto');
        if (typeof EpubLoader !== 'undefined' && EpubLoader.isLoaded()) EpubLoader.reRender();
      });
    }

    // Sync UI when Full Settings Reading panel is opened
    const readingNavBtn = document.querySelector('[data-section="reading"]');
    if (readingNavBtn) {
      readingNavBtn.addEventListener('click', syncFullSettingsReadingUI);
    }
  }

  function syncFullSettingsReadingUI() {
    if (typeof ReaderSettings === 'undefined') return;

    const s = ReaderSettings.getSettings();

    // Font size display
    const fontSizeDisplay = document.getElementById('full-font-size-display');
    if (fontSizeDisplay) fontSizeDisplay.textContent = `${s.fontSize}px`;

    // Font family active state
    document.querySelectorAll('#reading-panel .font-opt').forEach(opt => {
      opt.classList.toggle('active', opt.dataset.font === s.fontFamily);
    });

    // Text alignment active state
    document.querySelectorAll('#reading-panel [data-alignment]').forEach(option => {
      const isActive = option.dataset.alignment === s.alignment;
      option.classList.toggle('active', isActive);
      option.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    // Line spacing slider & value
    const spacingSlider = document.getElementById('full-spacing-slider');
    const spacingVal = document.getElementById('full-spacing-val');
    if (spacingSlider) spacingSlider.value = s.lineHeight;
    if (spacingVal) spacingVal.textContent = s.lineHeight.toFixed(1);

    // Page margins slider & value
    const marginSlider = document.getElementById('full-margin-slider');
    const marginVal = document.getElementById('full-margin-val');
    if (marginSlider) marginSlider.value = s.margin;
    if (marginVal) marginVal.textContent = `${s.margin}%`;

    // Flow buttons
    const flowPaginated = document.getElementById('full-flow-paginated-btn');
    const flowScrolled = document.getElementById('full-flow-scrolled-btn');
    if (flowPaginated) flowPaginated.classList.toggle('active', s.flow === 'paginated');
    if (flowScrolled) flowScrolled.classList.toggle('active', s.flow === 'scrolled');

    // Spread buttons
    const spreadAuto = document.getElementById('full-spread-auto-btn');
    const spreadSingle = document.getElementById('full-spread-single-btn');
    if (spreadAuto) spreadAuto.classList.toggle('active', s.spread === 'auto');
    if (spreadSingle) spreadSingle.classList.toggle('active', s.spread === 'none');
  }

  function toggleDrawer(panel) {
    if (!panel) return;
    const isOpen = panel.classList.contains('open');
    closeAllPanels();
    if (!isOpen) {
      panel.classList.add('open');
      document.getElementById('panel-overlay')?.classList.add('visible');
    }
  }

  function closeDrawer(panel) {
    if (!panel) return;
    panel.classList.remove('open');
    document.getElementById('panel-overlay')?.classList.remove('visible');
  }

  function closeAllPanels() {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('open'));
    document.getElementById('panel-overlay')?.classList.remove('visible');
    document.getElementById('search-overlay')?.classList.remove('visible');
    document.getElementById('shortcuts-modal')?.classList.add('hidden');
    document.getElementById('book-details-modal')?.classList.add('hidden');
    document.getElementById('note-modal')?.classList.add('hidden');
    closeFullSettings();
  }

  function openFullSettings() {
    const modal = document.getElementById('full-settings-modal');
    if (!modal) return;
    closeAllPanels();
    modal.classList.remove('hidden');
    // Focus the close button for accessibility
    const closeBtn = document.getElementById('close-full-settings-btn');
    setTimeout(() => closeBtn?.focus(), 0);
  }

  function closeFullSettings() {
    const modal = document.getElementById('full-settings-modal');
    if (!modal) return;
    modal.classList.add('hidden');
  }

  function switchFullSettingsSection(section) {
    // Update nav buttons
    document.querySelectorAll('.full-settings-nav-btn').forEach(btn => {
      const isActive = btn.dataset.section === section;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive);
    });
    // Update content sections
    document.querySelectorAll('.full-settings-section').forEach(sec => {
      const isActive = sec.id === `${section}-panel`;
      sec.classList.toggle('active', isActive);
      sec.hidden = !isActive;
    });
  }

  function bindSelectionToolbar() {
    // Highlight color clicks
    document.querySelectorAll('.sel-color').forEach(btn => {
      btn.addEventListener('click', () => {
        const color = btn.dataset.color || 'yellow';
        EpubLoader.addHighlight(color);
      });
    });

    // Add note button
    const noteBtn = document.getElementById('sel-add-note');
    if (noteBtn) {
      noteBtn.addEventListener('click', () => {
        const sel = EpubLoader.getActiveSelection();
        if (!sel) return;

        const quoteEl = document.getElementById('note-selected-text');
        const textarea = document.getElementById('note-textarea');
        const noteModal = document.getElementById('note-modal');

        if (quoteEl) quoteEl.textContent = `"${sel.text}"`;
        if (textarea) textarea.value = '';
        if (noteModal) noteModal.classList.remove('hidden');
        if (textarea) textarea.focus();
      });
    }

    // Copy text button
    const copyBtn = document.getElementById('sel-copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const sel = EpubLoader.getActiveSelection();
        if (sel && sel.text) {
          navigator.clipboard.writeText(sel.text).then(() => {
            Utils.toast('Copied to clipboard', 'info');
          });
        }
      });
    }
  }

  function bindSearchOverlay() {
    const searchBtn = document.getElementById('search-toggle-btn');
    const overlay = document.getElementById('search-overlay');
    const closeBtn = document.getElementById('search-close-btn');
    const input = document.getElementById('search-input');
    const prevBtn = document.getElementById('search-prev-btn');
    const nextBtn = document.getElementById('search-next-btn');

    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        if (!overlay) return;
        const isVis = overlay.classList.contains('visible');
        if (isVis) {
          overlay.classList.remove('visible');
        } else {
          overlay.classList.add('visible');
          input?.focus();
        }
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => overlay?.classList.remove('visible'));
    }

    if (input) {
      input.addEventListener('input', Utils.debounce((e) => {
        EpubLoader.searchBook(e.target.value);
      }, 300));

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (e.shiftKey) {
            EpubLoader.prevSearchResult();
          } else {
            EpubLoader.nextSearchResult();
          }
        }
      });
    }

    if (prevBtn) prevBtn.addEventListener('click', () => EpubLoader.prevSearchResult());
    if (nextBtn) nextBtn.addEventListener('click', () => EpubLoader.nextSearchResult());
  }

  function bindKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // If typing in input, textarea, or contentEditable, ignore shortcuts (except Escape)
      const target = e.target;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (e.key === 'Escape') {
        // If modals or drawers open, close them
        const hasOpenPanels = document.querySelector('.panel.open') ||
                              document.querySelector('.modal-backdrop:not(.hidden)') ||
                              document.getElementById('search-overlay')?.classList.contains('visible');
        if (hasOpenPanels) {
          closeAllPanels();
          return;
        }

        if (focusMode || nativeFullscreen || document.fullscreenElement) {
          e.preventDefault();
          setFocusMode(false);
          if (nativeFullscreen && window.noveraDesktop?.toggleNativeFullscreen) {
            window.noveraDesktop.toggleNativeFullscreen();
          } else if (document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen();
          }
          return;
        }

        // If in reader view, escape goes back to library
        if (activeView === 'reader') {
          openLibrary();
          return;
        }
      }

      // Library search shortcut: Ctrl+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('lib-search-input');
        if (searchInput && activeView === 'library') {
          searchInput.focus();
          searchInput.select();
        }
        return;
      }

      if (isInput) return;

      // Reader shortcuts
      if (activeView === 'reader') {
        if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key.toLowerCase() === 'j' || (e.key === ' ' && !e.shiftKey)) {
          if (!e.shiftKey) {
            e.preventDefault();
            EpubLoader.next();
          }
        } else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key.toLowerCase() === 'k' || (e.key === ' ' && e.shiftKey)) {
          e.preventDefault();
          EpubLoader.prev();
        } else if (e.key.toLowerCase() === 't') {
          e.preventDefault();
          const tocPanel = document.getElementById('toc-panel');
          toggleDrawer(tocPanel);
        } else if (e.key.toLowerCase() === 's') {
          e.preventDefault();
          const settingsPanel = document.getElementById('settings-panel');
          toggleDrawer(settingsPanel);
        } else if (e.key.toLowerCase() === 'n') {
          e.preventDefault();
          const annPanel = document.getElementById('annotations-panel');
          EpubLoader.refreshAnnotationsPanel();
          toggleDrawer(annPanel);
        } else if (e.key.toLowerCase() === 'b') {
          e.preventDefault();
          EpubLoader.toggleBookmark();
        } else if (e.key === '/') {
          e.preventDefault();
          const searchOverlay = document.getElementById('search-overlay');
          if (searchOverlay) {
            searchOverlay.classList.add('visible');
            document.getElementById('search-input')?.focus();
          }
        } else if (e.key.toLowerCase() === 'f') {
          e.preventDefault();
          toggleFullscreen();
        } else if (e.key === '?') {
          e.preventDefault();
          document.getElementById('shortcuts-modal')?.classList.remove('hidden');
        }
      }
    });
  }

  function showLibraryLoading(show) {
    const loader = document.getElementById('lib-loading');
    const content = document.getElementById('lib-content');
    const dropZone = document.getElementById('drop-zone');
    const libHeader = document.getElementById('lib-header');
    if (loader) loader.classList.toggle('hidden', !show);
    if (content) content.classList.toggle('is-loading', show);
    if (dropZone) dropZone.classList.toggle('loading-books', show);
    if (!show) {
      if (dropZone) dropZone.classList.remove('loading-books');
    }
  }

  function hideLibraryLoading() {
    showLibraryLoading(false);
  }

  return {
    init,
    openLibrary,
    openReader
  };
})();

// Bootstrap application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
