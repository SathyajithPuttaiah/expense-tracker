// =====================================================
// TripSplit — Main Application Logic
// =====================================================

(() => {
  'use strict';

  // ---- Constants ----
  const CATEGORIES = {
    transport:   { icon: '🚕', label: 'Transport',   color: '#7CB3F5' },
    food:        { icon: '🍽️', label: 'Food',        color: '#F5C77C' },
    hotel:       { icon: '🏨', label: 'Hotel',       color: '#B49CF5' },
    sightseeing: { icon: '🎟️', label: 'Sightseeing', color: '#F5A0C8' },
    shopping:    { icon: '🛍️', label: 'Shopping',    color: '#7CD4B2' },
    drinks:      { icon: '☕', label: 'Drinks',      color: '#A8D8EA' },
    snacks:      { icon: '🍿', label: 'Snacks',      color: '#FFD3B6' },
    medical:     { icon: '💊', label: 'Medical',     color: '#F5B0B0' },
    gifts:       { icon: '🎁', label: 'Gifts',       color: '#D4A5F5' },
    fuel:        { icon: '⛽', label: 'Fuel',        color: '#B8D4A8' },
    tips:        { icon: '💡', label: 'Tips',        color: '#F5E6A0' },
    other:       { icon: '📦', label: 'Other',       color: '#C0C0D0' },
  };

  // ---- State ----
  let state = {
    tripCode: null,
    tripName: null,
    userName: null,
    members: [],
    budget: 0,
    expenses: [],
    currentView: 'home',
    selectedCategory: 'transport',
    editingExpenseId: null,
  };

  let unsubscribeExpenses = null;
  let charts = {};

  // ---- Helpers ----
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  function generateTripCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  function formatCurrency(amount) {
    return '₹' + Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateStr === today.toISOString().split('T')[0]) return 'Today';
    if (dateStr === yesterday.toISOString().split('T')[0]) return 'Yesterday';

    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  function getTodayStr() {
    return new Date().toISOString().split('T')[0];
  }

  function showToast(message) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.add('hidden'), 2500);
  }

  function showLoading(show) {
    $('#loading').classList.toggle('hidden', !show);
  }

  function saveState() {
    localStorage.setItem('tripsplit_state', JSON.stringify({
      tripCode: state.tripCode,
      tripName: state.tripName,
      userName: state.userName,
      members: state.members,
      budget: state.budget,
    }));
    saveTripToHistory();
  }

  function saveTripToHistory() {
    const history = getTripHistory();
    const idx = history.findIndex(t => t.tripCode === state.tripCode);
    const entry = {
      tripCode: state.tripCode,
      tripName: state.tripName,
      userName: state.userName,
      members: state.members,
    };
    if (idx >= 0) {
      history[idx] = entry;
    } else {
      history.unshift(entry);
    }
    localStorage.setItem('tripsplit_history', JSON.stringify(history));
  }

  function getTripHistory() {
    try {
      return JSON.parse(localStorage.getItem('tripsplit_history') || '[]');
    } catch {
      return [];
    }
  }

  function removeTripFromHistory(tripCode) {
    const history = getTripHistory().filter(t => t.tripCode !== tripCode);
    localStorage.setItem('tripsplit_history', JSON.stringify(history));
  }

  function loadState() {
    const saved = localStorage.getItem('tripsplit_state');
    if (saved) {
      const data = JSON.parse(saved);
      Object.assign(state, data);
      return true;
    }
    return false;
  }

  // ---- Firebase Operations ----
  async function createTrip(tripName, userName, partnerName, budget) {
    const tripCode = generateTripCode();
    const members = [userName, partnerName];

    await db.collection('trips').doc(tripCode).set({
      name: tripName,
      members: members,
      budget: budget || 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    state.tripCode = tripCode;
    state.tripName = tripName;
    state.userName = userName;
    state.members = members;
    state.budget = budget || 0;
    saveState();

    return tripCode;
  }

  async function joinTrip(tripCode, userName) {
    tripCode = tripCode.toUpperCase();
    const doc = await db.collection('trips').doc(tripCode).get();

    if (!doc.exists) {
      throw new Error('Trip not found. Check the code and try again.');
    }

    const data = doc.data();

    // Add member if not already present
    if (!data.members.includes(userName)) {
      data.members.push(userName);
      await db.collection('trips').doc(tripCode).update({ members: data.members });
    }

    state.tripCode = tripCode;
    state.tripName = data.name;
    state.userName = userName;
    state.members = data.members;
    state.budget = data.budget || 0;
    saveState();
  }

  async function addExpense(expense) {
    await db.collection('trips').doc(state.tripCode)
      .collection('expenses').add({
        ...expense,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
  }

  async function updateExpense(id, data) {
    await db.collection('trips').doc(state.tripCode)
      .collection('expenses').doc(id).update(data);
  }

  async function deleteExpense(id) {
    await db.collection('trips').doc(state.tripCode)
      .collection('expenses').doc(id).delete();
  }

  function subscribeToExpenses() {
    if (unsubscribeExpenses) unsubscribeExpenses();

    unsubscribeExpenses = db.collection('trips').doc(state.tripCode)
      .collection('expenses')
      .orderBy('date', 'desc')
      .onSnapshot((snapshot) => {
        state.expenses = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        renderAll();
      }, (error) => {
        console.error('Firestore subscription error:', error);
        showToast('Connection error. Check your internet.');
      });
  }

  // ---- Navigation ----
  function switchView(viewName) {
    state.currentView = viewName;
    $$('.view').forEach(v => v.classList.remove('active'));
    $(`#view-${viewName}`).classList.add('active');
    $$('.nav-btn').forEach(b => b.classList.remove('active'));
    $(`.nav-btn[data-view="${viewName}"]`).classList.add('active');

    if (viewName === 'charts') {
      setTimeout(renderCharts, 100);
    }
    if (viewName === 'add') {
      $('#expense-amount').focus();
    }
  }

  // ---- Rendering ----
  function renderAll() {
    renderDashboard();
    renderHistory();
    if (state.currentView === 'charts') {
      renderCharts();
    }
  }

  function renderDashboard() {
    const expenses = state.expenses;
    const today = getTodayStr();

    // Total
    const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    $('#total-spent').textContent = formatCurrency(total);

    // Budget
    if (state.budget > 0) {
      const pct = Math.min((total / state.budget) * 100, 100);
      $('#budget-bar-container').classList.remove('hidden');
      $('#budget-fill').style.width = pct + '%';
      $('#budget-text').textContent = `${formatCurrency(total)} of ${formatCurrency(state.budget)} (${Math.round(pct)}%)`;
    } else {
      $('#budget-bar-container').classList.add('hidden');
    }

    // Per person
    const person1 = state.members[0] || 'Person 1';
    const person2 = state.members[1] || 'Person 2';
    $('#person1-name').textContent = person1;
    $('#person2-name').textContent = person2;

    const person1Total = expenses.filter(e => e.paidBy === person1).reduce((s, e) => s + Number(e.amount), 0);
    const person2Total = expenses.filter(e => e.paidBy === person2).reduce((s, e) => s + Number(e.amount), 0);
    $('#person1-total').textContent = formatCurrency(person1Total);
    $('#person2-total').textContent = formatCurrency(person2Total);

    // Today
    const todayExpenses = expenses.filter(e => e.date === today);
    const todayTotal = todayExpenses.reduce((s, e) => s + Number(e.amount), 0);
    $('#today-total').textContent = formatCurrency(todayTotal);
    renderExpenseList('#today-expenses-list', todayExpenses, "No expenses today. Tap + to add one!");

    // Recent (last 5, excluding today's already shown)
    const recent = expenses.slice(0, 5);
    renderExpenseList('#recent-expenses-list', recent, "No expenses yet.");
  }

  function renderExpenseList(containerSelector, expenses, emptyMsg) {
    const container = $(containerSelector);
    if (expenses.length === 0) {
      container.innerHTML = `<div class="empty-state">${emptyMsg}</div>`;
      return;
    }

    container.innerHTML = expenses.map(e => {
      const cat = CATEGORIES[e.category] || CATEGORIES.other;
      return `
        <div class="expense-item" data-id="${e.id}">
          <div class="expense-icon ${e.category}">${cat.icon}</div>
          <div class="expense-details">
            <div class="expense-desc">${escapeHtml(e.description || cat.label)}</div>
            <div class="expense-meta">${cat.label} · ${formatDate(e.date)}</div>
          </div>
          <div>
            <div class="expense-amount">${formatCurrency(e.amount)}</div>
            <div class="expense-paid-by">${escapeHtml(e.paidBy)}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderHistory() {
    const filterCat = $('#filter-category').value;
    const filterPerson = $('#filter-person').value;

    let filtered = state.expenses;
    if (filterCat !== 'all') filtered = filtered.filter(e => e.category === filterCat);
    if (filterPerson !== 'all') filtered = filtered.filter(e => e.paidBy === filterPerson);

    const container = $('#history-list');

    if (filtered.length === 0) {
      container.innerHTML = '<div class="empty-state">No expenses match the filters.</div>';
      return;
    }

    // Group by date
    const grouped = {};
    filtered.forEach(e => {
      if (!grouped[e.date]) grouped[e.date] = [];
      grouped[e.date].push(e);
    });

    let html = '';
    Object.keys(grouped).sort().reverse().forEach(date => {
      const dayTotal = grouped[date].reduce((s, e) => s + Number(e.amount), 0);
      html += `<div class="date-group-header">${formatDate(date)} — ${formatCurrency(dayTotal)}</div>`;
      grouped[date].forEach(e => {
        const cat = CATEGORIES[e.category] || CATEGORIES.other;
        html += `
          <div class="expense-item" data-id="${e.id}">
            <div class="expense-icon ${e.category}">${cat.icon}</div>
            <div class="expense-details">
              <div class="expense-desc">${escapeHtml(e.description || cat.label)}</div>
              <div class="expense-meta">${cat.label}</div>
            </div>
            <div>
              <div class="expense-amount">${formatCurrency(e.amount)}</div>
              <div class="expense-paid-by">${escapeHtml(e.paidBy)}</div>
            </div>
          </div>
        `;
      });
    });

    container.innerHTML = html;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // ---- Charts ----
  function renderCharts() {
    if (state.expenses.length === 0) return;

    renderCategoryChart();
    renderDailyChart();
    renderPersonChart();
    renderCategoryPersonChart();
  }

  function renderCategoryChart() {
    const data = {};
    state.expenses.forEach(e => {
      data[e.category] = (data[e.category] || 0) + Number(e.amount);
    });

    const labels = Object.keys(data).map(k => CATEGORIES[k]?.label || k);
    const values = Object.values(data);
    const colors = Object.keys(data).map(k => CATEGORIES[k]?.color || '#6B7280');

    if (charts.category) charts.category.destroy();
    charts.category = new Chart($('#chart-category'), {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { padding: 16, font: { size: 12 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ₹${ctx.parsed.toLocaleString('en-IN')}`
            }
          }
        },
        cutout: '60%',
      }
    });
  }

  function renderDailyChart() {
    const data = {};
    state.expenses.forEach(e => {
      data[e.date] = (data[e.date] || 0) + Number(e.amount);
    });

    const sortedDates = Object.keys(data).sort();
    const labels = sortedDates.map(d => {
      const dt = new Date(d + 'T00:00:00');
      return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    });
    const values = sortedDates.map(d => data[d]);

    if (charts.daily) charts.daily.destroy();
    charts.daily = new Chart($('#chart-daily'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Daily Spend',
          data: values,
          backgroundColor: '#818CF8',
          borderRadius: 6,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `₹${ctx.parsed.y.toLocaleString('en-IN')}`
            }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            beginAtZero: true,
            ticks: {
              callback: (v) => '₹' + (v >= 1000 ? (v/1000) + 'k' : v)
            }
          }
        }
      }
    });
  }

  function renderPersonChart() {
    const data = {};
    state.members.forEach(m => data[m] = 0);
    state.expenses.forEach(e => {
      data[e.paidBy] = (data[e.paidBy] || 0) + Number(e.amount);
    });

    if (charts.person) charts.person.destroy();
    charts.person = new Chart($('#chart-person'), {
      type: 'doughnut',
      data: {
        labels: Object.keys(data),
        datasets: [{
          data: Object.values(data),
          backgroundColor: ['#4F46E5', '#F59E0B'],
          borderWidth: 0,
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { padding: 16, font: { size: 12 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ₹${ctx.parsed.toLocaleString('en-IN')}`
            }
          }
        },
        cutout: '60%',
      }
    });
  }

  function renderCategoryPersonChart() {
    const categories = Object.keys(CATEGORIES);
    const person1 = state.members[0];
    const person2 = state.members[1];

    const data1 = categories.map(cat =>
      state.expenses.filter(e => e.category === cat && e.paidBy === person1)
        .reduce((s, e) => s + Number(e.amount), 0)
    );
    const data2 = categories.map(cat =>
      state.expenses.filter(e => e.category === cat && e.paidBy === person2)
        .reduce((s, e) => s + Number(e.amount), 0)
    );

    // Only show categories with data
    const activeIdx = categories.map((_, i) => i).filter(i => data1[i] > 0 || data2[i] > 0);
    const labels = activeIdx.map(i => CATEGORIES[categories[i]].label);
    const d1 = activeIdx.map(i => data1[i]);
    const d2 = activeIdx.map(i => data2[i]);

    if (labels.length === 0) return;

    if (charts.catPerson) charts.catPerson.destroy();
    charts.catPerson = new Chart($('#chart-category-person'), {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: person1 || 'Person 1', data: d1, backgroundColor: '#4F46E5', borderRadius: 4 },
          { label: person2 || 'Person 2', data: d2, backgroundColor: '#F59E0B', borderRadius: 4 },
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { padding: 12, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ₹${ctx.parsed.y.toLocaleString('en-IN')}`
            }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            beginAtZero: true,
            ticks: {
              callback: (v) => '₹' + (v >= 1000 ? (v/1000) + 'k' : v)
            }
          }
        }
      }
    });
  }

  // ---- Event Handlers ----
  function initEventListeners() {

    // Setup tabs
    $$('.setup-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        $$('.setup-tab').forEach(t => t.classList.remove('active'));
        $$('.tab-content').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        $(`#${tab.dataset.tab}-tab`).classList.add('active');
      });
    });

    // Create trip
    $('#btn-create-trip').addEventListener('click', async () => {
      const tripName = $('#trip-name').value.trim();
      const userName = $('#create-user-name').value.trim();
      const partnerName = $('#partner-name').value.trim();
      const budget = Number($('#trip-budget').value) || 0;

      if (!tripName || !userName || !partnerName) {
        showToast('Please fill in all required fields');
        return;
      }

      showLoading(true);
      try {
        const code = await createTrip(tripName, userName, partnerName, budget);
        showToast(`Trip created! Code: ${code}`);
        initMainApp();
      } catch (err) {
        showToast('Error creating trip: ' + err.message);
        console.error(err);
      }
      showLoading(false);
    });

    // Join trip
    $('#btn-join-trip').addEventListener('click', async () => {
      const tripCode = $('#join-trip-code').value.trim();
      const userName = $('#join-user-name').value.trim();

      if (!tripCode || !userName) {
        showToast('Please fill in all fields');
        return;
      }

      showLoading(true);
      try {
        await joinTrip(tripCode, userName);
        showToast(`Joined "${state.tripName}"!`);
        initMainApp();
      } catch (err) {
        showToast(err.message);
        console.error(err);
      }
      showLoading(false);
    });

    // Bottom nav
    $$('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => switchView(btn.dataset.view));
    });

    // Category selection
    $('#category-grid').addEventListener('click', (e) => {
      const btn = e.target.closest('.category-btn');
      if (!btn) return;
      $$('.category-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.selectedCategory = btn.dataset.category;
    });

    // Paid by toggle
    $('#paid-by-toggle').addEventListener('click', (e) => {
      const btn = e.target.closest('.toggle-btn');
      if (!btn) return;
      $$('#paid-by-toggle .toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });

    // Save expense
    $('#btn-save-expense').addEventListener('click', async () => {
      const amount = Number($('#expense-amount').value);
      const description = $('#expense-desc').value.trim();
      const date = $('#expense-date').value;
      const paidByBtn = $('#paid-by-toggle .toggle-btn.active');
      const paidBy = paidByBtn.dataset.person === 'person1' ? state.members[0] : state.members[1];

      if (!amount || amount <= 0) {
        showToast('Please enter an amount');
        return;
      }

      if (!date) {
        showToast('Please select a date');
        return;
      }

      showLoading(true);
      try {
        await addExpense({
          amount,
          category: state.selectedCategory,
          description: description || CATEGORIES[state.selectedCategory].label,
          paidBy,
          date,
        });
        // Reset form
        $('#expense-amount').value = '';
        $('#expense-desc').value = '';
        showToast('Expense added!');
        switchView('home');
      } catch (err) {
        showToast('Error saving: ' + err.message);
        console.error(err);
      }
      showLoading(false);
    });

    // History filters
    $('#filter-category').addEventListener('change', renderHistory);
    $('#filter-person').addEventListener('change', renderHistory);

    // Expense item click (edit)
    document.addEventListener('click', (e) => {
      const item = e.target.closest('.expense-item');
      if (!item) return;
      const id = item.dataset.id;
      const expense = state.expenses.find(ex => ex.id === id);
      if (!expense) return;
      openEditModal(expense);
    });

    // Trip switcher
    $('#btn-trip-switcher').addEventListener('click', openTripSwitcher);

    // Trip switcher actions
    $('#btn-modal-new-trip').addEventListener('click', () => {
      $('#trips-modal').classList.add('hidden');
      if (confirm('Start a new trip? You can switch back to this trip anytime.')) {
        if (unsubscribeExpenses) unsubscribeExpenses();
        localStorage.removeItem('tripsplit_state');
        location.reload();
      }
    });

    $('#btn-modal-join-trip').addEventListener('click', () => {
      $('#trips-modal').classList.add('hidden');
      if (confirm('Join another trip? You can switch back to this trip anytime.')) {
        if (unsubscribeExpenses) unsubscribeExpenses();
        localStorage.setItem('tripsplit_open_join', 'true');
        localStorage.removeItem('tripsplit_state');
        location.reload();
      }
    });

    // Settings
    $('#btn-settings').addEventListener('click', openSettings);

    // Modal close
    $$('.modal-close, .modal-overlay').forEach(el => {
      el.addEventListener('click', (e) => {
        e.target.closest('.modal').classList.add('hidden');
      });
    });

    // Copy trip code
    $('#btn-copy-code').addEventListener('click', () => {
      navigator.clipboard.writeText(state.tripCode).then(() => {
        showToast('Trip code copied!');
      }).catch(() => {
        // Fallback
        const el = document.createElement('textarea');
        el.value = state.tripCode;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        showToast('Trip code copied!');
      });
    });

    // Export
    $('#btn-export').addEventListener('click', exportData);

    // Start new trip
    $('#btn-new-trip').addEventListener('click', () => {
      if (confirm('Start a new trip? You can always rejoin this trip later using the code: ' + state.tripCode)) {
        if (unsubscribeExpenses) unsubscribeExpenses();
        localStorage.removeItem('tripsplit_state');
        location.reload();
        // Will land on setup screen with "New Trip" tab active
      }
    });

    // Switch / join another trip
    $('#btn-switch-trip').addEventListener('click', () => {
      if (confirm('Switch to another trip? You can rejoin this trip later using the code: ' + state.tripCode)) {
        if (unsubscribeExpenses) unsubscribeExpenses();
        localStorage.setItem('tripsplit_open_join', 'true');
        localStorage.removeItem('tripsplit_state');
        location.reload();
      }
    });

    // Leave trip
    $('#btn-leave-trip').addEventListener('click', () => {
      if (confirm('Leave this trip? Your local session will be cleared. Expenses will remain in the cloud.')) {
        if (unsubscribeExpenses) unsubscribeExpenses();
        localStorage.removeItem('tripsplit_state');
        location.reload();
      }
    });

    // Update expense
    $('#btn-update-expense').addEventListener('click', async () => {
      if (!state.editingExpenseId) return;
      showLoading(true);
      try {
        await updateExpense(state.editingExpenseId, {
          amount: Number($('#edit-amount').value),
          category: $('#edit-category').value,
          description: $('#edit-desc').value.trim(),
          date: $('#edit-date').value,
        });
        $('#edit-modal').classList.add('hidden');
        showToast('Expense updated!');
      } catch (err) {
        showToast('Error: ' + err.message);
      }
      showLoading(false);
    });

    // Delete expense
    $('#btn-delete-expense').addEventListener('click', async () => {
      if (!state.editingExpenseId) return;
      if (!confirm('Delete this expense?')) return;
      showLoading(true);
      try {
        await deleteExpense(state.editingExpenseId);
        $('#edit-modal').classList.add('hidden');
        showToast('Expense deleted');
      } catch (err) {
        showToast('Error: ' + err.message);
      }
      showLoading(false);
    });
  }

  function openEditModal(expense) {
    state.editingExpenseId = expense.id;
    $('#edit-amount').value = expense.amount;
    $('#edit-category').value = expense.category;
    $('#edit-desc').value = expense.description || '';
    $('#edit-date').value = expense.date;
    $('#edit-modal').classList.remove('hidden');
  }

  function openTripSwitcher() {
    const history = getTripHistory();
    const container = $('#trips-list');

    if (history.length === 0) {
      container.innerHTML = '<div class="trips-empty">No trips yet. Create one to get started!</div>';
    } else {
      container.innerHTML = history.map(trip => {
        const isActive = trip.tripCode === state.tripCode;
        return `
          <div class="trip-item ${isActive ? 'active-trip' : ''}" data-code="${trip.tripCode}">
            <div class="trip-item-icon">${isActive ? '✈️' : '🗂️'}</div>
            <div class="trip-item-details">
              <div class="trip-item-name">${escapeHtml(trip.tripName)}</div>
              <div class="trip-item-meta">${trip.members ? trip.members.join(', ') : trip.userName}</div>
            </div>
            <span class="trip-item-badge">${trip.tripCode}</span>
            ${isActive ? '<span class="active-label">Active</span>' : ''}
          </div>
        `;
      }).join('');

      // Trip item click handler
      container.querySelectorAll('.trip-item:not(.active-trip)').forEach(item => {
        item.addEventListener('click', () => {
          switchToTrip(item.dataset.code);
        });
      });
    }

    $('#trips-modal').classList.remove('hidden');
  }

  async function switchToTrip(tripCode) {
    showLoading(true);
    try {
      const history = getTripHistory();
      const trip = history.find(t => t.tripCode === tripCode);
      if (!trip) {
        showToast('Trip not found in history');
        showLoading(false);
        return;
      }

      // Verify from Firestore
      const doc = await db.collection('trips').doc(tripCode).get();
      if (!doc.exists) {
        showToast('Trip no longer exists in the cloud');
        removeTripFromHistory(tripCode);
        showLoading(false);
        return;
      }

      const data = doc.data();
      if (unsubscribeExpenses) unsubscribeExpenses();

      state.tripCode = tripCode;
      state.tripName = data.name;
      state.userName = trip.userName;
      state.members = data.members;
      state.budget = data.budget || 0;
      saveState();

      $('#trips-modal').classList.add('hidden');
      initMainApp();
      showToast(`Switched to "${data.name}"`);
    } catch (err) {
      showToast('Error: ' + err.message);
    }
    showLoading(false);
  }

  function openSettings() {
    $('#settings-trip-code').textContent = state.tripCode;
    $('#settings-trip-name').textContent = state.tripName;
    $('#settings-user-name').textContent = state.userName;
    $('#settings-members').textContent = state.members.join(', ');
    $('#settings-modal').classList.remove('hidden');
  }

  function exportData() {
    const data = {
      trip: {
        code: state.tripCode,
        name: state.tripName,
        members: state.members,
        budget: state.budget,
      },
      expenses: state.expenses.map(e => ({
        amount: e.amount,
        category: e.category,
        description: e.description,
        paidBy: e.paidBy,
        date: e.date,
      })),
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.tripName.replace(/\s+/g, '-')}-expenses.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Data exported!');
  }

  // ---- App Initialization ----
  function initMainApp() {
    $('#setup-screen').classList.remove('active');
    $('#main-app').classList.remove('hidden');

    // Set header
    $('#header-trip-name').textContent = state.tripName;
    $('#header-trip-code').textContent = state.tripCode;

    // Set person names in UI
    const person1 = state.members[0] || 'Person 1';
    const person2 = state.members[1] || 'Person 2';
    $('#toggle-person1').textContent = person1;
    $('#toggle-person2').textContent = person2;

    // Set default active person
    if (state.userName === person1) {
      $('#toggle-person1').classList.add('active');
      $('#toggle-person2').classList.remove('active');
    } else {
      $('#toggle-person2').classList.add('active');
      $('#toggle-person1').classList.remove('active');
    }

    // Person filter dropdown
    const personFilter = $('#filter-person');
    personFilter.innerHTML = '<option value="all">Everyone</option>';
    state.members.forEach(m => {
      personFilter.innerHTML += `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`;
    });

    // Set default date
    $('#expense-date').value = getTodayStr();

    // Subscribe to expenses
    subscribeToExpenses();

    // Start on home view
    switchView('home');
  }

  // ---- Boot ----
  function boot() {
    initEventListeners();

    if (loadState() && state.tripCode) {
      // Returning user - go straight to app
      initMainApp();
    } else if (localStorage.getItem('tripsplit_open_join')) {
      // User wants to switch/join another trip
      localStorage.removeItem('tripsplit_open_join');
      $$('.setup-tab').forEach(t => t.classList.remove('active'));
      $$('.tab-content').forEach(t => t.classList.remove('active'));
      $('[data-tab="join"]').classList.add('active');
      $('#join-tab').classList.add('active');
    }
    // else stay on setup screen
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
