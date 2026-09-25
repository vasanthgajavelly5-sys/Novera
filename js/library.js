/**
 * Lirune Reader — Library Management System
 * Handles drag-and-drop, EPUB ingestion, IndexedDB persistence,
 * library rendering, search, sort, and sample book generation.
 */

const Library = (() => {
  let allBooks = [];
  let currentSort = 'recent';
  let currentFilter = 'all';
  let currentCollection = 'all';
  let collections = [];
  let searchQuery = '';
  let isListView = false;
  let activeContextBook = null;
  let deleteConfirmationResolver = null;
  let isLoading = true;

  async function init() {
    bindDropAndFileInput();
    bindSearchAndSort();
    bindModals();
    document.getElementById('integrity-check-btn')?.addEventListener('click', checkIntegrity);
    document.getElementById('export-annotations-btn')?.addEventListener('click', exportAnnotations);
    document.getElementById('backup-library-btn')?.addEventListener('click', backupMetadata);
    document.getElementById('restore-library-input')?.addEventListener('change', restoreMetadata);
    collections = await NoveraDB.getCollections();
    renderCollectionOptions();
    await loadAndRenderBooks();
  }

  async function loadAndRenderBooks() {
    isLoading = true;
    try {
      allBooks = await NoveraDB.getAllBooks();
    } finally {
      isLoading = false;
    }
    renderLibraryUI();
  }

  function renderLibraryUI() {
    if (isLoading) return;

    const dropZone = document.getElementById('drop-zone');
    const libHeader = document.getElementById('lib-header');
    const continueSection = document.getElementById('continue-section');
    const booksGrid = document.getElementById('books-grid');
    const emptyState = document.getElementById('empty-state');
    const bookCount = document.getElementById('book-count');

    // Filter books by search query
    let filtered = allBooks.filter(book => {
      const progress = Number(book.progressPercent) || 0;
      if (currentCollection !== 'all' && !book.collectionIds?.includes(currentCollection)) return false;
      if (currentFilter === 'unread' && progress > 0) return false;
      if (currentFilter === 'progress' && (progress <= 0 || progress >= 100)) return false;
      if (currentFilter === 'finished' && progress < 100) return false;
      if (currentFilter === 'favorites' && !book.favorite) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (book.title && book.title.toLowerCase().includes(q)) ||
             (book.author && book.author.toLowerCase().includes(q));
    });

    // Sort books
    sortBooks(filtered, currentSort);

    if (allBooks.length === 0) {
      // Empty library: show hero drop zone
      if (dropZone) dropZone.classList.remove('has-books');
      if (libHeader) libHeader.classList.remove('visible');
      if (continueSection) continueSection.classList.remove('visible');
      if (booksGrid) booksGrid.classList.remove('visible');
      if (emptyState) emptyState.classList.add('hidden');
      return;
    }

    // Has books: hide standalone drop zone, show library view
    if (dropZone) dropZone.classList.add('has-books');
    if (libHeader) libHeader.classList.add('visible');
    if (booksGrid) booksGrid.classList.add('visible');

    if (bookCount) {
      bookCount.textContent = `${allBooks.length} book${allBooks.length === 1 ? '' : 's'}`;
    }

    // Render "Continue Reading" strip for most recently read book
    renderContinueReading();

    // Check if search returned zero results
    if (filtered.length === 0 && (searchQuery || currentFilter !== 'all')) {
      if (booksGrid) booksGrid.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }
    if (emptyState) emptyState.classList.add('hidden');

    // Render book cards in grid / list
    renderBookCards(filtered);
  }

  function renderContinueReading() {
    const continueSection = document.getElementById('continue-section');
    const continueCard = document.getElementById('continue-card');
    if (!continueSection || !continueCard) return;

    // Find the book with most recent lastReadDate > 0
    const readBooks = allBooks.filter(b => b.lastReadDate && b.lastReadDate > 0);
    if (readBooks.length === 0) {
      continueSection.classList.remove('visible');
      return;
    }

    readBooks.sort((a, b) => b.lastReadDate - a.lastReadDate);
    const book = readBooks[0];

    const pct = book.progressPercent || 0;
    const coverHtml = book.coverDataUrl
      ? `<img src="${book.coverDataUrl}" alt="${Utils.escapeHTML(book.title)}" class="continue-cover">`
      : `<div class="continue-cover-fallback">
           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
         </div>`;

    continueCard.innerHTML = `
      ${coverHtml}
      <div class="continue-info">
        <div class="continue-title">${Utils.escapeHTML(book.title)}</div>
        <div class="continue-author">${Utils.escapeHTML(book.author || 'Unknown')}</div>
        <div class="continue-progress-row">
          <div class="continue-progress-bar">
            <div class="continue-progress-fill" style="width:${pct}%"></div>
          </div>
          <span class="continue-pct">${pct}%</span>
        </div>
        <div class="continue-chapter">${Utils.escapeHTML(book.currentChapter || 'Reading')}</div>
      </div>
      <div class="continue-action">
        <button class="btn btn-accent btn-sm" aria-label="Resume reading">Resume</button>
      </div>
    `;

    continueCard.onclick = () => App.openReader(book.id);
    continueSection.classList.add('visible');
  }

  async function hydrateChapterCount(book, card) {
    if (!book || Number.isFinite(Number(book.chapterCount)) || !window.ePub) return;
    try {
      let epubData = book.fileData;
      if (!epubData && book.storageId && window.noveraDesktop?.readManagedBook) {
        epubData = await window.noveraDesktop.readManagedBook(book.storageId, book.fingerprint, book.fileSize);
      }
      if (!epubData) return;

      const tempBook = ePub(epubData);
      let count = 0;
      try {
        const navigation = await tempBook.loaded.navigation;
        const flatten = (items) => {
          let total = 0;
          for (const item of (items || [])) {
            total += 1;
            if (item.subitems?.length) total += flatten(item.subitems);
          }
          return total;
        };
        count = flatten(navigation?.toc);
        if (!count) {
          await tempBook.ready;
          count = tempBook.spine?.spineItems?.length || 0;
        }
      } finally {
        tempBook.destroy();
      }

      if (!count) return;
      book.chapterCount = count;
      await NoveraDB.updateBookMetadata(book.id, { chapterCount: count });

      const chapterEl = card?.querySelector('.card-chapter-count');
      if (chapterEl) {
        chapterEl.textContent = `${count} chapter${count === 1 ? '' : 's'}`;
        chapterEl.classList.remove('is-loading');
      }
    } catch (error) {
      console.warn(`Could not determine chapter count for ${book.title || book.id}:`, error);
    }
  }

  function observeMissingChapterCounts(books, grid) {
    if (!isListView || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const card = entry.target;
        observer.unobserve(card);
        const book = books.find(item => item.id === card.dataset.bookId);
        if (book && !Number.isFinite(Number(book.chapterCount))) {
          hydrateChapterCount(book, card);
        }
      });
    }, { root: null, rootMargin: '160px 0px' });

    grid.querySelectorAll('.book-card[data-book-id]').forEach(card => {
      const book = books.find(item => item.id === card.dataset.bookId);
      if (book && !Number.isFinite(Number(book.chapterCount))) observer.observe(card);
    });
  }

  function renderBookCards(books) {
    const grid = document.getElementById('books-grid');
    if (!grid) return;
    grid.innerHTML = '';
    grid.className = isListView ? 'books-grid list-view visible' : 'books-grid visible';

    books.forEach(book => {
      const card = document.createElement('div');
      card.className = 'book-card';
      card.dataset.bookId = book.id;
      card.setAttribute('role', 'listitem');
      card.setAttribute('tabindex', '0');

      const pct = book.progressPercent || 0;
      const unavailable = book.availability === 'unavailable';

      const coverHtml = book.coverDataUrl
        ? `<img src="${book.coverDataUrl}" alt="${Utils.escapeHTML(book.title)}" class="card-cover" loading="lazy">`
        : `<div class="card-cover-fallback">
             <svg class="card-fallback-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
             <span class="card-fallback-title">${Utils.escapeHTML(book.title)}</span>
           </div>`;

      card.innerHTML = `
        <div class="card-cover-wrap">
          ${coverHtml}
          ${unavailable ? '<div class="card-badge card-badge-warning">File unavailable</div>' : ''}
            <button class="card-fav ${book.favorite ? 'visible' : ''}" type="button" aria-label="${book.favorite ? 'Remove from favorites' : 'Add to favorites'}" title="${book.favorite ? 'Remove from favorites' : 'Add to favorites'}">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="${book.favorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.8 8.8c0 5.5-8.8 10.2-8.8 10.2S3.2 14.3 3.2 8.8A4.6 4.6 0 0 1 12 6.1a4.6 4.6 0 0 1 8.8 2.7Z"/></svg>
            </button>
          ${pct > 0 ? `<div class="card-progress-bar"><div class="card-progress-fill" style="width:${pct}%"></div></div>` : ''}
          ${pct >= 100 ? `<div class="card-badge">Completed</div>` : (pct > 0 ? `<div class="card-badge">${pct}%</div>` : '')}
        </div>
        <div class="card-meta">
          <div class="card-title" title="${Utils.escapeHTML(book.title)}">${Utils.escapeHTML(book.title)}</div>
          <div class="card-author">${Utils.escapeHTML(book.author || 'Unknown')}</div>
        </div>
        ${isListView ? `<div class="card-chapter-count ${Number.isFinite(Number(book.chapterCount)) ? '' : 'is-loading'}">${Number.isFinite(Number(book.chapterCount)) ? `${book.chapterCount} chapter${Number(book.chapterCount) === 1 ? '' : 's'}` : 'Chapters'}</div>` : ''}
      `;

      const favoriteButton = card.querySelector('.card-fav');
      favoriteButton?.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        favoriteButton.disabled = true;
        try {
          const newFavorite = await NoveraDB.updateFavorite(book.id, !book.favorite);
          if (newFavorite === null) return;
          book.favorite = newFavorite;
          updateFavoriteCard(card, newFavorite);
        } catch (error) {
          console.error('Failed to update favorite:', error);
          Utils.toast('Could not update favorite', 'error');
        } finally {
          favoriteButton.disabled = false;
        }
      });

      // Click to open book
      card.addEventListener('click', (e) => {
        App.openReader(book.id);
      });

      // Context menu on right click
      card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        openContextMenu(e.clientX, e.clientY, book);
      });

      // Keyboard support
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          App.openReader(book.id);
        }
      });

      grid.appendChild(card);
    });

    if (isListView) {
      // Only calculate missing counts as rows approach the viewport. This keeps large libraries responsive.
      observeMissingChapterCounts(books, grid);
    }
  }

  function updateFavoriteCard(card, isFavorite) {
    const favBtn = card.querySelector('.card-fav');
    if (!favBtn) return;
    favBtn.classList.toggle('visible', isFavorite);
    favBtn.setAttribute('aria-label', isFavorite ? 'Remove from favorites' : 'Add to favorites');
    favBtn.setAttribute('title', isFavorite ? 'Remove from favorites' : 'Add to favorites');
    const svg = favBtn.querySelector('svg');
    if (svg) svg.setAttribute('fill', isFavorite ? 'currentColor' : 'none');
  }

  function sortBooks(books, criterion) {
    switch (criterion) {
      case 'recent':
        books.sort((a, b) => (b.lastReadDate || 0) - (a.lastReadDate || 0));
        break;
      case 'added':
        books.sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0));
        break;
      case 'title':
        books.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        break;
      case 'author':
        books.sort((a, b) => (a.author || '').localeCompare(b.author || ''));
        break;
      case 'progress':
        books.sort((a, b) => (b.progressPercent || 0) - (a.progressPercent || 0));
        break;
    }
  }

  // File drag-and-drop & Picker handlers
  function bindDropAndFileInput() {
    const fileInput = document.getElementById('file-input');
    const browseBtn = document.getElementById('browse-btn');
    const addBtn = document.getElementById('add-book-btn');
    const addMoreBtn = document.getElementById('add-more-btn');
    const dropZone = document.getElementById('drop-zone');

    const importModal = document.getElementById('import-modal');
    const closeImportBtn = document.getElementById('close-import-btn');
    const importFileBtn = document.getElementById('import-file-btn');
    const importFolderBtn = document.getElementById('import-folder-btn');
    const importProgress = document.getElementById('import-progress');
    const importProgressLabel = document.getElementById('import-progress-label');
    const importProgressPercent = document.getElementById('import-progress-percent');
    const importProgressFill = document.getElementById('import-progress-fill');

    const closeImport = () => importModal?.classList.add('hidden');
    const openImport = () => {
      updateImportProgress(0, '', false);
      importModal?.classList.remove('hidden');
    };
    const showImportErrors = (errors) => {
      if (!errors || errors.length === 0) return;
      const first = errors.slice(0, 3).map(item => `${item.name}: ${item.error}`).join(' | ');
      Utils.toast(`${errors.length} file${errors.length === 1 ? '' : 's'} skipped. ${first}`, 'error');
    };
    const updateImportProgress = (percent, label = '', visible = true) => {
      const value = Math.max(0, Math.min(100, Math.round(percent)));
      if (importProgress) importProgress.hidden = !visible;
      if (importProgressLabel && label) importProgressLabel.textContent = label;
      if (importProgressPercent) importProgressPercent.textContent = `${value}%`;
      if (importProgressFill) importProgressFill.style.width = `${value}%`;
      const track = importProgress?.querySelector('[role="progressbar"]');
      if (track) track.setAttribute('aria-valuenow', String(value));
    };

    const handleFileChoice = async () => {
      if (window.noveraDesktop?.openFileDialog) {
        const result = await window.noveraDesktop.openFileDialog();
        showImportErrors(result.errors);
        if (!result.canceled && result.files?.length) await processNativeFiles(result.files, null, updateImportProgress);
      } else {
        closeImport();
        fileInput?.click();
      }
    };
    const handleFolderChoice = async () => {
      if (!window.noveraDesktop?.openFolderDialog) {
        Utils.toast('Folder import is available in the desktop app', 'info');
        return;
      }
      updateImportProgress(0, 'Scanning folder...');
      const result = await window.noveraDesktop.openFolderDialog();
      showImportErrors(result.errors);
      if (!result.canceled && result.files?.length) await processNativeFiles(result.files, null, updateImportProgress);
      else if (!result.canceled) updateImportProgress(0, 'No EPUB files found in that folder.');
    };

    [browseBtn, addBtn, addMoreBtn].forEach(btn => {
      if (btn) btn.addEventListener('click', openImport);
    });
    closeImportBtn?.addEventListener('click', closeImport);
    importModal?.addEventListener('click', (event) => {
      if (event.target === importModal) closeImport();
    });
    importFileBtn?.addEventListener('click', handleFileChoice);
    importFolderBtn?.addEventListener('click', handleFolderChoice);

    const sampleBookBtn = document.getElementById('sample-book-btn');
    if (sampleBookBtn) {
      sampleBookBtn.addEventListener('click', () => {
        generateSampleBook();
      });
    }

    // File input change (browser/fallback)
    if (fileInput) {
      fileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
          await processFiles(files);
          fileInput.value = '';
        }
      });
    }

    // Windows OS launch / Double-click EPUB file listener
    if (window.noveraDesktop && window.noveraDesktop.onOpenFile) {
      window.noveraDesktop.onOpenFile(async (filePath) => {
        Utils.toast('Opening book from Windows...', 'info');
        const existing = allBooks.find(b => b.sourcePath === filePath || b.diskPath === filePath);
        if (existing) {
          App.openReader(existing.id);
          return;
        }

        try {
          const file = await window.noveraDesktop.readEpubFile(filePath);
          await processNativeFiles([file]);
          await loadAndRenderBooks();
          const imported = allBooks.find(b => b.sourcePath === file.path);
          if (imported) App.openReader(imported.id);
        } catch (err) {
          console.error('Failed to open EPUB from Windows:', err);
          Utils.toast('Could not open the selected EPUB', 'error');
        }
      });
    }

    // Drag-and-drop on entire document
    let dragCounter = 0;

    window.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragCounter++;
      if (dropZone) dropZone.classList.add('drag-active');
    });

    window.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        if (dropZone) dropZone.classList.remove('drag-active');
      }
    });

    window.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    window.addEventListener('drop', async (e) => {
      e.preventDefault();
      dragCounter = 0;
      if (dropZone) dropZone.classList.remove('drag-active');

      const files = Array.from(e.dataTransfer?.files || []);
      const epubs = files.filter(f => f.name.toLowerCase().endsWith('.epub') || f.type.includes('epub'));

      if (epubs.length === 0) {
        Utils.toast('Please drop valid .epub files', 'error');
        return;
      }

      await processFiles(epubs);
    });
  }

  async function processNativeFiles(fileList, _setStatus, updateProgress) {
    Utils.toast(`Importing ${fileList.length} book${fileList.length === 1 ? '' : 's'}...`);

    let importedCount = 0;
    const errors = [];
    for (const [index, file] of fileList.entries()) {
      let savedStorageId = null;
      try {
        const completed = Math.round((index / fileList.length) * 100);
        updateProgress?.(completed, `Importing ${index + 1} of ${fileList.length}: ${file.name}`);
        const existing = allBooks.find(book => book.sourcePath === file.path || book.diskPath === file.path);
        if (existing) {
          continue;
        }

        const bookData = await parseEpubMetadata(file.data, file.name, file.size);
        bookData.fingerprint = await getFingerprint(file.data, file.size, file.name);
        if (allBooks.some(book => book.fingerprint && book.fingerprint === bookData.fingerprint)) continue;
        bookData.sourcePath = file.path;

        // Persist copy in AppData storage if needed
        if (window.noveraDesktop && window.noveraDesktop.saveBookToStorage) {
          const res = await window.noveraDesktop.saveBookToStorage(file.name, file.data, `${bookData.fingerprint}.epub`);
          if (res && res.success) {
            bookData.storageId = res.storageId;
            savedStorageId = res.storageId;
          } else {
            throw new Error(res?.error || 'Could not save EPUB to managed storage');
          }
        }

        await NoveraDB.saveBook(bookData);
        importedCount++;
      } catch (err) {
        console.error('Failed to import EPUB:', file.name, err);
        if (savedStorageId) {
          try { await window.noveraDesktop.deleteBookFromStorage(savedStorageId); } catch (_) {}
        }
        errors.push({ name: file.name, error: err.message || 'Unreadable EPUB' });
      }
    }

    updateProgress?.(100, `Finished: ${importedCount} book${importedCount === 1 ? '' : 's'} imported`);
    showBatchErrors(errors);
    if (importedCount > 0) {
      Utils.toast(`Added ${importedCount} book${importedCount === 1 ? '' : 's'} to library`, 'success');
      await loadAndRenderBooks();
    }
  }

  async function processFiles(fileList) {
    Utils.toast(`Importing ${fileList.length} book${fileList.length === 1 ? '' : 's'}...`);

    let importedCount = 0;
    for (const file of fileList) {
      let savedStorageId = null;
      try {
        const arrayBuffer = await file.arrayBuffer();
        await validateEpubArchive(arrayBuffer);
        const bookData = await parseEpubMetadata(arrayBuffer, file.name, file.size);
        bookData.fingerprint = await getFingerprint(arrayBuffer, file.size, file.name);
        if (allBooks.some(book => book.fingerprint && book.fingerprint === bookData.fingerprint)) continue;

        // If on desktop, save copy to AppData
        if (window.noveraDesktop && window.noveraDesktop.saveBookToStorage) {
          const res = await window.noveraDesktop.saveBookToStorage(file.name, arrayBuffer, `${bookData.fingerprint}.epub`);
          if (res && res.success) {
            bookData.storageId = res.storageId;
            savedStorageId = res.storageId;
          } else {
            throw new Error(res?.error || 'Could not save EPUB to managed storage');
          }
        }

        await NoveraDB.saveBook(bookData);
        importedCount++;
      } catch (err) {
        console.error('Failed to import EPUB:', file.name, err);
        if (savedStorageId) {
          try { await window.noveraDesktop.deleteBookFromStorage(savedStorageId); } catch (_) {}
        }
        Utils.toast(`Could not import "${file.name}"`, 'error');
      }
    }

    if (importedCount > 0) {
      Utils.toast(`Added ${importedCount} book${importedCount === 1 ? '' : 's'} to library`, 'success');
      await loadAndRenderBooks();
    }
  }

  function showBatchErrors(errors) {
    if (!errors.length) return;
    const first = errors.slice(0, 3).map(item => `${item.name}: ${item.error}`).join(' | ');
    Utils.toast(`${errors.length} EPUB${errors.length === 1 ? '' : 's'} could not be imported. ${first}`, 'error');
  }

  async function validateEpubArchive(arrayBuffer) {
    if (!window.JSZip) throw new Error('EPUB validation is unavailable');
    const bytes = new Uint8Array(arrayBuffer);
    if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error('Not a readable ZIP archive');
    const zip = await JSZip.loadAsync(arrayBuffer);
    if (zip.file('META-INF/rights.xml')) throw new Error('DRM-protected EPUBs are not supported');
    if (zip.file('META-INF/encryption.xml')) throw new Error('Encrypted EPUB resources are not supported');
    const container = zip.file('META-INF/container.xml');
    if (!container) throw new Error('Missing META-INF/container.xml');
    const xml = await container.async('text');
    const match = xml.match(/full-path\s*=\s*["']([^"']+)["']/i);
    if (!match || !zip.file(match[1])) throw new Error('Missing EPUB package document (OPF)');
  }

  async function getFingerprint(data, size, name) {
    if (window.crypto?.subtle) {
      const digest = await window.crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
    }
    return `${size}:${name}`;
  }

  async function parseEpubMetadata(arrayBuffer, fileName, fileSize) {
    const tempBook = ePub(arrayBuffer);
    let title = fileName.replace(/\.epub$/i, '');
    let author = 'Unknown Author';
    let description = '';
    let coverDataUrl = null;

    try {
      const meta = await tempBook.loaded.metadata;
      if (meta) {
        if (meta.title) title = meta.title;
        if (meta.creator) author = meta.creator;
        if (meta.description) description = meta.description;
      }

      // Extract cover image
      try {
        const coverUrl = await tempBook.coverUrl();
        if (coverUrl) {
          coverDataUrl = await urlToDataUrl(coverUrl);
        }
      } catch (covErr) {
        console.warn('Cover extraction failed:', covErr);
      }
    } catch (e) {
      console.warn('Metadata load error, using defaults:', e);
    }

    let chapterCount = null;
    try {
      const navigation = await tempBook.loaded.navigation;
      const flatten = (items) => {
        let total = 0;
        for (const item of (items || [])) {
          total += 1;
          if (item.subitems?.length) total += flatten(item.subitems);
        }
        return total;
      };
      chapterCount = flatten(navigation?.toc) || null;
    } catch (_) {
      chapterCount = null;
    } finally {
      tempBook.destroy();
    }

    return {
      id: Utils.generateId(),
      title,
      author,
      description,
      chapterCount,
      coverDataUrl,
      ...(window.noveraDesktop ? {} : { fileData: arrayBuffer }),
      originalName: fileName,
      schemaVersion: 2,
      fileSize: fileSize || arrayBuffer.byteLength,
      dateAdded: Date.now(),
      lastReadDate: 0,
      currentCfi: null,
      progressPercent: 0,
      currentChapter: 'Not started'
    };
  }

  function urlToDataUrl(url) {
    return new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve(null);
        }
      }, 4000);

      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try {
          if (!img.naturalWidth || !img.naturalHeight) {
            return resolve(null);
          }
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(null);
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } catch (e) {
          console.warn('Canvas toDataURL failed:', e);
          resolve(null);
        }
      };
      img.onerror = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(null);
      };
      img.src = url;
    });
  }

  // Search & Filter & Sort binding
  function bindSearchAndSort() {
    const searchInput = document.getElementById('lib-search-input');
    const clearBtn = document.getElementById('clear-search-btn');
    const sortSelect = document.getElementById('sort-select');
    const filterSelect = document.getElementById('filter-select');
    const collectionSelect = document.getElementById('collection-select');
    const viewToggle = document.getElementById('view-toggle-btn');

    if (searchInput) {
      searchInput.addEventListener('input', Utils.debounce((e) => {
        searchQuery = e.target.value.trim();
        renderLibraryUI();
      }, 150));
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        searchQuery = '';
        renderLibraryUI();
      });
    }

    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        renderLibraryUI();
      });
    }

    if (filterSelect) {
      filterSelect.addEventListener('change', (e) => {
        currentFilter = e.target.value;
        renderLibraryUI();
      });
    }

    if (viewToggle) {
      viewToggle.addEventListener('click', () => {
        isListView = !isListView;
        viewToggle.classList.toggle('active', isListView);
        renderLibraryUI();
      });
    }

    collectionSelect?.addEventListener('change', event => {
      const value = event.target.value;
      if (value === '__new__') {
        event.target.value = currentCollection;
        openCollectionModal();
        return;
      }
      currentCollection = value;
      renderLibraryUI();
    });

    const collectionModal = document.getElementById('collection-modal');
    const collectionInput = document.getElementById('collection-name-input');
    const saveCollectionBtn = document.getElementById('save-collection-btn');
    const closeCollectionBtn = document.getElementById('close-collection-btn');
    const cancelCollectionBtn = document.getElementById('cancel-collection-btn');

    const closeCollectionModal = () => {
      collectionModal?.classList.add('hidden');
      if (collectionInput) collectionInput.value = '';
      clearCollectionError();
    };

    closeCollectionBtn?.addEventListener('click', closeCollectionModal);
    cancelCollectionBtn?.addEventListener('click', closeCollectionModal);
    collectionModal?.addEventListener('click', event => {
      if (event.target === collectionModal) closeCollectionModal();
    });
    saveCollectionBtn?.addEventListener('click', () => createCollection(closeCollectionModal));
    collectionInput?.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        createCollection(closeCollectionModal);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        closeCollectionModal();
      }
    });
  }

  function renderCollectionOptions() {
    const select = document.getElementById('collection-select');
    if (!select) return;
    select.replaceChildren(
      new Option('All collections', 'all'),
      new Option('+ New collection…', '__new__')
    );
    collections.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach(collection => {
      select.appendChild(new Option(collection.name, collection.id));
    });
    select.value = currentCollection;
  }

  function clearCollectionError() {
    const error = document.getElementById('collection-name-error');
    if (error) {
      error.hidden = true;
      error.textContent = '';
    }
  }

  function showCollectionError(message) {
    const error = document.getElementById('collection-name-error');
    if (error) {
      error.hidden = false;
      error.textContent = message;
    }
  }

  function openCollectionModal() {
    const modal = document.getElementById('collection-modal');
    const input = document.getElementById('collection-name-input');
    if (!modal || !input) return;

    clearCollectionError();
    input.value = '';
    modal.classList.remove('hidden');
    requestAnimationFrame(() => {
      input.focus();
    });
  }

  async function createCollection(closeModal) {
    const input = document.getElementById('collection-name-input');
    const trimmed = input?.value.trim() || '';
    if (!trimmed) {
      showCollectionError('Enter a collection name.');
      input?.focus();
      return;
    }

    if (collections.some(collection => collection.name.toLowerCase() === trimmed.toLowerCase())) {
      showCollectionError('A collection with that name already exists.');
      input?.focus();
      input?.select();
      return;
    }

    const saveButton = document.getElementById('save-collection-btn');
    if (saveButton) saveButton.disabled = true;

    try {
      const collection = {
        id: Utils.generateId(),
        name: trimmed,
        dateCreated: Date.now()
      };
      await NoveraDB.saveCollection(collection);
      collections.push(collection);
      renderCollectionOptions();
      currentCollection = collection.id;
      const select = document.getElementById('collection-select');
      if (select) select.value = currentCollection;
      renderLibraryUI();
      closeModal?.();
    } catch (error) {
      console.error('Collection creation failed:', error);
      showCollectionError('Could not create the collection. Please try again.');
    } finally {
      if (saveButton) saveButton.disabled = false;
    }
  }

  async function checkIntegrity() {
    if (!window.noveraDesktop?.listManagedBooks) {
      Utils.toast('Integrity checks are available in the desktop app', 'info');
      return;
    }
    try {
      const storedIds = new Set(await window.noveraDesktop.listManagedBooks());
      const missing = allBooks.filter(book => book.storageId && !storedIds.has(book.storageId));
      const legacy = allBooks.filter(book => !book.storageId);
      if (missing.length === 0 && legacy.length === 0) {
        Utils.toast(`Library check complete: ${allBooks.length} healthy book${allBooks.length === 1 ? '' : 's'}.`, 'success');
        return;
      }
      for (const book of missing) {
        if (book.availability !== 'unavailable') await NoveraDB.updateAvailability(book.id, 'unavailable');
        book.availability = 'unavailable';
      }
      renderLibraryUI();
      Utils.toast(`Library check: ${allBooks.length - missing.length - legacy.length} healthy, ${missing.length} missing, ${legacy.length} needing migration.`, 'info', 5000);
    } catch (error) {
      console.error('Library integrity check failed:', error);
      Utils.toast('Could not check library integrity', 'error');
    }
  }

  function downloadText(filename, content, type = 'application/json') {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function backupMetadata() {
    try {
      const [books, annotations, preferences, savedCollections] = await Promise.all([
        NoveraDB.getAllBooks(), NoveraDB.getAllAnnotations(), NoveraDB.getAllPreferences(), NoveraDB.getCollections()
      ]);
      downloadText(`lirune-metadata-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({
        format: 'NOVERA_METADATA_BACKUP', version: 1, createdAt: Date.now(), books, annotations, preferences, collections: savedCollections
      }, null, 2));
      Utils.toast('Metadata backup exported', 'success');
    } catch (error) {
      console.error('Metadata backup failed:', error);
      Utils.toast('Could not create a metadata backup', 'error');
    }
  }

  async function exportAnnotations() {
    try {
      const [annotations, books] = await Promise.all([NoveraDB.getAllAnnotations(), NoveraDB.getAllBooks()]);
      const booksById = new Map(books.map(book => [book.id, book]));
      const markdown = annotations.map(annotation => {
        const book = booksById.get(annotation.bookId) || {};
        return `## ${book.title || 'Untitled'}\n\n- Author: ${book.author || 'Unknown'}\n- Type: ${annotation.type}\n- Chapter: ${annotation.chapter || 'Unknown'}\n- Date: ${new Date(annotation.dateAdded || Date.now()).toLocaleString()}\n\n> ${annotation.text || ''}\n\n${annotation.note ? `Note: ${annotation.note}\n` : ''}`;
      }).join('\n');
      downloadText(`lirune-annotations-${new Date().toISOString().slice(0, 10)}.md`, markdown, 'text/markdown');
      Utils.toast('Annotations exported as Markdown', 'success');
    } catch (error) {
      console.error('Annotation export failed:', error);
      Utils.toast('Could not export annotations', 'error');
    }
  }

  async function restoreMetadata(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text());
      if (backup.format !== 'NOVERA_METADATA_BACKUP' || backup.version !== 1 || !Array.isArray(backup.books) || !Array.isArray(backup.annotations)) {
        throw new Error('Unsupported backup format');
      }
      for (const book of backup.books) await NoveraDB.saveBook(book);
      for (const annotation of backup.annotations) await NoveraDB.saveAnnotation(annotation);
      for (const collection of backup.collections || []) await NoveraDB.saveCollection(collection);
      for (const [key, value] of Object.entries(backup.preferences || {})) await NoveraDB.setPref(key, value);
      await loadAndRenderBooks();
      Utils.toast('Metadata backup restored', 'success');
    } catch (error) {
      console.error('Metadata restore failed:', error);
      Utils.toast('Backup is invalid or could not be restored', 'error');
    }
  }

  // Context Menu & Book Details Modal
  function bindModals() {
    const ctxMenu = document.getElementById('context-menu');
    const ctxRead = document.getElementById('ctx-read');
    const ctxDetails = document.getElementById('ctx-details');
    const ctxDelete = document.getElementById('ctx-delete');
    const ctxCollection = document.getElementById('ctx-collection');
    const deleteModal = document.getElementById('delete-book-modal');
    const cancelDeleteButton = document.getElementById('cancel-delete-book-btn');
    const confirmDeleteButton = document.getElementById('confirm-delete-book-btn');
    const resolveDeleteConfirmation = (confirmed) => {
      deleteModal?.classList.add('hidden');
      const resolve = deleteConfirmationResolver;
      deleteConfirmationResolver = null;
      resolve?.(confirmed);
    };
    cancelDeleteButton?.addEventListener('click', () => resolveDeleteConfirmation(false));
    confirmDeleteButton?.addEventListener('click', () => resolveDeleteConfirmation(true));
    deleteModal?.addEventListener('click', (event) => {
      if (event.target === deleteModal) resolveDeleteConfirmation(false);
    });

    // Close context menu on window click (but not when clicking inside context menu or submenu)
    window.addEventListener('click', (event) => {
      if (ctxMenu && !ctxMenu.contains(event.target)) {
        ctxMenu.classList.add('hidden');
      }
    });

    if (ctxRead) {
      ctxRead.addEventListener('click', () => {
        if (activeContextBook) App.openReader(activeContextBook.id);
      });
    }

    if (ctxDetails) {
      ctxDetails.addEventListener('click', () => {
        if (activeContextBook) openBookDetails(activeContextBook);
      });
    }

    const ctxReveal = document.getElementById('ctx-reveal');
    if (ctxReveal) {
      ctxReveal.addEventListener('click', () => {
        if (activeContextBook && activeContextBook.storageId && window.noveraDesktop) {
          window.noveraDesktop.showInExplorer(activeContextBook.storageId);
        } else {
          Utils.toast('File location on disk not available', 'info');
        }
      });
    }

    if (ctxDelete) {
      ctxDelete.addEventListener('click', async () => {
        if (activeContextBook) {
          await deleteBook(activeContextBook.id);
        }
      });
    }

    ctxCollection?.addEventListener('click', (event) => {
      event.stopPropagation();
      const submenu = document.getElementById('ctx-collection-submenu');
      if (!submenu) return;
      if (!activeContextBook) return;

      // Populate submenu with collections
      const separator = submenu.querySelector('.ctx-sep');
      submenu.querySelectorAll('.ctx-item[data-collection]').forEach(el => el.remove());

      if (collections.length === 0) {
        const newItem = document.createElement('div');
        newItem.className = 'ctx-item';
        newItem.dataset.collection = '__new__';
        newItem.textContent = '+ New collection…';
        submenu.insertBefore(newItem, separator);
      } else {
        collections.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach(collection => {
          const item = document.createElement('div');
          item.className = 'ctx-item';
          item.dataset.collection = collection.id;
          const isIncluded = activeContextBook.collectionIds?.includes(collection.id);
          item.textContent = `${isIncluded ? '✓ ' : ''}${collection.name}`;
          submenu.insertBefore(item, separator);
        });
        const newItem = document.createElement('div');
        newItem.className = 'ctx-item';
        newItem.dataset.collection = '__new__';
        newItem.textContent = '+ New collection…';
        submenu.insertBefore(newItem, separator);
      }

      // Position submenu to the right of parent
      const rect = event.currentTarget.getBoundingClientRect();
      submenu.style.left = `${rect.right + 4}px`;
      submenu.style.top = `${rect.top}px`;
      submenu.classList.remove('hidden');
    });

    // Handle submenu item clicks
    const submenu = document.getElementById('ctx-collection-submenu');
    submenu?.addEventListener('click', async (event) => {
      event.stopPropagation();
      const item = event.target.closest('.ctx-item[data-collection]');
      if (!item || !activeContextBook) return;

      const collectionId = item.dataset.collection;
      submenu.classList.add('hidden');

      if (collectionId === '__new__') {
        openCollectionModal();
        return;
      }

      const collection = collections.find(c => c.id === collectionId);
      if (!collection) return;

      const included = !activeContextBook.collectionIds?.includes(collection.id);
      activeContextBook.collectionIds = await NoveraDB.setBookCollection(activeContextBook.id, collection.id, included);
      await loadAndRenderBooks();
    });

    // Close submenu on outside click (but not when clicking inside submenu)
    window.addEventListener('click', (event) => {
      const submenu = document.getElementById('ctx-collection-submenu');
      if (submenu && !submenu.contains(event.target) && event.target.id !== 'ctx-collection') {
        submenu.classList.add('hidden');
      }
    });

    // Book details modal buttons
    const closeDetailsBtn = document.getElementById('close-details-btn');
    const detailsReadBtn = document.getElementById('details-read-btn');
    const detailsDeleteBtn = document.getElementById('details-delete-btn');
    const detailsModal = document.getElementById('book-details-modal');

    if (closeDetailsBtn) {
      closeDetailsBtn.addEventListener('click', () => {
        detailsModal?.classList.add('hidden');
      });
    }

    if (detailsModal) {
      detailsModal.addEventListener('click', (e) => {
        if (e.target === detailsModal) detailsModal.classList.add('hidden');
      });
    }

    if (detailsReadBtn) {
      detailsReadBtn.addEventListener('click', () => {
        if (activeContextBook) {
          detailsModal?.classList.add('hidden');
          App.openReader(activeContextBook.id);
        }
      });
    }

    if (detailsDeleteBtn) {
      detailsDeleteBtn.addEventListener('click', async () => {
        if (activeContextBook) {
          detailsModal?.classList.add('hidden');
          await deleteBook(activeContextBook.id);
        }
      });
    }
  }

  function openContextMenu(x, y, book) {
    activeContextBook = book;
    const ctxMenu = document.getElementById('context-menu');
    if (!ctxMenu) return;

    ctxMenu.style.left = `${Math.min(window.innerWidth - 180, x)}px`;
    ctxMenu.style.top = `${Math.min(window.innerHeight - 150, y)}px`;
    ctxMenu.classList.remove('hidden');
  }

  function openBookDetails(book) {
    activeContextBook = book;
    const modal = document.getElementById('book-details-modal');
    if (!modal) return;

    const coverImg = document.getElementById('details-cover-img');
    const fallback = document.getElementById('details-cover-fallback');
    const titleEl = document.getElementById('details-book-title');
    const authorEl = document.getElementById('details-book-author');
    const descEl = document.getElementById('details-book-desc');
    const progressEl = document.getElementById('details-meta-progress');
    const sizeEl = document.getElementById('details-meta-size');
    const addedEl = document.getElementById('details-meta-added');

    if (book.coverDataUrl) {
      if (coverImg) {
        coverImg.src = book.coverDataUrl;
        coverImg.style.display = 'block';
      }
      if (fallback) fallback.classList.add('hidden');
    } else {
      if (coverImg) coverImg.style.display = 'none';
      if (fallback) fallback.classList.remove('hidden');
    }

    if (titleEl) titleEl.textContent = book.title;
    if (authorEl) authorEl.textContent = book.author ? `by ${book.author}` : '';
    if (descEl) descEl.textContent = book.description ? stripHTML(book.description) : 'No description available for this volume.';
    if (progressEl) progressEl.textContent = `${book.progressPercent || 0}%`;
    if (sizeEl) sizeEl.textContent = Utils.formatBytes(book.fileSize);
    if (addedEl) addedEl.textContent = Utils.formatDate(book.dateAdded);

    modal.classList.remove('hidden');
  }

  async function deleteBook(id) {
    if (!await confirmBookRemoval()) return;
    const book = await NoveraDB.getBook(id);
    try {
      await NoveraDB.deleteBook(id);
    } catch (error) {
      Utils.toast('The book could not be removed from the library.', 'error');
      console.error('Failed to delete book metadata:', error);
      return;
    }
    if (book?.storageId && window.noveraDesktop?.deleteBookFromStorage) {
      const deleted = await window.noveraDesktop.deleteBookFromStorage(book.storageId);
      if (!deleted) {
        Utils.toast('Book removed from the library. Its managed file remains and can be recovered from the data folder.', 'info', 5000);
        await loadAndRenderBooks();
        return;
      }
    }
    Utils.toast('Book removed from library', 'info');
    await loadAndRenderBooks();
  }

  function confirmBookRemoval() {
    const modal = document.getElementById('delete-book-modal');
    if (!modal) return Promise.resolve(false);
    modal.classList.remove('hidden');
    document.getElementById('cancel-delete-book-btn')?.focus();
    return new Promise(resolve => { deleteConfirmationResolver = resolve; });
  }

  function stripHTML(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  // Built-in Sample Guide EPUB Generator (Welcome to Lirune)
  async function generateSampleBook() {
    Utils.toast('Generating sample book: "Welcome to Lirune"...');

    try {
      const zip = new JSZip();

      // mimetype (must be first, uncompressed)
      zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

      // META-INF/container.xml
      zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);

      // OEBPS/content.opf
      zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Welcome to Lirune</dc:title>
    <dc:creator>Lirune Reader</dc:creator>
    <dc:language>en</dc:language>
    <dc:identifier id="BookId">urn:uuid:lirune-welcome-guide-4-0</dc:identifier>
    <dc:description>A short built-in guide to help you explore Lirune Reader's library, reading tools, customization, annotations, keyboard shortcuts, and local-first features.</dc:description>
    <dc:publisher>Lirune Reader</dc:publisher>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="style" href="styles.css" media-type="text/css"/>
    <item id="ch1" href="chapter1.html" media-type="application/xhtml+xml"/>
    <item id="ch2" href="chapter2.html" media-type="application/xhtml+xml"/>
    <item id="ch3" href="chapter3.html" media-type="application/xhtml+xml"/>
    <item id="ch4" href="chapter4.html" media-type="application/xhtml+xml"/>
    <item id="ch5" href="chapter5.html" media-type="application/xhtml+xml"/>
    <item id="ch6" href="chapter6.html" media-type="application/xhtml+xml"/>
    <item id="ch7" href="chapter7.html" media-type="application/xhtml+xml"/>
    <item id="ch8" href="chapter8.html" media-type="application/xhtml+xml"/>
    <item id="ch9" href="chapter9.html" media-type="application/xhtml+xml"/>
    <item id="ch10" href="chapter10.html" media-type="application/xhtml+xml"/>
    <item id="ch11" href="chapter11.html" media-type="application/xhtml+xml"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="ch1"/>
    <itemref idref="ch2"/>
    <itemref idref="ch3"/>
    <itemref idref="ch4"/>
    <itemref idref="ch5"/>
    <itemref idref="ch6"/>
    <itemref idref="ch7"/>
    <itemref idref="ch8"/>
    <itemref idref="ch9"/>
    <itemref idref="ch10"/>
    <itemref idref="ch11"/>
  </spine>
</package>`);

      // OEBPS/toc.ncx
      zip.file('OEBPS/toc.ncx', `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:lirune-welcome-guide-4-0"/>
  </head>
  <docTitle><text>Welcome to Lirune</text></docTitle>
  <navMap>
    <navPoint id="np-1" playOrder="1">
      <navLabel><text>1. Welcome to Lirune</text></navLabel>
      <content src="chapter1.html"/>
    </navPoint>
    <navPoint id="np-2" playOrder="2">
      <navLabel><text>2. Your Library</text></navLabel>
      <content src="chapter2.html"/>
    </navPoint>
    <navPoint id="np-3" playOrder="3">
      <navLabel><text>3. Opening and Importing Books</text></navLabel>
      <content src="chapter3.html"/>
    </navPoint>
    <navPoint id="np-4" playOrder="4">
      <navLabel><text>4. Reading Comfortably</text></navLabel>
      <content src="chapter4.html"/>
    </navPoint>
    <navPoint id="np-5" playOrder="5">
      <navLabel><text>5. Finding Your Place</text></navLabel>
      <content src="chapter5.html"/>
    </navPoint>
    <navPoint id="np-6" playOrder="6">
      <navLabel><text>6. Highlights, Notes and Bookmarks</text></navLabel>
      <content src="chapter6.html"/>
    </navPoint>
    <navPoint id="np-7" playOrder="7">
      <navLabel><text>7. Organizing Your Library</text></navLabel>
      <content src="chapter7.html"/>
    </navPoint>
    <navPoint id="np-8" playOrder="8">
      <navLabel><text>8. Backups, Storage and Privacy</text></navLabel>
      <content src="chapter8.html"/>
    </navPoint>
    <navPoint id="np-9" playOrder="9">
      <navLabel><text>9. Keyboard Shortcuts</text></navLabel>
      <content src="chapter9.html"/>
    </navPoint>
    <navPoint id="np-10" playOrder="10">
      <navLabel><text>10. Troubleshooting</text></navLabel>
      <content src="chapter10.html"/>
    </navPoint>
    <navPoint id="np-11" playOrder="11">
      <navLabel><text>11. Support Lirune Reader</text></navLabel>
      <content src="chapter11.html"/>
    </navPoint>
  </navMap>
</ncx>`);

      // OEBPS/styles.css
      zip.file('OEBPS/styles.css', `
body { font-family: serif; line-height: 1.6; margin: 5%; color: inherit; }
h1 { text-align: center; margin-top: 1.6em; margin-bottom: 0.3em; font-size: 1.7em; }
h2 { text-align: center; margin-bottom: 1.5em; font-weight: normal; font-style: italic; opacity: 0.85; font-size: 1.05em; }
h3 { margin-top: 1.4em; margin-bottom: 0.4em; font-size: 1.15em; font-weight: bold; }
p { margin-bottom: 1.15em; text-indent: 0; line-height: 1.65; }
p.lead { font-size: 1.1em; line-height: 1.7; font-weight: 500; }
ul, ol { margin: 0.8em 0 1.2em 1.5em; padding: 0; }
li { margin-bottom: 0.45em; line-height: 1.6; }
table { width: 100%; border-collapse: collapse; margin: 1.2em 0 1.5em 0; }
th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid rgba(128, 128, 128, 0.25); }
th { font-weight: bold; }
kbd { display: inline-block; padding: 2px 6px; font-family: monospace; font-size: 0.9em; background: rgba(128, 128, 128, 0.15); border-radius: 4px; border: 1px solid rgba(128, 128, 128, 0.3); }
blockquote { margin: 1.2em 1.5em; padding-left: 1em; border-left: 3px solid rgba(128, 128, 128, 0.35); font-style: italic; }
a { color: inherit; text-decoration: underline; }
.support-card { margin: 2em 0; padding: 1.5em; border: 1px solid rgba(128, 128, 128, 0.25); border-radius: 8px; text-align: center; }
`);

      // OEBPS/chapter1.html
      zip.file('OEBPS/chapter1.html', `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Chapter 1: Welcome to Lirune</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <h1>Chapter 1</h1>
  <h2>Welcome to Lirune</h2>
  <p class="lead">Welcome to Lirune Reader.</p>
  <p>Lirune is a calm, local-first EPUB reader for Windows. It is designed to keep your personal reading experience focused and your library safely on your computer.</p>
  <p>This introductory guide is built directly into Lirune so that you can explore the application's reading tools, navigation, and customization right away—without needing to search for an external EPUB file first.</p>
  <h3>Core Philosophy</h3>
  <p>Lirune is built upon five foundational principles:</p>
  <ul>
    <li><strong>Local:</strong> Your books, reading progress, and annotations reside directly on your device.</li>
    <li><strong>Private:</strong> There are no tracking scripts, analytics, or mandatory cloud logins monitoring what you read.</li>
    <li><strong>Focused:</strong> A clean, quiet reading surface free from clutter, popups, and unnecessary interruptions.</li>
    <li><strong>Customizable:</strong> Thoughtful typography, comfortable reading palettes, flexible layout flows, and personalized window accents.</li>
    <li><strong>Windows-Friendly:</strong> Deep integration with Windows windowing, keyboard shortcuts, and file associations.</li>
  </ul>
  <p>Whether you are reading technical documentation, classic literature, or personal research notes, Lirune aims to give your books the calm digital environment they deserve.</p>
</body>
</html>`);

      // OEBPS/chapter2.html
      zip.file('OEBPS/chapter2.html', `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Chapter 2: Your Library</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <h1>Chapter 2</h1>
  <h2>Your Library</h2>
  <p class="lead">The Library is your personal reading headquarters, displaying your book collection with elegance and clarity.</p>
  <p>When you add books, Lirune automatically extracts their embedded cover artwork and metadata, presenting them in a responsive, beautifully spaced gallery.</p>
  <h3>Views and Navigation</h3>
  <ul>
    <li><strong>Grid View and List View:</strong> Toggle between a rich visual cover grid and a structured, compact list view depending on your screen size and organizational preference.</li>
    <li><strong>Library Search:</strong> Quickly locate any title using the search bar (or by pressing <kbd>Ctrl + K</kbd>). Library search searches through book metadata, including titles and author names.</li>
    <li><strong>Sorting:</strong> Sort your library by recently read, date added, title alphabetically, or author.</li>
    <li><strong>Reading Progress:</strong> Every book card displays a subtle progress indicator showing your completion percentage and current chapter.</li>
    <li><strong>Continue Reading:</strong> At the top of your library, the Continue Reading banner highlights your most recently active book for seamless one-click resumption.</li>
  </ul>
  <h3>Status Filters</h3>
  <p>Keep your collection tidy by switching between status tabs:</p>
  <ul>
    <li><strong>All:</strong> Displays every book present in your local library.</li>
    <li><strong>Unread:</strong> Shows books you have imported but have not yet begun reading.</li>
    <li><strong>In Progress:</strong> Focuses on the books you are actively reading right now.</li>
    <li><strong>Finished:</strong> Holds completed works once you turn the final page.</li>
    <li><strong>Favorites:</strong> Instantly narrows your bookshelf to the volumes you have starred for quick reference.</li>
  </ul>
  <p>You can also create custom <strong>Collections</strong> to group titles by topic, project, or genre without altering the files on your disk.</p>
</body>
</html>`);

      // OEBPS/chapter3.html
      zip.file('OEBPS/chapter3.html', `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Chapter 3: Opening and Importing Books</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <h1>Chapter 3</h1>
  <h2>Opening and Importing Books</h2>
  <p class="lead">Adding books to your Lirune library is fast, versatile, and non-destructive.</p>
  <h3>Supported Import Methods</h3>
  <p>Lirune supports several intuitive ways to import your EPUB collection:</p>
  <ul>
    <li><strong>Single EPUB Import:</strong> Use the "Browse EPUB Files" button to select and open an individual book.</li>
    <li><strong>Multiple EPUB Import:</strong> Select multiple files simultaneously in the Windows file picker to add an entire batch in one step.</li>
    <li><strong>Folder Import:</strong> Choose "Open Folder" from the library menu to scan an entire directory.</li>
    <li><strong>Recursive Folder Import:</strong> Lirune searches nested subfolders within a selected directory, discovering all valid EPUB files.</li>
    <li><strong>Drag and Drop:</strong> Simply drag one or more <code>.epub</code> files from Windows Explorer directly into the Lirune window.</li>
    <li><strong>Windows Explorer Integration:</strong> Once installed, Lirune registers the <code>.epub</code> file type with Windows, allowing you to double-click any EPUB on your PC to launch it in Lirune.</li>
  </ul>
  <h3>Resilient Package Validation</h3>
  <p>Lirune inspects each EPUB package upon import to ensure valid structure and metadata. If a file in a batch is malformed, damaged, or unsupported, Lirune reports the issue without halting or discarding the remaining valid books in the import queue.</p>
  <h3>DRM and Encryption</h3>
  <p>Lirune respects copyright and digital packaging standards. Encrypted or DRM-protected files (such as Adobe ADEPT or proprietary vendor locks) cannot be opened. Lirune does not bypass digital rights management.</p>
  <h3>Duplicate Handling</h3>
  <p>Lirune uses cryptographic content fingerprinting to identify books. If you import an EPUB that is already in your library, Lirune recognizes it and avoids creating redundant duplicate records. At the same time, different books that share identical or similar filenames can coexist without conflict.</p>
</body>
</html>`);

      // OEBPS/chapter4.html
      zip.file('OEBPS/chapter4.html', `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Chapter 4: Reading Comfortably</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <h1>Chapter 4</h1>
  <h2>Reading Comfortably</h2>
  <p class="lead">Reading should be an effortless visual experience. Lirune provides comprehensive controls to tailor page typography and layout to your comfort.</p>
  <h3>Reader Customization</h3>
  <p>Open Reading Settings (<kbd>S</kbd>) while inside any book to adjust:</p>
  <ul>
    <li><strong>Reader Themes:</strong> Choose between a crisp Light theme (the default for new readers), an immersive Dark/Night theme, a warm Sepia mode, a gentle Paper background, or contrast-oriented themes designed for high readability. You can also specify custom background and text colors.</li>
    <li><strong>Font Families:</strong> Switch between refined serif typefaces, modern sans-serif options, monospaced fonts, or the original EPUB publisher styling when supported.</li>
    <li><strong>Font Sizing:</strong> Scale text smoothly from compact print up to large, accessible sizes.</li>
    <li><strong>Text Alignment:</strong> Choose between natural left-aligned text or clean justified formatting.</li>
    <li><strong>Line Spacing and Margins:</strong> Adjust vertical line height and horizontal page margins to create the optimal line length for your display.</li>
    <li><strong>Reading Flow:</strong> Switch between paginated reading (flipping pages horizontally like a physical volume) and continuous scrolled reading for smooth vertical reading.</li>
    <li><strong>Layout Modes:</strong> Opt for a focused single-page layout or an automatic two-page spread on wide desktop monitors.</li>
  </ul>
  <h3>Application Accent vs. Reader Theme</h3>
  <p>It is important to distinguish between the two color customization systems in Lirune:</p>
  <ul>
    <li><strong>Application Accent Color:</strong> This governs the user interface elements of the Lirune desktop window—such as buttons, tab highlights, slider tracks, and keyboard focus outlines. The default Lirune accent is <code>#EEECF8</code> (RGB 238, 236, 248). You can pick a custom accent in Settings or reset it to the default at any time.</li>
    <li><strong>Reader Themes:</strong> These control the reading canvas itself—including the book page background, typography color, link styling, and text selection highlights.</li>
  </ul>
  <p>These two systems operate independently: adjusting your application accent keeps your reading page undisturbed, while changing your reading theme leaves your desktop application controls intact.</p>
</body>
</html>`);

      // OEBPS/chapter5.html
      zip.file('OEBPS/chapter5.html', `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Chapter 5: Finding Your Place</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <h1>Chapter 5</h1>
  <h2>Finding Your Place</h2>
  <p class="lead">Navigating through long books and complex documents is seamless with Lirune's navigation tools.</p>
  <h3>Table of Contents and Chapter Filtering</h3>
  <p>Press <kbd>T</kbd> or click the table of contents icon to reveal the book's structural hierarchy. If a book has dozens of chapters, use the built-in search filter at the top of the TOC panel to locate a specific chapter name or section heading instantly.</p>
  <h3>Continuous Progress Tracking</h3>
  <p>Lirune continuously saves your exact reading location using EPUB Canonical Fragment Identifiers (CFI). When you close a book or shut down your PC, your exact spot is remembered. Reopening the title returns you precisely to where you paused.</p>
  <h3>Navigation History and Returning</h3>
  <p>If you jump across sections via the Table of Contents or a footnote link, Lirune tracks your navigation path, allowing you to return to your previous reading position without losing your place.</p>
  <h3>Page Navigation Modes</h3>
  <p>Turn pages using any method that feels natural:</p>
  <ul>
    <li>Keyboard arrow keys (<kbd>Left</kbd> / <kbd>Right</kbd>) or vim-style keys (<kbd>H</kbd> / <kbd>L</kbd> or <kbd>J</kbd> / <kbd>K</kbd>).</li>
    <li>Clicking the unobtrusive left and right edge navigation zones with your mouse.</li>
    <li>Using your mouse scroll wheel or laptop trackpad gestures.</li>
    <li>Onscreen navigation buttons in the reader controls.</li>
  </ul>
  <h3>Distraction-Free Fullscreen</h3>
  <p>Press <kbd>F</kbd> to toggle native fullscreen mode. Fullscreen hides desktop bars and window chrome, creating an uncluttered reading environment where only the words remain.</p>
</body>
</html>`);

      // OEBPS/chapter6.html
      zip.file('OEBPS/chapter6.html', `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Chapter 6: Highlights, Notes and Bookmarks</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <h1>Chapter 6</h1>
  <h2>Highlights, Notes and Bookmarks</h2>
  <p class="lead">Engage actively with your reading material using Lirune's integrated annotation suite.</p>
  <h3>The Text-Selection Toolbar</h3>
  <p>Whenever you select text on a page, a floating selection toolbar appears immediately above the selected passage. From this toolbar, you can:</p>
  <ul>
    <li><strong>Highlight:</strong> Apply a colorful highlight with a single click.</li>
    <li><strong>Choose Colors:</strong> Select from six curated highlight shades: <em>Yellow</em>, <em>Blue</em>, <em>Green</em>, <em>Pink</em>, <em>Purple</em>, or <em>Orange</em>.</li>
    <li><strong>Add Notes:</strong> Attach your thoughts, comments, or summaries directly to the highlighted text.</li>
    <li><strong>Copy:</strong> Copy the excerpt directly to the clipboard.</li>
  </ul>
  <h3>Bookmarks</h3>
  <p>Press <kbd>B</kbd> or click the bookmark button in the top reader toolbar to bookmark your current location. Bookmarks act as visual placeholders for key moments or reference points in your books.</p>
  <h3>The Annotations Drawer</h3>
  <p>Press <kbd>N</kbd> or click the annotations button to slide open the side drawer. Here, all your highlights, notes, and bookmarks are gathered chronologically and by chapter. Clicking any entry jumps directly to that passage in the book.</p>
  <h3>Local Storage and Markdown Export</h3>
  <p>All annotations are stored locally in your private database. When you want to incorporate your reading notes into your knowledge base or study system, click "Export Annotations" to generate a clean, formatted Markdown file compatible with Obsidian, Notion, Logseq, or any plain text editor.</p>
</body>
</html>`);

      // OEBPS/chapter7.html
      zip.file('OEBPS/chapter7.html', `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Chapter 7: Organizing Your Library</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <h1>Chapter 7</h1>
  <h2>Organizing Your Library</h2>
  <p class="lead">As your digital library expands, thoughtful organization tools ensure your books remain accessible and orderly.</p>
  <h3>Favorites</h3>
  <p>Click the heart icon on any book card or within the book details modal to mark it as a Favorite. Favorites are always easily accessible from the library filter bar, making them ideal for current projects, core reference books, or beloved novels.</p>
  <h3>Collections</h3>
  <p>Collections let you group titles by topic, genre, author study, research project, academic course, or reading challenge. You can create as many collections as you need from the Collections manager in the sidebar.</p>
  <p>A book can belong to multiple collections simultaneously. Because organization is handled at the database level, adding or reordering collections never moves, renames, or alters your original EPUB files.</p>
  <h3>Combining Search and Filters</h3>
  <p>You can combine text searches with status filters (such as searching for an author name while viewing only "In Progress" books) to quickly locate the exact volume you want, even in a library containing hundreds of titles.</p>
</body>
</html>`);

      // OEBPS/chapter8.html
      zip.file('OEBPS/chapter8.html', `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Chapter 8: Backups, Storage and Privacy</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <h1>Chapter 8</h1>
  <h2>Backups, Storage and Privacy</h2>
  <p class="lead">Lirune is designed with a strict local-first philosophy: you own your data, your files remain on your PC, and no cloud service is ever required.</p>
  <h3>Local-First Architecture</h3>
  <p>Everything you do in Lirune happens on your machine:</p>
  <ul>
    <li>Imported EPUB books are stored in managed local application storage on your hard drive.</li>
    <li>Library metadata, reading progress, and exact CFI positions are saved in a local database.</li>
    <li>Highlights, notes, bookmarks, collections, and favorites remain entirely on your device.</li>
    <li>Your personal preferences and color schemes are saved locally.</li>
    <li>No user account or cloud registration is required, and core reading features operate fully offline.</li>
  </ul>
  <h3>Metadata Backup and Restore</h3>
  <p>Lirune includes a built-in backup and restore tool in Settings. This tool exports your library records, reading status, reading percentages, annotations, and collections into a portable backup file.</p>
  <blockquote>
    <p><strong>Note:</strong> The metadata backup tool backs up your library database and reading records. It does not package every full EPUB binary file into the backup archive. Always keep your original source EPUB files stored safely in your own personal documents or backup folders.</p>
  </blockquote>
  <h3>Library Integrity Check</h3>
  <p>The Library Integrity Check utility verifies that the EPUB files in your managed storage match their expected fingerprints. If an underlying file has been moved or becomes inaccessible, the integrity check identifies the missing book so you can restore or re-import it cleanly.</p>
  <h3>Removing Books vs. Deleting Source Files</h3>
  <p>When you choose "Remove Book" from Lirune, the application deletes the book entry and reading state from your Lirune library. Removing a book from Lirune does not delete the original EPUB file from the folder where you originally kept it on your computer.</p>
</body>
</html>`);

      // OEBPS/chapter9.html
      zip.file('OEBPS/chapter9.html', `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Chapter 9: Keyboard Shortcuts</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <h1>Chapter 9</h1>
  <h2>Keyboard Shortcuts</h2>
  <p class="lead">Lirune offers an extensive set of keyboard shortcuts for fast, hands-on-the-keyboard reading and navigation.</p>
  <table>
    <thead>
      <tr>
        <th>Action</th>
        <th>Shortcut</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Next Page</td>
        <td><kbd>→</kbd> / <kbd>Page Down</kbd> / <kbd>Space</kbd> / <kbd>J</kbd></td>
      </tr>
      <tr>
        <td>Previous Page</td>
        <td><kbd>←</kbd> / <kbd>Page Up</kbd> / <kbd>Shift + Space</kbd> / <kbd>K</kbd></td>
      </tr>
      <tr>
        <td>Table of Contents</td>
        <td><kbd>T</kbd></td>
      </tr>
      <tr>
        <td>Reading Settings</td>
        <td><kbd>S</kbd></td>
      </tr>
      <tr>
        <td>Bookmark</td>
        <td><kbd>B</kbd></td>
      </tr>
      <tr>
        <td>Annotations &amp; Notes</td>
        <td><kbd>N</kbd></td>
      </tr>
      <tr>
        <td>Search in Book</td>
        <td><kbd>/</kbd></td>
      </tr>
      <tr>
        <td>Fullscreen</td>
        <td><kbd>F</kbd></td>
      </tr>
      <tr>
        <td>Library Search</td>
        <td><kbd>Ctrl + K</kbd></td>
      </tr>
      <tr>
        <td>Close Overlay / Back</td>
        <td><kbd>Esc</kbd></td>
      </tr>
    </tbody>
  </table>
  <p>These shortcuts function both in the main reader window and while focusing inside the reader page.</p>
</body>
</html>`);

      // OEBPS/chapter10.html
      zip.file('OEBPS/chapter10.html', `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Chapter 10: Troubleshooting</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <h1>Chapter 10</h1>
  <h2>Troubleshooting</h2>
  <p class="lead">Here are quick solutions for common questions and situations you might encounter.</p>
  <h3>Book will not import</h3>
  <p>Ensure that the file is a standard, uncorrupted EPUB package. Files that were incompletely downloaded, saved in an incompatible archive format, or protected by commercial DRM encryption cannot be read. Lirune does not strip or bypass DRM.</p>
  <h3>Book will not open from Explorer</h3>
  <p>The standard Windows installer automatically configures the <code>.epub</code> file association. If another program has taken over this file type, right-click any EPUB file in Windows Explorer, select <em>Open with</em>, choose <em>Lirune Reader</em>, and check the option to always use this application.</p>
  <h3>Need to start from source</h3>
  <p>If you are running Lirune from its open-source repository, ensure you have Node.js 20 or higher installed. Run <code>npm ci</code> to install dependencies cleanly, followed by <code>npm start</code> to launch the desktop application.</p>
  <h3>Need to reset the library</h3>
  <p>Use the Settings screen to adjust reading preferences, appearance, and local library maintenance. Export annotations or create a metadata backup before making changes you may want to undo.</p>
</body>
</html>`);

      // OEBPS/chapter11.html
      zip.file('OEBPS/chapter11.html', `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Chapter 11: Support Lirune Reader</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <h1>Chapter 11</h1>
  <h2>Support Lirune Reader</h2>
  <div class="support-card">
    <p class="lead">Thanks for giving Lirune Reader a place on your desktop.</p>
    <p>Lirune is free and open-source software. If you find it useful and would like to support continued development, you can optionally buy the developer a coffee.</p>
    <p>Support Lirune Reader on Buy Me a Coffee:</p>
    <p><a href="https://buymeacoffee.com/vasanthgajavelly" target="_blank" rel="noopener noreferrer">https://buymeacoffee.com/vasanthgajavelly</a></p>
    <p style="font-size: 0.9em; opacity: 0.85; margin-top: 1.5em;">Support is completely optional and does not unlock features or change how the application works.</p>
  </div>
</body>
</html>`);

      const epubBlob = await zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
      const arrayBuffer = await epubBlob.arrayBuffer();

      // Sample book cover (SVG rendered to canvas data URL)
      const coverDataUrl = generateWelcomeCoverDataUrl();

      const sampleBook = {
        id: 'sample_welcome_' + Date.now(),
        title: 'Welcome to Lirune',
        author: 'Lirune Reader',
        description: "A short built-in guide to help you explore Lirune Reader's library, reading tools, customization, annotations, keyboard shortcuts, and local-first features.",
        coverDataUrl,
        ...(window.noveraDesktop ? {} : { fileData: arrayBuffer }),
        schemaVersion: 2,
        fileSize: arrayBuffer.byteLength,
        dateAdded: Date.now(),
        lastReadDate: 0,
        currentCfi: null,
        progressPercent: 0,
        currentChapter: '1. Welcome to Lirune'
      };

      if (window.noveraDesktop?.saveBookToStorage) {
        const storageId = `${await getFingerprint(arrayBuffer, arrayBuffer.byteLength, 'sample')}.epub`;
        const result = await window.noveraDesktop.saveBookToStorage('welcome-to-lirune.epub', arrayBuffer, storageId);
        if (!result?.success) throw new Error(result?.error || 'Could not save sample book');
        sampleBook.storageId = result.storageId;
      }
      await NoveraDB.saveBook(sampleBook);
      Utils.toast('Sample book added! Opening now...', 'success');
      await loadAndRenderBooks();
      App.openReader(sampleBook.id);

    } catch (err) {
      console.error('Failed to generate sample book:', err);
      Utils.toast('Could not create sample book: ' + err.message, 'error');
    }
  }

  function generateWelcomeCoverDataUrl() {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');

    // Dark charcoal / deep cool background
    const grad = ctx.createLinearGradient(0, 0, 400, 600);
    grad.addColorStop(0, '#151621');
    grad.addColorStop(0.4, '#1C1E2B');
    grad.addColorStop(1, '#0E0F16');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 400, 600);

    // Subtle soft glass surface card
    ctx.fillStyle = 'rgba(238, 236, 248, 0.035)';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(24, 24, 352, 552, 12);
    } else {
      ctx.rect(24, 24, 352, 552);
    }
    ctx.fill();

    // Subtle borders
    ctx.strokeStyle = 'rgba(238, 236, 248, 0.18)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(238, 236, 248, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(32, 32, 336, 536, 8);
    } else {
      ctx.rect(32, 32, 336, 536);
    }
    ctx.stroke();

    // Subtle ambient accent glow behind symbol
    const glow = ctx.createRadialGradient(200, 210, 10, 200, 210, 120);
    glow.addColorStop(0, 'rgba(238, 236, 248, 0.12)');
    glow.addColorStop(1, 'rgba(238, 236, 248, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(200, 210, 120, 0, Math.PI * 2);
    ctx.fill();

    // Minimalist open book symbol
    ctx.save();
    ctx.strokeStyle = '#EEECF8';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Left page
    ctx.beginPath();
    ctx.moveTo(196, 222);
    ctx.quadraticCurveTo(170, 212, 148, 215);
    ctx.lineTo(148, 245);
    ctx.quadraticCurveTo(170, 242, 196, 252);
    ctx.closePath();
    ctx.stroke();

    // Right page
    ctx.beginPath();
    ctx.moveTo(204, 222);
    ctx.quadraticCurveTo(230, 212, 252, 215);
    ctx.lineTo(252, 245);
    ctx.quadraticCurveTo(230, 242, 204, 252);
    ctx.closePath();
    ctx.stroke();

    // Spine mark
    ctx.beginPath();
    ctx.moveTo(200, 224);
    ctx.lineTo(200, 252);
    ctx.stroke();
    ctx.restore();

    // Category / Tag
    ctx.fillStyle = 'rgba(238, 236, 248, 0.7)';
    ctx.font = '600 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '3px';
    ctx.fillText('BUILT-IN GUIDE', 200, 120);

    // Title
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 32px "Playfair Display", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '1px';
    ctx.fillText('WELCOME TO', 200, 315);
    ctx.font = 'bold 36px "Playfair Display", Georgia, serif';
    ctx.fillStyle = '#EEECF8';
    ctx.fillText('LIRUNE', 200, 360);

    // Divider line
    ctx.strokeStyle = 'rgba(238, 236, 248, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(160, 390);
    ctx.lineTo(240, 390);
    ctx.stroke();

    // Subtitle
    ctx.fillStyle = 'rgba(238, 236, 248, 0.85)';
    ctx.font = 'italic 15px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('A quick guide to your reading space', 200, 420);

    // Author
    ctx.fillStyle = 'rgba(238, 236, 248, 0.75)';
    ctx.font = '500 13px Inter, system-ui, sans-serif';
    ctx.letterSpacing = '2px';
    ctx.fillText('LIRUNE READER', 200, 500);

    // Version / tag
    ctx.fillStyle = 'rgba(238, 236, 248, 0.4)';
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.letterSpacing = '1px';
    ctx.fillText('LOCAL-FIRST READING', 200, 526);

    return canvas.toDataURL('image/jpeg', 0.9);
  }

  return {
    init,
    loadAndRenderBooks,
    openBookDetails,
    deleteBook,
    generateSampleBook
  };
})();
