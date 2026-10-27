/*
 * Saarthi Play Public School — browser prototype logic
 * Academic session: 2026–27
 *
 * SECURITY NOTICE:
 * This file is a client-side prototype. A static website cannot securely
 * authenticate staff or protect student records. Without a server API this
 * version uses a clearly-labelled local demo sign-in and browser storage.
 * Do not publish real student/fee/attendance data until a backend, server-side
 * authentication, authorization, and protected database are configured.
 */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const SCHOOL_CLASSES = ['Play Group', 'Nursery', 'LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5'];
  const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
  const STORAGE_KEY = 'spps_school_portal_prototype_v1';
  const DEFAULT_SETTINGS = {
    schoolName: 'Saarthi Play Public School',
    address: 'Alipur, Delhi – 36',
    session: '2026–27',
    primaryColour: '#173d83',
    accentColour: '#e88719',
    logoDataUrl: ''
  };
  const EMPTY_DATABASE = {
    settings: { ...DEFAULT_SETTINGS },
    students: [],
    content: { announcements: [], homework: [], materials: [], exams: [], calendar: [], gallery: [], timetable: [], results: [] },
    attendance: {},
    payments: []
  };

  let database = loadDatabase();
  let currentUser = null;
  let currentPage = 'dashboard';
  let editorContext = null;
  let toastTimer = 0;
  let currentLogoDataUrl = database.settings.logoDataUrl || '';

  function loadDatabase() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return structuredCloneSafe(EMPTY_DATABASE);
      const parsed = JSON.parse(stored);
      return {
        ...structuredCloneSafe(EMPTY_DATABASE),
        ...parsed,
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
        content: { ...structuredCloneSafe(EMPTY_DATABASE.content), ...(parsed.content || {}) },
        students: Array.isArray(parsed.students) ? parsed.students : [],
        attendance: parsed.attendance && typeof parsed.attendance === 'object' ? parsed.attendance : {},
        payments: Array.isArray(parsed.payments) ? parsed.payments : []
      };
    } catch (error) {
      console.warn('Could not load saved SPPS browser data.', error);
      return structuredCloneSafe(EMPTY_DATABASE);
    }
  }

  function structuredCloneSafe(value) {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function saveDatabase() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(database));
      return true;
    } catch (error) {
      console.error('Unable to save SPPS browser data.', error);
      notify('The browser could not save all data. Export a backup and use a secure database for production.', 'error');
      return false;
    }
  }

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  function plainText(value, limit = 5000) {
    return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, limit);
  }

  function normalise(value) {
    return String(value ?? '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function slug(value) {
    return normalise(value).replace(/\s+/g, '-') || 'item';
  }

  function uid(prefix = 'item') {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function money(value) {
    const amount = Number(value || 0);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency', currency: 'INR', maximumFractionDigits: 0
    }).format(Number.isFinite(amount) ? amount : 0);
  }

  function moneyNumber(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const text = String(value ?? '').trim();
    if (!text || /^(ok|na|n a|none|nil|-)$/i.test(text)) return null;
    const cleaned = text.replace(/[₹,\s]/g, '');
    if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
    const number = Number(cleaned);
    return Number.isFinite(number) ? number : null;
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  }

  function inputDateToday() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  function notify(message, kind = 'info') {
    const region = $('#toast-region');
    if (!region) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${kind}`;
    toast.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    toast.textContent = message;
    region.appendChild(toast);
    window.setTimeout(() => toast.remove(), 4200);
  }

  function setMessage(id, message, kind = 'info') {
    const node = document.getElementById(id);
    if (!node) return;
    node.textContent = message || '';
    node.dataset.kind = kind;
  }

  function ensureContentArrays() {
    ['announcements', 'homework', 'materials', 'exams', 'calendar', 'gallery', 'timetable', 'results'].forEach(key => {
      if (!Array.isArray(database.content[key])) database.content[key] = [];
    });
  }

  function applySettings() {
    const settings = database.settings;
    document.documentElement.style.setProperty('--brand', isColour(settings.primaryColour) ? settings.primaryColour : DEFAULT_SETTINGS.primaryColour);
    document.documentElement.style.setProperty('--brand-deep', darkenHex(isColour(settings.primaryColour) ? settings.primaryColour : DEFAULT_SETTINGS.primaryColour, 0.22));
    document.documentElement.style.setProperty('--accent', isColour(settings.accentColour) ? settings.accentColour : DEFAULT_SETTINGS.accentColour);
    document.title = `${settings.schoolName || DEFAULT_SETTINGS.schoolName} | School Portal`;
    const logoSrc = currentLogoDataUrl || 'schoollogo.jpeg';
    $$('.school-logo, .sidebar-logo').forEach(image => { image.src = logoSrc; });
    const brandHeading = $('.login-brand-panel h1');
    if (brandHeading) brandHeading.textContent = settings.schoolName || DEFAULT_SETTINGS.schoolName;
    const location = $('.school-location');
    if (location) location.textContent = settings.address || '';
    const session = $('#academic-session-label');
    if (session) session.textContent = settings.session || DEFAULT_SETTINGS.session;
    const sessionFooter = $('.app-footer span:last-child');
    if (sessionFooter) sessionFooter.textContent = `Academic Session ${settings.session || DEFAULT_SETTINGS.session}`;
    const label = $('#data-source-label');
    const description = $('#data-source-description');
    if (database.students.length && label && description) {
      label.textContent = 'Student data loaded in this browser (prototype)';
      description.textContent = `${database.students.length} student record(s) are saved in this browser only. This is not a secure shared school database.`;
    }
    const nameInput = $('#settings-school-name');
    const addressInput = $('#settings-address');
    const sessionInput = $('#settings-session');
    const primaryInput = $('#settings-primary-colour');
    const accentInput = $('#settings-accent-colour');
    if (nameInput) nameInput.value = settings.schoolName || '';
    if (addressInput) addressInput.value = settings.address || '';
    if (sessionInput) sessionInput.value = settings.session || '';
    if (primaryInput) primaryInput.value = settings.primaryColour || DEFAULT_SETTINGS.primaryColour;
    if (accentInput) accentInput.value = settings.accentColour || DEFAULT_SETTINGS.accentColour;
  }

  function isColour(value) {
    return /^#[0-9a-f]{6}$/i.test(String(value || ''));
  }

  function darkenHex(hex, amount) {
    const clean = String(hex || '#173d83').replace('#', '');
    if (!/^[0-9a-f]{6}$/i.test(clean)) return '#102d65';
    const values = [0, 2, 4].map(offset => Math.max(0, Math.round(parseInt(clean.slice(offset, offset + 2), 16) * (1 - amount))));
    return `#${values.map(number => number.toString(16).padStart(2, '0')).join('')}`;
  }

  function hasAdmin() {
    return currentUser?.role === 'admin';
  }

  function studentById(id) {
    return database.students.find(student => student.id === id) || null;
  }

  function studentsInClass(className) {
    return database.students
      .filter(student => student.className === className)
      .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
  }

  function canSeeClass(className) {
    return hasAdmin() || !currentUser || !currentUser.className || currentUser.className === className;
  }

  function allowedContent(items) {
    if (hasAdmin()) return items;
    if (!currentUser?.className) return items.filter(item => !item.audience || item.audience === 'all' || item.className === 'all');
    return items.filter(item => {
      const target = item.audience || item.className || 'all';
      return target === 'all' || target === currentUser.className;
    });
  }

  function showLogin() {
    currentUser = null;
    currentPage = 'dashboard';
    $('#login-screen')?.classList.remove('is-hidden');
    $('#app-shell')?.classList.add('is-hidden');
    $('#student-mode-button')?.classList.add('is-active');
    $('#student-mode-button')?.setAttribute('aria-pressed', 'true');
    $('#admin-mode-button')?.classList.remove('is-active');
    $('#admin-mode-button')?.setAttribute('aria-pressed', 'false');
    $('#student-login-form')?.classList.remove('is-hidden');
    $('#admin-login-form')?.classList.add('is-hidden');
    renderStudentNameOptions();
    setMessage('student-login-message', '');
    setMessage('admin-login-message', '');
  }

  function startSession(user) {
    currentUser = user;
    $('#login-screen')?.classList.add('is-hidden');
    $('#app-shell')?.classList.remove('is-hidden');
    const displayName = user.role === 'admin' ? (user.name || 'School administrator') : (user.name || 'Student');
    $('#portal-user-name').textContent = displayName;
    $('#portal-user-role').textContent = user.role === 'admin' ? 'Teacher / Admin' : `Student portal · ${user.className || ''}`;
    $('#topbar-role-label').textContent = user.role === 'admin' ? 'Administration preview' : 'Student portal';
    $('#user-avatar').textContent = (displayName.match(/[A-Za-z0-9]/g) || ['S', 'P']).slice(0, 2).join('').toUpperCase();
    $('#dashboard-greeting').textContent = user.role === 'admin' ? 'Welcome to the admin portal' : `Welcome, ${displayName}`;
    $('#dashboard-subtitle').textContent = user.role === 'admin'
      ? 'Manage school content and review records in this local prototype.'
      : `Your school information for ${user.className || 'your class'}, all in one place.`;
    $('#admin-navigation-group')?.classList.toggle('is-hidden', user.role !== 'admin');
    $('#admin-dashboard-summary')?.classList.toggle('is-hidden', user.role !== 'admin');
    $('#student-dashboard-summary')?.classList.toggle('is-hidden', user.role === 'admin');
    $('#admin-shortcuts-card')?.classList.toggle('is-hidden', user.role !== 'admin');
    $$('.admin-only').forEach(node => node.classList.toggle('is-hidden', user.role !== 'admin'));
    $$('.admin-page').forEach(node => node.classList.toggle('is-hidden', user.role !== 'admin'));
    setPage('dashboard');
    renderAll();
    if (user.role === 'admin') {
      notify('Local prototype mode: this sign-in is not verified by a server. Do not publish real student records yet.', 'error');
    }
  }

  function switchLoginMode(mode) {
    const studentMode = mode === 'student';
    $('#student-mode-button')?.classList.toggle('is-active', studentMode);
    $('#student-mode-button')?.setAttribute('aria-pressed', String(studentMode));
    $('#admin-mode-button')?.classList.toggle('is-active', !studentMode);
    $('#admin-mode-button')?.setAttribute('aria-pressed', String(!studentMode));
    $('#student-login-form')?.classList.toggle('is-hidden', !studentMode);
    $('#admin-login-form')?.classList.toggle('is-hidden', studentMode);
    setMessage('student-login-message', '');
    setMessage('admin-login-message', '');
  }

  function renderStudentNameOptions() {
    const classSelect = $('#student-class');
    const nameSelect = $('#student-name');
    if (!classSelect || !nameSelect) return;
    const selectedClass = classSelect.value;
    const previous = nameSelect.value;
    const names = studentsInClass(selectedClass);
    nameSelect.innerHTML = '<option value="">Select a student</option>' + names.map(student =>
      `<option value="${escapeHTML(student.id)}">${escapeHTML(student.name)}${student.admissionNo ? ` · ${escapeHTML(student.admissionNo)}` : ''}</option>`
    ).join('');
    nameSelect.disabled = !selectedClass || names.length === 0;
    if (names.some(student => student.id === previous)) nameSelect.value = previous;
    if (!selectedClass) nameSelect.innerHTML = '<option value="">Select a class first</option>';
    else if (names.length === 0) nameSelect.innerHTML = '<option value="">No imported students in this class</option>';
  }

  async function handleStudentLogin(event) {
    event.preventDefault();
    const className = $('#student-class').value;
    const studentId = $('#student-name').value;
    const student = studentById(studentId);
    if (!database.students.length) {
      setMessage('student-login-message', 'The student directory has not been imported yet. Ask the school administrator to load the workbook.', 'error');
      return;
    }
    if (!student || student.className !== className) {
      setMessage('student-login-message', 'Please select a valid class and student.', 'error');
      return;
    }
    startSession({ role: 'student', studentId: student.id, name: student.name, className: student.className });
  }

  async function handleAdminLogin(event) {
    event.preventDefault();
    const adminId = plainText($('#admin-id').value, 80);
    const password = $('#admin-password').value;
    if (!adminId || !password) {
      setMessage('admin-login-message', 'Enter your staff ID and password.', 'error');
      return;
    }

    // No server API has been supplied yet. Do not falsely claim this is secure authentication.
    // A deployed version must replace this branch with a server-side auth request.
    if (window.SPPS_CONFIG?.authEndpoint) {
      try {
        const response = await fetch(window.SPPS_CONFIG.authEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ username: adminId, password })
        });
        if (!response.ok) throw new Error('Sign-in was rejected by the server.');
        const payload = await response.json();
        if (!payload?.user || !['admin', 'teacher'].includes(payload.user.role)) throw new Error('The server did not return a staff session.');
        startSession({ role: 'admin', name: payload.user.name || adminId, token: payload.token || null });
        return;
      } catch (error) {
        setMessage('admin-login-message', error.message || 'Unable to sign in. Check the connection.', 'error');
        return;
      }
    }

    // Local preview only: any non-empty credentials open the prototype and are not validated.
    // The user-supplied password is intentionally not copied into the public JavaScript.
    startSession({ role: 'admin', name: adminId });
  }

  function setPage(page) {
    const section = $(`[data-page-section="${CSS.escape(page)}"]`);
    if (!section) return;
    if (section.classList.contains('admin-page') && !hasAdmin()) {
      notify('This section is available only to staff in the prototype.', 'error');
      return;
    }
    currentPage = page;
    $$('[data-page-section]').forEach(node => node.classList.toggle('is-active', node.dataset.pageSection === page));
    $$('.nav-item[data-page]').forEach(node => node.classList.toggle('is-active', node.dataset.page === page));
    const activeNav = $(`.nav-item[data-page="${CSS.escape(page)}"]`);
    $('#current-page-label').textContent = activeNav ? activeNav.textContent.trim().replace(/\s+/g, ' ') : pageLabel(page);
    closeSidebar();
    $('#main-content')?.focus({ preventScroll: true });
    if (page === 'manage-attendance') renderAttendanceRegister();
    if (page === 'manage-fees') renderFeesRegister();
    if (page === 'students') renderStudentDirectory();
    if (page === 'timetable') renderTimetable();
  }

  function pageLabel(page) {
    const words = String(page).split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1));
    return words.join(' ');
  }

  function openSidebar() {
    $('#sidebar')?.classList.add('is-open');
    $('#sidebar-backdrop')?.classList.remove('is-hidden');
  }

  function closeSidebar() {
    $('#sidebar')?.classList.remove('is-open');
    $('#sidebar-backdrop')?.classList.add('is-hidden');
  }

  function renderAll() {
    ensureContentArrays();
    applySettings();
    renderStudentNameOptions();
    renderDashboard();
    renderAnnouncements();
    renderHomework();
    renderTimetable();
    renderMaterials();
    renderExams();
    renderResults();
    renderStudentAttendance();
    renderStudentFees();
    renderCalendar();
    renderGallery();
    if (hasAdmin()) {
      renderStudentDirectory();
      renderAttendanceRegister();
      renderFeesRegister();
    }
  }

  function renderDashboard() {
    const now = new Date();
    $('#current-date-label').textContent = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(now);
    if (hasAdmin()) {
      $('#stat-total-students').textContent = String(database.students.length);
      const today = inputDateToday();
      const todaysAttendance = Object.values(database.attendance[today] || {});
      $('#stat-present-today').textContent = String(todaysAttendance.filter(status => status === 'Present').length);
      $('#stat-fee-balance').textContent = money(database.students.reduce((total, student) => total + Math.max(0, Number(student.feeBalance) || 0), 0));
      $('#stat-active-notices').textContent = String(database.content.announcements.length);
    } else {
      const student = studentById(currentUser?.studentId);
      $('#student-stat-class').textContent = student?.className || '—';
      $('#student-stat-attendance').textContent = student ? attendanceRate(student.id) : '—';
      $('#student-stat-fees').textContent = student ? (Number(student.feeBalance || 0) > 0 ? `${money(student.feeBalance)} due` : 'Up to date') : '—';
      const exams = allowedContent(database.content.exams).filter(item => !item.className || item.className === 'all' || item.className === student?.className);
      $('#student-stat-exams').textContent = String(exams.length);
    }
    const announcementCount = allowedContent(database.content.announcements).length;
    const countNode = $('#announcement-nav-count');
    if (countNode) {
      countNode.textContent = String(announcementCount);
      countNode.classList.toggle('is-hidden', announcementCount === 0);
    }
    const dot = $('#notification-dot');
    dot?.classList.toggle('is-hidden', announcementCount === 0);
    renderDashboardAnnouncementPreview();
    renderUpcomingPreview();
  }

  function adminActions(type, id) {
    if (!hasAdmin()) return '';
    return `<div class="portal-item-actions"><button type="button" class="secondary-button" data-edit-type="${escapeHTML(type)}" data-edit-id="${escapeHTML(id)}">Edit</button><button type="button" class="text-button danger-text" data-delete-type="${escapeHTML(type)}" data-delete-id="${escapeHTML(id)}">Delete</button></div>`;
  }

  function emptyState(title, detail) {
    return `<div class="empty-state"><strong>${escapeHTML(title)}</strong><p>${escapeHTML(detail)}</p></div>`;
  }

  function contentCard(item, type, meta, description, extra = '') {
    const id = escapeHTML(item.id || '');
    return `<article class="content-card portal-content-card">
      <div class="portal-content-main"><div class="portal-content-meta">${meta}</div><h3>${escapeHTML(item.title || 'Untitled')}</h3><p>${escapeHTML(description || '')}</p>${extra}</div>
      ${adminActions(type, item.id)}
    </article>`;
  }

  function renderList(containerId, items, type, emptyTitle, emptyDetail, mapper) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const filtered = allowedContent(items);
    container.classList.remove('empty-state');
    container.innerHTML = filtered.length ? filtered.map(item => mapper(item, type)).join('') : emptyState(emptyTitle, emptyDetail);
  }

  function renderDashboardAnnouncementPreview() {
    const container = $('#dashboard-announcements');
    if (!container) return;
    const items = allowedContent(database.content.announcements).slice().sort(byNewest).slice(0, 3);
    container.classList.remove('empty-state');
    container.innerHTML = items.length ? items.map(item => contentCard(item, 'announcement', `${escapeHTML(formatDate(item.date))}${item.audience && item.audience !== 'all' ? ` · ${escapeHTML(item.audience)}` : ''}`, item.body, '')).join('') : emptyState('No announcements yet', 'Published school announcements will appear here.');
  }

  function renderUpcomingPreview() {
    const container = $('#dashboard-upcoming-dates');
    if (!container) return;
    const today = inputDateToday();
    const events = [
      ...allowedContent(database.content.calendar).map(item => ({ ...item, kind: item.kind || 'School event' })),
      ...allowedContent(database.content.exams).map(item => ({ ...item, kind: 'Exam' }))
    ].filter(item => !item.date || item.date >= today).sort((a, b) => String(a.date || '').localeCompare(String(b.date || ''))).slice(0, 4);
    container.classList.toggle('empty-state', events.length === 0);
    container.innerHTML = events.length ? events.map(item => `<article class="upcoming-event"><span class="upcoming-event-date">${escapeHTML(formatDate(item.date))}</span><div><strong>${escapeHTML(item.title)}</strong><span>${escapeHTML(item.kind)}${item.className && item.className !== 'all' ? ` · ${escapeHTML(item.className)}` : ''}</span></div>${adminActions(item.kind === 'Exam' ? 'exam' : 'calendar', item.id)}</article>`).join('') : emptyState('No upcoming dates published', 'New dates will be shown here when the school adds them.');
  }

  function renderAnnouncements() {
    const items = database.content.announcements.slice().sort(byNewest);
    renderList('announcements-list', items, 'announcement', 'No announcements published', 'New announcements from the school will appear here.', item => contentCard(item, 'announcement', `${formatDate(item.date)}${item.audience && item.audience !== 'all' ? ` · ${item.audience}` : ''}${item.priority ? ` · ${item.priority}` : ''}`, item.body));
  }

  function renderHomework() {
    const classFilter = $('#homework-class-filter')?.value || 'all';
    const subjectFilter = $('#homework-subject-filter')?.value || 'all';
    let items = allowedContent(database.content.homework);
    if (!hasAdmin() && currentUser?.className) items = items.filter(item => item.className === 'all' || item.className === currentUser.className);
    else if (classFilter !== 'all') items = items.filter(item => item.className === classFilter || item.className === 'all');
    if (subjectFilter !== 'all') items = items.filter(item => item.subject === subjectFilter);
    items = items.slice().sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')));
    const container = $('#homework-list');
    if (!container) return;
    container.classList.remove('empty-state');
    container.innerHTML = items.length ? items.map(item => contentCard(item, 'homework', `${escapeHTML(item.className || 'All classes')} · ${escapeHTML(item.subject || 'General')} · Due ${escapeHTML(formatDate(item.dueDate))}`, item.description)) .join('') : emptyState('No homework posted', 'Homework and classwork added by staff will appear here.');
  }

  function renderTimetable() {
    const container = $('#timetable-content');
    if (!container) return;
    const className = hasAdmin() ? ($('#timetable-class-filter')?.value || currentUser?.className) : currentUser?.className;
    const day = $('#timetable-day-filter')?.value || WEEKDAYS[new Date().getDay() === 0 ? 5 : new Date().getDay() - 1];
    let entries = database.content.timetable.filter(item => (!className || item.className === className) && item.day === day);
    if (!hasAdmin() && currentUser?.className) entries = entries.filter(item => item.className === currentUser.className);
    entries.sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
    container.innerHTML = entries.length ? `<table><thead><tr><th>Time / Period</th><th>Subject</th><th>Teacher</th>${hasAdmin() ? '<th>Actions</th>' : ''}</tr></thead><tbody>${entries.map(item => `<tr><td>${escapeHTML(item.time || '—')}</td><td><strong>${escapeHTML(item.subject || '—')}</strong></td><td>${escapeHTML(item.teacher || '—')}</td>${hasAdmin() ? `<td>${adminActions('timetable', item.id)}</td>` : ''}</tr>`).join('')}</tbody></table>` : emptyState('Timetable not published', 'The administrator can add periods, subjects and timings for each class and day.');
  }

  function renderMaterials() {
    const classFilter = $('#material-class-filter')?.value || 'all';
    const typeFilter = $('#material-type-filter')?.value || 'all';
    let items = allowedContent(database.content.materials);
    if (!hasAdmin() && currentUser?.className) items = items.filter(item => item.className === 'all' || item.className === currentUser.className);
    else if (classFilter !== 'all') items = items.filter(item => item.className === classFilter || item.className === 'all');
    if (typeFilter !== 'all') items = items.filter(item => item.materialType === typeFilter);
    const container = $('#materials-list');
    if (!container) return;
    container.classList.remove('empty-state');
    container.innerHTML = items.length ? items.map(item => {
      const link = safeHttpUrl(item.url);
      const linkHtml = link ? `<p><a href="${escapeHTML(link)}" target="_blank" rel="noopener noreferrer">Open resource ↗</a></p>` : '';
      return `<article class="content-card resource-card"><span class="resource-card-type">${escapeHTML(item.materialType || 'Resource')}</span><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.className || 'All classes')}</p>${escapeHTML(item.description || '')}${linkHtml}${adminActions('material', item.id)}</article>`;
    }).join('') : emptyState('No study material uploaded', 'Resources uploaded by teachers will be listed here.');
  }

  function renderExams() {
    const items = database.content.exams.slice().sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
    renderList('exams-list', items, 'exam', 'No exam schedule published', 'Check here for exam dates and class-wise syllabus.', item => contentCard(item, 'exam', `${formatDate(item.date)} · ${item.className || 'All classes'}`, item.details || item.description || 'Exam / syllabus details.'));
  }

  function renderResults() {
    const container = $('#results-content');
    if (!container) return;
    let items = database.content.results;
    if (!hasAdmin() && currentUser?.studentId) items = items.filter(item => item.studentId === currentUser.studentId || item.studentName === currentUser.name);
    if (!items.length) {
      container.innerHTML = emptyState('No report card published', 'Report cards will appear here after the school publishes results.');
      return;
    }
    container.innerHTML = `<div class="table-responsive"><table><thead><tr><th>Student</th><th>Class</th><th>Term</th><th>Subject</th><th>Marks</th><th>Percentage</th>${hasAdmin() ? '<th>Actions</th>' : ''}</tr></thead><tbody>${items.map(item => {
      const total = Math.max(1, Number(item.outOf) || 100);
      const marks = Number(item.marks) || 0;
      return `<tr><td>${escapeHTML(item.studentName || studentById(item.studentId)?.name || 'Student')}</td><td>${escapeHTML(item.className || '')}</td><td>${escapeHTML(item.term || '')}</td><td>${escapeHTML(item.subject || '')}</td><td>${escapeHTML(marks)} / ${escapeHTML(total)}</td><td>${((marks / total) * 100).toFixed(1)}%</td>${hasAdmin() ? `<td>${adminActions('result', item.id)}</td>` : ''}</tr>`;
    }).join('')}</tbody></table></div>`;
  }

  function renderStudentAttendance() {
    const student = studentById(currentUser?.studentId);
    const table = $('#student-attendance-table');
    if (!table) return;
    if (!student) {
      table.innerHTML = emptyState('Attendance record unavailable', 'Attendance appears here after the school has recorded it.');
      $('#attendance-present-count').textContent = '—';
      $('#attendance-absent-count').textContent = '—';
      $('#attendance-rate').textContent = '—';
      return;
    }
    const records = attendanceRecordsForStudent(student.id);
    const present = records.filter(record => record.status === 'Present').length;
    const absent = records.filter(record => record.status === 'Absent').length;
    const leave = records.filter(record => record.status === 'Leave').length;
    const denominator = present + absent + leave;
    $('#attendance-present-count').textContent = String(present);
    $('#attendance-absent-count').textContent = String(absent);
    $('#attendance-rate').textContent = denominator ? `${Math.round((present / denominator) * 100)}%` : '—';
    table.innerHTML = records.length ? `<table><thead><tr><th>Date</th><th>Status</th></tr></thead><tbody>${records.map(record => `<tr><td>${escapeHTML(formatDate(record.date))}</td><td><span class="status-pill status-${slug(record.status)}">${escapeHTML(record.status)}</span></td></tr>`).join('')}</tbody></table>` : emptyState('No attendance recorded yet', 'Your attendance history will appear here after staff saves the register.');
  }

  function attendanceRecordsForStudent(studentId) {
    return Object.entries(database.attendance).flatMap(([date, entries]) => entries && entries[studentId] ? [{ date, status: entries[studentId] }] : []).sort((a, b) => b.date.localeCompare(a.date));
  }

  function attendanceRate(studentId) {
    const records = attendanceRecordsForStudent(studentId);
    const valid = records.filter(record => ['Present', 'Absent', 'Leave'].includes(record.status));
    if (!valid.length) return 'Not recorded';
    const present = valid.filter(record => record.status === 'Present').length;
    return `${Math.round((present / valid.length) * 100)}%`;
  }

  function renderStudentFees() {
    const student = studentById(currentUser?.studentId);
    const breakdown = $('#student-fee-breakdown');
    if (!breakdown) return;
    if (!student) {
      ['student-fee-total', 'student-fee-paid', 'student-fee-balance'].forEach(id => { const node = document.getElementById(id); if (node) node.textContent = '—'; });
      breakdown.innerHTML = emptyState('Fee details not available', 'Fee records will be visible after a student session is selected.');
      return;
    }
    $('#student-fee-total').textContent = money(student.feeTotal || 0);
    $('#student-fee-paid').textContent = money(student.feePaid || 0);
    $('#student-fee-balance').textContent = money(student.feeBalance || 0);
    const payments = database.payments.filter(payment => payment.studentId === student.id).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    const paymentRows = payments.length ? `<h3>Payments recorded in this browser</h3><table><thead><tr><th>Date</th><th>Amount</th><th>Mode</th><th>Receipt / Note</th></tr></thead><tbody>${payments.map(payment => `<tr><td>${escapeHTML(formatDate(payment.date))}</td><td>${money(payment.amount)}</td><td>${escapeHTML(payment.mode || '—')}</td><td>${escapeHTML(payment.note || '—')}</td></tr>`).join('')}</tbody></table>` : '<p class="muted-text">No new payment entries have been recorded in this browser.</p>';
    breakdown.innerHTML = `<div class="fee-student-heading"><strong>${escapeHTML(student.name)}</strong><span>${escapeHTML(student.className)}${student.admissionNo ? ` · Admission ${escapeHTML(student.admissionNo)}` : ''}</span></div><div class="fee-summary-lines"><div><span>Fee total from workbook</span><strong>${money(student.feeTotal || 0)}</strong></div><div><span>Amount received from workbook and records</span><strong>${money(student.feePaid || 0)}</strong></div><div><span>Balance</span><strong>${money(student.feeBalance || 0)}</strong></div></div>${paymentRows}`;
  }

  function renderCalendar() {
    const items = database.content.calendar.slice().sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
    renderList('calendar-list', items, 'calendar', 'School calendar not published', 'Upcoming holidays and celebrations will appear here.', item => contentCard(item, 'calendar', `${formatDate(item.date)} · ${item.kind || 'School event'}`, item.description || ''));
  }

  function renderGallery() {
    const container = $('#gallery-list');
    if (!container) return;
    const items = allowedContent(database.content.gallery).slice().sort(byNewest);
    container.classList.remove('empty-state');
    container.innerHTML = items.length ? items.map(item => {
      const src = safeHttpUrl(item.imageUrl);
      const image = src ? `<img src="${escapeHTML(src)}" alt="${escapeHTML(item.title || 'School event photo')}" loading="lazy" referrerpolicy="no-referrer">` : '';
      return `<article class="content-card gallery-card">${image}<div class="gallery-card-copy"><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.caption || '')}</p><span>${escapeHTML(formatDate(item.date))}</span>${adminActions('gallery', item.id)}</div></article>`;
    }).join('') : emptyState('No photos published', 'School event photos will appear here when approved by the administration.');
  }

  function renderStudentDirectory() {
    const container = $('#student-directory-table');
    if (!container) return;
    const query = normalise($('#student-search')?.value || '');
    const classFilter = $('#directory-class-filter')?.value || 'all';
    const students = database.students.filter(student => {
      const haystack = normalise(`${student.name} ${student.admissionNo} ${student.className}`);
      return (!query || haystack.includes(query)) && (classFilter === 'all' || student.className === classFilter);
    }).sort((a, b) => a.className.localeCompare(b.className) || a.name.localeCompare(b.name));
    container.innerHTML = students.length ? `<table><thead><tr><th>Student</th><th>Class</th><th>Admission no.</th><th>Fee balance</th><th>Actions</th></tr></thead><tbody>${students.map(student => `<tr><td><strong>${escapeHTML(student.name)}</strong>${student.fatherName ? `<div class="muted-text">Parent: ${escapeHTML(student.fatherName)}</div>` : ''}</td><td>${escapeHTML(student.className)}</td><td>${escapeHTML(student.admissionNo || '—')}</td><td>${money(student.feeBalance || 0)}</td><td><div class="portal-item-actions"><button type="button" class="secondary-button" data-edit-type="student" data-edit-id="${escapeHTML(student.id)}">Edit</button><button type="button" class="text-button danger-text" data-delete-type="student" data-delete-id="${escapeHTML(student.id)}">Delete</button></div></td></tr>`).join('')}</tbody></table>` : emptyState('No students match this filter', database.students.length ? 'Try a different name or class filter.' : 'Import the school workbook or add a student to begin.');
  }

  function renderAttendanceRegister() {
    const container = $('#attendance-register');
    if (!container) return;
    if (!hasAdmin()) return;
    const className = $('#attendance-class-select')?.value || SCHOOL_CLASSES[0];
    const date = $('#attendance-date')?.value || inputDateToday();
    const students = studentsInClass(className);
    if (!students.length) {
      container.innerHTML = emptyState('No students in this class', 'Import the workbook or add student records before taking attendance.');
      return;
    }
    const record = database.attendance[date] || {};
    container.innerHTML = `<div class="attendance-toolbar"><span>${students.length} student(s) · ${escapeHTML(className)} · ${escapeHTML(formatDate(date))}</span><div><button type="button" class="secondary-button" id="mark-all-present-button">Mark all present</button><button type="button" class="secondary-button" id="clear-attendance-button">Clear statuses</button></div></div><table><thead><tr><th>#</th><th>Student</th><th>Admission no.</th><th>Attendance status</th></tr></thead><tbody>${students.map((student, index) => `<tr><td>${index + 1}</td><td><strong>${escapeHTML(student.name)}</strong></td><td>${escapeHTML(student.admissionNo || '—')}</td><td><select class="attendance-status-select" data-student-id="${escapeHTML(student.id)}" aria-label="Attendance status for ${escapeHTML(student.name)}"><option value="">Not marked</option><option value="Present" ${record[student.id] === 'Present' ? 'selected' : ''}>Present</option><option value="Absent" ${record[student.id] === 'Absent' ? 'selected' : ''}>Absent</option><option value="Leave" ${record[student.id] === 'Leave' ? 'selected' : ''}>Leave</option></select></td></tr>`).join('')}</tbody></table>`;
  }

  function renderFeesRegister() {
    const container = $('#fees-register');
    if (!container) return;
    if (!hasAdmin()) return;
    const query = normalise($('#fees-search')?.value || '');
    const classFilter = $('#fees-class-filter')?.value || 'all';
    const students = database.students.filter(student => {
      const haystack = normalise(`${student.name} ${student.admissionNo} ${student.className}`);
      return (!query || haystack.includes(query)) && (classFilter === 'all' || student.className === classFilter);
    }).sort((a, b) => a.className.localeCompare(b.className) || a.name.localeCompare(b.name));
    const totalBalance = students.reduce((sum, student) => sum + Math.max(0, Number(student.feeBalance) || 0), 0);
    const totalPaid = students.reduce((sum, student) => sum + Math.max(0, Number(student.feePaid) || 0), 0);
    container.innerHTML = students.length ? `<div class="table-summary-strip"><span>${students.length} student(s)</span><span>Received: <strong>${money(totalPaid)}</strong></span><span>Outstanding: <strong>${money(totalBalance)}</strong></span></div><table><thead><tr><th>Student</th><th>Class</th><th>Fee total</th><th>Received</th><th>Balance</th><th>Actions</th></tr></thead><tbody>${students.map(student => `<tr><td><strong>${escapeHTML(student.name)}</strong><div class="muted-text">Admission ${escapeHTML(student.admissionNo || '—')}</div></td><td>${escapeHTML(student.className)}</td><td>${money(student.feeTotal || 0)}</td><td>${money(student.feePaid || 0)}</td><td><strong>${money(student.feeBalance || 0)}</strong></td><td><div class="portal-item-actions"><button type="button" class="secondary-button" data-open-payment-for="${escapeHTML(student.id)}">Record payment</button><button type="button" class="text-button" data-edit-type="student" data-edit-id="${escapeHTML(student.id)}">Edit</button></div></td></tr>`).join('')}</tbody></table>` : emptyState('Fee records are not loaded', 'Import the fee workbook or add student records before managing balances.');
  }

  function byNewest(a, b) {
    return String(b.date || b.createdAt || '').localeCompare(String(a.date || a.createdAt || ''));
  }

  function normaliseClass(value, sheetName = '') {
    const raw = normalise(value);
    const sheet = normalise(sheetName);
    const map = {
      'play': 'Play Group', 'play group': 'Play Group', 'playgroup': 'Play Group', 'pg': 'Play Group',
      'nur': 'Nursery', 'nursery': 'Nursery', 'nursary': 'Nursery',
      'lkg': 'LKG', 'ukg': 'UKG',
      '1': 'Class 1', '1st': 'Class 1', 'first': 'Class 1', 'class 1': 'Class 1',
      '2': 'Class 2', '2nd': 'Class 2', 'second': 'Class 2', 'class 2': 'Class 2',
      '3': 'Class 3', '3rd': 'Class 3', 'third': 'Class 3', 'class 3': 'Class 3',
      '4': 'Class 4', '4th': 'Class 4', 'fourth': 'Class 4', 'class 4': 'Class 4',
      '5': 'Class 5', '5th': 'Class 5', 'fifth': 'Class 5', 'class 5': 'Class 5'
    };
    if (map[raw]) return map[raw];
    if (map[sheet]) return map[sheet];
    if (sheet.includes('play')) return 'Play Group';
    if (sheet === 'nur') return 'Nursery';
    if (sheet === '1st') return 'Class 1';
    if (sheet === '2nd') return 'Class 2';
    if (sheet.includes('3 to5')) return '';
    return '';
  }

  function headerIndex(headers, predicate, preference = 'first') {
    const matches = headers.map((value, index) => ({ value: normalise(value), raw: String(value ?? '').trim(), index }))
      .filter(item => item.raw && predicate(item.value, item.raw));
    if (!matches.length) return -1;
    return preference === 'last' ? matches[matches.length - 1].index : matches[0].index;
  }

  function findHeaderRow(rows) {
    const limit = Math.min(rows.length, 12);
    for (let index = 0; index < limit; index += 1) {
      const row = rows[index] || [];
      const hasName = row.some(cell => normalise(cell) === 'name' || normalise(cell) === 'student name');
      const hasAdmission = row.some(cell => normalise(cell).includes('admission no') || normalise(cell).includes('admission number'));
      if (hasName && hasAdmission) return index;
    }
    return -1;
  }

  function cellAt(row, index) {
    return index >= 0 ? row[index] : null;
  }

  function numericCell(row, index) {
    return moneyNumber(cellAt(row, index));
  }

  function makeWorkbookStudent(row, headers, sheetName, rowNumber) {
    const nameIndex = headerIndex(headers, value => value === 'name' || value === 'student name');
    const admissionIndex = headerIndex(headers, value => value.includes('admission no') || value.includes('admission number'));
    const fatherIndex = headerIndex(headers, value => value.includes('father') && value.includes('name'));
    const classIndex = headerIndex(headers, value => value === 'class' || value === 'class name', 'last');
    const oldFeeIndex = headerIndex(headers, value => value === 'old fee');
    const newFeeIndices = headers.map((value, index) => ({ value: normalise(value), index })).filter(item => item.value === 'new fee').map(item => item.index);
    const monthlyFeeIndex = newFeeIndices.find(index => moneyNumber(row[index]) !== null) ?? newFeeIndices[0] ?? -1;
    const totalExactIndex = headerIndex(headers, value => value === 'total', 'last');
    const totalBalanceIndices = headers.map((value, index) => ({ value: normalise(value), index }))
      .filter(item => item.value === 'total balance' || item.value === 'total bal' || item.value === 'total balance fee')
      .map(item => item.index);
    const totalBalanceIndex = totalBalanceIndices.length ? totalBalanceIndices[totalBalanceIndices.length - 1] : -1;
    const oldPaymentIndex = headerIndex(headers, value => value.includes('old payment received') || value.includes('old payment recieved'));
    const receivedCandidates = headers.map((value, index) => ({ value: normalise(value), index }))
      .filter(item => (item.value.includes('payment received') || item.value.includes('payment recieved') || item.value.includes('payments receive') || item.value.includes('payment receive') || item.value.includes('cash received') || item.value.includes('cash recieved'))
        && !['old', 'winter', 'dress', 'notebook', 'stationery', 'book', 'summer', 'sumer'].some(exclusion => item.value.includes(exclusion)));
    let paidIndex = -1;
    const exactCash = receivedCandidates.find(item => item.value.includes('total cash'));
    const exactPayment = receivedCandidates.find(item => item.value === 'payment received' || item.value === 'payment recieved' || item.value === 'payments receive' || item.value === 'payment receive');
    if (exactCash) paidIndex = exactCash.index;
    else if (exactPayment) paidIndex = exactPayment.index;
    else if (receivedCandidates.length) paidIndex = receivedCandidates[receivedCandidates.length - 1].index;

    let name = plainText(cellAt(row, nameIndex), 150);
    if (!name) return null;
    const admissionNo = plainText(cellAt(row, admissionIndex), 60);
    const fatherName = plainText(cellAt(row, fatherIndex), 150);
    let className = normaliseClass(cellAt(row, classIndex), sheetName);
    if (!className) className = normaliseClass('', sheetName);
    if (!className && normalise(sheetName).includes('3 to5')) return null;
    if (!className) return null;

    const oldFee = numericCell(row, oldFeeIndex);
    const monthlyFee = numericCell(row, monthlyFeeIndex);
    // Some tabs contain both old/new fee columns; remove an accidental fee suffix from names only when it matches a fee value.
    const suffix = name.match(/\s+(\d{3,4})$/);
    if (suffix && [oldFee, monthlyFee].some(fee => fee !== null && Math.round(fee) === Number(suffix[1]))) name = name.slice(0, suffix.index).trim();

    let feePaid = numericCell(row, paidIndex);
    if (feePaid === null) feePaid = 0;
    let feeBalance = numericCell(row, totalBalanceIndex);
    let feeTotal = numericCell(row, totalExactIndex);
    // In one workbook tab, the first of two "Total Balance" columns is the fee-total column and the last is the outstanding balance.
    if (feeTotal === null && totalBalanceIndices.length > 1) feeTotal = numericCell(row, totalBalanceIndices[0]);
    if (feeBalance === null && feeTotal !== null) feeBalance = Math.max(0, feeTotal - feePaid);
    if (feeTotal === null && feeBalance !== null) feeTotal = feePaid + feeBalance;
    if (feeBalance === null) feeBalance = feeTotal === null ? 0 : Math.max(0, feeTotal - feePaid);
    if (feeTotal === null) feeTotal = feePaid + feeBalance;

    const monthly = {};
    headers.forEach((header, index) => {
      const key = normalise(header);
      if (MONTHS.some(month => normalise(month) === key)) {
        const value = numericCell(row, index);
        if (value !== null) monthly[String(header).trim()] = value;
      }
    });
    const idPart = admissionNo ? `adm-${slug(admissionNo)}` : `row-${rowNumber}-${slug(name)}`;
    const id = `stu-${slug(className)}-${idPart}`;
    return {
      id,
      admissionNo,
      name,
      className,
      fatherName,
      monthlyFee: monthlyFee ?? 0,
      oldFee: oldFee ?? 0,
      feeTotal: Math.max(0, feeTotal || 0),
      feePaid: Math.max(0, feePaid || 0),
      feeBalance: Math.max(0, feeBalance || 0),
      monthly,
      sourceSheet: sheetName
    };
  }

  function parseWorkbook(workbook) {
    const imported = [];
    const warnings = [];
    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) return;
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: null, blankrows: false });
      const headerRowIndex = findHeaderRow(rows);
      if (headerRowIndex < 0) return;
      const headers = rows[headerRowIndex] || [];
      let parsedRows = 0;
      for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
        const row = rows[rowIndex] || [];
        if (!row.some(cell => cell !== null && String(cell).trim() !== '')) continue;
        const student = makeWorkbookStudent(row, headers, sheetName, rowIndex + 1);
        if (student) {
          imported.push(student);
          parsedRows += 1;
        }
      }
      if (parsedRows === 0) warnings.push(`Sheet “${sheetName}” had a header but no student rows were recognized.`);
    });
    // De-duplicate student identifiers while retaining distinct same-name students.
    const seen = new Set();
    const unique = [];
    imported.forEach(student => {
      let id = student.id;
      if (seen.has(id)) id = `${id}-${unique.length + 1}`;
      seen.add(id);
      student.id = id;
      unique.push(student);
    });
    return { students: unique, warnings };
  }

  function loadXLSXLibrary() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (window.__sppsXlsxPromise) return window.__sppsXlsxPromise;
    window.__sppsXlsxPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      script.async = true;
      script.onload = () => window.XLSX ? resolve(window.XLSX) : reject(new Error('Excel reader loaded but is unavailable.'));
      script.onerror = () => reject(new Error('Could not load the Excel reader. Check the internet connection or host the library locally.'));
      document.head.appendChild(script);
    });
    return window.__sppsXlsxPromise;
  }

  async function handleWorkbookImport(event) {
    event.preventDefault();
    if (!hasAdmin()) {
      setMessage('workbook-import-message', 'Sign in as an administrator before importing a workbook.', 'error');
      return;
    }
    const file = $('#student-workbook')?.files?.[0];
    if (!file) {
      setMessage('workbook-import-message', 'Choose the SPPS .xlsx workbook first.', 'error');
      return;
    }
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setMessage('workbook-import-message', 'Please select an .xlsx Excel workbook.', 'error');
      return;
    }
    setMessage('workbook-import-message', 'Reading workbook and mapping student rows…');
    try {
      await loadXLSXLibrary();
      const arrayBuffer = await file.arrayBuffer();
      const workbook = window.XLSX.read(arrayBuffer, { type: 'array', cellDates: false });
      const parsed = parseWorkbook(workbook);
      if (!parsed.students.length) throw new Error('No student rows were recognized. Check that the workbook has class sheets with Name and Admission No. headers.');
      const previous = new Map(database.students.map(student => [student.id, student]));
      database.students = parsed.students.map(student => {
        // Preserve payments manually recorded in this browser when re-importing the same student.
        const old = previous.get(student.id);
        if (!old) return student;
        const manualPayments = database.payments.filter(payment => payment.studentId === student.id).reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
        const baselinePaid = Number(student.feePaid) || 0;
        student.feePaid = baselinePaid + manualPayments;
        student.feeBalance = Math.max(0, (Number(student.feeTotal) || 0) - student.feePaid);
        return student;
      });
      saveDatabase();
      applySettings();
      renderAll();
      renderStudentNameOptions();
      const warningText = parsed.warnings.length ? ` Warnings: ${parsed.warnings.join(' ')}` : '';
      setMessage('workbook-import-message', `Imported ${parsed.students.length} student record(s) from ${workbook.SheetNames.length} workbook sheet(s). Fee totals, payments and balances were mapped where the sheet had recognizable summary columns. This copy is saved in this browser only.${warningText}`, parsed.warnings.length ? 'warning' : 'success');
      notify(`Imported ${parsed.students.length} students. Export a backup and use a secure backend before deployment.`, parsed.warnings.length ? 'error' : 'success');
    } catch (error) {
      console.error('Workbook import error:', error);
      setMessage('workbook-import-message', error.message || 'The workbook could not be imported.', 'error');
    }
  }

  function openEditor(type, existingId = null, prefill = {}) {
    if (!hasAdmin()) {
      notify('Only staff can edit school records.', 'error');
      return;
    }
    const dialog = $('#editor-dialog');
    const fields = $('#editor-form-fields');
    if (!dialog || !fields) return;
    const collectionMap = {
      announcement: 'announcements', homework: 'homework', material: 'materials', exam: 'exams',
      calendar: 'calendar', gallery: 'gallery', timetable: 'timetable', result: 'results', student: 'students', payment: 'payments'
    };
    const collectionName = collectionMap[type];
    let existing = null;
    if (existingId) existing = type === 'student' ? studentById(existingId) : type === 'payment' ? database.payments.find(item => item.id === existingId) : database.content[collectionName]?.find(item => item.id === existingId);
    editorContext = { type, existingId, collectionName, existing };
    $('#editor-dialog-title').textContent = `${existing ? 'Edit' : (type === 'payment' ? 'Record' : 'Add')} ${editorLabel(type)}`;
    fields.innerHTML = buildEditorFields(type, existing || prefill);
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', 'open');
  }

  function editorLabel(type) {
    return ({ announcement: 'announcement', homework: 'homework', material: 'study material', exam: 'exam / syllabus', calendar: 'school calendar date', gallery: 'gallery item', timetable: 'timetable period', result: 'marks / report card', student: 'student', payment: 'payment' })[type] || 'item';
  }

  function editorField(name, label, value = '', type = 'text', options = {}) {
    const id = `editor-${name}`;
    const required = options.required ? 'required' : '';
    const full = options.full ? 'field-full' : 'field-half';
    if (type === 'textarea') return `<label for="${id}">${escapeHTML(label)}</label><textarea id="${id}" name="${escapeHTML(name)}" ${required} rows="3" class="${full}" placeholder="${escapeHTML(options.placeholder || '')}">${escapeHTML(value)}</textarea>`;
    if (type === 'select') {
      const choices = options.choices || [];
      return `<label for="${id}">${escapeHTML(label)}</label><select id="${id}" name="${escapeHTML(name)}" ${required} class="${full}">${choices.map(choice => {
        const item = typeof choice === 'string' ? { value: choice, label: choice } : choice;
        return `<option value="${escapeHTML(item.value)}" ${String(item.value) === String(value) ? 'selected' : ''}>${escapeHTML(item.label)}</option>`;
      }).join('')}</select>`;
    }
    const attrs = type === 'number' ? `min="${options.min ?? 0}" step="${options.step ?? 1}"` : '';
    return `<label for="${id}">${escapeHTML(label)}</label><input id="${id}" name="${escapeHTML(name)}" type="${escapeHTML(type)}" value="${escapeHTML(value)}" ${required} ${attrs} placeholder="${escapeHTML(options.placeholder || '')}" class="${full}">`;
  }

  function selectOptions(items, selected, includeAll = false) {
    const choices = items.map(value => ({ value, label: value }));
    if (includeAll) choices.unshift({ value: 'all', label: 'All classes' });
    return choices;
  }

  function buildEditorFields(type, item) {
    const field = (name, label, value, inputType, options) => editorField(name, label, value ?? '', inputType || 'text', options || {});
    switch (type) {
      case 'announcement':
        return field('title', 'Announcement title', item.title, 'text', { required: true }) +
          field('date', 'Publication date', item.date || inputDateToday(), 'date', { required: true }) +
          field('audience', 'Audience', item.audience || 'all', 'select', { choices: selectOptions(SCHOOL_CLASSES, item.audience || 'all', true), required: true }) +
          field('priority', 'Priority', item.priority || 'Normal', 'select', { choices: ['Normal', 'Important', 'Urgent'].map(x => ({ value: x, label: x })), required: true }) +
          field('body', 'Announcement details', item.body || item.description, 'textarea', { required: true, full: true, placeholder: 'Write the notice clearly for students and parents.' });
      case 'homework':
        return field('title', 'Homework title', item.title, 'text', { required: true }) +
          field('className', 'Class', item.className || 'Play Group', 'select', { choices: selectOptions(SCHOOL_CLASSES, item.className || 'Play Group', true), required: true }) +
          field('subject', 'Subject', item.subject || 'English', 'select', { choices: ['English', 'Hindi', 'Maths', 'EVS', 'Science', 'Social Studies', 'Computer', 'Other'].map(x => ({ value: x, label: x })), required: true }) +
          field('dueDate', 'Due date', item.dueDate || inputDateToday(), 'date', { required: true }) +
          field('description', 'Instructions / classwork', item.description, 'textarea', { required: true, full: true });
      case 'material':
        return field('title', 'Resource title', item.title, 'text', { required: true }) +
          field('className', 'Class', item.className || 'Play Group', 'select', { choices: selectOptions(SCHOOL_CLASSES, item.className || 'Play Group', true), required: true }) +
          field('materialType', 'Resource type', item.materialType || 'Worksheet', 'select', { choices: ['Worksheet', 'Notes', 'Revision', 'Reading', 'Other'].map(x => ({ value: x, label: x })), required: true }) +
          field('url', 'Resource link (https://…)', item.url, 'url', { full: true, placeholder: 'Paste a shareable learning-resource link' }) +
          field('description', 'Description', item.description, 'textarea', { full: true });
      case 'exam':
        return field('title', 'Exam / assessment title', item.title, 'text', { required: true }) +
          field('className', 'Class', item.className || 'Play Group', 'select', { choices: selectOptions(SCHOOL_CLASSES, item.className || 'Play Group', true), required: true }) +
          field('date', 'Exam date', item.date || inputDateToday(), 'date', { required: true }) +
          field('details', 'Syllabus / instructions', item.details || item.description, 'textarea', { required: true, full: true });
      case 'calendar':
        return field('title', 'Event / holiday name', item.title, 'text', { required: true }) +
          field('date', 'Date', item.date || inputDateToday(), 'date', { required: true }) +
          field('kind', 'Category', item.kind || 'Celebration', 'select', { choices: ['Holiday', 'Celebration', 'School event', 'PTM', 'Other'].map(x => ({ value: x, label: x })), required: true }) +
          field('className', 'Class / audience', item.className || 'all', 'select', { choices: selectOptions(SCHOOL_CLASSES, item.className || 'all', true) }) +
          field('description', 'Details', item.description, 'textarea', { full: true });
      case 'gallery':
        return field('title', 'Photo / event title', item.title, 'text', { required: true }) +
          field('date', 'Event date', item.date || inputDateToday(), 'date') +
          field('imageUrl', 'Image link (https://…)', item.imageUrl, 'url', { full: true, placeholder: 'Use an approved image URL; avoid public links to private student photos' }) +
          field('caption', 'Caption', item.caption, 'textarea', { full: true });
      case 'timetable':
        return field('className', 'Class', item.className || 'Play Group', 'select', { choices: selectOptions(SCHOOL_CLASSES, item.className || 'Play Group'), required: true }) +
          field('day', 'Day', item.day || 'Monday', 'select', { choices: WEEKDAYS, required: true }) +
          field('time', 'Period / time', item.time || '09:00–09:40', 'text', { required: true, placeholder: 'e.g. 09:00–09:40' }) +
          field('subject', 'Subject / activity', item.subject, 'text', { required: true }) +
          field('teacher', 'Teacher name', item.teacher, 'text');
      case 'result': {
        const options = database.students.map(student => ({ value: student.id, label: `${student.name} — ${student.className}${student.admissionNo ? ` (${student.admissionNo})` : ''}` }));
        const currentStudent = studentById(item.studentId);
        return field('studentId', 'Student', item.studentId || '', 'select', { choices: [{ value: '', label: 'Choose a student' }, ...options], required: true, full: true }) +
          field('term', 'Term / examination', item.term || 'Term 1', 'text', { required: true }) +
          field('subject', 'Subject', item.subject || 'English', 'text', { required: true }) +
          field('marks', 'Marks obtained', item.marks ?? 0, 'number', { min: 0, step: 0.5, required: true }) +
          field('outOf', 'Maximum marks', item.outOf ?? 100, 'number', { min: 1, step: 0.5, required: true }) +
          '<p class="form-help field-full">Only add marks after checking the official result. The student and class are captured when the record is saved.</p>';
      }
      case 'student':
        return field('name', 'Student name', item.name, 'text', { required: true }) +
          field('className', 'Class', item.className || 'Play Group', 'select', { choices: selectOptions(SCHOOL_CLASSES, item.className || 'Play Group'), required: true }) +
          field('admissionNo', 'Admission number', item.admissionNo, 'text') +
          field('fatherName', 'Parent / guardian name', item.fatherName, 'text') +
          field('monthlyFee', 'Monthly fee (₹)', item.monthlyFee ?? 0, 'number', { min: 0, required: true }) +
          field('feeTotal', 'Total fee due (₹)', item.feeTotal ?? 0, 'number', { min: 0, required: true }) +
          field('feePaid', 'Amount received (₹)', item.feePaid ?? 0, 'number', { min: 0, required: true }) +
          '<p class="form-help field-full">Balance is calculated as total fee due minus amount received. This browser prototype does not sync to a central database.</p>';
      case 'payment': {
        const choices = database.students.map(student => ({ value: student.id, label: `${student.name} — ${student.className}${student.admissionNo ? ` (${student.admissionNo})` : ''}` }));
        return field('studentId', 'Student', item.studentId || '', 'select', { choices: [{ value: '', label: 'Choose a student' }, ...choices], required: true, full: true }) +
          field('amount', 'Payment amount (₹)', item.amount ?? '', 'number', { min: 1, step: 1, required: true }) +
          field('date', 'Payment date', item.date || inputDateToday(), 'date', { required: true }) +
          field('mode', 'Payment mode', item.mode || 'Cash', 'select', { choices: ['Cash', 'UPI', 'Bank transfer', 'Cheque', 'Other'].map(x => ({ value: x, label: x })), required: true }) +
          field('note', 'Receipt / reference note', item.note, 'text', { full: true, placeholder: 'Receipt number or short note (optional)' });
      }
      default:
        return field('title', 'Title', item.title, 'text', { required: true });
    }
  }

  function readEditorValues() {
    const fields = $('#editor-form-fields');
    const data = {};
    $$('[name]', fields).forEach(input => { data[input.name] = plainText(input.value, input.tagName === 'TEXTAREA' ? 5000 : 500); });
    return data;
  }

  function closeEditor() {
    const dialog = $('#editor-dialog');
    if (dialog?.open && typeof dialog.close === 'function') dialog.close();
    else dialog?.removeAttribute('open');
    editorContext = null;
  }

  function saveEditor(event) {
    event.preventDefault();
    if (!hasAdmin() || !editorContext) return;
    const data = readEditorValues();
    const { type, existingId, collectionName, existing } = editorContext;
    if (type !== 'payment' && type !== 'student' && !data.title) {
      notify('Please enter a title.', 'error');
      return;
    }
    if (type === 'material' && data.url && !safeHttpUrl(data.url)) {
      notify('Resource links must start with http:// or https://.', 'error');
      return;
    }
    if (type === 'gallery' && data.imageUrl && !safeHttpUrl(data.imageUrl)) {
      notify('Image links must start with http:// or https://.', 'error');
      return;
    }

    if (type === 'student') {
      const id = existing?.id || uid('stu');
      const feeTotal = Math.max(0, Number(data.feeTotal) || 0);
      const feePaid = Math.max(0, Number(data.feePaid) || 0);
      const student = {
        ...(existing || {}), id,
        name: plainText(data.name, 150), className: data.className,
        admissionNo: plainText(data.admissionNo, 60), fatherName: plainText(data.fatherName, 150),
        monthlyFee: Math.max(0, Number(data.monthlyFee) || 0),
        feeTotal,
        feePaid,
        feeBalance: Math.max(0, feeTotal - feePaid),
        sourceSheet: existing?.sourceSheet || 'Manually added'
      };
      if (existingId) database.students = database.students.map(item => item.id === existingId ? student : item);
      else database.students.push(student);
      if (student.admissionNo && database.students.some(item => item.id !== student.id && item.className === student.className && item.admissionNo === student.admissionNo)) {
        notify('Warning: this class already has another student with the same admission number.', 'error');
      }
    } else if (type === 'payment') {
      const student = studentById(data.studentId);
      const amount = Number(data.amount);
      if (!student) {
        notify('Choose a valid student.', 'error');
        return;
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        notify('Enter a payment amount greater than zero.', 'error');
        return;
      }
      const payment = { id: uid('payment'), studentId: student.id, amount, date: data.date || inputDateToday(), mode: data.mode || 'Cash', note: plainText(data.note, 300), createdAt: new Date().toISOString() };
      database.payments.push(payment);
      student.feePaid = Math.max(0, Number(student.feePaid) || 0) + amount;
      student.feeBalance = Math.max(0, (Number(student.feeTotal) || 0) - student.feePaid);
    } else {
      const item = { ...(existing || {}), ...data, id: existing?.id || uid(type), createdAt: existing?.createdAt || new Date().toISOString() };
      if (type === 'calendar' && !item.audience) item.audience = item.className || 'all';
      if (type === 'result') {
        const student = studentById(data.studentId);
        if (!student) {
          notify('Choose a valid student for the report card.', 'error');
          return;
        }
        item.studentName = student.name;
        item.className = student.className;
        item.marks = Math.max(0, Number(data.marks) || 0);
        item.outOf = Math.max(1, Number(data.outOf) || 100);
        if (item.marks > item.outOf) {
          notify('Marks obtained cannot exceed maximum marks.', 'error');
          return;
        }
      }
      const collection = database.content[collectionName] || [];
      if (existingId) database.content[collectionName] = collection.map(row => row.id === existingId ? item : row);
      else database.content[collectionName] = [item, ...collection];
    }

    saveDatabase();
    closeEditor();
    renderAll();
    notify(`${editorLabel(type).replace(/^./, char => char.toUpperCase())} saved in this browser.`, 'success');
  }

  function editItem(type, id) {
    openEditor(type, id);
  }

  function deleteItem(type, id) {
    if (!hasAdmin()) return;
    const label = editorLabel(type);
    if (!window.confirm(`Delete this ${label}? This cannot be undone in this browser.`)) return;
    if (type === 'student') {
      database.students = database.students.filter(student => student.id !== id);
      Object.keys(database.attendance).forEach(date => { if (database.attendance[date]) delete database.attendance[date][id]; });
      database.payments = database.payments.filter(payment => payment.studentId !== id);
      database.content.results = database.content.results.filter(result => result.studentId !== id);
    } else if (type === 'payment') {
      const payment = database.payments.find(item => item.id === id);
      if (payment) {
        const student = studentById(payment.studentId);
        if (student) {
          student.feePaid = Math.max(0, (Number(student.feePaid) || 0) - Number(payment.amount || 0));
          student.feeBalance = Math.max(0, (Number(student.feeTotal) || 0) - student.feePaid);
        }
      }
      database.payments = database.payments.filter(item => item.id !== id);
    } else {
      const collectionName = ({ announcement: 'announcements', homework: 'homework', material: 'materials', exam: 'exams', calendar: 'calendar', gallery: 'gallery', timetable: 'timetable', result: 'results' })[type];
      if (collectionName) database.content[collectionName] = database.content[collectionName].filter(item => item.id !== id);
    }
    saveDatabase();
    renderAll();
    notify(`${label.charAt(0).toUpperCase() + label.slice(1)} deleted.`, 'success');
  }

  function saveAttendance() {
    if (!hasAdmin()) return;
    const date = $('#attendance-date')?.value || inputDateToday();
    const className = $('#attendance-class-select')?.value || SCHOOL_CLASSES[0];
    const selects = $$('.attendance-status-select');
    if (!selects.length) {
      notify('There are no students to mark for this class.', 'error');
      return;
    }
    const next = { ...(database.attendance[date] || {}) };
    let changed = 0;
    selects.forEach(select => {
      const id = select.dataset.studentId;
      if (!id) return;
      if (select.value) {
        next[id] = select.value;
        changed += 1;
      } else {
        delete next[id];
      }
    });
    if (Object.keys(next).length) database.attendance[date] = next;
    else delete database.attendance[date];
    saveDatabase();
    renderAll();
    renderAttendanceRegister();
    notify(`Attendance saved for ${changed} marked student(s) in ${className} on ${formatDate(date)}.`, 'success');
  }

  function exportCSV(filename, rows) {
    if (!rows.length) {
      notify('There is no data to export.', 'error');
      return;
    }
    const safeCell = value => {
      let text = String(value ?? '');
      if (/^[=+@\-]/.test(text)) text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    };
    const csv = rows.map(row => row.map(safeCell).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function exportStudents() {
    const query = normalise($('#student-search')?.value || '');
    const classFilter = $('#directory-class-filter')?.value || 'all';
    const students = database.students.filter(student => (!query || normalise(`${student.name} ${student.admissionNo} ${student.className}`).includes(query)) && (classFilter === 'all' || student.className === classFilter));
    const rows = [['Student name', 'Class', 'Admission number', 'Parent / guardian', 'Monthly fee', 'Fee total', 'Amount received', 'Balance']];
    students.forEach(student => rows.push([student.name, student.className, student.admissionNo, student.fatherName, student.monthlyFee, student.feeTotal, student.feePaid, student.feeBalance]));
    exportCSV(`SPPS-students-${inputDateToday()}.csv`, rows);
  }

  function exportFees() {
    const query = normalise($('#fees-search')?.value || '');
    const classFilter = $('#fees-class-filter')?.value || 'all';
    const students = database.students.filter(student => (!query || normalise(`${student.name} ${student.admissionNo} ${student.className}`).includes(query)) && (classFilter === 'all' || student.className === classFilter));
    const rows = [['Student name', 'Class', 'Admission number', 'Fee total', 'Received', 'Balance']];
    students.forEach(student => rows.push([student.name, student.className, student.admissionNo, student.feeTotal, student.feePaid, student.feeBalance]));
    exportCSV(`SPPS-fee-report-${inputDateToday()}.csv`, rows);
  }

  function safeHttpUrl(value) {
    try {
      const url = new URL(String(value || '').trim());
      if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
    } catch (_) { /* invalid URL */ }
    return '';
  }

  function saveSettings(event) {
    event?.preventDefault();
    if (!hasAdmin()) {
      notify('Only an administrator can customize the portal.', 'error');
      return;
    }
    database.settings.schoolName = plainText($('#settings-school-name')?.value, 160) || DEFAULT_SETTINGS.schoolName;
    database.settings.address = plainText($('#settings-address')?.value, 300) || DEFAULT_SETTINGS.address;
    database.settings.session = plainText($('#settings-session')?.value, 40) || DEFAULT_SETTINGS.session;
    const primary = $('#settings-primary-colour')?.value;
    const accent = $('#settings-accent-colour')?.value;
    database.settings.primaryColour = isColour(primary) ? primary : DEFAULT_SETTINGS.primaryColour;
    database.settings.accentColour = isColour(accent) ? accent : DEFAULT_SETTINGS.accentColour;
    database.settings.logoDataUrl = currentLogoDataUrl;
    saveDatabase();
    applySettings();
    renderAll();
    notify('School identity, session and theme saved in this browser.', 'success');
  }

  function handleLogoUpload() {
    const file = $('#settings-logo-file')?.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      notify('Choose a PNG, JPEG or WebP image.', 'error');
      return;
    }
    if (file.size > 1024 * 1024) {
      notify('Please use a logo smaller than 1 MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      currentLogoDataUrl = String(reader.result || '');
      database.settings.logoDataUrl = currentLogoDataUrl;
      applySettings();
      saveDatabase();
      notify('School logo updated in this browser.', 'success');
    };
    reader.onerror = () => notify('Could not read that image file.', 'error');
    reader.readAsDataURL(file);
  }

  function bindEvents() {
    $('#student-mode-button')?.addEventListener('click', () => switchLoginMode('student'));
    $('#admin-mode-button')?.addEventListener('click', () => switchLoginMode('admin'));
    $('#student-class')?.addEventListener('change', renderStudentNameOptions);
    $('#student-login-form')?.addEventListener('submit', handleStudentLogin);
    $('#admin-login-form')?.addEventListener('submit', handleAdminLogin);
    $('#toggle-password')?.addEventListener('click', () => {
      const input = $('#admin-password');
      const button = $('#toggle-password');
      if (!input || !button) return;
      input.type = input.type === 'password' ? 'text' : 'password';
      button.textContent = input.type === 'password' ? 'Show' : 'Hide';
      button.setAttribute('aria-label', input.type === 'password' ? 'Show password' : 'Hide password');
      button.setAttribute('aria-pressed', String(input.type === 'text'));
    });
    $('#logout-button')?.addEventListener('click', showLogin);
    $('#open-sidebar')?.addEventListener('click', openSidebar);
    $('#close-sidebar')?.addEventListener('click', closeSidebar);
    $('#sidebar-backdrop')?.addEventListener('click', closeSidebar);
    $('#notification-button')?.addEventListener('click', () => setPage('announcements'));
    $('#main-navigation')?.addEventListener('click', event => {
      const button = event.target.closest('[data-page]');
      if (button) setPage(button.dataset.page);
    });
    document.addEventListener('click', event => {
      const goPage = event.target.closest('[data-go-page]');
      if (goPage) setPage(goPage.dataset.goPage);
      const addButton = event.target.closest('[data-open-editor]');
      if (addButton) openEditor(addButton.dataset.openEditor);
      const editButton = event.target.closest('[data-edit-type]');
      if (editButton) editItem(editButton.dataset.editType, editButton.dataset.editId);
      const deleteButton = event.target.closest('[data-delete-type]');
      if (deleteButton) deleteItem(deleteButton.dataset.deleteType, deleteButton.dataset.deleteId);
      const paymentButton = event.target.closest('[data-open-payment-for]');
      if (paymentButton) openEditor('payment', null, { studentId: paymentButton.dataset.openPaymentFor });
    });
    $('#editor-form')?.addEventListener('submit', saveEditor);
    $('#cancel-editor-button')?.addEventListener('click', closeEditor);
    $('#close-editor-dialog')?.addEventListener('click', closeEditor);
    $('#editor-dialog')?.addEventListener('click', event => {
      if (event.target === $('#editor-dialog')) closeEditor();
    });
    $('#save-attendance-button')?.addEventListener('click', saveAttendance);
    $('#attendance-class-select')?.addEventListener('change', renderAttendanceRegister);
    $('#attendance-date')?.addEventListener('change', renderAttendanceRegister);
    $('#mark-all-present-button')?.addEventListener('click', () => $$('.attendance-status-select').forEach(select => { select.value = 'Present'; }));
    $('#clear-attendance-button')?.addEventListener('click', () => $$('.attendance-status-select').forEach(select => { select.value = ''; }));
    $('#student-search')?.addEventListener('input', renderStudentDirectory);
    $('#directory-class-filter')?.addEventListener('change', renderStudentDirectory);
    $('#fees-search')?.addEventListener('input', renderFeesRegister);
    $('#fees-class-filter')?.addEventListener('change', renderFeesRegister);
    $('#homework-class-filter')?.addEventListener('change', renderHomework);
    $('#homework-subject-filter')?.addEventListener('change', renderHomework);
    $('#timetable-class-filter')?.addEventListener('change', renderTimetable);
    $('#timetable-day-filter')?.addEventListener('change', renderTimetable);
    $('#material-class-filter')?.addEventListener('change', renderMaterials);
    $('#material-type-filter')?.addEventListener('change', renderMaterials);
    $('#export-students-button')?.addEventListener('click', exportStudents);
    $('#export-fees-button')?.addEventListener('click', exportFees);
    $('#save-settings-button')?.addEventListener('click', saveSettings);
    $('#school-settings-form')?.addEventListener('submit', saveSettings);
    $('#settings-logo-file')?.addEventListener('change', handleLogoUpload);
    $('#student-workbook-form')?.addEventListener('submit', handleWorkbookImport);
  }

  function initialise() {
    ensureContentArrays();
    currentLogoDataUrl = database.settings.logoDataUrl || '';
    $('#footer-year').textContent = String(new Date().getFullYear());
    $('#app-footer-year').textContent = String(new Date().getFullYear());
    $('#attendance-date').value = inputDateToday();
    $('#attendance-date').max = inputDateToday();
    $('#attendance-class-select').value = SCHOOL_CLASSES[0];
    $('#timetable-day-filter').value = WEEKDAYS[new Date().getDay() === 0 ? 5 : Math.max(0, new Date().getDay() - 1)];
    applySettings();
    bindEvents();
    renderStudentNameOptions();
    renderAll();
    if (!window.SPPS_CONFIG?.authEndpoint) {
      const help = $('.form-help', $('#admin-login-form'));
      if (help) help.textContent = 'Local prototype only: the form does not securely verify the password. Server-side sign-in is required before real use.';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialise, { once: true });
  else initialise();
})();
