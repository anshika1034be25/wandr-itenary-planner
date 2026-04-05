(function() {
  let itineraryData = [];
  let currentFilter = 'all';
  let searchQuery = '';
  let editingId = null;

  const categoryMap = {
    travel:   { label: '✈ Travel',   cls: 'cat-travel' },
    food:     { label: '🍜 Food',    cls: 'cat-food' },
    stay:     { label: '🏨 Stay',    cls: 'cat-stay' },
    activity: { label: '🎭 Activity',cls: 'cat-activity' },
    shopping: { label: '🛍 Shopping',cls: 'cat-shopping' },
    other:    { label: '◎ Other',    cls: 'cat-other' }
  };

  const storageKey = 'wandr_itineraries_v1';

  const planGrid = document.getElementById('planGrid');
  const emptyStateDiv = document.getElementById('emptyStateMsg');
  const planCountSpan = document.getElementById('planCounter');
  const modalBackdrop = document.getElementById('modalBackdrop');
  const modalTitle = document.getElementById('modalTitle');
  const planForm = document.getElementById('planForm');
  const destInput = document.getElementById('destInput');
  const startDateInput = document.getElementById('startDateInput');
  const endDateInput = document.getElementById('endDateInput');
  const categorySelect = document.getElementById('categorySelect');
  const notesInput = document.getElementById('notesInput');
  const searchField = document.getElementById('searchField');
  const filterGroupContainer = document.getElementById('filterGroupContainer');
  const addPlanButton = document.getElementById('addPlanButton');
  const emptyAddButton = document.getElementById('emptyAddButton');
  const closeModalButton = document.getElementById('closeModalButton');
  const cancelFormButton = document.getElementById('cancelFormButton');
  const themeToggleButton = document.getElementById('themeToggleButton');
  const notificationArea = document.getElementById('notificationArea');

  function loadData() {
    try {
      return JSON.parse(localStorage.getItem(storageKey)) || [];
    } catch {
      return [];
    }
  }

  function saveData() {
    localStorage.setItem(storageKey, JSON.stringify(itineraryData));
  }

  function generateId() {
    return Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  }

  function formatDateShort(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function getDateRangeText(start, end) {
    const startF = formatDateShort(start);
    const endF = formatDateShort(end);
    return startF && endF && startF !== endF ? `${startF} → ${endF}` : startF;
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[c]));
  }

  function getFilteredList() {
    return itineraryData.filter(item => {
      const categoryMatch = currentFilter === 'all' || item.category === currentFilter;
      const lowerQuery = searchQuery.toLowerCase();
      const searchMatch = !lowerQuery ||
        item.destination.toLowerCase().includes(lowerQuery) ||
        (item.notes || '').toLowerCase().includes(lowerQuery);
      return categoryMatch && searchMatch;
    });
  }

  function renderCards() {
    const filtered = getFilteredList();
    planCountSpan.textContent = itineraryData.length === 0 ? '' : `${filtered.length} of ${itineraryData.length} plans`;

    if (!filtered.length) {
      planGrid.innerHTML = '';
      emptyStateDiv.hidden = false;
      return;
    }

    emptyStateDiv.hidden = true;

    planGrid.innerHTML = filtered.map((item, idx) => {
      const cat = categoryMap[item.category] || categoryMap.other;
      const dateText = getDateRangeText(item.startDate, item.endDate);
      return `
        <article class="planCard" style="animation-delay:${idx * 0.04}s" data-id="${item.id}">
          <div class="cardAccent ${cat.cls}"></div>
          <span class="cardCategory">${cat.label}</span>
          <h3 class="cardTitle">${escapeHtml(item.destination)}</h3>
          ${dateText ? `<div class="cardDateRange"><span>📅</span><span>${dateText}</span></div>` : ''}
          ${item.notes ? `<p class="cardNotes">${escapeHtml(item.notes)}</p>` : ''}
          <div class="cardActions">
            <button class="cardButton editBtn" data-id="${item.id}">✎ Edit</button>
          </div>
        </article>
      `;
    }).join('');

    document.querySelectorAll('.editBtn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        openEditModal(btn.dataset.id);
      };
    });

    document.querySelectorAll('.planCard').forEach(card => {
      card.onclick = (e) => {
        if (e.target.closest('.cardButton')) return;
        openEditModal(card.dataset.id);
      };
    });
  }

  function addItinerary(item) {
    itineraryData.unshift({ id: generateId(), ...item });
    saveData();
    renderCards();
    showToast('Plan added ✦');
  }

  function updateItinerary(id, updated) {
    const existing = itineraryData.find(x => x.id === id);
    if (!existing) return;
    Object.assign(existing, updated);
    saveData();
    renderCards();
    showToast('Plan updated ✎');
  }

  function openAddModal() {
    editingId = null;
    planForm.reset();
    modalTitle.textContent = 'New Plan';
    openModal();
  }

  function openEditModal(id) {
    const item = itineraryData.find(x => x.id === id);
    if (!item) return;
    editingId = id;
    modalTitle.textContent = 'Edit Plan';
    destInput.value = item.destination;
    startDateInput.value = item.startDate || '';
    endDateInput.value = item.endDate || '';
    categorySelect.value = item.category;
    notesInput.value = item.notes || '';
    openModal();
  }

  function openModal() {
    modalBackdrop.hidden = false;
    modalBackdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modalBackdrop.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => modalBackdrop.hidden = true, 300);
  }

  function showToast(message) {
    const toastEl = document.createElement('div');
    toastEl.className = 'notificationToast';
    toastEl.textContent = message;
    notificationArea.appendChild(toastEl);
    setTimeout(() => toastEl.remove(), 2000);
  }

  planForm.onsubmit = (e) => {
    e.preventDefault();
    const destination = destInput.value.trim();
    if (!destination) {
      showToast('Enter destination');
      return;
    }
    const newEntry = {
      destination: destination,
      startDate: startDateInput.value || null,
      endDate: endDateInput.value || null,
      category: categorySelect.value,
      notes: notesInput.value.trim()
    };
    if (editingId) {
      updateItinerary(editingId, newEntry);
    } else {
      addItinerary(newEntry);
    }
    closeModal();
  };

  function initApp() {
    itineraryData = loadData();
    renderCards();

    addPlanButton.onclick = openAddModal;
    emptyAddButton.onclick = openAddModal;
    closeModalButton.onclick = closeModal;
    cancelFormButton.onclick = closeModal;

    searchField.oninput = (e) => {
      searchQuery = e.target.value;
      renderCards();
    };

    filterGroupContainer.onclick = (e) => {
      const chip = e.target.closest('.filterChip');
      if (!chip) return;
      currentFilter = chip.dataset.filter;
      renderCards();
    };

    themeToggleButton.onclick = () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      document.documentElement.setAttribute('data-theme', currentTheme === 'dark' ? 'light' : 'dark');
    };
  }

  document.addEventListener('DOMContentLoaded', initApp);
})();