/* ============================================================
   khekhe.js — Wandr Itinerary Planner Logic
   Features: Add/Edit/Delete, localStorage, Search/Filter,
             Dark/Light mode, Toast notifications, Animations
   ============================================================ */

'use strict';

/* ── 1. State ───────────────────────────────────────────────── */
let itineraries = []; // Main data array
let activeFilter = 'all';
let searchQuery  = '';
let editingId    = null; // null = add mode, string = edit mode

/* ── 2. Category Config ─────────────────────────────────────── */
const CATEGORIES = {
  travel:   { label: '✈ Travel',   accentClass: 'cat-travel'   },
  food:     { label: '🍜 Food',    accentClass: 'cat-food'     },
  stay:     { label: '🏨 Stay',    accentClass: 'cat-stay'     },
  activity: { label: '🎭 Activity',accentClass: 'cat-activity' },
  shopping: { label: '🛍 Shopping',accentClass: 'cat-shopping' },
  other:    { label: '◎ Other',    accentClass: 'cat-other'    },
};

/* ── 3. LocalStorage Helpers ────────────────────────────────── */
const STORAGE_KEY = 'wandr_itineraries_v1';

/** Load data from localStorage */
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Save current state to localStorage */
function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(itineraries));
}

/* ── 4. DOM References ──────────────────────────────────────── */
const cardsGrid     = document.getElementById('cards-grid');
const emptyState    = document.getElementById('empty-state');
const planCount     = document.getElementById('plan-count');
const modalOverlay  = document.getElementById('modal-overlay');
const modalTitle    = document.getElementById('modal-title');
const form          = document.getElementById('itinerary-form');
const editIdInput   = document.getElementById('edit-id');
const destInput     = document.getElementById('destination');
const startInput    = document.getElementById('start-date');
const endInput      = document.getElementById('end-date');
const catSelect     = document.getElementById('category');
const notesInput    = document.getElementById('notes');
const searchInput   = document.getElementById('search-input');
const filterPills   = document.getElementById('filter-pills');
const themeToggle   = document.getElementById('theme-toggle');
const themeIcon     = document.getElementById('theme-icon');
const toastContainer= document.getElementById('toast-container');
const openModalBtn  = document.getElementById('open-modal-btn');
const emptyAddBtn   = document.getElementById('empty-add-btn');
const modalCloseBtn = document.getElementById('modal-close');
const cancelBtn     = document.getElementById('cancel-btn');

/* ── 5. Unique ID Generator ─────────────────────────────────── */
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ── 6. Date Formatting ─────────────────────────────────────── */
/** Format a YYYY-MM-DD date string into readable "Jan 12" */
function formatDate(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Build human-readable date range string */
function buildDateLabel(start, end) {
  const s = formatDate(start);
  const e = formatDate(end);
  if (s && e && s !== e) return `${s} → ${e}`;
  if (s) return s;
  return null;
}

/* ── 7. Render Engine ───────────────────────────────────────── */
/** Filter data by active category + search query */
function getFilteredData() {
  return itineraries.filter(item => {
    const matchCat    = activeFilter === 'all' || item.category === activeFilter;
    const query       = searchQuery.toLowerCase();
    const matchSearch = !query ||
      item.destination.toLowerCase().includes(query) ||
      (item.notes || '').toLowerCase().includes(query);
    return matchCat && matchSearch;
  });
}

/** Render all cards */
function renderCards() {
  const data = getFilteredData();

  // Update plan count label
  const total = itineraries.length;
  planCount.textContent = total === 0 ? '' :
    `${data.length} of ${total} plan${total !== 1 ? 's' : ''}`;

  // Toggle empty state
  if (data.length === 0) {
    cardsGrid.innerHTML = '';
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  // Build card HTML
  cardsGrid.innerHTML = data.map((item, i) => buildCardHTML(item, i)).join('');

  // Attach card button listeners
  cardsGrid.querySelectorAll('.card-btn[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.id));
  });
  cardsGrid.querySelectorAll('.card-btn[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => deleteItem(btn.dataset.id));
  });
}

