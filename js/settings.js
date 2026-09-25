/**
 * Lirune Reader — Reader Display Settings (Typography, Spacing, Flow & Layout)
 */

const ReaderSettings = (() => {
  const DEFAULT_SETTINGS = {
    fontSize: 18,
    fontFamily: 'Cormorant Garamond',
    alignment: 'left',
    lineHeight: 1.6,
    margin: 10,
    flow: 'paginated',
    spread: 'auto'
  };

  let currentSettings = { ...DEFAULT_SETTINGS };
  let currentZoom = 100;
  let persistTimer = null;
  let zoomChangeTimer = null;
  let zoomOverlayVisible = false;

  function normalizeSettings(settings) {
    const merged = { ...DEFAULT_SETTINGS, ...settings };
    const allowedFonts = ['Cormorant Garamond', 'Lora', 'Playfair Display', 'Inter', 'Georgia', 'JetBrains Mono', 'Original'];
    merged.fontSize = Math.min(36, Math.max(12, Number(merged.fontSize) || DEFAULT_SETTINGS.fontSize));
    merged.fontFamily = allowedFonts.includes(merged.fontFamily) ? merged.fontFamily : DEFAULT_SETTINGS.fontFamily;
    merged.alignment = ['left', 'center', 'right', 'justify'].includes(merged.alignment) ? merged.alignment : DEFAULT_SETTINGS.alignment;
    merged.lineHeight = Math.min(2.4, Math.max(1.2, Number(merged.lineHeight) || DEFAULT_SETTINGS.lineHeight));
    merged.margin = Math.min(24, Math.max(2, Number(merged.margin) || DEFAULT_SETTINGS.margin));
    merged.flow = ['paginated', 'scrolled'].includes(merged.flow) ? merged.flow : DEFAULT_SETTINGS.flow;
    merged.spread = ['auto', 'none'].includes(merged.spread) ? merged.spread : DEFAULT_SETTINGS.spread;
    return merged;
  }

  async function init() {
    const saved = await NoveraDB.getPref('readerSettings', DEFAULT_SETTINGS);
    currentSettings = normalizeSettings(saved);
    updateUI();
    bindEvents();
    bindZoomEvents();
  }

  function getSettings() {
    return { ...currentSettings, zoom: currentZoom };
  }

function updateUI() {
    // Font size display
    const fontSizeDisplay = document.getElementById('font-size-display');
    if (fontSizeDisplay) fontSizeDisplay.textContent = `${currentSettings.fontSize}px`;

    // Typeface active state
    document.querySelectorAll('.font-opt').forEach(opt => {
      opt.classList.toggle('active', opt.dataset.font === currentSettings.fontFamily);
    });

    document.querySelectorAll('[data-alignment]').forEach(option => {
      const isActive = option.dataset.alignment === currentSettings.alignment;
      option.classList.toggle('active', isActive);
      option.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    // Spacing slider & value
    const spacingSlider = document.getElementById('spacing-slider');
    const spacingVal = document.getElementById('spacing-val');
    if (spacingSlider) spacingSlider.value = currentSettings.lineHeight;
    if (spacingVal) spacingVal.textContent = currentSettings.lineHeight.toFixed(1);

    // Margin slider & value
    const marginSlider = document.getElementById('margin-slider');
    const marginVal = document.getElementById('margin-val');
    if (marginSlider) marginSlider.value = currentSettings.margin;
    if (marginVal) marginVal.textContent = `${currentSettings.margin}%`;

    // Zoom display (runtime only)
    const zoomDisplay = document.getElementById('zoom-display');
    if (zoomDisplay) zoomDisplay.textContent = `${currentZoom}%`;

    // Flow buttons
    const flowPaginated = document.getElementById('flow-paginated-btn');
    const flowScrolled = document.getElementById('flow-scrolled-btn');
    if (flowPaginated) flowPaginated.classList.toggle('active', currentSettings.flow === 'paginated');
    if (flowScrolled) flowScrolled.classList.toggle('active', currentSettings.flow === 'scrolled');

    // Spread buttons
    const spreadAuto = document.getElementById('spread-auto-btn');
    const spreadSingle = document.getElementById('spread-single-btn');
    if (spreadAuto) spreadAuto.classList.toggle('active', currentSettings.spread === 'auto');
    if (spreadSingle) spreadSingle.classList.toggle('active', currentSettings.spread === 'none');
  }

  function setSetting(key, val, shouldApply = true) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) return;
    currentSettings = normalizeSettings({ ...currentSettings, [key]: val });
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => NoveraDB.setPref('readerSettings', currentSettings), 250);
    updateUI();

    if (shouldApply && typeof EpubLoader !== 'undefined') {
      EpubLoader.applySettings({ ...currentSettings, zoom: currentZoom });
    }
  }

  function adjustZoom(delta) {
    const newZoom = Math.min(200, Math.max(50, currentZoom + delta));
    if (newZoom !== currentZoom) {
      currentZoom = newZoom;
      updateUI();
      if (typeof EpubLoader !== 'undefined') {
        EpubLoader.applySettings({ ...currentSettings, zoom: currentZoom });
      }
      showZoomOverlay();
    }
  }

  function setZoom(zoom) {
    const newZoom = Math.min(200, Math.max(50, zoom));
    if (newZoom !== currentZoom) {
      currentZoom = newZoom;
      updateUI();
      if (typeof EpubLoader !== 'undefined') {
        EpubLoader.applySettings({ ...currentSettings, zoom: currentZoom });
      }
      showZoomOverlay();
    }
  }

  function showZoomOverlay() {
    const overlay = document.getElementById('zoom-overlay');
    if (!overlay) return;
    const zoomDisplay = document.getElementById('zoom-overlay-value');
    if (zoomDisplay) zoomDisplay.textContent = `${currentZoom}%`;
    overlay.classList.add('visible');
    zoomOverlayVisible = true;
    clearTimeout(zoomChangeTimer);
    zoomChangeTimer = setTimeout(() => {
      overlay.classList.remove('visible');
      zoomOverlayVisible = false;
    }, 2000);
  }

  function bindZoomEvents() {
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const zoomInBtn = document.getElementById('zoom-in-btn');
    if (zoomOutBtn) {
      zoomOutBtn.addEventListener('click', () => adjustZoom(-10));
    }
    if (zoomInBtn) {
      zoomInBtn.addEventListener('click', () => adjustZoom(10));
    }

    const overlay = document.getElementById('zoom-overlay');
    if (overlay) {
      overlay.addEventListener('pointerenter', () => {
        clearTimeout(zoomChangeTimer);
      });
      overlay.addEventListener('pointerleave', () => {
        clearTimeout(zoomChangeTimer);
        zoomChangeTimer = setTimeout(() => {
          overlay.classList.remove('visible');
          zoomOverlayVisible = false;
        }, 1200);
      });
    }
  }

  function bindEvents() {
    // Font size stepper
    const decBtn = document.getElementById('font-decrease');
    const incBtn = document.getElementById('font-increase');
    if (decBtn) {
      decBtn.addEventListener('click', () => {
        if (currentSettings.fontSize > 12) {
          setSetting('fontSize', currentSettings.fontSize - 2);
        }
      });
    }
    if (incBtn) {
      incBtn.addEventListener('click', () => {
        if (currentSettings.fontSize < 36) {
          setSetting('fontSize', currentSettings.fontSize + 2);
        }
      });
    }

    // Typeface grid
    document.querySelectorAll('.font-opt').forEach(opt => {
      opt.addEventListener('click', () => {
        setSetting('fontFamily', opt.dataset.font);
      });
    });

    document.querySelectorAll('[data-alignment]').forEach(option => {
      option.addEventListener('click', () => {
        setSetting('alignment', option.dataset.alignment);
      });
    });

    // Spacing slider
    const spacingSlider = document.getElementById('spacing-slider');
    if (spacingSlider) {
      spacingSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        setSetting('lineHeight', val);
      });
    }

    // Margin slider
    const marginSlider = document.getElementById('margin-slider');
    if (marginSlider) {
      marginSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        setSetting('margin', val);
      });
    }


    // Flow mode buttons
    const flowPaginated = document.getElementById('flow-paginated-btn');
    const flowScrolled = document.getElementById('flow-scrolled-btn');
    if (flowPaginated) {
      flowPaginated.addEventListener('click', () => {
        if (currentSettings.flow !== 'paginated') {
          setSetting('flow', 'paginated');
          if (typeof EpubLoader !== 'undefined' && EpubLoader.isLoaded()) {
            EpubLoader.reRender();
          }
        }
      });
    }
    if (flowScrolled) {
      flowScrolled.addEventListener('click', () => {
        if (currentSettings.flow !== 'scrolled') {
          setSetting('flow', 'scrolled');
          if (typeof EpubLoader !== 'undefined' && EpubLoader.isLoaded()) {
            EpubLoader.reRender();
          }
        }
      });
    }

    // Spread buttons
    const spreadAuto = document.getElementById('spread-auto-btn');
    const spreadSingle = document.getElementById('spread-single-btn');
    if (spreadAuto) {
      spreadAuto.addEventListener('click', () => {
        if (currentSettings.spread !== 'auto') {
          setSetting('spread', 'auto');
          if (typeof EpubLoader !== 'undefined' && EpubLoader.isLoaded()) {
            EpubLoader.reRender();
          }
        }
      });
    }
    if (spreadSingle) {
      spreadSingle.addEventListener('click', () => {
        if (currentSettings.spread !== 'none') {
          setSetting('spread', 'none');
          if (typeof EpubLoader !== 'undefined' && EpubLoader.isLoaded()) {
            EpubLoader.reRender();
          }
        }
      });
    }

    const resetButton = document.getElementById('reset-reader-settings-btn');
    if (resetButton) {
      resetButton.addEventListener('click', () => {
        currentSettings = { ...DEFAULT_SETTINGS };
        clearTimeout(persistTimer);
        persistTimer = setTimeout(() => NoveraDB.setPref('readerSettings', currentSettings), 0);
        updateUI();
        if (typeof EpubLoader !== 'undefined' && EpubLoader.isLoaded()) EpubLoader.reRender();
      });
    }
  }

  return {
    init,
    getSettings,
    setSetting,
    adjustZoom,
    setZoom,
    showZoomOverlay,
    getZoom: () => currentZoom,
    setZoomDirect: (val) => { currentZoom = Math.min(200, Math.max(50, val)); }
  };
})();
