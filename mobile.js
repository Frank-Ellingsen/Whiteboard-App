/**
 * Project Controls Whiteboard - Smartphone Mobile Application Engine
 * Focused on Rapid Task Entry, Visual Swimlanes, and File Save/Load
 * 100% Schema-Compatible with desktop app.js
 */

(function () {
  'use strict';

  // --- Constants & Storage Keys ---
  const STORAGE_KEY = 'whiteboard-autosave';
  const RECENT_PROJECTS_KEY = 'whiteboard-saved-projects';

  const DEFAULT_LANES = [
    'Engineering',
    'Procurement',
    'Production',
    'Project Management',
    'Quality & Inspection',
    'Logistics',
  ];

  const COLOR_PALETTE = [
    { name: 'Slate (Default)', value: '#1e293b' },
    { name: 'Blue (Planned)', value: '#2563eb' },
    { name: 'Green (Actuals)', value: '#16a34a' },
    { name: 'Red (Critical/Risk)', value: '#dc2626' },
    { name: 'Yellow (Warning)', value: '#eab308' },
  ];

  // --- Application State ---
  const state = {
    projectName: 'Mobile Project',
    savedAt: new Date().toISOString(),
    activeTemplate: 'swimlane',
    showGrid: true,
    ganttStartDate: formatDate(new Date()),
    ganttStatusDate: formatDate(new Date()),
    trianglePriorities: { budget: 5, quality: 5, time: 5 },
    strokes: [],
    stickyNotes: [],
    dependencies: [],
    selectedLane: DEFAULT_LANES[0],
    selectedColor: COLOR_PALETTE[0].value,
    activeView: 'add',
  };

  // --- Helper Functions ---
  function formatDate(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function formatCurrency(val) {
    const num = Number(val) || 0;
    return num.toLocaleString('en-US');
  }

  function sanitizeFileName(name) {
    return (name || 'whiteboard_project')
      .replace(/[^a-z0-9_\-\s]/gi, '_')
      .trim();
  }

  function showToast(msg) {
    const toast = document.getElementById('mobile-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2400);
  }

  // --- Position Calculation for Desktop Parity ---
  function calculateNextCoordinates(laneName) {
    // Unique swimlanes order
    const lanes = Array.from(
      new Set([...DEFAULT_LANES, ...state.stickyNotes.map((n) => n.lane || 'Generelt')])
    );
    const laneIdx = Math.max(0, lanes.indexOf(laneName));
    const countInLane = state.stickyNotes.filter((n) => (n.lane || 'Generelt') === laneName).length;

    // Desktop canvas dimensions (columns: ~260px wide, rows: ~160px high)
    const x = 80 + laneIdx * 280;
    const y = 120 + countInLane * 180;
    return { x, y };
  }

  // --- Task Management ---
  function addTask(taskData) {
    const { x, y } = calculateNextCoordinates(taskData.lane);
    const id = `note-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const newNote = {
      id: id,
      x: x,
      y: y,
      lane: taskData.lane || 'Generelt',
      duration: Math.max(1, Number(taskData.duration) || 1),
      plannedHours: Math.max(0, Number(taskData.plannedHours) || 0),
      plannedCost: Math.max(0, Number(taskData.plannedCost) || 0),
      actualHours: 0,
      actualCost: 0,
      progress: 0,
      resource: taskData.resource || '',
      riskFactor: 1,
      impactFactor: 1,
      weightedFactor: 1,
      color: taskData.color || '#1e293b',
      text: taskData.text.trim(),
    };

    state.stickyNotes.push(newNote);
    saveToLocalStorage();
    renderAllViews();
    showToast(`Added: "${newNote.text.substring(0, 24)}"`);
  }

  function deleteTask(noteId) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    state.stickyNotes = state.stickyNotes.filter((n) => n.id !== noteId);
    state.dependencies = state.dependencies.filter(
      (d) => d.from !== noteId && d.to !== noteId
    );
    saveToLocalStorage();
    renderAllViews();
    showToast('Task deleted');
  }

  function updateTask(noteId, updates) {
    const note = state.stickyNotes.find((n) => n.id === noteId);
    if (!note) return;
    Object.assign(note, updates);
    saveToLocalStorage();
    renderAllViews();
    showToast('Task updated');
  }

  // --- Persistence & File I/O ---
  function getFullSnapshot() {
    return {
      projectName: state.projectName || 'Mobile Project',
      savedAt: new Date().toISOString(),
      activeTemplate: state.activeTemplate || 'swimlane',
      showGrid: state.showGrid !== false,
      ganttStartDate: state.ganttStartDate,
      ganttStatusDate: state.ganttStatusDate,
      trianglePriorities: { ...state.trianglePriorities },
      strokes: [...state.strokes],
      stickyNotes: state.stickyNotes.map((n) => ({ ...n })),
      dependencies: state.dependencies.map((d) => ({ ...d })),
    };
  }

  function saveToLocalStorage() {
    try {
      const snapshot = getFullSnapshot();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      localStorage.setItem('whiteboard-last-project', state.projectName);
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }

  function loadFromLocalStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        applyLoadedData(data, false);
      }
    } catch (e) {
      console.warn('LocalStorage load failed:', e);
    }
  }

  function saveToFile() {
    try {
      const snapshot = getFullSnapshot();
      const json = JSON.stringify(snapshot, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const filename = `${sanitizeFileName(state.projectName)}.json`;

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast(`Saved ${filename} to Downloads`);
    } catch (e) {
      alert('Save failed: ' + e.message);
    }
  }

  function openFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        applyLoadedData(data, true, file.name);
        showToast(`Loaded ${file.name}`);
        switchMobileView('board');
      } catch (err) {
        alert('Invalid whiteboard JSON file: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  async function loadSample(sampleFileName) {
    try {
      const res = await fetch(`samples/${encodeURIComponent(sampleFileName)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      applyLoadedData(data, true, sampleFileName);
      showToast(`Loaded ${data.projectName || sampleFileName}`);
      switchMobileView('board');
    } catch (err) {
      alert('Failed to load sample: ' + err.message);
    }
  }

  function applyLoadedData(data, overrideName = true, fileName = '') {
    if (!data || typeof data !== 'object') return;

    if (overrideName) {
      state.projectName =
        data.projectName ||
        (fileName ? fileName.replace(/\.json$/i, '') : 'Mobile Project');
    }
    state.activeTemplate = data.activeTemplate || 'swimlane';
    state.showGrid = data.showGrid !== false;
    state.ganttStartDate = data.ganttStartDate || formatDate(new Date());
    state.ganttStatusDate = data.ganttStatusDate || formatDate(new Date());
    state.strokes = Array.isArray(data.strokes) ? data.strokes : [];
    state.stickyNotes = Array.isArray(data.stickyNotes) ? data.stickyNotes : [];
    state.dependencies = Array.isArray(data.dependencies) ? data.dependencies : [];
    if (data.trianglePriorities) {
      state.trianglePriorities = { ...data.trianglePriorities };
    }

    // Update UI elements
    const nameInput = document.getElementById('project-name-header');
    if (nameInput) nameInput.value = state.projectName;

    const startDateInput = document.getElementById('setting-start-date');
    if (startDateInput) startDateInput.value = state.ganttStartDate;

    const statusDateInput = document.getElementById('setting-status-date');
    if (statusDateInput) statusDateInput.value = state.ganttStatusDate;

    saveToLocalStorage();
    renderAllViews();
  }

  function clearBoard() {
    if (!confirm('Clear all tasks and start a fresh board?')) return;
    state.projectName = 'New Project';
    state.stickyNotes = [];
    state.dependencies = [];
    state.strokes = [];
    const nameInput = document.getElementById('project-name-header');
    if (nameInput) nameInput.value = state.projectName;
    saveToLocalStorage();
    renderAllViews();
    showToast('Board cleared');
    switchMobileView('add');
  }

  // --- Rendering Functions ---

  function renderAllViews() {
    updateBadgeCounts();
    renderRecentTasks();
    renderWhiteboardSwimlanes();
    renderTaskTable();
  }

  function updateBadgeCounts() {
    const count = state.stickyNotes.length;
    const badge = document.getElementById('header-task-badge');
    if (badge) badge.textContent = `${count} task${count === 1 ? '' : 's'}`;

    const totalHours = state.stickyNotes.reduce((acc, n) => acc + (Number(n.plannedHours) || 0), 0);
    const totalCost = state.stickyNotes.reduce((acc, n) => acc + (Number(n.plannedCost) || 0), 0);

    const summaryHours = document.getElementById('summary-total-hours');
    if (summaryHours) summaryHours.textContent = totalHours.toLocaleString();

    const summaryCost = document.getElementById('summary-total-cost');
    if (summaryCost) summaryCost.textContent = `${formatCurrency(totalCost)} kr`;
  }

  // 1. Quick Add View: Recent Added Tasks
  function renderRecentTasks() {
    const container = document.getElementById('recent-tasks-container');
    if (!container) return;

    if (state.stickyNotes.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <div class="empty-state-text">No tasks yet. Enter your first task above!</div>
        </div>
      `;
      return;
    }

    // Show last 5 added (reversed)
    const recent = [...state.stickyNotes].reverse().slice(0, 5);
    let html = '';
    recent.forEach((n, idx) => {
      const code = `T${(state.stickyNotes.indexOf(n) + 1) * 10}`;
      html += `
        <div class="task-card" style="border-left-color: ${n.color || '#1e293b'};">
          <div class="task-card-header">
            <span class="task-code-badge">${code}</span>
            <span class="task-card-title">${escapeHtml(n.text)}</span>
          </div>
          <div class="task-card-meta">
            <span>🏷️ ${escapeHtml(n.lane || 'Generelt')}</span>
            <span>⏱️ ${n.duration || 1}d</span>
            <span>💰 ${formatCurrency(n.plannedCost)} kr</span>
          </div>
        </div>
      `;
    });
    container.innerHTML = html;
  }

  // 2. Whiteboard View: Swimlane Grouping
  function renderWhiteboardSwimlanes() {
    const container = document.getElementById('swimlane-board-container');
    if (!container) return;

    if (state.stickyNotes.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🎨</div>
          <div class="empty-state-text">Whiteboard is empty.<br>Use the <strong>Add Task</strong> tab to enter tasks!</div>
          <button class="btn btn-primary btn-sm" onclick="window.switchMobileView('add')">➕ Add Task</button>
        </div>
      `;
      return;
    }

    // Group notes by swimlane
    const groups = {};
    state.stickyNotes.forEach((n, idx) => {
      const lane = n.lane || 'Generelt';
      if (!groups[lane]) groups[lane] = [];
      groups[lane].push({ note: n, originalIndex: idx });
    });

    let html = '';
    Object.keys(groups).forEach((lane) => {
      const items = groups[lane];
      html += `
        <div class="swimlane-group">
          <div class="swimlane-group-header">
            <span>🏊 ${escapeHtml(lane)}</span>
            <span class="badge">${items.length}</span>
          </div>
          <div class="swimlane-group-items">
      `;

      items.forEach(({ note, originalIndex }) => {
        const code = `T${(originalIndex + 1) * 10}`;
        html += `
          <div class="task-card" style="border-left-color: ${note.color || '#1e293b'};">
            <div class="task-card-header">
              <span class="task-code-badge">${code}</span>
              <span class="task-card-title">${escapeHtml(note.text)}</span>
            </div>
            <div class="task-card-meta">
              <span>⏱️ ${note.duration || 1} days</span>
              <span>🕒 ${note.plannedHours || 0} hrs</span>
              <span>💰 ${formatCurrency(note.plannedCost)} kr</span>
            </div>
            <div class="task-card-actions">
              <button class="btn btn-secondary btn-sm" onclick="window.promptEditTask('${note.id}')">✏️ Edit</button>
              <button class="btn btn-danger-outline btn-sm" onclick="window.deleteTask('${note.id}')">🗑️ Delete</button>
            </div>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  // 3. Task List View: Tufte Data Table
  function renderTaskTable() {
    const tbody = document.getElementById('mobile-table-tbody');
    if (!tbody) return;

    if (state.stickyNotes.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 20px;">
            No tasks found.
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    state.stickyNotes.forEach((n, idx) => {
      const code = `T${(idx + 1) * 10}`;
      html += `
        <tr>
          <td style="font-weight: 700; font-family: var(--font-mono);">${code}</td>
          <td>${escapeHtml(n.text)}</td>
          <td><span class="badge">${escapeHtml(n.lane || 'Generelt')}</span></td>
          <td class="num-col">${n.duration || 1}d</td>
          <td class="num-col">${formatCurrency(n.plannedCost)}</td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  }

  // Helper escape
  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // --- View Switcher ---
  function switchMobileView(viewName) {
    state.activeView = viewName;
    document.querySelectorAll('.mobile-view').forEach((el) => {
      el.classList.remove('active');
    });
    const target = document.getElementById(`view-${viewName}`);
    if (target) target.classList.add('active');

    document.querySelectorAll('.nav-tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-view') === viewName);
    });

    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // --- Edit Task Modal/Prompt ---
  function promptEditTask(noteId) {
    const note = state.stickyNotes.find((n) => n.id === noteId);
    if (!note) return;

    const newText = prompt('Task / WBS Title:', note.text);
    if (newText === null) return;

    const newLane = prompt('Discipline / Swimlane:', note.lane);
    const newDur = prompt('Duration (Days):', note.duration);
    const newCost = prompt('Planned Cost (BAC kr):', note.plannedCost);

    updateTask(noteId, {
      text: (newText || note.text).trim(),
      lane: (newLane || note.lane).trim(),
      duration: Math.max(1, Number(newDur) || note.duration),
      plannedCost: Math.max(0, Number(newCost) || note.plannedCost),
    });
  }

  // --- Setup Event Listeners ---
  function setupEvents() {
    // 1. Navigation tabs
    document.querySelectorAll('.nav-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-view');
        if (view) switchMobileView(view);
      });
    });

    // 2. Project Name input
    const nameInput = document.getElementById('project-name-header');
    if (nameInput) {
      nameInput.value = state.projectName;
      nameInput.addEventListener('change', () => {
        state.projectName = nameInput.value.trim() || 'Mobile Project';
        saveToLocalStorage();
      });
      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') nameInput.blur();
      });
    }

    // 3. Save File buttons
    const btnSaveHeader = document.getElementById('btn-save-header');
    if (btnSaveHeader) btnSaveHeader.addEventListener('click', saveToFile);

    const btnSaveFilesView = document.getElementById('btn-save-files-view');
    if (btnSaveFilesView) btnSaveFilesView.addEventListener('click', saveToFile);

    // 4. File Input
    const fileInput = document.getElementById('mobile-file-input');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const [file] = e.target.files;
        if (file) openFile(file);
        fileInput.value = '';
      });
    }

    const btnOpenFile = document.getElementById('btn-open-file');
    if (btnOpenFile && fileInput) {
      btnOpenFile.addEventListener('click', () => fileInput.click());
    }

    // 5. Swimlane Pills in Add Task Form
    const pillsContainer = document.getElementById('swimlane-pills-container');
    if (pillsContainer) {
      DEFAULT_LANES.forEach((lane) => {
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = `swimlane-pill ${lane === state.selectedLane ? 'active' : ''}`;
        pill.textContent = lane;
        pill.addEventListener('click', () => {
          document.querySelectorAll('.swimlane-pill').forEach((p) => p.classList.remove('active'));
          pill.classList.add('active');
          state.selectedLane = lane;
          const customInput = document.getElementById('task-custom-lane');
          if (customInput) customInput.value = lane;
        });
        pillsContainer.appendChild(pill);
      });
    }

    // 6. Color Tag Buttons
    const colorTagsContainer = document.getElementById('color-tags-container');
    if (colorTagsContainer) {
      COLOR_PALETTE.forEach((c) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `color-tag-btn ${c.value === state.selectedColor ? 'active' : ''}`;
        btn.style.backgroundColor = c.value;
        btn.title = c.name;
        btn.addEventListener('click', () => {
          document.querySelectorAll('.color-tag-btn').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          state.selectedColor = c.value;
        });
        colorTagsContainer.appendChild(btn);
      });
    }

    // 7. Add Task Form Submit
    const addForm = document.getElementById('mobile-add-task-form');
    if (addForm) {
      addForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const textInput = document.getElementById('task-text-input');
        const customLaneInput = document.getElementById('task-custom-lane');
        const durationInput = document.getElementById('task-duration-input');
        const hoursInput = document.getElementById('task-hours-input');
        const costInput = document.getElementById('task-cost-input');

        const text = textInput ? textInput.value.trim() : '';
        if (!text) {
          alert('Please enter a task name.');
          if (textInput) textInput.focus();
          return;
        }

        const lane = (customLaneInput && customLaneInput.value.trim()) || state.selectedLane || 'Generelt';
        const duration = Number(durationInput?.value) || 1;
        const plannedHours = Number(hoursInput?.value) || 0;
        const plannedCost = Number(costInput?.value) || 0;

        addTask({
          text,
          lane,
          duration,
          plannedHours,
          plannedCost,
          color: state.selectedColor,
        });

        // Reset form but preserve lane and duration
        if (textInput) {
          textInput.value = '';
          textInput.focus();
        }
      });
    }

    // 8. Sample Projects
    document.querySelectorAll('[data-load-sample]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sampleName = btn.getAttribute('data-load-sample');
        if (sampleName) loadSample(sampleName);
      });
    });

    // 9. Clear Board Button
    const btnClear = document.getElementById('btn-clear-board');
    if (btnClear) btnClear.addEventListener('click', clearBoard);

    // 10. Date Settings
    const startDateInput = document.getElementById('setting-start-date');
    if (startDateInput) {
      startDateInput.addEventListener('change', () => {
        state.ganttStartDate = startDateInput.value;
        saveToLocalStorage();
      });
    }

    const statusDateInput = document.getElementById('setting-status-date');
    if (statusDateInput) {
      statusDateInput.addEventListener('change', () => {
        state.ganttStatusDate = statusDateInput.value;
        saveToLocalStorage();
      });
    }
  }

  // Expose global methods
  window.switchMobileView = switchMobileView;
  window.deleteTask = deleteTask;
  window.promptEditTask = promptEditTask;
  window.saveToFile = saveToFile;

  // Initialize on DOM Ready
  document.addEventListener('DOMContentLoaded', () => {
    loadFromLocalStorage();
    setupEvents();
    renderAllViews();
  });
})();