/** Build HTML string for a single card */
function buildCardHTML(item, index) {
  const cat      = CATEGORIES[item.category] || CATEGORIES.other;
  const dateLabel= buildDateLabel(item.startDate, item.endDate);
  const notes    = item.notes ? escapeHTML(item.notes) : '';
  const delay    = Math.min(index * 0.04, 0.4); // stagger up to 400ms

  return `
    <article class="itinerary-card" style="animation-delay:${delay}s" data-id="${item.id}">
      <div class="card-accent-line ${cat.accentClass}"></div>
      <span class="card-badge">${cat.label}</span>
      <h3 class="card-destination">${escapeHTML(item.destination)}</h3>
      ${dateLabel ? `
        <div class="card-dates">
          <span>📅</span>
          <span>${dateLabel}</span>
        </div>` : ''}
      ${notes ? `<p class="card-notes">${notes}</p>` : ''}
      <div class="card-actions">
        <button class="card-btn" data-action="edit"   data-id="${item.id}" title="Edit plan">✎ Edit</button>
        <button class="card-btn delete" data-action="delete" data-id="${item.id}" title="Delete plan">✕ Delete</button>
      </div>
    </article>
  `;
}

/** Escape HTML entities to prevent XSS */
function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ── 8. CRUD Operations ─────────────────────────────────────── */
/** Add a new itinerary item */
function addItem(data) {
  const newItem = { id: generateId(), ...data };
  itineraries.unshift(newItem); // add to top
  saveToStorage();
  renderCards();
  showToast('Plan added! ✦', 'success');
}

/** Update an existing item by id */
function updateItem(id, data) {
  const idx = itineraries.findIndex(i => i.id === id);
  if (idx === -1) return;
  itineraries[idx] = { ...itineraries[idx], ...data };
  saveToStorage();
  renderCards();
  showToast('Plan updated ✎', 'info');
}

/** Delete an item by id */
function deleteItem(id) {
  // Animate the card out first
  const card = cardsGrid.querySelector(`[data-id="${id}"]`);
  if (card) {
    card.style.transition = 'all 0.3s ease';
    card.style.opacity    = '0';
    card.style.transform  = 'scale(0.9) translateY(-8px)';
    setTimeout(() => {
      itineraries = itineraries.filter(i => i.id !== id);
      saveToStorage();
      renderCards();
    }, 280);
  } else {
    itineraries = itineraries.filter(i => i.id !== id);
    saveToStorage();
    renderCards();
  }
  showToast('Plan removed', 'error');
}

/* ── 9. Modal Logic ─────────────────────────────────────────── */
/** Open modal in ADD mode */
function openAddModal() {
  editingId = null;
  form.reset();
  editIdInput.value  = '';
  modalTitle.textContent = 'New Plan';
  document.getElementById('save-btn').textContent = 'Save Plan ✦';
  clearFormErrors();
  showModal();
  // Auto-focus destination after transition
  setTimeout(() => destInput.focus(), 350);
}

/** Open modal in EDIT mode */
function openEditModal(id) {
  const item = itineraries.find(i => i.id === id);
  if (!item) return;

  editingId          = id;
  editIdInput.value  = id;
  modalTitle.textContent = 'Edit Plan';
  document.getElementById('save-btn').textContent = 'Save Changes ✦';

  // Populate form fields
  destInput.value  = item.destination;
  startInput.value = item.startDate  || '';
  endInput.value   = item.endDate    || '';
  catSelect.value  = item.category   || 'other';
  notesInput.value = item.notes      || '';

  clearFormErrors();
  showModal();
  setTimeout(() => destInput.focus(), 350);
}

/** Show modal overlay */
function showModal() {
  modalOverlay.hidden = false;
  // Force reflow before adding open class for transition
  requestAnimationFrame(() => {
    requestAnimationFrame(() => modalOverlay.classList.add('open'));
  });
  document.body.style.overflow = 'hidden';
}

/** Hide modal overlay */
function hideModal() {
  modalOverlay.classList.remove('open');
  document.body.style.overflow = '';
  // Wait for animation to finish before hiding
  setTimeout(() => { modalOverlay.hidden = true; }, 360);
}

/* ── 10. Form Validation & Submission ──────────────────────── */
/** Remove all error states */
function clearFormErrors() {
  form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
}

/** Handle form submit */
function handleFormSubmit(e) {
  e.preventDefault();
  clearFormErrors();

  const destination = destInput.value.trim();

  // Validate required fields
  if (!destination) {
    destInput.classList.add('error');
    destInput.focus();
    showToast('Please enter a destination', 'error');
    return;
  }

  // Validate date order
  if (startInput.value && endInput.value && endInput.value < startInput.value) {
    endInput.classList.add('error');
    showToast('End date must be after start date', 'error');
    return;
  }

  const data = {
    destination,
    startDate: startInput.value || null,
    endDate:   endInput.value   || null,
    category:  catSelect.value,
    notes:     notesInput.value.trim(),
  };

  if (editingId) {
    updateItem(editingId, data);
  } else {
    addItem(data);
  }

  hideModal();
}

