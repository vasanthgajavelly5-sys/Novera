/**
 * Folio — Library Management System
 * Handles drag-and-drop, EPUB ingestion, IndexedDB persistence,
 * library rendering, search, sort, and sample book generation.
 */

const Library = (() => {
  let allBooks = [];
  let currentSort = 'recent';
  let searchQuery = '';
  let isListView = false;
  let activeContextBook = null;

  async function init() {
    bindDropAndFileInput();
    bindSearchAndSort();
    bindModals();
    await loadAndRenderBooks();
  }

  async function loadAndRenderBooks() {
    allBooks = await FolioDB.getAllBooks();
    renderLibraryUI();
  }

  function renderLibraryUI() {
    const dropZone = document.getElementById('drop-zone');
    const libHeader = document.getElementById('lib-header');
    const continueSection = document.getElementById('continue-section');
    const booksGrid = document.getElementById('books-grid');
    const emptyState = document.getElementById('empty-state');
    const bookCount = document.getElementById('book-count');

    // Filter books by search query
    let filtered = allBooks.filter(book => {
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
    if (filtered.length === 0 && searchQuery) {
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

  function renderBookCards(books) {
    const grid = document.getElementById('books-grid');
    if (!grid) return;
    grid.innerHTML = '';
    grid.className = isListView ? 'books-grid list-view visible' : 'books-grid visible';

    books.forEach(book => {
      const card = document.createElement('div');
      card.className = 'book-card';
      card.setAttribute('role', 'listitem');
      card.setAttribute('tabindex', '0');

      const pct = book.progressPercent || 0;

      const coverHtml = book.coverDataUrl
        ? `<img src="${book.coverDataUrl}" alt="${Utils.escapeHTML(book.title)}" class="card-cover" loading="lazy">`
        : `<div class="card-cover-fallback">
             <svg class="card-fallback-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
             <span class="card-fallback-title">${Utils.escapeHTML(book.title)}</span>
           </div>`;

      card.innerHTML = `
        <div class="card-cover-wrap">
          ${coverHtml}
          ${pct > 0 ? `<div class="card-progress-bar"><div class="card-progress-fill" style="width:${pct}%"></div></div>` : ''}
          ${pct >= 100 ? `<div class="card-badge">Completed</div>` : (pct > 0 ? `<div class="card-badge">${pct}%</div>` : '')}
        </div>
        <div class="card-meta">
          <div class="card-title" title="${Utils.escapeHTML(book.title)}">${Utils.escapeHTML(book.title)}</div>
          <div class="card-author">${Utils.escapeHTML(book.author || 'Unknown')}</div>
        </div>
      `;

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
    const importStatus = document.getElementById('import-status');
    const closeImportBtn = document.getElementById('close-import-btn');
    const importFileBtn = document.getElementById('import-file-btn');
    const importFolderBtn = document.getElementById('import-folder-btn');

    const closeImport = () => importModal?.classList.add('hidden');
    const openImport = () => {
      if (importStatus) importStatus.textContent = '';
      importModal?.classList.remove('hidden');
    };
    const showImportErrors = (errors) => {
      if (!errors || errors.length === 0) return;
      const first = errors.slice(0, 3).map(item => `${item.name}: ${item.error}`).join(' | ');
      Utils.toast(`${errors.length} file${errors.length === 1 ? '' : 's'} skipped. ${first}`, 'error');
    };
    const setImportStatus = (message) => {
      if (importStatus) importStatus.textContent = message;
    };

    const handleFileChoice = async () => {
      if (window.folioDesktop?.openFileDialog) {
        const result = await window.folioDesktop.openFileDialog();
        showImportErrors(result.errors);
        if (!result.canceled && result.files?.length) await processNativeFiles(result.files, setImportStatus);
      } else {
        closeImport();
        fileInput?.click();
      }
    };
    const handleFolderChoice = async () => {
      if (!window.folioDesktop?.openFolderDialog) {
        Utils.toast('Folder import is available in the desktop app', 'info');
        return;
      }
      setImportStatus('Scanning folder...');
      const result = await window.folioDesktop.openFolderDialog();
      showImportErrors(result.errors);
      if (!result.canceled && result.files?.length) await processNativeFiles(result.files, setImportStatus);
      else if (!result.canceled) setImportStatus('No EPUB files found in that folder.');
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
    if (window.folioDesktop && window.folioDesktop.onOpenFile) {
      window.folioDesktop.onOpenFile(async (filePath) => {
        Utils.toast('Opening book from Windows...', 'info');
        const existing = allBooks.find(b => b.sourcePath === filePath || b.diskPath === filePath);
        if (existing) {
          App.openReader(existing.id);
          return;
        }

        try {
          const file = await window.folioDesktop.readEpubFile(filePath);
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

  async function processNativeFiles(fileList, setStatus = null) {
    Utils.toast(`Importing ${fileList.length} book${fileList.length === 1 ? '' : 's'}...`);

    let importedCount = 0;
    const errors = [];
    for (const [index, file] of fileList.entries()) {
      try {
        setStatus?.(`Importing ${index + 1} of ${fileList.length}: ${file.name}`);
        const existing = allBooks.find(book => book.sourcePath === file.path || book.diskPath === file.path);
        if (existing) {
          continue;
        }

        const bookData = await parseEpubMetadata(file.data, file.name, file.size);
        bookData.fingerprint = await getFingerprint(file.data, file.size, file.name);
        if (allBooks.some(book => book.fingerprint && book.fingerprint === bookData.fingerprint)) continue;
        bookData.diskPath = file.path;
        bookData.sourcePath = file.path;

        // Persist copy in AppData storage if needed
        if (window.folioDesktop && window.folioDesktop.saveBookToStorage) {
          const res = await window.folioDesktop.saveBookToStorage(file.name, file.data);
          if (res && res.success) {
            bookData.diskPath = res.path;
          }
        }

        await FolioDB.saveBook(bookData);
        importedCount++;
      } catch (err) {
        console.error('Failed to import EPUB:', file.name, err);
        errors.push({ name: file.name, error: err.message || 'Unreadable EPUB' });
      }
    }

    showBatchErrors(errors);
    if (importedCount > 0) {
      Utils.toast(`Added ${importedCount} book${importedCount === 1 ? '' : 's'} to library`, 'success');
      await loadAndRenderBooks();
    }
    setStatus?.('');
  }

  async function processFiles(fileList) {
    Utils.toast(`Importing ${fileList.length} book${fileList.length === 1 ? '' : 's'}...`);

    let importedCount = 0;
    for (const file of fileList) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        await validateEpubArchive(arrayBuffer);
        const bookData = await parseEpubMetadata(arrayBuffer, file.name, file.size);
        bookData.fingerprint = await getFingerprint(arrayBuffer, file.size, file.name);
        if (allBooks.some(book => book.fingerprint && book.fingerprint === bookData.fingerprint)) continue;

        // If on desktop, save copy to AppData
        if (window.folioDesktop && window.folioDesktop.saveBookToStorage) {
          const res = await window.folioDesktop.saveBookToStorage(file.name, arrayBuffer);
          if (res && res.success) {
            bookData.diskPath = res.path;
          }
        }

        await FolioDB.saveBook(bookData);
        importedCount++;
      } catch (err) {
        console.error('Failed to import EPUB:', file.name, err);
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
    } finally {
      tempBook.destroy();
    }

    return {
      id: Utils.generateId(),
      title,
      author,
      description,
      coverDataUrl,
      fileData: arrayBuffer,
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
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  // Search & Filter & Sort binding
  function bindSearchAndSort() {
    const searchInput = document.getElementById('lib-search-input');
    const clearBtn = document.getElementById('clear-search-btn');
    const sortSelect = document.getElementById('sort-select');
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

    if (viewToggle) {
      viewToggle.addEventListener('click', () => {
        isListView = !isListView;
        viewToggle.classList.toggle('active', isListView);
        renderLibraryUI();
      });
    }
  }

  // Context Menu & Book Details Modal
  function bindModals() {
    const ctxMenu = document.getElementById('context-menu');
    const ctxRead = document.getElementById('ctx-read');
    const ctxDetails = document.getElementById('ctx-details');
    const ctxDelete = document.getElementById('ctx-delete');

    // Close context menu on window click
    window.addEventListener('click', () => {
      if (ctxMenu) ctxMenu.classList.add('hidden');
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
        if (activeContextBook && activeContextBook.diskPath && window.folioDesktop) {
          window.folioDesktop.showInExplorer(activeContextBook.diskPath);
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
    if (!confirm('Are you sure you want to remove this book from your library?')) return;
    await FolioDB.deleteBook(id);
    Utils.toast('Book removed from library', 'info');
    await loadAndRenderBooks();
  }

  function stripHTML(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  // Built-in Sample Classic EPUB Generator (Alice's Adventures in Wonderland)
  async function generateSampleBook() {
    Utils.toast('Generating sample book: "Alice in Wonderland"...');

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
    <dc:title>Alice's Adventures in Wonderland</dc:title>
    <dc:creator>Lewis Carroll</dc:creator>
    <dc:language>en</dc:language>
    <dc:identifier id="BookId">urn:uuid:folio-sample-alice-1865</dc:identifier>
    <dc:description>The classic 1865 English tale of Alice tumbling down a rabbit hole into a fantastical, whimsical world of curious creatures.</dc:description>
    <dc:publisher>Vellune Classics</dc:publisher>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="style" href="style.css" media-type="text/css"/>
    <item id="ch1" href="chapter1.html" media-type="application/xhtml+xml"/>
    <item id="ch2" href="chapter2.html" media-type="application/xhtml+xml"/>
    <item id="ch3" href="chapter3.html" media-type="application/xhtml+xml"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="ch1"/>
    <itemref idref="ch2"/>
    <itemref idref="ch3"/>
  </spine>
</package>`);

      // OEBPS/toc.ncx
      zip.file('OEBPS/toc.ncx', `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:folio-sample-alice-1865"/>
  </head>
  <docTitle><text>Alice's Adventures in Wonderland</text></docTitle>
  <navMap>
    <navPoint id="np-1" playOrder="1">
      <navLabel><text>Chapter I: Down the Rabbit-Hole</text></navLabel>
      <content src="chapter1.html"/>
    </navPoint>
    <navPoint id="np-2" playOrder="2">
      <navLabel><text>Chapter II: The Pool of Tears</text></navLabel>
      <content src="chapter2.html"/>
    </navPoint>
    <navPoint id="np-3" playOrder="3">
      <navLabel><text>Chapter III: A Caucus-Race and a Long Tale</text></navLabel>
      <content src="chapter3.html"/>
    </navPoint>
  </navMap>
</ncx>`);

      // OEBPS/style.css
      zip.file('OEBPS/style.css', `
body { font-family: serif; line-height: 1.6; margin: 5%; }
h1 { text-align: center; margin-top: 2em; margin-bottom: 0.5em; font-size: 1.8em; }
h2 { text-align: center; margin-bottom: 1.5em; font-weight: normal; font-style: italic; opacity: 0.8; font-size: 1.1em; }
p { margin-bottom: 1.2em; text-indent: 1.5em; }
p.lead { text-indent: 0; font-size: 1.1em; }
p.lead::first-letter { font-size: 3.2em; float: left; line-height: 0.8; padding-right: 0.1em; font-weight: bold; }
blockquote { margin: 1.5em 2em; font-style: italic; }
`);

      // OEBPS/chapter1.html
      zip.file('OEBPS/chapter1.html', `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Chapter I: Down the Rabbit-Hole</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <h1>CHAPTER I</h1>
  <h2>Down the Rabbit-Hole</h2>
  <p class="lead">Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, “and what is the use of a book,” thought Alice “without pictures or conversations?”</p>
  <p>So she was considering in her own mind (as well as she could, for the hot day made her feel very sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.</p>
  <p>There was nothing so very remarkable in that; nor did Alice think it so very much out of the way to hear the Rabbit say to itself, “Oh dear! Oh dear! I shall be late!” (when she thought it over afterwards, it occurred to her that she ought to have wondered at this, but at the time it all seemed quite natural); but when the Rabbit actually took a watch out of its waistcoat-pocket, and looked at it, and then hurried on, Alice started to her feet, for it flashed across her mind that she had never before seen a rabbit with either a waistcoat-pocket, or a watch to take out of it, and burning with curiosity, she ran across the field after it, and fortunately was just in time to see it pop down a large rabbit-hole under the hedge.</p>
  <p>In another moment down went Alice after it, never once considering in the world how in the world she was to get out again.</p>
</body>
</html>`);

      // OEBPS/chapter2.html
      zip.file('OEBPS/chapter2.html', `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Chapter II: The Pool of Tears</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <h1>CHAPTER II</h1>
  <h2>The Pool of Tears</h2>
  <p class="lead">“Curiouser and curiouser!” cried Alice (she was so much surprised, that for the moment she quite forgot how to speak good English); “now I’m opening out like the largest telescope that ever was! Good-bye, feet!” (for when she looked down at her feet, they seemed to be almost out of sight, they were getting so far off).</p>
  <p>“Oh, my poor little feet, I wonder who will put on your shoes and stockings for you now, dears? I’m sure I shan’t be able! I shall be a great deal too far off to trouble myself about you: you must manage the best way you can;—but I must be kind to them,” thought Alice, “or perhaps they won’t walk the way I want to go! Let me see: I’ll give them a new pair of boots every Christmas.”</p>
  <p>And she went on planning to herself how she would manage it. “They must go by the carrier,” she thought; “and how funny it’ll seem, sending presents to one’s own feet! And how odd the directions will look!”</p>
</body>
</html>`);

      // OEBPS/chapter3.html
      zip.file('OEBPS/chapter3.html', `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Chapter III: A Caucus-Race and a Long Tale</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <h1>CHAPTER III</h1>
  <h2>A Caucus-Race and a Long Tale</h2>
  <p class="lead">They were indeed a queer-looking party that assembled on the bank—the birds with draggled feathers, the animals with their fur clinging close to them, and all dripping wet, cross, and uncomfortable.</p>
  <p>The first question of course was, how to get dry again: they had a consultation about this, and after a few minutes it seemed quite natural to Alice to find herself talking familiarly with them, as if she had known them all her life. Indeed, she had quite a long argument with the Lory, who at last turned sulky, and would only say, “I am older than you, and must know better”; and this Alice would not allow without knowing how old it was, and, as the Lory positively refused to tell its age, there was no more to be said.</p>
</body>
</html>`);

      const epubBlob = await zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
      const arrayBuffer = await epubBlob.arrayBuffer();

      // Sample book cover (SVG rendered to canvas data URL)
      const coverDataUrl = generateAliceCoverDataUrl();

      const sampleBook = {
        id: 'sample_alice_' + Date.now(),
        title: "Alice's Adventures in Wonderland",
        author: 'Lewis Carroll',
        description: 'The timeless masterpiece of Alice falling down a rabbit hole into a world of unbridled imagination and absurdity.',
        coverDataUrl,
        fileData: arrayBuffer,
        fileSize: arrayBuffer.byteLength,
        dateAdded: Date.now(),
        lastReadDate: 0,
        currentCfi: null,
        progressPercent: 0,
        currentChapter: 'Chapter I: Down the Rabbit-Hole'
      };

      await FolioDB.saveBook(sampleBook);
      Utils.toast('Sample book added! Opening now...', 'success');
      await loadAndRenderBooks();
      App.openReader(sampleBook.id);

    } catch (err) {
      console.error('Failed to generate sample book:', err);
      Utils.toast('Could not create sample book: ' + err.message, 'error');
    }
  }

  function generateAliceCoverDataUrl() {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');

    // Rich gradient background
    const grad = ctx.createLinearGradient(0, 0, 400, 600);
    grad.addColorStop(0, '#2E1065');
    grad.addColorStop(0.5, '#4C1D95');
    grad.addColorStop(1, '#0F172A');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 400, 600);

    // Decorative vintage border
    ctx.strokeStyle = '#C4B5FD';
    ctx.lineWidth = 3;
    ctx.strokeRect(24, 24, 352, 552);

    ctx.strokeStyle = 'rgba(196, 181, 253, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(30, 30, 340, 540);

    // Title
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 30px "Playfair Display", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText("ALICE'S", 200, 160);
    ctx.fillText("ADVENTURES", 200, 205);
    ctx.font = 'italic 20px "Playfair Display", Georgia, serif';
    ctx.fillText("in", 200, 245);
    ctx.font = 'bold 28px "Playfair Display", Georgia, serif';
    ctx.fillText("WONDERLAND", 200, 290);

    // Ornament
    ctx.fillStyle = '#A78BFA';
    ctx.font = '24px serif';
    ctx.fillText("❦ ❦ ❦", 200, 345);

    // Author
    ctx.fillStyle = '#DDD6FE';
    ctx.font = '500 18px Inter, sans-serif';
    ctx.letterSpacing = '2px';
    ctx.fillText("LEWIS CARROLL", 200, 430);

    // Edition
    ctx.fillStyle = 'rgba(221, 214, 254, 0.6)';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText("VELLUNE CLASSIC EDITION", 200, 520);

    return canvas.toDataURL('image/jpeg', 0.9);
  }

  return {
    init,
    loadAndRenderBooks,
    openBookDetails,
    deleteBook
  };
})();
