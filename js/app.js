/**
 * Folio — Main Application Coordinator
 * Boots app, manages view transitions, drawer panels, modals, and hotkeys.
 */

const App = (() => {
  let activeView = 'library'; // 'library' | 'reader'
  let currentBookId = null;
  let focusMode = false;
  let nativeFullscreen = false;

  async function init() {
    // Initialize subsystem managers in sequence
    await ThemeManager.init();
    await ReaderSettings.init();
    await Library.init();

    bindNavigationEvents();
    bindDrawersAndModals();
    bindSelectionToolbar();
    bindKeyboardShortcuts();
    bindSearchOverlay();
    bindFullscreenState();

    console.log('Novera EPUB Reader successfully initialized');
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
    const book = await FolioDB.getBook(bookId);
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

    await EpubLoader.openBook(book);
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
  }

  async function toggleFullscreen() {
    const entering = !focusMode;
    setFocusMode(entering);

    if (window.folioDesktop?.toggleNativeFullscreen) {
      const isNative = await window.folioDesktop.isNativeFullscreen();
      if (isNative !== entering) await window.folioDesktop.toggleNativeFullscreen();
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

    window.folioDesktop?.onNativeFullscreenChanged((isFullscreen) => {
      nativeFullscreen = isFullscreen;
      setFocusMode(isFullscreen);
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
      document.getElementById('library-settings-btn')
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
          if (nativeFullscreen && window.folioDesktop?.toggleNativeFullscreen) {
            window.folioDesktop.toggleNativeFullscreen();
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
        if (e.key === 'ArrowRight' || e.key === ' ' || e.key.toLowerCase() === 'j') {
          if (!e.shiftKey) {
            e.preventDefault();
            EpubLoader.next();
          }
        } else if (e.key === 'ArrowLeft' || (e.key === ' ' && e.shiftKey) || e.key.toLowerCase() === 'k') {
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