/* ── 11. Toast Notifications ────────────────────────────────── */
const TOAST_ICONS = { success: '✓', error: '✕', info: '✎' };

/** Show a toast notification */
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'status');
  toast.innerHTML = `
    <span class="toast-icon">${TOAST_ICONS[type] || '●'}</span>
    <span class="toast-message">${message}</span>
  `;
  toastContainer.appendChild(toast);

  // Auto-dismiss after 3s
  const dismiss = () => {
    toast.classList.add('leaving');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
    // Fallback removal
    setTimeout(() => toast.remove(), 400);
  };
  const timer = setTimeout(dismiss, 3000);

  // Click to dismiss early
  toast.addEventListener('click', () => { clearTimeout(timer); dismiss(); });
}

/* ── 12. Search ─────────────────────────────────────────────── */
/** Debounce helper */
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

const handleSearch = debounce((q) => {
  searchQuery = q;
  renderCards();
}, 220);

/* ── 13. Filter Pills ───────────────────────────────────────── */
function handlePillClick(e) {
  const pill = e.target.closest('.pill');
  if (!pill) return;
  // Update active state
  filterPills.querySelectorAll('.pill').forEach(p => p.classList.remove('pill-active'));
  pill.classList.add('pill-active');
  activeFilter = pill.dataset.filter;
  renderCards();
}

/* ── 14. Theme Toggle ───────────────────────────────────────── */
const THEME_KEY = 'wandr_theme';

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'dark';
  applyTheme(saved);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeIcon.textContent = theme === 'dark' ? '☀' : '☽';
  themeToggle.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  localStorage.setItem(THEME_KEY, theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

/* ── 15. Keyboard Accessibility ─────────────────────────────── */
function handleKeyDown(e) {
  // Close modal on Escape
  if (e.key === 'Escape' && !modalOverlay.hidden) {
    hideModal();
  }
}

/* ── 16. Click Outside Modal ────────────────────────────────── */
function handleOverlayClick(e) {
  if (e.target === modalOverlay) hideModal();
}

/* ── 17. Seed Data (first visit) ────────────────────────────── */
function seedDemoData() {
  return [
    {
      id:          generateId(),
      destination: 'Kyoto, Japan 🇯🇵',
      startDate:   '2025-11-10',
      endDate:     '2025-11-17',
      category:    'travel',
      notes:       'Visit Arashiyama bamboo grove at sunrise. Book ryokan in Gion district. Try kaiseki dinner.',
    },
    {
      id:          generateId(),
      destination: 'Ramen Street, Shibuya',
      startDate:   '2025-11-11',
      endDate:     null,
      category:    'food',
      notes:       'Ichiran ramen solo booth experience. Best tonkotsu broth in the city apparently!',
    },
    {
      id:          generateId(),
      destination: 'Park Hyatt Tokyo',
      startDate:   '2025-11-10',
      endDate:     '2025-11-17',
      category:    'stay',
      notes:       'Lost in Translation vibes. Ask for a city-view room on the 47th floor.',
    },
  ];
}

/* ── 18. Initialization ─────────────────────────────────────── */
function init() {
  // Load data
  itineraries = loadFromStorage();

  // Seed demo data if first visit
  if (itineraries.length === 0) {
    itineraries = seedDemoData();
    saveToStorage();
  }

  // Apply saved theme
  initTheme();

  // Initial render
  renderCards();

  /* ── Event Listeners ── */

  // Open modal buttons
  openModalBtn.addEventListener('click', openAddModal);
  emptyAddBtn.addEventListener('click', openAddModal);

  // Close modal
  modalCloseBtn.addEventListener('click', hideModal);
  cancelBtn.addEventListener('click', hideModal);
  modalOverlay.addEventListener('click', handleOverlayClick);

  // Form submit
  form.addEventListener('submit', handleFormSubmit);

  // Search
  searchInput.addEventListener('input', (e) => handleSearch(e.target.value));

  // Filter pills
  filterPills.addEventListener('click', handlePillClick);

  // Theme toggle
  themeToggle.addEventListener('click', toggleTheme);

  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyDown);

  // Input error clear on type
  destInput.addEventListener('input', () => destInput.classList.remove('error'));
  endInput.addEventListener('input',  () => endInput.classList.remove('error'));
}

// Boot
document.addEventListener('DOMContentLoaded', init);
