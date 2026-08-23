// Canvas and DOM Elements
const canvas = document.getElementById('whiteboardCanvas');
const ctx = canvas.getContext('2d');
const viewport = document.getElementById('canvas-viewport');
const strokeWidthInput = document.getElementById('stroke-width');
const strokeValueSpan = document.getElementById('stroke-value');
const tempNameSpan = document.getElementById('current-template-name');
const gridToggleBtn = document.getElementById('btn-grid-toggle');
const clearBtn = document.getElementById('btn-clear');
const undoBtn = document.getElementById('btn-undo');
const redoBtn = document.getElementById('btn-redo');
const exportBtn = document.getElementById('btn-export');
const saveProjectBtn = document.getElementById('btn-save-project');
const openProjectBtn = document.getElementById('btn-open-project');
const projectFileInput = document.getElementById('project-file-input');
const projectNameInput = document.getElementById('project-name-input');
const a11yAnnouncer = document.getElementById('a11y-live-announcer');
const ganttStartDateInput = document.getElementById('gantt-start-date');
const ganttStatusDateInput = document.getElementById('gantt-status-date');
const ganttEndDate = document.getElementById('gantt-end-date');
const ganttCriticalPathDays = document.getElementById(
  'gantt-critical-path-days'
);
const BOARD_STORAGE_KEY = 'whiteboard-projects';
let trianglePriorities = { budget: 5, quality: 5, time: 5 };

// State Variables
let currentTool = 'select'; // select, pen, highlighter, eraser, line, rect, circle, sticky, text-box
let currentColor = '#1e293b';
let currentStrokeWidth = 4;
let activeTemplate = 'swimlane';
let showGrid = true;
let isDrawing = false;
let startPoint = { x: 0, y: 0 };
let currentStroke = null;

// Vector drawing database
let strokes = [];
let stickyNotes = []; // Stores states: { id, element, x, y, lane: 'Generelt', duration: 1, color, resource, riskFactor, impactFactor, weightedFactor, actualHours, actualCost, progress }
let dependencies = []; // Stores task arrows: { from: noteId, to: noteId }

// Unified Undo/Redo Engine
let historyStack = [];
let redoStack = [];

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateInput(value, fallback = new Date()) {
  if (!value)
    return new Date(
      fallback.getFullYear(),
      fallback.getMonth(),
      fallback.getDate()
    );
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day)
    return new Date(
      fallback.getFullYear(),
      fallback.getMonth(),
      fallback.getDate()
    );
  return new Date(year, month - 1, day);
}

function formatScheduleDate(date) {
  return formatDateInput(date);
}

const todayDate = formatDateInput(new Date());
if (ganttStartDateInput) ganttStartDateInput.value = todayDate;
if (ganttStatusDateInput) ganttStatusDateInput.value = todayDate;

function pushAction(action) {
  historyStack.push(action);
  redoStack = [];
}

// Task linking variables (Shift-drag)
let shiftKeyPressed = false;
let connectingStartNote = null;
let tempArrowTarget = null;

// Context Menu State
let contextMenuTargetNoteId = null;

// Initialize Canvas Sizing
function resizeCanvas() {
  const rect = viewport.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  // Using devicePixelRatio to maintain crispness on High-DPI screens
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  // Update canvas CSS size
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;

  drawAll();
}

// Coordinate extraction helper
function getCoords(e) {
  const rect = canvas.getBoundingClientRect();
  // Adjust for screen scaling
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };
}

// -------------------------------------------------------------
// Template Rendering Functions (Data-Ink Principles: Zero extra decoration)
// -------------------------------------------------------------
function drawGrid() {
  if (!showGrid) return;

  ctx.strokeStyle = '#f1f5f9';
  ctx.lineWidth = 1;

  const gridSize = 40;
  const w = canvas.width / (window.devicePixelRatio || 1);
  const h = canvas.height / (window.devicePixelRatio || 1);

  for (let x = 0; x < w; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
}

function drawSCurveTemplate() {
  const w = canvas.width / (window.devicePixelRatio || 1);
  const h = canvas.height / (window.devicePixelRatio || 1);

  // Set padding for axes
  const padLeft = 80;
  const padRight = 60;
  const padBottom = 60;
  const padTop = 60;

  const graphWidth = w - padLeft - padRight;
  const graphHeight = h - padTop - padBottom;

  // Adhering to Tufte: clean axes, no thick boundaries
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1;

  // Draw X & Y Axes
  ctx.beginPath();
  ctx.moveTo(padLeft, padTop);
  ctx.lineTo(padLeft, h - padBottom);
  ctx.lineTo(w - padRight, h - padBottom);
  ctx.stroke();

  // Labels
  ctx.fillStyle = '#0f172a';
  ctx.font = '12px Inter';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  // Y-axis ticks (Cumulative Cost / Value %)
  for (let i = 0; i <= 5; i++) {
    const val = i * 20;
    const y = h - padBottom - graphHeight * (i / 5);
    ctx.fillText(`${val}%`, padLeft - 10, y);

    // Subtle ticks
    ctx.beginPath();
    ctx.moveTo(padLeft - 4, y);
    ctx.lineTo(padLeft, y);
    ctx.stroke();
  }

  // X-axis ticks (Project Schedule Timeline)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const intervals = ['0% (Start)', '25%', '50% (Mid)', '75%', '100% (Finish)'];
  intervals.forEach((lbl, i) => {
    const x = padLeft + graphWidth * (i / 4);
    ctx.fillText(lbl, x, h - padBottom + 12);

    ctx.beginPath();
    ctx.moveTo(x, h - padBottom);
    ctx.lineTo(x, h - padBottom + 4);
    ctx.stroke();
  });

  // Titles / Labels (Direct text alignment)
  ctx.font = '600 13px Inter';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'left';
  ctx.fillText(
    'CUMULATIVE PROJECT VALUE / COST (S-CURVE)',
    padLeft,
    padTop - 25
  );

  ctx.font = '400 11px Inter';
  ctx.fillText(
    'Project Timeline (Time/ETC)',
    w - padRight - 120,
    h - padBottom - 15
  );
}

function drawRiskMatrixTemplate() {
  const w = canvas.width / (window.devicePixelRatio || 1);
  const h = canvas.height / (window.devicePixelRatio || 1);

  const padLeft = 80;
  const padBottom = 60;
  const padTop = 60;
  const padRight = 60;

  const size = Math.min(w - padLeft - padRight, h - padTop - padBottom);
  const cell = size / 5;

  // Matrix Box
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;

  // Draw cells
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const x = padLeft + c * cell;
      const y = padTop + r * cell;

      // Determine subtle risk shading based on Tufte principles (muted colors)
      // Risk level = (5 - r) * (c + 1)
      const severity = (5 - r) * (c + 1);

      if (severity >= 15) {
        ctx.fillStyle = '#fef2f2'; // Muted red
      } else if (severity >= 8) {
        ctx.fillStyle = '#fffbeb'; // Muted amber
      } else {
        ctx.fillStyle = '#f8fafc'; // Muted slate/grey
      }

      ctx.fillRect(x, y, cell, cell);
      ctx.strokeRect(x, y, cell, cell);
    }
  }

  // Axis Labels
  ctx.fillStyle = '#0f172a';
  ctx.font = '600 12px Inter';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(
    'CONSEQUENCE / IMPACT (1-5)',
    padLeft + size / 2,
    padTop + size + 15
  );

  // Vertical label (Probability)
  ctx.save();
  ctx.translate(padLeft - 45, padTop + size / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('PROBABILITY (1-5)', 0, 0);
  ctx.restore();

  // Grid tick numbers
  ctx.font = '400 11px Inter';
  ctx.fillStyle = '#475569';
  for (let i = 0; i < 5; i++) {
    // Probability values (Vertical axis)
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${5 - i}`, padLeft - 10, padTop + i * cell + cell / 2);

    // Impact values (Horizontal axis)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`${i + 1}`, padLeft + i * cell + cell / 2, padTop + size + 2);
  }

  // Title
  ctx.font = '600 13px Inter';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'left';
  ctx.fillText(
    '5x5 RISK & OPPORTUNITY ASSESSMENT MATRIX',
    padLeft,
    padTop - 25
  );
}

function drawGanttTemplate() {
  const w = canvas.width / (window.devicePixelRatio || 1);
  const h = canvas.height / (window.devicePixelRatio || 1);

  const padLeft = 140;
  const padRight = 40;
  const padTop = 80;
  const padBottom = 40;

  const width = w - padLeft - padRight;
  const height = h - padTop - padBottom;

  const rowHeight = height / 4;
  const colWidth = width / 4;

  // Draw Grid Lines (Tufte-style: no vertical lines, only light horizontal lanes)
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;

  // Columns (Quarters / Timeline)
  ctx.fillStyle = '#0f172a';
  ctx.font = '600 11px Inter';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';

  const quarters = ['Quarter 1', 'Quarter 2', 'Quarter 3', 'Quarter 4'];
  for (let i = 0; i <= 4; i++) {
    const x = padLeft + i * colWidth;
    ctx.beginPath();
    ctx.moveTo(x, padTop - 15);
    ctx.lineTo(x, h - padBottom);
    ctx.stroke();

    if (i < 4) {
      ctx.fillText(quarters[i], x + colWidth / 2, padTop - 20);
    }
  }

  // Rows (Swimlanes / Phases)
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const phases = [
    'Phase 1: Engineering',
    'Phase 2: Procurement',
    'Phase 3: Construction',
    'Phase 4: Commissioning',
  ];

  for (let i = 0; i <= 4; i++) {
    const y = padTop + i * rowHeight;
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(w - padRight, y);
    ctx.stroke();

    if (i < 4) {
      ctx.fillStyle = '#334155';
      ctx.fillText(phases[i], 15, y + rowHeight / 2);
    }
  }

  // Title
  ctx.font = '600 13px Inter';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'left';
  ctx.fillText('GANTT TIMELINE SCHEDULE SKETCH', 15, 30);
}

function drawVerticalSwimlaneTemplate() {
  const w = canvas.width / (window.devicePixelRatio || 1);
  const h = canvas.height / (window.devicePixelRatio || 1);

  const padLeft = 32;
  const padRight = 32;
  const padTop = 64;
  const padBottom = 32;

  const totalWidth = Math.max(200, w - padLeft - padRight);
  const totalHeight = Math.max(200, h - padTop - padBottom);

  // Group notes by canonical lane
  const lanesMap = {};
  const laneDisplayNames = {};
  stickyNotes.forEach((n) => {
    const { key, display } = getCanonicalLaneInfo(n.lane);
    if (!lanesMap[key]) {
      lanesMap[key] = [];
      laneDisplayNames[key] = display;
    }
    lanesMap[key].push(n);
  });

  // Sort swimlane columns by horizontal order of notes (earliest note x first)
  const sortedLaneKeys = Object.keys(lanesMap).sort((a, b) => {
    const minA = Math.min(...lanesMap[a].map((n) => Number(n.x) || 0));
    const minB = Math.min(...lanesMap[b].map((n) => Number(n.x) || 0));
    if (minA !== minB) return minA - minB;
    return a.localeCompare(b, undefined, {
      sensitivity: 'base',
      numeric: true,
    });
  });

  let lanes = [];
  if (sortedLaneKeys.length >= 2) {
    lanes = sortedLaneKeys.map((k) => ({
      key: k,
      name: laneDisplayNames[k],
      count: lanesMap[k].length,
    }));
  } else {
    lanes = [
      { key: 'legal', name: 'Legal', count: (lanesMap['legal'] || []).length },
      {
        key: 'clear garden',
        name: 'Clear Garden',
        count: (lanesMap['clear garden'] || []).length,
      },
      {
        key: 'buy shed',
        name: 'Buy Shed',
        count: (lanesMap['buy shed'] || []).length,
      },
      {
        key: 'foundations',
        name: 'Foundations',
        count: (lanesMap['foundations'] || []).length,
      },
      {
        key: 'install shed',
        name: 'Install Shed',
        count: (lanesMap['install shed'] || []).length,
      },
    ];
    sortedLaneKeys.forEach((k) => {
      if (!lanes.some((al) => al.key === k)) {
        lanes.push({
          key: k,
          name: laneDisplayNames[k] || k,
          count: lanesMap[k].length,
        });
      }
    });
  }

  const numLanes = lanes.length;
  const colWidth = totalWidth / numLanes;
  const headerH = 34;

  // Title Banner (Tufte clean typography)
  ctx.font = '700 13px Inter';
  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('VERTICAL SWIMLANE PROCESS FLOWCHART', padLeft, 20);

  ctx.font = '500 11px Inter';
  ctx.fillStyle = '#64748b';
  ctx.fillText(
    'Cross-functional discipline swimlanes · Drag notes into columns · Link with Shift-Drag',
    padLeft + 310,
    21
  );

  // Swimlane Outer Container Background & Frame
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(padLeft, padTop, totalWidth, totalHeight);

  // Alternating Column Track Shading for High Contrast & Visual Clarity
  lanes.forEach((lane, idx) => {
    const x = padLeft + idx * colWidth;
    ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
    ctx.fillRect(x, padTop + headerH, colWidth, totalHeight - headerH);
  });

  // Header Background Row (Crisp Dark Bar for High Data-Ink Contrast)
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(padLeft, padTop, totalWidth, headerH);

  // Outer Border around entire swimlane grid
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(padLeft, padTop, totalWidth, totalHeight);

  // Bottom line of header
  ctx.beginPath();
  ctx.moveTo(padLeft, padTop + headerH);
  ctx.lineTo(padLeft + totalWidth, padTop + headerH);
  ctx.stroke();

  // Draw Column Dividers and Column Headers
  lanes.forEach((lane, idx) => {
    const x = padLeft + idx * colWidth;

    // Vertical Divider Line between columns (solid clean divider)
    if (idx > 0) {
      // Body track divider
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, padTop + headerH);
      ctx.lineTo(x, padTop + totalHeight);
      ctx.stroke();

      // Header column divider
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, padTop);
      ctx.lineTo(x, padTop + headerH);
      ctx.stroke();
    }

    // Header Label: Discipline Name + Count Pill
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 11px Inter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const headerTitle =
      lane.count > 0
        ? `${lane.name.toUpperCase()} (${lane.count})`
        : lane.name.toUpperCase();
    ctx.fillText(headerTitle, x + colWidth / 2, padTop + headerH / 2);
  });

  // Subtle bottom footer bar with total summary
  ctx.fillStyle = '#64748b';
  ctx.font = '500 10px Inter';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText(
    `${numLanes} Swimlanes · ${stickyNotes.length} Process Tasks · Switch to 🏊 Swimlanes tab for auto-aligned flowchart`,
    padLeft + totalWidth,
    padTop + totalHeight + 8
  );
}

// Draw arrow helper function for dependencies
function drawArrow(
  ctx,
  fromX,
  fromY,
  toX,
  toY,
  color = '#2563eb',
  width = 2,
  isShape = false
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';

  const angle = Math.atan2(toY - fromY, toX - fromX);

  // Note size is roughly 160x110. Let's compute box boundary intersection
  const w = 160;
  const h = 110;
  const dx = toX - fromX;
  const dy = toY - fromY;

  let targetX = toX;
  let targetY = toY;

  if (!isShape && (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001)) {
    const tX = Math.abs(w / 2 / dx);
    const tY = Math.abs(h / 2 / dy);
    const t = Math.min(tX, tY);
    if (t < 1) {
      targetX = toX - dx * t;
      targetY = toY - dy * t;
    }
  }

  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(targetX, targetY);
  ctx.stroke();

  // Draw arrowhead at intersection boundary
  const arrowSize = 10;
  ctx.beginPath();
  ctx.moveTo(targetX, targetY);
  ctx.lineTo(
    targetX - arrowSize * Math.cos(angle - Math.PI / 6),
    targetY - arrowSize * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    targetX - arrowSize * Math.cos(angle + Math.PI / 6),
    targetY - arrowSize * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();
}

// -------------------------------------------------------------
// Rendering Manager
// -------------------------------------------------------------
function drawAll() {
  // Clear the drawing surface safely across all transforms/DPR
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  // 1. Draw static grid
  drawGrid();

  // 2. Draw current layout template
  if (activeTemplate === 'scurve') {
    drawSCurveTemplate();
  } else if (activeTemplate === 'matrix') {
    drawRiskMatrixTemplate();
  } else if (activeTemplate === 'gantt') {
    drawGanttTemplate();
  } else if (activeTemplate === 'swimlane' && activeView === 'swimlane') {
    drawVerticalSwimlaneTemplate();
  }

  // 3. Render task dependency arrows
  dependencies.forEach((dep) => {
    const fromNote = stickyNotes.find((n) => n.id === dep.from);
    const toNote = stickyNotes.find((n) => n.id === dep.to);
    if (fromNote && toNote) {
      const fromCenterX = fromNote.x + 80;
      const fromCenterY = fromNote.y + 55;
      const toCenterX = toNote.x + 80;
      const toCenterY = toNote.y + 55;
      drawArrow(
        ctx,
        fromCenterX,
        fromCenterY,
        toCenterX,
        toCenterY,
        '#2563eb',
        2
      );
    }
  });

  // 4. Render active shift-drag connection line
  if (connectingStartNote && tempArrowTarget) {
    const fromCenterX = connectingStartNote.x + 80;
    const fromCenterY = connectingStartNote.y + 55;
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(fromCenterX, fromCenterY);
    ctx.lineTo(tempArrowTarget.x, tempArrowTarget.y);
    ctx.stroke();
    ctx.setLineDash([]); // Reset dash state
  }

  // 5. Render vector drawings
  strokes.forEach((stroke) => {
    drawStroke(stroke);
  });

  // 6. Render active path currently being drawn
  if (isDrawing && currentStroke) {
    drawStroke(currentStroke);
  }
}

function drawStroke(stroke) {
  ctx.save();
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Handle highlighter blend mode
  if (stroke.tool === 'highlighter') {
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = convertHexToRGBA(stroke.color, 0.4);
  } else {
    ctx.globalAlpha = 1.0;
  }

  // Handle Eraser
  if (stroke.tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
  } else {
    ctx.globalCompositeOperation = 'source-over';
  }

  if (
    stroke.tool === 'pen' ||
    stroke.tool === 'highlighter' ||
    stroke.tool === 'eraser'
  ) {
    if (stroke.points.length < 1) {
      ctx.restore();
      return;
    }
    if (stroke.points.length === 1) {
      ctx.beginPath();
      ctx.arc(
        stroke.points[0].x,
        stroke.points[0].y,
        Math.max(1, stroke.width / 2),
        0,
        2 * Math.PI
      );
      ctx.fillStyle =
        stroke.tool === 'eraser'
          ? 'rgba(0,0,0,1)'
          : stroke.tool === 'highlighter'
            ? convertHexToRGBA(stroke.color, 0.4)
            : stroke.color;
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }
  } else if (stroke.tool === 'line') {
    ctx.beginPath();
    ctx.moveTo(stroke.start.x, stroke.start.y);
    ctx.lineTo(stroke.end.x, stroke.end.y);
    ctx.stroke();
  } else if (stroke.tool === 'rect') {
    const x = Math.min(stroke.start.x, stroke.end.x);
    const y = Math.min(stroke.start.y, stroke.end.y);
    const w = Math.abs(stroke.start.x - stroke.end.x);
    const h = Math.abs(stroke.start.y - stroke.end.y);
    ctx.fillStyle = 'rgba(241, 245, 249, 0.85)';
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.fill();
    ctx.stroke();
  } else if (stroke.tool === 'circle') {
    const rx = Math.abs(stroke.start.x - stroke.end.x);
    const ry = Math.abs(stroke.start.y - stroke.end.y);
    const r = Math.sqrt(rx * rx + ry * ry);
    ctx.fillStyle = 'rgba(241, 245, 249, 0.85)';
    ctx.beginPath();
    ctx.arc(stroke.start.x, stroke.start.y, r, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
  } else if (stroke.tool === 'diamond') {
    const cx = (stroke.start.x + stroke.end.x) / 2;
    const cy = (stroke.start.y + stroke.end.y) / 2;
    const rx = Math.abs(stroke.start.x - stroke.end.x) / 2;
    const ry = Math.abs(stroke.start.y - stroke.end.y) / 2;
    ctx.fillStyle = 'rgba(241, 245, 249, 0.85)';
    ctx.beginPath();
    ctx.moveTo(cx, cy - ry);
    ctx.lineTo(cx + rx, cy);
    ctx.lineTo(cx, cy + ry);
    ctx.lineTo(cx - rx, cy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (stroke.tool === 'triangle') {
    const cx = (stroke.start.x + stroke.end.x) / 2;
    const yMin = Math.min(stroke.start.y, stroke.end.y);
    const yMax = Math.max(stroke.start.y, stroke.end.y);
    const xMin = Math.min(stroke.start.x, stroke.end.x);
    const xMax = Math.max(stroke.start.x, stroke.end.x);
    ctx.fillStyle = 'rgba(241, 245, 249, 0.85)';
    ctx.beginPath();
    ctx.moveTo(cx, yMin);
    ctx.lineTo(xMax, yMax);
    ctx.lineTo(xMin, yMax);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (stroke.tool === 'arrow') {
    drawArrow(
      ctx,
      stroke.start.x,
      stroke.start.y,
      stroke.end.x,
      stroke.end.y,
      stroke.color,
      stroke.width,
      true
    );
  } else if (stroke.tool === 'area-eraser') {
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    const x = Math.min(stroke.start.x, stroke.end.x);
    const y = Math.min(stroke.start.y, stroke.end.y);
    const w = Math.abs(stroke.start.x - stroke.end.x);
    const h = Math.abs(stroke.start.y - stroke.end.y);
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (stroke.tool === 'text-box') {
    const x = Math.min(stroke.start.x, stroke.end.x);
    const y = Math.min(stroke.start.y, stroke.end.y);
    const w = Math.abs(stroke.start.x - stroke.end.x);
    const h = Math.abs(stroke.start.y - stroke.end.y);

    // Box fill (semi-transparent background for readability over grid and swimlanes)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
    ctx.fillRect(x, y, w, h);

    // Dashed text-box border
    ctx.strokeStyle = stroke.color || '#1e293b';
    ctx.lineWidth = Math.max(1, Math.min(stroke.width, 3));
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);

    if (stroke.text) {
      ctx.fillStyle = stroke.color || '#1e293b';
      ctx.font =
        '13px Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      drawCanvasText(ctx, stroke.text, x + 8, y + 8, Math.max(10, w - 16), 18);
    }
  }

  // Render shape text
  if (
    ['rect', 'circle', 'diamond', 'triangle'].includes(stroke.tool) &&
    stroke.text
  ) {
    const cx = (stroke.start.x + stroke.end.x) / 2;
    const cy = (stroke.start.y + stroke.end.y) / 2;
    ctx.fillStyle = '#1e293b';
    ctx.font = '12px Inter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const lines = stroke.text.split('\n');
    const lineHeight = 16;
    const startY = cy - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, index) => {
      ctx.fillText(line, cx, startY + index * lineHeight);
    });
  }

  // Restore properties
  ctx.restore();
}

function drawCanvasText(context, text, x, y, maxWidth, lineHeight) {
  let currentY = y;
  const paragraphs = String(text || '').split('\n');

  paragraphs.forEach((paragraph) => {
    const words = paragraph.split(' ').filter((w) => w.length > 0);
    if (words.length === 0) {
      currentY += lineHeight;
      return;
    }
    let line = '';
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (line && context.measureText(candidate).width > maxWidth) {
        context.fillText(line, x, currentY);
        currentY += lineHeight;
        line = word;
      } else {
        line = candidate;
      }
    });
    if (line) {
      context.fillText(line, x, currentY);
      currentY += lineHeight;
    }
  });
}

function convertHexToRGBA(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// -------------------------------------------------------------
// Interactive Sticky Notes System
// -------------------------------------------------------------
function createStickyNote(
  x,
  y,
  color = currentColor,
  text = '',
  isUndoRedo = false,
  customId = null
) {
  const noteId =
    customId || 'note-' + Date.now() + Math.floor(Math.random() * 1000);

  const note = document.createElement('div');
  note.id = noteId;
  note.className = 'sticky-note';
  note.style.left = `${x}px`;
  note.style.top = `${y}px`;

  // Set default theme class
  if (color === '#2563eb') note.classList.add('note-blue');
  else if (color === '#16a34a') note.classList.add('note-green');
  else if (color === '#dc2626') note.classList.add('note-red');

  // Create role badge
  const badge = document.createElement('div');
  badge.id = `badge-${noteId}`;
  badge.className = 'sticky-note-badge';
  badge.innerText = '[Generelt] 1d';

  const textarea = document.createElement('textarea');
  textarea.placeholder = 'Double click to write...';
  textarea.value = text;

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'note-delete';
  deleteBtn.innerHTML = '✕';
  deleteBtn.title = 'Delete note';

  deleteBtn.onclick = () => {
    deleteStickyNote(noteId);
  };

  note.appendChild(badge);
  note.appendChild(deleteBtn);
  note.appendChild(textarea);
  const details = document.createElement('div');
  details.id = `details-${noteId}`;
  details.className = 'sticky-note-details';
  note.appendChild(details);
  viewport.appendChild(note);

  // Save note object to database
  const noteState = {
    id: noteId,
    element: note,
    x: x,
    y: y,
    lane: 'Generelt',
    duration: 1,
    plannedHours: 0,
    plannedCost: 0,
    actualHours: 0,
    actualCost: 0,
    progress: 0,
    resource: '',
    riskFactor: 1,
    impactFactor: 1,
    weightedFactor: 1,
    color: color,
  };
  stickyNotes.push(noteState);
  updateNoteDetails(noteState);

  // Context Menu trigger
  note.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showContextMenu(e, noteId);
  });

  // Track text updates
  textarea.addEventListener('input', () => {
    noteState.text = textarea.value;
    if (typeof activeView !== 'undefined') {
      if (activeView === 'swimlane') renderSwimlaneView();
      if (activeView === 'risk') renderRiskMatrixView();
      if (activeView === 'gantt') refreshGanttSchedule();
    }
    autoSaveCurrentState();
  });

  // Dragging & connection events. Pointer events keep mouse, touch, and pen
  // input on the same path and pointer capture prevents lost drags at edges.
  let isDraggingNote = false;
  let offset = { x: 0, y: 0 };

  note.addEventListener('pointerdown', (e) => {
    if (e.target === textarea || e.target === deleteBtn || e.button === 2) {
      return;
    }

    e.preventDefault();

    // Shift key active -> Draw dependency arrow
    if (shiftKeyPressed || e.shiftKey) {
      connectingStartNote = noteState;
      const rect = canvas.getBoundingClientRect();
      tempArrowTarget = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      note.setPointerCapture(e.pointerId);
      drawAll();
      return;
    }

    if (currentTool === 'select') {
      isDraggingNote = true;
      const rect = note.getBoundingClientRect();
      offset.x = e.clientX - rect.left;
      offset.y = e.clientY - rect.top;
      note.style.zIndex = 1000;
      note.setPointerCapture(e.pointerId);
    }
  });

  note.addEventListener('pointermove', (e) => {
    if (isDraggingNote) {
      const viewportRect = viewport.getBoundingClientRect();
      const noteWidth = note.offsetWidth || 160;
      const noteHeight = note.offsetHeight || 110;
      let left = e.clientX - viewportRect.left - offset.x;
      let top = e.clientY - viewportRect.top - offset.y;

      left = Math.max(0, Math.min(left, viewportRect.width - noteWidth));
      top = Math.max(0, Math.min(top, viewportRect.height - noteHeight));

      note.style.left = `${left}px`;
      note.style.top = `${top}px`;
      noteState.x = left;
      noteState.y = top;
      drawAll();
    } else if (connectingStartNote && connectingStartNote.id === noteId) {
      const rect = canvas.getBoundingClientRect();
      tempArrowTarget = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      drawAll();
    }
  });

  const finishNotePointer = (e) => {
    if (isDraggingNote) {
      isDraggingNote = false;
      note.style.zIndex = 100;
      updateSidebarSwimlanes();
      if (typeof activeView !== 'undefined' && activeView === 'swimlane') {
        renderSwimlaneView();
      }
      refreshGanttSchedule();
      autoSaveCurrentState();
    }

    if (connectingStartNote && connectingStartNote.id === noteId) {
      const elem = document.elementFromPoint(e.clientX, e.clientY);
      const targetNoteElem = elem ? elem.closest('.sticky-note') : null;

      if (targetNoteElem && targetNoteElem.id !== noteId) {
        const targetId = targetNoteElem.id;
        const exists = dependencies.some(
          (d) => d.from === noteId && d.to === targetId
        );
        if (!exists) {
          const newDep = { from: noteId, to: targetId };
          dependencies.push(newDep);
          pushAction({ type: 'add-dep', dep: newDep });
          announceA11y('Tasks linked.');
          updateSidebarSwimlanes();
          if (typeof activeView !== 'undefined' && activeView === 'swimlane') {
            renderSwimlaneView();
          }
          refreshGanttSchedule();
          autoSaveCurrentState();
        }
      }

      connectingStartNote = null;
      tempArrowTarget = null;
      drawAll();
    }

    if (note.hasPointerCapture(e.pointerId)) {
      note.releasePointerCapture(e.pointerId);
    }
  };

  note.addEventListener('pointerup', finishNotePointer);
  note.addEventListener('pointercancel', finishNotePointer);

  if (!isUndoRedo) {
    pushAction({ type: 'add-note', noteState: noteState });
  }

  updateSidebarSwimlanes();
  if (typeof activeView !== 'undefined' && activeView === 'swimlane') {
    renderSwimlaneView();
  }
  refreshGanttSchedule();
  autoSaveCurrentState();

  announceA11y('Sticky note added.');
  if (typeof activeView !== 'undefined' && activeView === 'risk') {
    renderRiskMatrixView();
  }
}

function deleteStickyNote(noteId, isUndoRedo = false) {
  const index = stickyNotes.findIndex((n) => n.id === noteId);
  if (index !== -1) {
    const note = stickyNotes[index];
    note.element.remove();
    stickyNotes.splice(index, 1);

    // Remember dependencies for undoing
    const oldDeps = dependencies.filter(
      (d) => d.from === noteId || d.to === noteId
    );

    // Remove associated arrows/dependencies
    dependencies = dependencies.filter(
      (d) => d.from !== noteId && d.to !== noteId
    );

    if (!isUndoRedo) {
      const textarea = note.element.querySelector('textarea');
      const textVal = textarea ? textarea.value : '';
      pushAction({
        type: 'delete-note',
        noteState: { ...note, text: textVal },
        oldDependencies: oldDeps,
      });
    }

    drawAll();
    updateSidebarSwimlanes();
    if (typeof activeView !== 'undefined' && activeView === 'swimlane') {
      renderSwimlaneView();
    }
    if (typeof activeView !== 'undefined' && activeView === 'risk') {
      renderRiskMatrixView();
    }
    refreshGanttSchedule();
    autoSaveCurrentState();
    announceA11y('Sticky note deleted.');
  }
}

// Hook up brainstorm text input
const brainstormInput = document.getElementById('brainstorm-input');
if (brainstormInput) {
  brainstormInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const text = brainstormInput.value.trim();
      if (text) {
        const rect = viewport.getBoundingClientRect();
        const x = rect.width / 2 - 80 + (Math.random() * 60 - 30);
        const y = rect.height / 2 - 50 + (Math.random() * 60 - 30);
        createStickyNote(x, y, currentColor, text);
        brainstormInput.value = '';

        // Auto-switch to select tool for immediate dragging/interaction
        const selectToolBtn = document.getElementById('tool-select');
        if (selectToolBtn) selectToolBtn.click();
      }
    }
  });
}

// Hover tooltip on canvas shapes
const canvasTooltip = document.getElementById('canvas-tooltip');
canvas.addEventListener('mousemove', (e) => {
  if (isDrawing || currentTool !== 'select') {
    if (canvasTooltip) canvasTooltip.style.display = 'none';
    return;
  }

  const coords = getCoords(e);
  let hoveredShape = null;

  // Find topmost hovered shape
  for (let i = strokes.length - 1; i >= 0; i--) {
    const stroke = strokes[i];
    if (
      ['rect', 'circle', 'diamond', 'triangle', 'text-box'].includes(
        stroke.tool
      )
    ) {
      const xMin = Math.min(stroke.start.x, stroke.end.x);
      const xMax = Math.max(stroke.start.x, stroke.end.x);
      const yMin = Math.min(stroke.start.y, stroke.end.y);
      const yMax = Math.max(stroke.start.y, stroke.end.y);

      if (
        coords.x >= xMin &&
        coords.x <= xMax &&
        coords.y >= yMin &&
        coords.y <= yMax
      ) {
        hoveredShape = stroke;
        break;
      }
    }
  }

  if (hoveredShape) {
    canvas.style.cursor = 'pointer';
    if (canvasTooltip) {
      canvasTooltip.innerText = hoveredShape.text
        ? 'Double click to edit text'
        : 'Double click to insert text';
      canvasTooltip.style.display = 'block';
      canvasTooltip.style.left = `${e.clientX + 12}px`;
      canvasTooltip.style.top = `${e.clientY + 12}px`;
    }
  } else {
    canvas.style.cursor = 'default';
    if (canvasTooltip) {
      canvasTooltip.style.display = 'none';
    }
  }
});

canvas.addEventListener('mouseleave', () => {
  if (canvasTooltip) canvasTooltip.style.display = 'none';
  canvas.style.cursor = 'default';
});

// -------------------------------------------------------------
// Canvas Interactive Events (Pointer Events for Touch/Mouse/Pen)
// -------------------------------------------------------------
canvas.addEventListener('pointerdown', (e) => {
  if (currentTool === 'select') return;

  isDrawing = true;
  canvas.setPointerCapture(e.pointerId);
  const coords = getCoords(e);
  startPoint = coords;

  if (
    currentTool === 'pen' ||
    currentTool === 'highlighter' ||
    currentTool === 'eraser'
  ) {
    currentStroke = {
      tool: currentTool,
      points: [coords],
      color: currentColor,
      width: currentStrokeWidth,
    };
  } else if (
    [
      'line',
      'rect',
      'circle',
      'arrow',
      'diamond',
      'triangle',
      'area-eraser',
      'text-box',
    ].includes(currentTool)
  ) {
    currentStroke = {
      tool: currentTool,
      start: coords,
      end: coords,
      color: currentColor,
      width: currentStrokeWidth,
      text: '',
    };
  } else if (currentTool === 'sticky') {
    createStickyNote(coords.x, coords.y);
    isDrawing = false;
    canvas.releasePointerCapture(e.pointerId);
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (!isDrawing || !currentStroke) return;
  const coords = getCoords(e);

  if (['pen', 'highlighter', 'eraser'].includes(currentTool)) {
    currentStroke.points.push(coords);
  } else if (
    [
      'line',
      'rect',
      'circle',
      'arrow',
      'diamond',
      'triangle',
      'area-eraser',
      'text-box',
    ].includes(currentTool)
  ) {
    currentStroke.end = coords;
  }

  drawAll();
});

canvas.addEventListener('pointerup', (e) => {
  if (!isDrawing) return;
  isDrawing = false;
  canvas.releasePointerCapture(e.pointerId);

  if (currentStroke) {
    if (currentStroke.tool === 'area-eraser') {
      executeAreaErase(currentStroke.start, currentStroke.end);
      currentStroke = null;
    } else if (currentStroke.tool === 'text-box') {
      let x = Math.min(currentStroke.start.x, currentStroke.end.x);
      let y = Math.min(currentStroke.start.y, currentStroke.end.y);
      let width = Math.abs(currentStroke.start.x - currentStroke.end.x);
      let height = Math.abs(currentStroke.start.y - currentStroke.end.y);

      // If clicked without dragging or dragged tiny box, set comfortable default dimensions
      if (width < 16 || height < 16) {
        width = 180;
        height = 70;
        currentStroke.start = { x, y };
        currentStroke.end = { x: x + width, y: y + height };
      }

      const strokeToEdit = currentStroke;
      currentStroke = null;
      openTextBoxEditor(strokeToEdit, x, y, width, height, true);
    } else {
      strokes.push(currentStroke);
      pushAction({ type: 'draw', stroke: currentStroke });
      currentStroke = null;
    }
  }

  drawAll();
  announceA11y(`Added drawing segment: ${currentTool}`);
});

canvas.addEventListener('pointercancel', (e) => {
  isDrawing = false;
  currentStroke = null;
  drawAll();
});

// -------------------------------------------------------------
// Navigation / Mode Selectors
// -------------------------------------------------------------
document.querySelectorAll('.tool-btn').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    document
      .querySelectorAll('.tool-btn')
      .forEach((b) => b.classList.remove('active'));

    // Handle path matching if clicked on child SVG
    const target = e.target.closest('.tool-btn');
    target.classList.add('active');

    currentTool = target.id.replace('tool-', '');
    announceA11y(`Tool switched to ${currentTool}`);
  });
});

// Color Selection
document.querySelectorAll('.color-btn').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    document
      .querySelectorAll('.color-btn')
      .forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentColor = btn.getAttribute('data-color');
    strokeWidthInput.style.accentColor = currentColor;
    strokeValueSpan.style.color = currentColor;
  });
});

// Stroke slider adjustments
strokeWidthInput.addEventListener('input', (e) => {
  currentStrokeWidth = parseInt(e.target.value);
  strokeValueSpan.innerText = `${currentStrokeWidth}px`;
});

// Templates Selectors
document.querySelectorAll('.template-btn').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    document
      .querySelectorAll('.template-btn')
      .forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    activeTemplate = btn.id.replace('tpl-', '');
    if (tempNameSpan) tempNameSpan.innerText = btn.innerText;

    drawAll();
    announceA11y(`Active layout grid swapped to ${btn.innerText}`);
  });
});

// Utility Toggles
gridToggleBtn.addEventListener('click', () => {
  showGrid = !showGrid;
  gridToggleBtn.classList.toggle('active', showGrid);
  drawAll();
  announceA11y(`Gridlines toggled ${showGrid ? 'on' : 'off'}`);
});

function clearEntireCanvas(isUndoRedo = false) {
  if (!isUndoRedo) {
    const hasContent =
      strokes.length > 0 ||
      stickyNotes.length > 0 ||
      dependencies.length > 0 ||
      activeTemplate !== 'blank';
    if (hasContent) {
      pushAction({
        type: 'clear-all',
        snapshot: getBoardStateSnapshot(),
      });
    }
  }

  // 1. Clear drawings
  strokes = [];
  currentStroke = null;
  isDrawing = false;

  // 2. Remove all sticky notes from DOM & memory
  document.querySelectorAll('.sticky-note').forEach((n) => n.remove());
  stickyNotes = [];
  dependencies = [];
  connectingStartNote = null;
  tempArrowTarget = null;
  contextMenuTargetNoteId = null;
  hideContextMenu();

  // 3. Remove any active shape text edit overlays
  document
    .querySelectorAll('#canvas-viewport > textarea')
    .forEach((ta) => ta.remove());

  // 4. Reset layout template back to clean Blank Grid
  activeTemplate = 'blank';
  if (tempNameSpan) tempNameSpan.innerText = 'Blank Grid';
  document
    .querySelectorAll('.template-btn')
    .forEach((b) => b.classList.remove('active'));
  const tplBlank = document.getElementById('tpl-blank');
  if (tplBlank) tplBlank.classList.add('active');

  // 5. Reset project metadata & calculations
  if (projectNameInput) projectNameInput.value = '';
  organizedLayoutProposal = null;
  computedScheduleData = [];

  // 6. Reset local storage autosave & active project pointer
  try {
    localStorage.removeItem('whiteboard-autosave');
    localStorage.removeItem('whiteboard-last-project');
  } catch (e) {
    // Ignore localStorage errors
  }

  // 7. Redraw canvas
  drawAll(); // 8. Refresh all analytical views (Swimlanes, Gantt, Risk Matrix, EVM)
  updateSidebarSwimlanes();
  renderSwimlaneView();
  renderRiskMatrixView();
  refreshGanttSchedule();

  // 9. Switch view back to main canvas board
  switchView('canvas');

  // 10. Screen reader announcement
  announceA11y('Whiteboard canvas cleared.');
}

if (clearBtn) {
  clearBtn.addEventListener('click', (e) => {
    e.preventDefault();
    clearEntireCanvas();
  });
}

// -------------------------------------------------------------
// Undo / Redo History System
// -------------------------------------------------------------
function pushAction(action) {
  historyStack.push(action);
  if (historyStack.length > 50) {
    historyStack.shift();
  }
  redoStack = []; // Clear redo stack on new action
  autoSaveCurrentState();
}

function executeUndo() {
  if (historyStack.length > 0) {
    const action = historyStack.pop();
    redoStack.push(action);

    if (action.type === 'draw') {
      strokes.pop();
    } else if (action.type === 'add-note') {
      deleteStickyNote(action.noteState.id, true);
    } else if (action.type === 'delete-note') {
      const state = action.noteState;
      createStickyNote(
        state.x,
        state.y,
        state.color,
        state.text,
        true,
        state.id
      );
      const newNote = stickyNotes[stickyNotes.length - 1];
      newNote.lane = state.lane;
      newNote.duration = state.duration;
      newNote.plannedHours = state.plannedHours || 0;
      newNote.plannedCost = state.plannedCost || 0;
      newNote.actualHours = Math.max(0, Number(state.actualHours) || 0);
      newNote.actualCost = Math.max(0, Number(state.actualCost) || 0);
      newNote.progress = Math.min(
        100,
        Math.max(0, Number(state.progress) || 0)
      );
      newNote.resource = state.resource || '';
      newNote.riskFactor = state.riskFactor || 1;
      newNote.impactFactor = state.impactFactor || 1;
      newNote.weightedFactor = newNote.riskFactor * newNote.impactFactor;
      updateNoteBadge(newNote);
      updateNoteDetails(newNote);

      // Restore dependencies
      action.oldDependencies.forEach((dep) => dependencies.push(dep));
    } else if (action.type === 'add-dep') {
      dependencies.pop();
    } else if (action.type === 'edit-shape-text') {
      strokes[action.strokeIndex].text = action.oldText;
    } else if (action.type === 'area-erase') {
      // Restore strokes
      strokes.push(...action.erasedStrokes);

      // Restore notes
      action.erasedNotes.forEach((state) => {
        createStickyNote(
          state.x,
          state.y,
          state.color,
          state.text,
          true,
          state.id
        );
        const newNote = stickyNotes[stickyNotes.length - 1];
        newNote.lane = state.lane;
        newNote.duration = state.duration;
        newNote.plannedHours = state.plannedHours || 0;
        newNote.plannedCost = state.plannedCost || 0;
        newNote.actualHours = Math.max(0, Number(state.actualHours) || 0);
        newNote.actualCost = Math.max(0, Number(state.actualCost) || 0);
        newNote.progress = Math.min(
          100,
          Math.max(0, Number(state.progress) || 0)
        );
        newNote.resource = state.resource || '';
        newNote.riskFactor = state.riskFactor || 1;
        newNote.impactFactor = state.impactFactor || 1;
        newNote.weightedFactor = newNote.riskFactor * newNote.impactFactor;
        updateNoteBadge(newNote);
        updateNoteDetails(newNote);
      });

      // Restore dependencies
      action.oldDependencies.forEach((dep) => dependencies.push(dep));
    } else if (action.type === 'edit-properties') {
      const noteState = stickyNotes.find((n) => n.id === action.noteId);
      if (noteState) {
        Object.assign(noteState, action.oldState);
        updateNoteBadge(noteState);
        updateNoteDetails(noteState);
      }
    } else if (action.type === 'edit-predecessors') {
      dependencies = dependencies.filter(
        (dependency) => dependency.to !== action.noteId
      );
      dependencies.push(...action.oldDependencies);
    } else if (action.type === 'edit-actuals') {
      const noteState = stickyNotes.find((n) => n.id === action.noteId);
      if (noteState) Object.assign(noteState, action.oldState);
    } else if (action.type === 'clear-all') {
      applyBoardState(action.snapshot, '', true);
    }

    drawAll();
    updateSidebarSwimlanes();
    if (typeof activeView !== 'undefined' && activeView === 'swimlane') {
      renderSwimlaneView();
    }
    refreshGanttSchedule();
    autoSaveCurrentState();
    announceA11y('Last action undone.');
  }
}

function executeRedo() {
  if (redoStack.length > 0) {
    const action = redoStack.pop();
    historyStack.push(action);

    if (action.type === 'draw') {
      strokes.push(action.stroke);
    } else if (action.type === 'add-note') {
      const state = action.noteState;
      createStickyNote(
        state.x,
        state.y,
        state.color,
        state.text,
        true,
        state.id
      );
      const newNote = stickyNotes[stickyNotes.length - 1];
      newNote.lane = state.lane;
      newNote.duration = state.duration;
      newNote.plannedHours = state.plannedHours || 0;
      newNote.plannedCost = state.plannedCost || 0;
      newNote.actualHours = Math.max(0, Number(state.actualHours) || 0);
      newNote.actualCost = Math.max(0, Number(state.actualCost) || 0);
      newNote.progress = Math.min(
        100,
        Math.max(0, Number(state.progress) || 0)
      );
      newNote.resource = state.resource || '';
      newNote.riskFactor = state.riskFactor || 1;
      newNote.impactFactor = state.impactFactor || 1;
      newNote.weightedFactor = newNote.riskFactor * newNote.impactFactor;
      updateNoteBadge(newNote);
      updateNoteDetails(newNote);
    } else if (action.type === 'delete-note') {
      deleteStickyNote(action.noteState.id, true);
    } else if (action.type === 'add-dep') {
      dependencies.push(action.dep);
    } else if (action.type === 'edit-shape-text') {
      strokes[action.strokeIndex].text = action.newText;
    } else if (action.type === 'area-erase') {
      // Re-erase strokes
      const erasedRefs = action.erasedStrokes;
      strokes = strokes.filter((s) => !erasedRefs.includes(s));

      // Re-erase notes
      const idsToDelete = action.erasedNotes.map((n) => n.id);
      stickyNotes.forEach((note) => {
        if (idsToDelete.includes(note.id)) {
          note.element?.remove();
        }
      });
      stickyNotes = stickyNotes.filter(
        (note) => !idsToDelete.includes(note.id)
      );

      // Filter out dependencies
      dependencies = dependencies.filter(
        (d) => !idsToDelete.includes(d.from) && !idsToDelete.includes(d.to)
      );
    } else if (action.type === 'edit-properties') {
      const noteState = stickyNotes.find((n) => n.id === action.noteId);
      if (noteState) {
        Object.assign(noteState, action.newState);
        updateNoteBadge(noteState);
        updateNoteDetails(noteState);
      }
    } else if (action.type === 'edit-predecessors') {
      dependencies = dependencies.filter(
        (dependency) => dependency.to !== action.noteId
      );
      dependencies.push(...action.newDependencies);
    } else if (action.type === 'edit-actuals') {
      const noteState = stickyNotes.find((n) => n.id === action.noteId);
      if (noteState) Object.assign(noteState, action.newState);
    } else if (action.type === 'clear-all') {
      clearEntireCanvas(true);
    }

    drawAll();
    updateSidebarSwimlanes();
    if (typeof activeView !== 'undefined' && activeView === 'swimlane') {
      renderSwimlaneView();
    }
    refreshGanttSchedule();
    autoSaveCurrentState();
    announceA11y('Action redone.');
  }
}

undoBtn.addEventListener('click', executeUndo);
redoBtn.addEventListener('click', executeRedo);

const sidebarUndoBtn = document.getElementById('sidebar-undo');
const sidebarRedoBtn = document.getElementById('sidebar-redo');
if (sidebarUndoBtn) sidebarUndoBtn.addEventListener('click', executeUndo);
if (sidebarRedoBtn) sidebarRedoBtn.addEventListener('click', executeRedo);

function sanitizeFileName(name) {
  return (
    String(name || 'untitled-project')
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, ' ')
      .slice(0, 80) || 'untitled-project'
  );
}

function getCurrentProjectName() {
  return (projectNameInput?.value || '').trim() || 'Untitled Project';
}

function getBoardStateSnapshot() {
  return {
    projectName: getCurrentProjectName(),
    savedAt: new Date().toISOString(),
    activeTemplate,
    showGrid,
    ganttStartDate: ganttStartDateInput?.value || todayDate,
    ganttStatusDate: ganttStatusDateInput?.value || todayDate,
    trianglePriorities: { ...trianglePriorities },
    strokes: strokes.map((stroke) => ({
      ...stroke,
      points: stroke.points ? [...stroke.points] : undefined,
    })),
    stickyNotes: stickyNotes.map((note) => ({
      id: note.id,
      x: note.x,
      y: note.y,
      lane: note.lane,
      duration: note.duration,
      plannedHours: note.plannedHours,
      plannedCost: note.plannedCost,
      actualHours: note.actualHours,
      actualCost: note.actualCost,
      progress: note.progress,
      resource: note.resource,
      riskFactor: note.riskFactor,
      impactFactor: note.impactFactor,
      weightedFactor: note.weightedFactor,
      color: note.color,
      text: note.element?.querySelector('textarea')?.value || '',
    })),
    dependencies: dependencies.map((dep) => ({ ...dep })),
  };
}

function saveBoard(event) {
  event?.preventDefault();
  event?.stopPropagation();
  try {
    const boardState = getBoardStateSnapshot();
    const projectName = boardState.projectName;
    const savedProjects = JSON.parse(
      localStorage.getItem(BOARD_STORAGE_KEY) || '[]'
    );
    const existingIndex = savedProjects.findIndex(
      (entry) => entry.projectName.toLowerCase() === projectName.toLowerCase()
    );

    if (existingIndex >= 0) {
      savedProjects[existingIndex] = boardState;
    } else {
      savedProjects.push(boardState);
    }

    localStorage.setItem(BOARD_STORAGE_KEY, JSON.stringify(savedProjects));
    localStorage.setItem('whiteboard-last-project', projectName);
    localStorage.setItem('whiteboard-autosave', JSON.stringify(boardState));

    const blob = new Blob([JSON.stringify(boardState, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${sanitizeFileName(projectName)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);

    projectNameInput.value = projectName;
    drawAll();
    announceA11y(`Saved project ${projectName}.`);
  } catch (error) {
    console.error('Board save failed:', error);
    announceA11y('Unable to save the board right now.');
  }
}

function autoSaveCurrentState() {
  try {
    const boardState = getBoardStateSnapshot();
    localStorage.setItem('whiteboard-autosave', JSON.stringify(boardState));
  } catch (e) {
    // Ignore storage quota or disabled localStorage errors gracefully
  }
}

const DEFAULT_DEMO_PROJECT = {
  projectName: 'New Garden Shed',
  savedAt: '2026-08-22T12:00:00.000Z',
  activeTemplate: 'swimlane',
  showGrid: true,
  ganttStartDate: '2026-08-21',
  ganttStatusDate: '2026-08-25',
  strokes: [],
  stickyNotes: [
    {
      id: 'note-1787392857235476',
      x: 741,
      y: 199,
      lane: 'Clear Garden',
      duration: 2,
      plannedHours: 0,
      plannedCost: 1000,
      actualHours: 0,
      actualCost: 0,
      progress: 0,
      resource: '',
      riskFactor: 2,
      impactFactor: 2,
      weightedFactor: 4,
      color: '#1e293b',
      text: 'Demolish old shed',
    },
    {
      id: 'note-1787409624495393',
      x: 326,
      y: 199,
      lane: 'Clear Garden',
      duration: 1,
      plannedHours: 0,
      plannedCost: 500,
      actualHours: 0,
      actualCost: 0,
      progress: 0,
      resource: '',
      riskFactor: 1,
      impactFactor: 1,
      weightedFactor: 1,
      color: '#1e293b',
      text: 'Cut foliage back',
    },
    {
      id: 'note-1787409657557475',
      x: 523,
      y: 200,
      lane: 'Clear Garden',
      duration: 1,
      plannedHours: 0,
      plannedCost: 4000,
      actualHours: 0,
      actualCost: 0,
      progress: 0,
      resource: '',
      riskFactor: 3,
      impactFactor: 4,
      weightedFactor: 12,
      color: '#1e293b',
      text: 'Tre surgeon',
    },
    {
      id: 'note-1787409812988983',
      x: 688,
      y: 19,
      lane: 'Foundations',
      duration: 2,
      plannedHours: 0,
      plannedCost: 1500,
      actualHours: 0,
      actualCost: 0,
      progress: 0,
      resource: '',
      riskFactor: 2,
      impactFactor: 2,
      weightedFactor: 4,
      color: '#1e293b',
      text: 'Dig Trench',
    },
    {
      id: 'note-1787409859830839',
      x: 474,
      y: 19,
      lane: 'Foundations',
      duration: 1,
      plannedHours: 0,
      plannedCost: 2000,
      actualHours: 0,
      actualCost: 0,
      progress: 0,
      resource: '',
      riskFactor: 2,
      impactFactor: 3,
      weightedFactor: 6,
      color: '#1e293b',
      text: 'Hire digger',
    },
    {
      id: 'note-1787409912789142',
      x: 881,
      y: 20,
      lane: 'Foundations',
      duration: 1,
      plannedHours: 0,
      plannedCost: 3500,
      actualHours: 0,
      actualCost: 0,
      progress: 0,
      resource: '',
      riskFactor: 2,
      impactFactor: 3,
      weightedFactor: 6,
      color: '#1e293b',
      text: 'Fill with concrete',
    },
    {
      id: 'note-1787409977135858',
      x: 1080,
      y: 18,
      lane: 'Foundations',
      duration: 1,
      plannedHours: 0,
      plannedCost: 1000,
      actualHours: 0,
      actualCost: 0,
      progress: 0,
      resource: '',
      riskFactor: 1,
      impactFactor: 2,
      weightedFactor: 2,
      color: '#1e293b',
      text: 'Level the Base',
    },
    {
      id: 'note-1787410009126188',
      x: 593,
      y: 379,
      lane: 'Buy Shed',
      duration: 2,
      plannedHours: 0,
      plannedCost: 0,
      actualHours: 0,
      actualCost: 0,
      progress: 0,
      resource: '',
      riskFactor: 1,
      impactFactor: 1,
      weightedFactor: 1,
      color: '#1e293b',
      text: 'Find suppliers',
    },
    {
      id: 'note-1787410129700943',
      x: 780,
      y: 379,
      lane: 'Buy Shed',
      duration: 3,
      plannedHours: 0,
      plannedCost: 0,
      actualHours: 0,
      actualCost: 0,
      progress: 0,
      resource: '',
      riskFactor: 2,
      impactFactor: 2,
      weightedFactor: 4,
      color: '#1e293b',
      text: 'Get quotes',
    },
    {
      id: 'note-1787410348967454',
      x: 1065,
      y: 375,
      lane: 'Buy Shed',
      duration: 7,
      plannedHours: 0,
      plannedCost: 15000,
      actualHours: 0,
      actualCost: 0,
      progress: 0,
      resource: '',
      riskFactor: 3,
      impactFactor: 4,
      weightedFactor: 12,
      color: '#eab308',
      text: 'Delveriy time',
    },
    {
      id: 'note-1787410428873848',
      x: 55,
      y: 541,
      lane: 'Legal',
      duration: 2,
      plannedHours: 0,
      plannedCost: 0,
      actualHours: 0,
      actualCost: 0,
      progress: 0,
      resource: '',
      riskFactor: 1,
      impactFactor: 2,
      weightedFactor: 2,
      color: '#eab308',
      text: 'Check finance',
    },
    {
      id: 'note-1787410533685536',
      x: 254,
      y: 539,
      lane: 'Legal',
      duration: 3,
      plannedHours: 0,
      plannedCost: 500,
      actualHours: 0,
      actualCost: 0,
      progress: 0,
      resource: '',
      riskFactor: 2,
      impactFactor: 3,
      weightedFactor: 6,
      color: '#eab308',
      text: 'Check need for permission',
    },
    {
      id: 'note-1787410585384356',
      x: 425,
      y: 540,
      lane: 'Legal',
      duration: 14,
      plannedHours: 0,
      plannedCost: 2500,
      actualHours: 0,
      actualCost: 0,
      progress: 0,
      resource: '',
      riskFactor: 4,
      impactFactor: 4,
      weightedFactor: 16,
      color: '#eab308',
      text: 'Apply and wait for permission',
    },
    {
      id: 'note-1787411061625206',
      x: 1262,
      y: 50,
      lane: 'Install Shed',
      duration: 2,
      plannedHours: 0,
      plannedCost: 2500,
      actualHours: 0,
      actualCost: 0,
      progress: 0,
      resource: '',
      riskFactor: 2,
      impactFactor: 3,
      weightedFactor: 6,
      color: '#1e293b',
      text: 'Wire down the garden',
    },
    {
      id: 'note-1787411290875942',
      x: 1241,
      y: 373,
      lane: 'Buy Shed',
      duration: 2,
      plannedHours: 0,
      plannedCost: 3000,
      actualHours: 0,
      actualCost: 0,
      progress: 0,
      resource: '',
      riskFactor: 3,
      impactFactor: 3,
      weightedFactor: 9,
      color: '#eab308',
      text: 'Asembly shed',
    },
    {
      id: 'note-1787411381374339',
      x: 1338,
      y: 615,
      lane: 'Install Shed',
      duration: 2,
      plannedHours: 0,
      plannedCost: 1200,
      actualHours: 0,
      actualCost: 0,
      progress: 0,
      resource: '',
      riskFactor: 1,
      impactFactor: 2,
      weightedFactor: 2,
      color: '#eab308',
      text: 'Painting outside',
    },
    {
      id: 'note-1787411464214500',
      x: 1533,
      y: 650,
      lane: 'Install Shed',
      duration: 1,
      plannedHours: 0,
      plannedCost: 800,
      actualHours: 0,
      actualCost: 0,
      progress: 0,
      resource: '',
      riskFactor: 1,
      impactFactor: 1,
      weightedFactor: 1,
      color: '#eab308',
      text: 'Painting inside',
    },
    {
      id: 'note-1787411541723163',
      x: 1393,
      y: 220,
      lane: 'Install Shed',
      duration: 1,
      plannedHours: 0,
      plannedCost: 1500,
      actualHours: 0,
      actualCost: 0,
      progress: 0,
      resource: '',
      riskFactor: 2,
      impactFactor: 2,
      weightedFactor: 4,
      color: '#eab308',
      text: 'Put in light',
    },
    {
      id: 'note-1787411639376273',
      x: 1597,
      y: 406,
      lane: 'Install Shed',
      duration: 1,
      plannedHours: 0,
      plannedCost: 3000,
      actualHours: 0,
      actualCost: 0,
      progress: 0,
      resource: '',
      riskFactor: 1,
      impactFactor: 2,
      weightedFactor: 2,
      color: '#eab308',
      text: 'Put in furniture',
    },
    {
      id: 'note-178741173114854',
      x: 1599,
      y: 196,
      lane: 'Install Shed',
      duration: 1,
      plannedHours: 0,
      plannedCost: 5000,
      actualHours: 0,
      actualCost: 0,
      progress: 0,
      resource: '',
      riskFactor: 1,
      impactFactor: 2,
      weightedFactor: 2,
      color: '#eab308',
      text: 'Set up up PC/Music',
    },
  ],
  dependencies: [
    {
      from: 'note-1787410428873848',
      to: 'note-1787410009126188',
    },
    {
      from: 'note-1787410533685536',
      to: 'note-1787410585384356',
    },
    {
      from: 'note-1787410009126188',
      to: 'note-1787410129700943',
    },
    {
      from: 'note-1787410129700943',
      to: 'note-1787410348967454',
    },
    {
      from: 'note-1787410585384356',
      to: 'note-1787410348967454',
    },
    {
      from: 'note-1787392857235476',
      to: 'note-1787409624495393',
    },
    {
      from: 'note-1787409624495393',
      to: 'note-1787409657557475',
    },
    {
      from: 'note-1787409657557475',
      to: 'note-1787409859830839',
    },
    {
      from: 'note-1787409859830839',
      to: 'note-1787409812988983',
    },
    {
      from: 'note-1787409812988983',
      to: 'note-1787409912789142',
    },
    {
      from: 'note-1787409912789142',
      to: 'note-1787409977135858',
    },
    {
      from: 'note-1787409977135858',
      to: 'note-1787411290875942',
    },
    {
      from: 'note-1787410348967454',
      to: 'note-1787411290875942',
    },
    {
      from: 'note-1787411290875942',
      to: 'note-1787411061625206',
    },
    {
      from: 'note-1787411290875942',
      to: 'note-1787411381374339',
    },
    {
      from: 'note-1787411381374339',
      to: 'note-1787411464214500',
    },
    {
      from: 'note-1787411061625206',
      to: 'note-1787411541723163',
    },
    {
      from: 'note-1787411464214500',
      to: 'note-1787411639376273',
    },
    {
      from: 'note-1787411541723163',
      to: 'note-178741173114854',
    },
    {
      from: 'note-1787411639376273',
      to: 'note-178741173114854',
    },
  ],
};

async function loadDemoProject() {
  try {
    const res = await fetch('./samples/New Garden Shed - Full Board.json');
    if (res.ok) {
      const data = await res.json();
      applyBoardState(data, 'New Garden Shed.json');
      announceA11y('Loaded demo Garden Shed project.');
      return;
    }
  } catch (e) {}
  applyBoardState(DEFAULT_DEMO_PROJECT, 'New Garden Shed.json');
  announceA11y('Loaded demo Garden Shed project.');
}
window.loadDemoProject = loadDemoProject;

function loadInitialBoardState() {
  try {
    const autosave = localStorage.getItem('whiteboard-autosave');
    if (autosave) {
      const boardState = JSON.parse(autosave);
      if (
        boardState &&
        typeof boardState === 'object' &&
        Array.isArray(boardState.stickyNotes) &&
        boardState.stickyNotes.length > 0
      ) {
        applyBoardState(boardState);
        return;
      }
    }
    const savedProjects = JSON.parse(
      localStorage.getItem(BOARD_STORAGE_KEY) || '[]'
    );
    if (savedProjects.length > 0) {
      const lastProjectName = localStorage.getItem('whiteboard-last-project');
      const projectToLoad =
        savedProjects.find((p) => p.projectName === lastProjectName) ||
        savedProjects[savedProjects.length - 1];
      if (
        projectToLoad &&
        Array.isArray(projectToLoad.stickyNotes) &&
        projectToLoad.stickyNotes.length > 0
      ) {
        applyBoardState(projectToLoad);
        return;
      }
    }
    // Default fallback: Load Garden Shed demo project so swimlane flowchart is immediately visible
    applyBoardState(DEFAULT_DEMO_PROJECT, 'New Garden Shed.json');
  } catch (e) {
    console.error('Error loading initial board state:', e);
    applyBoardState(DEFAULT_DEMO_PROJECT, 'New Garden Shed.json');
  }
}

function clearBoardForImport(preserveHistory = false) {
  document.querySelectorAll('.sticky-note').forEach((note) => note.remove());
  stickyNotes = [];
  strokes = [];
  dependencies = [];
  if (!preserveHistory) {
    historyStack = [];
    redoStack = [];
  }
  organizedLayoutProposal = null;
  computedScheduleData = [];
  document
    .querySelectorAll('#canvas-viewport > textarea')
    .forEach((ta) => ta.remove());
}

function applyBoardState(boardState, fileName = '', preserveHistory = false) {
  if (!boardState || typeof boardState !== 'object') {
    throw new Error(
      'The selected file does not contain a valid whiteboard project.'
    );
  }

  clearBoardForImport(preserveHistory);

  activeTemplate = ['blank', 'swimlane', 'scurve', 'matrix', 'gantt'].includes(
    boardState.activeTemplate
  )
    ? boardState.activeTemplate
    : 'swimlane';
  showGrid = boardState.showGrid !== false;
  if (ganttStartDateInput)
    ganttStartDateInput.value = boardState.ganttStartDate || todayDate;
  if (ganttStatusDateInput)
    ganttStatusDateInput.value = boardState.ganttStatusDate || todayDate;
  trianglePriorities = {
    budget: Math.min(
      10,
      Math.max(1, Number(boardState.trianglePriorities?.budget) || 5)
    ),
    quality: Math.min(
      10,
      Math.max(1, Number(boardState.trianglePriorities?.quality) || 5)
    ),
    time: Math.min(
      10,
      Math.max(1, Number(boardState.trianglePriorities?.time) || 5)
    ),
  };
  strokes = Array.isArray(boardState.strokes) ? boardState.strokes : [];

  const notes = Array.isArray(boardState.stickyNotes)
    ? boardState.stickyNotes
    : [];
  notes.forEach((state) => {
    createStickyNote(
      Number(state.x) || 0,
      Number(state.y) || 0,
      state.color || '#1e293b',
      state.text || '',
      true,
      state.id
    );
    const noteState = stickyNotes[stickyNotes.length - 1];
    noteState.lane = state.lane || 'Generelt';
    noteState.duration = Math.max(1, Number(state.duration) || 1);
    noteState.plannedHours = Math.max(0, Number(state.plannedHours) || 0);
    noteState.plannedCost = Math.max(0, Number(state.plannedCost) || 0);
    noteState.actualHours = Math.max(0, Number(state.actualHours) || 0);
    noteState.actualCost = Math.max(0, Number(state.actualCost) || 0);
    noteState.progress = Math.min(
      100,
      Math.max(0, Number(state.progress) || 0)
    );
    noteState.resource = state.resource || '';
    noteState.riskFactor = Math.min(
      5,
      Math.max(1, Number(state.riskFactor) || 1)
    );
    noteState.impactFactor = Math.min(
      5,
      Math.max(1, Number(state.impactFactor) || 1)
    );
    noteState.weightedFactor = noteState.riskFactor * noteState.impactFactor;
    updateNoteBadge(noteState);
    updateNoteDetails(noteState);
  });

  const noteIds = new Set(stickyNotes.map((note) => note.id));
  dependencies = Array.isArray(boardState.dependencies)
    ? boardState.dependencies.filter(
        (dependency) =>
          noteIds.has(dependency.from) && noteIds.has(dependency.to)
      )
    : [];

  projectNameInput.value =
    boardState.projectName ||
    fileName.replace(/\.json$/i, '') ||
    'Untitled Project';
  tempNameSpan.innerText =
    {
      blank: 'Blank Grid',
      swimlane: 'Vertical Swimlanes',
      scurve: 'S-Curve',
      matrix: 'Risk Matrix',
      gantt: 'Gantt Schedule',
    }[activeTemplate] || 'Vertical Swimlanes';
  document.querySelectorAll('.template-btn').forEach((b) => {
    b.classList.toggle('active', b.id === `tpl-${activeTemplate}`);
  });
  gridToggleBtn.classList.toggle('active', showGrid);
  switchView('canvas');
  resizeCanvas();
  updateSidebarSwimlanes();
  renderSwimlaneView();
  refreshGanttSchedule();
  announceA11y(`Opened project ${projectNameInput.value}.`);
}

async function openBoardFile(file) {
  try {
    const boardState = JSON.parse(await file.text());
    applyBoardState(boardState, file.name);
  } catch (error) {
    console.error('Board open failed:', error);
    announceA11y('Unable to open that project file.');
    alert(
      'Unable to open this file. Please select a valid whiteboard JSON file.'
    );
  }
}

if (saveProjectBtn) {
  saveProjectBtn.addEventListener('click', saveBoard);
}

if (projectNameInput) {
  projectNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveBoard(e);
    }
  });
}

if (openProjectBtn && projectFileInput) {
  openProjectBtn.addEventListener('click', () => projectFileInput.click());
  projectFileInput.addEventListener('change', () => {
    const [file] = projectFileInput.files;
    if (file) openBoardFile(file);
    projectFileInput.value = '';
  });
}

function drawExportText(exportCtx, text, x, y, maxWidth, lineHeight) {
  const words = String(text || '')
    .split(/\s+/)
    .filter(Boolean);
  let line = '';

  words.forEach((word) => {
    const testLine = line ? `${line} ${word}` : word;
    if (line && exportCtx.measureText(testLine).width > maxWidth) {
      exportCtx.fillText(line, x, y);
      line = word;
      y += lineHeight;
    } else {
      line = testLine;
    }
  });

  if (line) exportCtx.fillText(line, x, y);
}

function drawStickyNotesForExport(exportCtx) {
  stickyNotes.forEach((noteState) => {
    const note = noteState.element;
    const styles = getComputedStyle(note);
    const width = note.offsetWidth || 185;
    const height = note.offsetHeight || 110;
    const x = noteState.x;
    const y = noteState.y;
    const borderLeftWidth = parseFloat(styles.borderLeftWidth) || 0;

    exportCtx.fillStyle = styles.backgroundColor;
    exportCtx.fillRect(x, y, width, height);
    exportCtx.strokeStyle = styles.borderTopColor || '#e2e8f0';
    exportCtx.lineWidth = 1;
    exportCtx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
    exportCtx.fillStyle = styles.borderLeftColor || '#eab308';
    exportCtx.fillRect(x, y, borderLeftWidth, height);

    const padding = parseFloat(styles.paddingLeft) || 10;
    const textX = x + padding + borderLeftWidth;
    const contentWidth = width - padding * 2 - borderLeftWidth;

    exportCtx.font = '600 11px Arial';
    exportCtx.fillStyle = '#64748b';
    exportCtx.textBaseline = 'top';
    drawExportText(
      exportCtx,
      note.querySelector('.sticky-note-badge')?.innerText,
      textX,
      y + padding,
      contentWidth,
      14
    );

    exportCtx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    exportCtx.beginPath();
    exportCtx.moveTo(textX, y + padding + 18);
    exportCtx.lineTo(x + width - padding, y + padding + 18);
    exportCtx.stroke();

    exportCtx.font = '12px Arial';
    exportCtx.fillStyle = styles.color || '#1e293b';
    drawExportText(
      exportCtx,
      note.querySelector('textarea')?.value,
      textX,
      y + padding + 25,
      contentWidth,
      16
    );

    const details = note.querySelector('.sticky-note-details');
    if (details?.innerText) {
      exportCtx.font = '10px Arial';
      exportCtx.fillStyle = '#64748b';
      drawExportText(
        exportCtx,
        details.innerText,
        textX,
        y + height - 28,
        contentWidth,
        12
      );
    }
  });
}

// Export Canvas layout as PNG image
exportBtn.addEventListener('click', () => {
  // Sticky notes are DOM elements layered over the canvas, so compose both
  // layers into a temporary canvas before creating the PNG.
  const dpr = window.devicePixelRatio || 1;
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = canvas.width;
  exportCanvas.height = canvas.height;
  const exportCtx = exportCanvas.getContext('2d');
  exportCtx.drawImage(canvas, 0, 0);
  exportCtx.scale(dpr, dpr);
  drawStickyNotesForExport(exportCtx);

  const dataURL = exportCanvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.download = `project-whiteboard-${activeTemplate}-${Date.now()}.png`;
  link.href = dataURL;
  link.click();
  announceA11y('Exporting drawing canvas to PNG.');
});

// Context Menu Management
const contextMenu = document.getElementById('sticky-context-menu');

function showContextMenu(e, noteId) {
  contextMenuTargetNoteId = noteId;
  contextMenu.style.display = 'block';
  contextMenu.style.left = `${e.clientX + window.scrollX}px`;
  contextMenu.style.top = `${e.clientY + window.scrollY}px`;
}

function hideContextMenu() {
  contextMenu.style.display = 'none';
  contextMenuTargetNoteId = null;
}

// Click outside menu to close (but ignore clicks inside the properties dialog)
document.addEventListener('click', (e) => {
  if (
    !e.target.closest('#sticky-context-menu') &&
    !e.target.closest('#note-properties-dialog')
  ) {
    hideContextMenu();
  }
});

function formatThousands(val) {
  if (val === null || val === undefined || val === '') return '0';
  const num = Math.round(Number(String(val).replace(/,/g, '').trim()) || 0);
  return num.toLocaleString('en-US');
}

function parseFormattedNumber(val) {
  if (val === null || val === undefined || val === '') return 0;
  const cleaned = String(val).replace(/,/g, '').replace(/\s/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.max(0, num);
}

// Badge Update Helper
function updateNoteBadge(noteState) {
  const badge = document.getElementById(`badge-${noteState.id}`);
  if (badge) {
    const laneText = noteState.lane || 'Generelt';
    const durText = `${noteState.duration || 1}d`;
    const hoursText = noteState.plannedHours
      ? ` | ${noteState.plannedHours}h`
      : '';
    const costText = noteState.plannedCost
      ? ` | ${formatThousands(noteState.plannedCost)}`
      : '';
    badge.innerText = `[${laneText}] ${durText}${hoursText}${costText}`;
  }
}

function updateNoteDetails(noteState) {
  const details = document.getElementById(`details-${noteState.id}`);
  if (!details) return;
  const resourceText = noteState.resource || 'Not assigned';
  const risk = noteState.riskFactor || 1;
  const impact = noteState.impactFactor || 1;
  const weighted = risk * impact;
  noteState.weightedFactor = weighted;
  details.innerHTML = `<div><strong>Responsible:</strong> ${escapeHtml(resourceText)}</div><div><strong>Risk:</strong> ${risk} · <strong>Impact:</strong> ${impact} · <strong>Weighted:</strong> ${weighted}</div>`;
  if (typeof activeView !== 'undefined' && activeView === 'risk') {
    renderRiskMatrixView();
  }
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>'"]/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
      })[character]
  );
}

// Context Menu Options Action Listeners
const notePropertiesDialog = document.getElementById('note-properties-dialog');
const notePropertiesForm = document.getElementById('note-properties-form');
const riskInput = document.getElementById('prop-risk');
const impactInput = document.getElementById('prop-impact');
const weightedInput = document.getElementById('prop-weighted');

function updateWeightedFactorInput() {
  const risk = Math.min(5, Math.max(1, parseInt(riskInput.value) || 1));
  const impact = Math.min(5, Math.max(1, parseInt(impactInput.value) || 1));
  weightedInput.value = risk * impact;
}

riskInput.addEventListener('input', updateWeightedFactorInput);
impactInput.addEventListener('input', updateWeightedFactorInput);

function openNotePropertiesDialog(focusInputId = null) {
  if (!contextMenuTargetNoteId) return;
  const noteState = stickyNotes.find((n) => n.id === contextMenuTargetNoteId);
  if (!noteState) return;

  // Refresh autocomplete presets with existing active lanes
  const datalist = document.getElementById('lane-presets');
  if (datalist) {
    const existingLanes = [
      ...new Set(stickyNotes.map((n) => (n.lane || 'Generelt').trim())),
    ];
    const standardPresets = [
      'Project Management',
      'Engineering',
      'Procurement',
      'Foundations',
      'Clear Garden',
      'Buy Shed',
      'Install Shed',
      'Legal',
      'Generelt',
    ];
    const allPresets = [...new Set([...existingLanes, ...standardPresets])];
    datalist.innerHTML = allPresets
      .map((p) => `<option value="${escapeHtml(p)}"></option>`)
      .join('');
  }

  // Populate inputs
  document.getElementById('prop-lane').value = noteState.lane || 'Generelt';
  document.getElementById('prop-duration').value = noteState.duration || 1;
  document.getElementById('prop-hours').value = noteState.plannedHours || 0;
  document.getElementById('prop-cost').value = noteState.plannedCost || 0;
  document.getElementById('prop-resource').value = noteState.resource || '';
  document.getElementById('prop-risk').value = noteState.riskFactor || 1;
  document.getElementById('prop-impact').value = noteState.impactFactor || 1;
  document.getElementById('prop-weighted').value =
    (noteState.riskFactor || 1) * (noteState.impactFactor || 1);

  // Show dialog
  notePropertiesDialog.showModal();

  // Focus specific input if requested
  if (focusInputId) {
    setTimeout(() => {
      const inputEl = document.getElementById(focusInputId);
      if (inputEl) {
        inputEl.focus();
        inputEl.select();
      }
    }, 50);
  }
}

document.getElementById('menu-set-lane').addEventListener('click', () => {
  openNotePropertiesDialog('prop-lane');
  contextMenu.style.display = 'none';
});

document.getElementById('menu-set-duration').addEventListener('click', () => {
  openNotePropertiesDialog('prop-duration');
  contextMenu.style.display = 'none';
});

document.getElementById('menu-set-hours').addEventListener('click', () => {
  openNotePropertiesDialog('prop-hours');
  contextMenu.style.display = 'none';
});

document.getElementById('menu-set-cost').addEventListener('click', () => {
  openNotePropertiesDialog('prop-cost');
  contextMenu.style.display = 'none';
});

document.getElementById('menu-set-risk').addEventListener('click', () => {
  openNotePropertiesDialog('prop-resource');
  contextMenu.style.display = 'none';
});

document.getElementById('menu-delete-note').addEventListener('click', () => {
  if (contextMenuTargetNoteId) {
    deleteStickyNote(contextMenuTargetNoteId);
  }
  hideContextMenu();
});

notePropertiesDialog.addEventListener('close', () => {
  hideContextMenu();
});

notePropertiesForm.addEventListener('submit', (e) => {
  if (!contextMenuTargetNoteId) return;
  const noteState = stickyNotes.find((n) => n.id === contextMenuTargetNoteId);
  if (noteState) {
    const newLane =
      document.getElementById('prop-lane').value.trim() || 'Generelt';
    const newDur =
      parseInt(document.getElementById('prop-duration').value) || 1;
    const newHours = parseInt(document.getElementById('prop-hours').value) || 0;
    const newCost = parseFloat(document.getElementById('prop-cost').value) || 0;
    const newResource = document.getElementById('prop-resource').value.trim();
    const newRisk = Math.min(
      5,
      Math.max(1, parseInt(document.getElementById('prop-risk').value) || 1)
    );
    const newImpact = Math.min(
      5,
      Math.max(1, parseInt(document.getElementById('prop-impact').value) || 1)
    );

    const oldState = {
      lane: noteState.lane,
      duration: noteState.duration,
      plannedHours: noteState.plannedHours,
      plannedCost: noteState.plannedCost,
      resource: noteState.resource,
      riskFactor: noteState.riskFactor,
      impactFactor: noteState.impactFactor,
      weightedFactor: noteState.weightedFactor,
    };

    noteState.lane = newLane;
    noteState.duration = Math.max(1, newDur);
    noteState.plannedHours = Math.max(0, newHours);
    noteState.plannedCost = Math.max(0, newCost);
    noteState.resource = newResource;
    noteState.riskFactor = newRisk;
    noteState.impactFactor = newImpact;
    noteState.weightedFactor = newRisk * newImpact;

    updateNoteBadge(noteState);
    updateNoteDetails(noteState);

    pushAction({
      type: 'edit-properties',
      noteId: noteState.id,
      oldState: oldState,
      newState: {
        lane: noteState.lane,
        duration: noteState.duration,
        plannedHours: noteState.plannedHours,
        plannedCost: noteState.plannedCost,
        resource: noteState.resource,
        riskFactor: noteState.riskFactor,
        impactFactor: noteState.impactFactor,
        weightedFactor: noteState.weightedFactor,
      },
    });

    updateSidebarSwimlanes();
    if (typeof activeView !== 'undefined' && activeView === 'swimlane') {
      renderSwimlaneView();
    }
    refreshGanttSchedule();
    drawAll();
    autoSaveCurrentState();
  }
  hideContextMenu();
});

// -------------------------------------------------------------
// Left Sidebar Swimlanes / Roles Monitor & Typo Manager
// -------------------------------------------------------------
function isSimilarRole(a, b) {
  if (a === b) return false;
  // Plural/singular differences (e.g. foundation vs foundations)
  if (a === b + 's' || b === a + 's' || a === b + 'es' || b === a + 'es')
    return true;
  // Space difference (e.g. buyshed vs buy shed)
  if (a.replace(/\s+/g, '') === b.replace(/\s+/g, '')) return true;
  // Small typo (Levenshtein distance <= 1)
  const lenA = a.length,
    lenB = b.length;
  if (Math.abs(lenA - lenB) > 2) return false;
  let diffs = 0;
  for (let i = 0, j = 0; i < lenA && j < lenB; i++, j++) {
    if (a[i] !== b[j]) {
      diffs++;
      if (lenA > lenB) j--;
      else if (lenB > lenA) i--;
    }
  }
  return diffs <= 1;
}

function updateSidebarSwimlanes() {
  const container = document.getElementById('sidebar-roles-list');
  const countBadge = document.getElementById('sidebar-roles-count');
  const datalist = document.getElementById('lane-presets');
  if (!container) return;

  if (stickyNotes.length === 0) {
    if (summaryBadges) summaryBadges.innerHTML = '';
    if (uniqueRolesBar) uniqueRolesBar.innerHTML = '';
    diagramViewport.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 320px; color: var(--text-muted); text-align: center; gap: 10px; width: 100%;">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.4;">
          <rect x="3" y="3" width="18" height="18" rx="2"></rect>
          <line x1="9" y1="3" x2="9" y2="21"></line>
          <line x1="15" y1="3" x2="15" y2="21"></line>
        </svg>
        <div style="font-weight: 600; font-size: 0.95rem; color: var(--text-main);">No tasks found on the board</div>
        <div style="font-size: 0.8rem; max-width: 420px;">Create sticky notes on the Whiteboard to generate the vertical swimlane flowchart, or load the demo project to view the flowchart immediately.</div>
        <button type="button" class="btn-load-demo-empty" onclick="loadDemoProject()" title="Load Garden Shed demo project with 20 tasks and swimlanes">
          ✨ Load Demo Project (Garden Shed)
        </button>
      </div>
    `;
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">No sticky notes found. <button type="button" class="btn-load-demo-empty" style="margin-left: 10px; padding: 4px 10px; font-size: 0.74rem;" onclick="loadDemoProject()">Load Demo Project</button></td></tr>';
    return;
  }

  // Count occurrences per lane
  const laneCounts = {};
  const laneDisplayNames = {};

  stickyNotes.forEach((n) => {
    const { key, display } = getCanonicalLaneInfo(n.lane);
    laneCounts[key] = (laneCounts[key] || 0) + 1;
    if (!laneDisplayNames[key]) {
      laneDisplayNames[key] = display;
    }
  });

  const keys = Object.keys(laneCounts);
  if (countBadge) countBadge.innerText = String(keys.length);

  // Detect potential typos / near-duplicates (e.g. "foundation" vs "foundations")
  const potentialTypos = new Set();
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      if (isSimilarRole(keys[i], keys[j])) {
        potentialTypos.add(keys[i]);
        potentialTypos.add(keys[j]);
      }
    }
  }

  // Sort by task count descending, then alphabetical
  keys.sort((a, b) => laneCounts[b] - laneCounts[a] || a.localeCompare(b));

  let html = '';
  keys.forEach((key) => {
    const disp = laneDisplayNames[key];
    const count = laneCounts[key];
    const isTypoRisk = potentialTypos.has(key);
    html += `
      <div class="sidebar-role-item ${isTypoRisk ? 'typo-warning' : ''}" data-role-key="${escapeHtml(key)}" title="${isTypoRisk ? 'Possible typo / duplicate role: Click ✏️ to rename or merge' : 'Click to highlight tasks on board'}">
        <button type="button" class="sidebar-role-btn" data-role-key="${escapeHtml(key)}">
          <span class="sidebar-role-name">${escapeHtml(disp)}</span>
          <span class="sidebar-role-count">${count}</span>
        </button>
        <button type="button" class="sidebar-role-rename-btn" data-role-key="${escapeHtml(key)}" data-role-display="${escapeHtml(disp)}" title="Rename or merge this role across all ${count} tasks" aria-label="Rename role ${escapeHtml(disp)}">
          <svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" stroke-width="2" fill="none">
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
          </svg>
        </button>
      </div>
    `;
  });

  container.innerHTML = html;

  // Update datalist presets with active lanes
  if (datalist) {
    const standardPresets = [
      'Project Management',
      'Engineering',
      'Procurement',
      'Foundations',
      'Clear Garden',
      'Buy Shed',
      'Install Shed',
      'Legal',
      'Generelt',
    ];
    const allPresets = [
      ...new Set([...Object.values(laneDisplayNames), ...standardPresets]),
    ];
    datalist.innerHTML = allPresets
      .map((p) => `<option value="${escapeHtml(p)}"></option>`)
      .join('');
  }

  // Click listeners for role buttons (highlight notes on canvas or scroll in swimlane)
  container.querySelectorAll('.sidebar-role-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const roleKey = btn.getAttribute('data-role-key');
      highlightNotesByRole(roleKey);
    });
  });

  // Click listeners for rename buttons
  container.querySelectorAll('.sidebar-role-rename-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const currentName = btn.getAttribute('data-role-display');
      promptRenameRole(currentName);
    });
  });
}

function highlightNotesByRole(roleKey) {
  if (!roleKey) return;

  if (activeView === 'canvas') {
    let firstMatchedNote = null;
    stickyNotes.forEach((n) => {
      const noteLaneKey = getCanonicalLaneInfo(n.lane).key;
      if (noteLaneKey === roleKey) {
        n.element.classList.add('note-highlight-active');
        if (!firstMatchedNote) firstMatchedNote = n;
      } else {
        n.element.classList.remove('note-highlight-active');
      }
    });

    if (firstMatchedNote) {
      firstMatchedNote.element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center',
      });
    }

    setTimeout(() => {
      stickyNotes.forEach((n) =>
        n.element.classList.remove('note-highlight-active')
      );
    }, 2500);
  } else if (activeView === 'swimlane') {
    selectedSwimlaneRoleFilter = roleKey;
    renderSwimlaneView();
    const colTrack = document.querySelector(
      `.vs-swimlane-col-track[data-lane-index]`
    );
    if (colTrack) {
      colTrack.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  } else if (activeView === 'gantt') {
    refreshGanttSchedule();
  }
}

function promptRenameRole(currentName) {
  if (!currentName) return;
  const newName = prompt(
    `Rename Swimlane / Role "${currentName}" across all matching tasks to:`,
    currentName
  );
  if (!newName || newName.trim() === '' || newName.trim() === currentName)
    return;

  const trimmedNew = newName.trim();
  const currentKey = getCanonicalLaneInfo(currentName).key;
  let updatedCount = 0;

  stickyNotes.forEach((n) => {
    const noteKey = getCanonicalLaneInfo(n.lane).key;
    if (noteKey === currentKey) {
      n.lane = trimmedNew;
      updateNoteBadge(n);
      updatedCount++;
    }
  });

  if (updatedCount > 0) {
    updateSidebarSwimlanes();
    if (typeof activeView !== 'undefined' && activeView === 'swimlane') {
      renderSwimlaneView();
    }
    refreshGanttSchedule();
    drawAll();
    autoSaveCurrentState();
    announceA11y(
      `Renamed role "${currentName}" to "${trimmedNew}" on ${updatedCount} tasks.`
    );
  }
}

// -------------------------------------------------------------
// Vertical Swimlane Process Diagram & Sequence Flow
// -------------------------------------------------------------
let organizedLayoutProposal = null; // Temp holder for proposal
let currentSwimlaneSubView = 'diagram'; // 'diagram' or 'table'
let selectedSwimlaneRoleFilter = 'all';

function generateSwimlaneLayoutProposal() {
  if (stickyNotes.length === 0) {
    organizedLayoutProposal = null;
    return;
  }

  const horizontalSortedNotes = [...stickyNotes].sort(
    (a, b) => a.x - b.x || a.y - b.y
  );

  // 1. Build adjacency list & indegree map for topological sorting
  const adj = {};
  const inDegree = {};
  stickyNotes.forEach((n) => {
    adj[n.id] = [];
    inDegree[n.id] = 0;
  });

  dependencies.forEach((dep) => {
    if (adj[dep.from] && inDegree[dep.to] !== undefined) {
      adj[dep.from].push(dep.to);
      inDegree[dep.to]++;
    }
  });

  // 2. Perform sorting respecting horizontal x order
  const readyQueue = horizontalSortedNotes.filter((n) => inDegree[n.id] === 0);
  const sortedIds = [];

  while (readyQueue.length > 0) {
    readyQueue.sort((a, b) => a.x - b.x || a.y - b.y);
    const node = readyQueue.shift();
    sortedIds.push(node.id);
    adj[node.id].forEach((neighborId) => {
      inDegree[neighborId]--;
      if (inDegree[neighborId] === 0) {
        const neighborNode = stickyNotes.find((n) => n.id === neighborId);
        if (neighborNode) readyQueue.push(neighborNode);
      }
    });
  }

  // Catch cycles or disconnected notes
  horizontalSortedNotes.forEach((n) => {
    if (!sortedIds.includes(n.id)) {
      sortedIds.push(n.id);
    }
  });

  // 3. Group by swimlane (Lane name = Swimlane/Role), sorted horizontally by minimum note x position
  const lanesMap = {};
  sortedIds.forEach((id) => {
    const note = stickyNotes.find((n) => n.id === id);
    if (!note) return;
    const lane = (note.lane || 'Generelt').trim();
    if (!lanesMap[lane]) lanesMap[lane] = [];
    lanesMap[lane].push(note);
  });

  const sortedLaneKeys = Object.keys(lanesMap).sort((a, b) => {
    const minA = Math.min(...lanesMap[a].map((n) => Number(n.x) || 0));
    const minB = Math.min(...lanesMap[b].map((n) => Number(n.x) || 0));
    if (minA !== minB) return minA - minB;
    return a.localeCompare(b, undefined, {
      sensitivity: 'base',
      numeric: true,
    });
  });

  const organized = {};
  sortedLaneKeys.forEach((lane) => {
    organized[lane] = lanesMap[lane];
  });

  organizedLayoutProposal = organized;
}

function getCanonicalLaneInfo(rawLane) {
  const trimmed = (rawLane || 'Generelt').trim();
  let key = trimmed.toLowerCase();

  // Plural/singular normalization
  if (key === 'foundation' || key === 'foundations') {
    return { key: 'foundations', display: 'Foundations' };
  }

  // Clean display presets
  const presets = {
    'clear garden': 'Clear Garden',
    'buy shed': 'Buy Shed',
    'install shed': 'Install Shed',
    legal: 'Legal',
    generelt: 'Generelt',
    'project management': 'Project Management',
    engineering: 'Engineering',
    procurement: 'Procurement',
    fabrication: 'Fabrication',
    assembly: 'Assembly',
    commissioning: 'Commissioning',
  };

  const display = presets[key] || trimmed;
  return { key, display };
}

let swimlaneZoomMode = 'fit'; // 'fit' or 'custom'
let swimlaneCustomScale = 1.0;

function updateSwimlaneScale() {
  const frame = document.getElementById('vs-flowchart-frame');
  const container = document.getElementById('swimlane-diagram-container');
  const viewport = document.getElementById('swimlane-diagram-viewport');
  const zoomLabel = document.getElementById('swimlane-zoom-label');
  const fitBtn = document.getElementById('btn-swimlane-fit-height');
  if (!frame || !container || !viewport) return;

  const frameW = frame.offsetWidth || parseInt(frame.style.width, 10) || 740;
  const frameH =
    frame.offsetHeight || parseInt(frame.style.minHeight, 10) || 520;
  const availH = Math.max(200, container.clientHeight - 48);
  const availW = Math.max(300, container.clientWidth - 48);

  let scale = 1.0;
  if (swimlaneZoomMode === 'fit') {
    if (fitBtn) fitBtn.classList.add('active');
    const scaleH = availH / frameH;
    const scaleW = availW / frameW;
    scale = Math.min(scaleH, scaleW, 1.0);
    scale = Math.max(0.4, Math.min(1.0, scale));
    if (zoomLabel) zoomLabel.innerText = 'Fit';
  } else {
    if (fitBtn) fitBtn.classList.remove('active');
    scale = Math.max(0.35, Math.min(2.0, swimlaneCustomScale));
    if (zoomLabel) zoomLabel.innerText = `${Math.round(scale * 100)}%`;
  }

  viewport.style.width = `${Math.round(frameW * scale)}px`;
  viewport.style.height = `${Math.round(frameH * scale)}px`;
  viewport.style.position = 'relative';

  frame.style.position = 'absolute';
  frame.style.top = '0';
  frame.style.left = '0';
  frame.style.transformOrigin = 'top left';
  frame.style.transform = `scale(${scale})`;

  // Redraw SVG connectors
  drawSwimlaneConnectors();
}

function drawSwimlaneConnectors() {
  const svg = document.getElementById('vs-flowchart-svg');
  const bodyEl = document.getElementById('vs-swimlane-body');
  if (!svg || !bodyEl) return;

  const width = bodyEl.offsetWidth || parseInt(bodyEl.style.width, 10) || 740;
  const height =
    bodyEl.offsetHeight || parseInt(bodyEl.style.height, 10) || 500;

  svg.setAttribute('width', `${width}px`);
  svg.setAttribute('height', `${height}px`);
  svg.style.width = `${width}px`;
  svg.style.height = `${height}px`;

  // Remove existing paths and branch labels, preserve defs
  svg.querySelectorAll('path, text').forEach((el) => el.remove());

  function getCardAnchor(el) {
    const cx = parseFloat(el.style.left) || el.offsetLeft + el.offsetWidth / 2;
    const cy = parseFloat(el.style.top) || el.offsetTop + el.offsetHeight / 2;
    const w =
      el.offsetWidth ||
      (el.classList.contains('vs-node-capsule')
        ? 160
        : el.classList.contains('vs-node-decision-outer')
          ? 100
          : 122);
    const h =
      el.offsetHeight ||
      (el.classList.contains('vs-node-capsule')
        ? 30
        : el.classList.contains('vs-node-decision-outer')
          ? 48
          : 40);

    return {
      center: { x: cx, y: cy },
      top: { x: cx, y: cy - h / 2 },
      bottom: { x: cx, y: cy + h / 2 },
      left: { x: cx - w / 2, y: cy },
      right: { x: cx + w / 2, y: cy },
    };
  }

  function connectNodes(fromEl, toEl, labelText = null) {
    if (!fromEl || !toEl) return;
    const fromAnchor = getCardAnchor(fromEl);
    const toAnchor = getCardAnchor(toEl);

    const fromBottom = fromAnchor.bottom;
    const toTop = toAnchor.top;
    const fromCenter = fromAnchor.center;
    const toCenter = toAnchor.center;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('vs-flowchart-path');
    path.setAttribute('marker-end', 'url(#vs-arrow)');

    let d = '';
    const isFromDecision = fromEl.classList.contains('vs-node-decision-outer');

    // 1. Vertical straight alignment (same column track)
    if (Math.abs(fromCenter.x - toCenter.x) < 20 && fromCenter.y < toCenter.y) {
      d = `M ${fromBottom.x} ${fromBottom.y} V ${toTop.y - 2}`;
      if (labelText || isFromDecision) {
        const text = document.createElementNS(
          'http://www.w3.org/2000/svg',
          'text'
        );
        text.classList.add('vs-branch-label');
        text.setAttribute('x', fromBottom.x + 14);
        text.setAttribute('y', fromBottom.y + (toTop.y - fromBottom.y) / 2);
        text.textContent = labelText || 'YES';
        svg.appendChild(text);
      }
    } else if (fromCenter.y < toCenter.y - 14) {
      // Step-down cross-lane orthogonal path
      const midY = fromBottom.y + (toTop.y - fromBottom.y) / 2;
      d = `M ${fromBottom.x} ${fromBottom.y} V ${midY} H ${toTop.x} V ${toTop.y - 2}`;
      if (labelText || isFromDecision) {
        const text = document.createElementNS(
          'http://www.w3.org/2000/svg',
          'text'
        );
        text.classList.add('vs-branch-label');
        text.setAttribute(
          'x',
          fromBottom.x + (toTop.x > fromBottom.x ? 18 : -18)
        );
        text.setAttribute('y', midY - 6);
        text.textContent = labelText || (toTop.x > fromBottom.x ? 'NO' : 'YES');
        svg.appendChild(text);
      }
    } else if (Math.abs(fromCenter.y - toCenter.y) <= 24) {
      // Horizontal cross-lane connector
      if (toCenter.x > fromCenter.x) {
        d = `M ${fromAnchor.right.x} ${fromAnchor.right.y} H ${toAnchor.left.x - 2}`;
      } else {
        d = `M ${fromAnchor.left.x} ${fromAnchor.left.y} H ${toAnchor.right.x + 2}`;
      }
    } else {
      // Step-up or wrap-around fallback
      const midY = fromBottom.y + 14;
      d = `M ${fromBottom.x} ${fromBottom.y} V ${midY} H ${toTop.x} V ${toTop.y - 2}`;
    }

    path.setAttribute('d', d);
    svg.appendChild(path);
  }

  // 1. Draw Start Node connector if present
  const startNode = document.getElementById('vs-start-node');
  const firstTaskCards = document.querySelectorAll('.vs-first-task');
  const terminalNode = document.getElementById('vs-terminal-node');
  if (startNode && firstTaskCards.length > 0) {
    firstTaskCards.forEach((card) => connectNodes(startNode, card));
  } else if (startNode && terminalNode) {
    connectNodes(startNode, terminalNode);
  }

  // 2. Draw task dependencies
  if (dependencies.length > 0) {
    dependencies.forEach((dep) => {
      const fromNode = document.getElementById(`vs-node-${dep.from}`);
      const toNode = document.getElementById(`vs-node-${dep.to}`);
      if (fromNode && toNode) {
        connectNodes(fromNode, toNode);
      }
    });
  } else {
    // Sequential process flow PER SWIMLANE
    const laneNodesByLane = {};
    document
      .querySelectorAll('.vs-node-wrapper[data-note-id]')
      .forEach((node) => {
        const laneKey = node.getAttribute('data-lane-key') || 'generelt';
        if (!laneNodesByLane[laneKey]) laneNodesByLane[laneKey] = [];
        laneNodesByLane[laneKey].push(node);
      });

    Object.values(laneNodesByLane).forEach((nodes) => {
      for (let i = 0; i < nodes.length - 1; i++) {
        connectNodes(nodes[i], nodes[i + 1]);
      }
    });
  }

  // 3. Draw Terminal Node connector if present
  const lastTaskCards = document.querySelectorAll('.vs-last-task');
  if (terminalNode && lastTaskCards.length > 0) {
    lastTaskCards.forEach((card) => connectNodes(card, terminalNode));
  }
}

function renderSwimlaneView() {
  const diagramViewport = document.getElementById('swimlane-diagram-viewport');
  const tableContainer = document.getElementById('swimlane-table-container');
  const diagramContainer = document.getElementById(
    'swimlane-diagram-container'
  );
  const summaryBadges = document.getElementById('swimlane-summary-badges');
  const uniqueRolesBar = document.getElementById('swimlane-unique-roles-bar');
  const tbody = document.querySelector('#swimlane-view-table tbody');

  if (!diagramViewport || !tbody) return;

  // Toggle display based on current subview
  if (currentSwimlaneSubView === 'table') {
    if (diagramContainer) diagramContainer.style.display = 'none';
    if (tableContainer) tableContainer.style.display = 'block';
  } else {
    if (diagramContainer) diagramContainer.style.display = 'flex';
    if (tableContainer) tableContainer.style.display = 'none';
  }

  // 1. Sort all sticky notes horizontally by x coordinate (and y as secondary)
  const horizontalSortedNotes = [...stickyNotes].sort(
    (a, b) => a.x - b.x || a.y - b.y
  );

  // 2. Task Code mapping (T10, T20, T30...) ordered horizontally
  const taskCodes = {};
  horizontalSortedNotes.forEach((n, idx) => {
    taskCodes[n.id] = `T${(idx + 1) * 10}`;
  });

  // 3. Build predecessor & successor maps
  const predsMap = {};
  const succsMap = {};
  stickyNotes.forEach((n) => {
    predsMap[n.id] = [];
    succsMap[n.id] = [];
  });
  dependencies.forEach((dep) => {
    if (predsMap[dep.to] && succsMap[dep.from]) {
      predsMap[dep.to].push(dep.from);
      succsMap[dep.from].push(dep.to);
    }
  });

  // 4. Group all notes by unique Swimlane / Role (canonical key, clean display title)
  const lanesMap = {};
  const laneDisplayNames = {};
  horizontalSortedNotes.forEach((n) => {
    const { key, display } = getCanonicalLaneInfo(n.lane);
    if (!lanesMap[key]) {
      lanesMap[key] = [];
      laneDisplayNames[key] = display;
    }
    lanesMap[key].push(n);
  });

  // Sort swimlane columns to reflect horizontal order of sticky notes on the board (earliest x first)
  const sortedLaneKeys = Object.keys(lanesMap).sort((a, b) => {
    const minA = Math.min(...lanesMap[a].map((n) => Number(n.x) || 0));
    const minB = Math.min(...lanesMap[b].map((n) => Number(n.x) || 0));
    if (minA !== minB) return minA - minB;
    return a.localeCompare(b, undefined, {
      sensitivity: 'base',
      numeric: true,
    });
  });

  // Align activeLanes with the Board Canvas logic (defaulting to 5 specific lanes, while keeping any extra notes lanes)
  let activeLanes = [];
  if (sortedLaneKeys.length >= 2) {
    activeLanes = sortedLaneKeys.map((k) => ({
      key: k,
      name: laneDisplayNames[k],
      count: lanesMap[k].length,
    }));
  } else {
    activeLanes = [
      { key: 'legal', name: 'Legal', count: (lanesMap['legal'] || []).length },
      {
        key: 'clear garden',
        name: 'Clear Garden',
        count: (lanesMap['clear garden'] || []).length,
      },
      {
        key: 'buy shed',
        name: 'Buy Shed',
        count: (lanesMap['buy shed'] || []).length,
      },
      {
        key: 'foundations',
        name: 'Foundations',
        count: (lanesMap['foundations'] || []).length,
      },
      {
        key: 'install shed',
        name: 'Install Shed',
        count: (lanesMap['install shed'] || []).length,
      },
    ];
    // Include any other user-defined lanes that have sticky notes on them
    sortedLaneKeys.forEach((k) => {
      if (!activeLanes.some((al) => al.key === k)) {
        activeLanes.push({
          key: k,
          name: laneDisplayNames[k] || k,
          count: lanesMap[k].length,
        });
      }
    });
  }

  // Ensure all active lanes have mapped lists & titles
  activeLanes.forEach((lane) => {
    if (!laneDisplayNames[lane.key]) {
      laneDisplayNames[lane.key] = lane.name;
    }
    if (!lanesMap[lane.key]) {
      lanesMap[lane.key] = [];
    }
  });

  const laneIndexMap = {};
  activeLanes.forEach((lane, idx) => {
    laneIndexMap[lane.key] = idx;
  });

  // 5. Compute step rank / tier for each note
  const ranks = {};
  if (dependencies.length === 0) {
    activeLanes.forEach((lane) => {
      const k = lane.key;
      const laneNotes = [...lanesMap[k]].sort((a, b) => a.x - b.x || a.y - b.y);
      laneNotes.forEach((n, stepIdx) => {
        ranks[n.id] = stepIdx + 1;
      });
    });
  } else {
    // Topological sort respecting horizontal x positions
    const inDegree = {};
    const adj = {};
    stickyNotes.forEach((n) => {
      inDegree[n.id] = predsMap[n.id].length;
      adj[n.id] = [...succsMap[n.id]];
    });

    const readyQueue = horizontalSortedNotes.filter(
      (n) => inDegree[n.id] === 0
    );
    const topoOrder = [];

    while (readyQueue.length > 0) {
      readyQueue.sort((a, b) => a.x - b.x || a.y - b.y);
      const nextNode = readyQueue.shift();
      topoOrder.push(nextNode);

      adj[nextNode.id].forEach((succId) => {
        inDegree[succId]--;
        if (inDegree[succId] === 0) {
          const succNode = stickyNotes.find((n) => n.id === succId);
          if (succNode) readyQueue.push(succNode);
        }
      });
    }

    horizontalSortedNotes.forEach((n) => {
      if (!topoOrder.includes(n)) topoOrder.push(n);
    });

    let rankCounter = 1;
    topoOrder.forEach((n) => {
      const predRanks = predsMap[n.id].map((pId) => ranks[pId] || 1);
      const minAllowedRank =
        predRanks.length > 0 ? Math.max(...predRanks) + 1 : 1;
      ranks[n.id] = Math.max(minAllowedRank, rankCounter);
      rankCounter = ranks[n.id] + 1;
    });
  }

  let maxRank = Math.max(...Object.values(ranks), 1);

  // Summary Metrics
  const totalCost = stickyNotes.reduce(
    (sum, n) => sum + (Number(n.plannedCost) || 0),
    0
  );
  if (summaryBadges) {
    summaryBadges.innerHTML = `
      <span class="swimlane-badge-pill"><strong>${activeLanes.length}</strong> Swimlanes</span>
      <span class="swimlane-badge-pill"><strong>${stickyNotes.length}</strong> Process Steps</span>
      <span class="swimlane-badge-pill"><strong>${maxRank}</strong> Tiers</span>
      <span class="swimlane-badge-pill"><strong>${totalCost.toLocaleString('nb-NO')} kr</strong> BAC</span>
    `;
  }

  // 6. Render Unique Swimlane/Role Values Top Bar
  if (uniqueRolesBar) {
    let chipsHtml = `
      <button class="swimlane-role-chip ${selectedSwimlaneRoleFilter === 'all' ? 'active' : ''}" data-role="all" type="button">
        <span>All Disciplines</span>
        <span class="swimlane-role-chip-count">${stickyNotes.length}</span>
      </button>
    `;
    activeLanes.forEach((lane) => {
      const count = lane.count;
      const disp = lane.name;
      const k = lane.key;
      const isActive =
        selectedSwimlaneRoleFilter === k || selectedSwimlaneRoleFilter === disp;
      chipsHtml += `
        <button class="swimlane-role-chip ${isActive ? 'active' : ''}" data-role="${escapeHtml(k)}" type="button">
          <span>${escapeHtml(disp)}</span>
          <span class="swimlane-role-chip-count">${count}</span>
        </button>
      `;
    });
    uniqueRolesBar.innerHTML = chipsHtml;

    // Attach chip click listeners
    uniqueRolesBar.querySelectorAll('.swimlane-role-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const roleKey = chip.getAttribute('data-role');
        selectedSwimlaneRoleFilter = roleKey;
        uniqueRolesBar
          .querySelectorAll('.swimlane-role-chip')
          .forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');

        // Scroll to or highlight column
        const colIndex = activeLanes.findIndex((l) => l.key === roleKey);
        if (colIndex !== -1) {
          const colTrack = document.querySelector(
            `.vs-swimlane-col-track[data-lane-index="${colIndex}"]`
          );
          if (colTrack) {
            colTrack.scrollIntoView({
              behavior: 'smooth',
              inline: 'center',
              block: 'nearest',
            });
          }
        }
      });
    });
  }

  // 7. Build Flowchart Template Layout with adaptive step height to fit screen
  const colWidth = 148;
  const containerEl = document.getElementById('swimlane-diagram-container');
  const availH =
    containerEl && containerEl.clientHeight > 180
      ? containerEl.clientHeight - 24
      : 540;
  const overhead = 140;
  const availStepSpace = Math.max(160, availH - overhead);
  const stepHeight = Math.max(
    46,
    Math.min(74, Math.floor(availStepSpace / Math.max(maxRank, 1)))
  );
  const topPadding = 34;
  const laneUsedY = {};
  activeLanes.forEach((lane) => (laneUsedY[lane.key] = topPadding));

  const rootTasks = stickyNotes.filter(
    (n) => !predsMap[n.id] || predsMap[n.id].length === 0
  );
  const leafTasks = stickyNotes.filter(
    (n) => !succsMap[n.id] || succsMap[n.id].length === 0
  );

  // Calculate required flowchart height
  let maxY = topPadding + (maxRank + 1) * stepHeight + 36;
  const bodyHeight = Math.max(360, maxY + 50);

  // Flowchart Frame HTML
  const totalFrameWidth = activeLanes.length * colWidth;
  let frameHtml = `<div class="vs-flowchart-frame" id="vs-flowchart-frame" style="width: ${totalFrameWidth}px; min-height: ${bodyHeight + 80}px;">`;

  // Header Banner
  frameHtml += `
    <div class="vs-flowchart-header">
      <h2 class="vs-flowchart-title">VERTICAL SWIMLANE FLOWCHART</h2>
      <div class="vs-flowchart-subtitle">Cross-Functional Responsibility & Process Sequence Flow</div>
    </div>
  `;

  // Columns Header Row
  frameHtml += `<div class="vs-swimlanes-header-row">`;
  activeLanes.forEach((lane) => {
    const disp = lane.name;
    frameHtml += `
      <div class="vs-swimlane-header-col">
        ${escapeHtml(disp)}
      </div>
    `;
  });
  frameHtml += `</div>`;

  // Swimlanes Body with Tracks
  frameHtml += `<div class="vs-swimlane-body" id="vs-swimlane-body" style="height: ${bodyHeight}px; width: ${totalFrameWidth}px; position: relative;">`;

  // Column Tracks
  activeLanes.forEach((lane, idx) => {
    const disp = lane.name;
    frameHtml += `
      <div class="vs-swimlane-col-track" data-lane-index="${idx}" data-lane="${escapeHtml(disp)}"></div>
    `;
  });

  // 1. Begin Workflow Start Node
  const startNodeX = (activeLanes.length * colWidth) / 2;
  const startNodeY = 22;
  frameHtml += `
    <div class="vs-node-wrapper vs-node-capsule" id="vs-start-node" style="left: ${startNodeX}px; top: ${startNodeY}px;" title="Workflow Initiation">
      <span>Begin Operational Workflow</span>
    </div>
  `;

  // 2. Position Task Nodes across the Swimlane Columns
  activeLanes.forEach((lane) => {
    const k = lane.key;
    const laneIdx = laneIndexMap[k];
    const nodeX = laneIdx * colWidth + colWidth / 2;
    const laneNotes = [...(lanesMap[k] || [])].sort(
      (a, b) => a.x - b.x || a.y - b.y
    );

    laneNotes.forEach((note, stepIdx) => {
      const rank = ranks[note.id] || stepIdx + 1;
      let targetY = topPadding + rank * stepHeight - 6;

      if (
        laneUsedY[k] &&
        targetY < laneUsedY[k] + Math.max(38, stepHeight - 4)
      ) {
        targetY = laneUsedY[k] + Math.max(40, stepHeight - 2);
      }
      laneUsedY[k] = targetY;

      if (targetY + 48 > maxY) {
        maxY = targetY + 48;
      }

      const textarea = note.element
        ? note.element.querySelector('textarea')
        : null;
      const taskTitle = textarea
        ? textarea.value.trim()
        : note.text || 'Process Task';
      const code = taskCodes[note.id] || 'T10';
      const costStr = note.plannedCost
        ? `${Number(note.plannedCost).toLocaleString('nb-NO')} kr`
        : '0 kr';
      const durationStr = `${note.duration || 1}d`;

      // Check if task is a Decision Diamond
      const isDecision =
        (note.riskFactor && Number(note.riskFactor) >= 4) ||
        taskTitle.includes('?') ||
        /\b(review|approved|condition|inspect|gate|validate|satisfied|choose|decision)\b/i.test(
          taskTitle
        );

      const isFirstTask =
        dependencies.length > 0
          ? rootTasks.some((t) => t.id === note.id)
          : stepIdx === 0;

      const isLastTask =
        dependencies.length > 0
          ? leafTasks.some((t) => t.id === note.id)
          : stepIdx === laneNotes.length - 1;

      if (isDecision) {
        frameHtml += `
          <div class="vs-node-wrapper vs-node-decision-outer ${isFirstTask ? 'vs-first-task' : ''} ${isLastTask ? 'vs-last-task' : ''}" id="vs-node-${note.id}" data-note-id="${note.id}" data-lane-key="${k}" style="left: ${nodeX}px; top: ${targetY}px;" title="Double-click to edit properties">
            <div class="vs-node-decision-bg"></div>
            <div class="vs-node-decision-text">${escapeHtml(taskTitle.toUpperCase())}</div>
          </div>
        `;
      } else {
        frameHtml += `
          <div class="vs-node-wrapper vs-node-process ${isFirstTask ? 'vs-first-task' : ''} ${isLastTask ? 'vs-last-task' : ''}" id="vs-node-${note.id}" data-note-id="${note.id}" data-lane-key="${k}" style="left: ${nodeX}px; top: ${targetY}px;" title="Double-click to edit properties">
            <div class="vs-node-title">${escapeHtml(taskTitle)}</div>
            <div class="vs-node-meta">${code} · ${durationStr} · ${costStr}</div>
          </div>
        `;
      }
    });
  });

  // 3. Complete Tasks Terminal Node
  const terminalNodeX = (activeLanes.length * colWidth) / 2;
  const terminalNodeY = maxY + 18;

  frameHtml += `
    <div class="vs-node-wrapper vs-node-capsule" id="vs-terminal-node" style="left: ${terminalNodeX}px; top: ${terminalNodeY}px;" title="Process Finalization">
      <span>Complete Required Tasks</span>
    </div>
  `;

  // SVG Layer for Orthogonal Elbow Connectors
  frameHtml += `
    <svg class="vs-flowchart-svg" id="vs-flowchart-svg">
      <defs>
        <marker id="vs-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <polygon points="0 1.5, 9 5, 0 8.5" fill="#0f172a"></polygon>
        </marker>
        <marker id="vs-arrow-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <polygon points="0 1.5, 9 5, 0 8.5" fill="#2563eb"></polygon>
        </marker>
      </defs>
    </svg>
  `;

  frameHtml += `</div></div>`;

  diagramViewport.innerHTML = frameHtml;

  // 7. Attach Double-Click to Edit Note Properties
  diagramViewport
    .querySelectorAll('.vs-node-wrapper[data-note-id]')
    .forEach((node) => {
      node.addEventListener('dblclick', () => {
        const noteId = node.getAttribute('data-note-id');
        if (noteId) {
          contextMenuTargetNoteId = noteId;
          openNotePropertiesDialog();
        }
      });
    });

  // 8. Draw Orthogonal Stepped Connectors & Auto-Fit Scale
  setTimeout(() => {
    updateSwimlaneScale();
  }, 40);

  // 9. Render Table View grouped by unique Swimlane/Role
  tbody.innerHTML = '';
  activeLanes.forEach((lane) => {
    const k = lane.key;
    const disp = lane.name;
    const laneNotes = [...(lanesMap[k] || [])].sort(
      (a, b) => a.x - b.x || a.y - b.y
    );
    const laneCost = laneNotes.reduce(
      (s, n) => s + (Number(n.plannedCost) || 0),
      0
    );
    const laneDays = laneNotes.reduce(
      (s, n) => s + (Number(n.duration) || 1),
      0
    );

    // Group Header Row for this Swimlane/Role
    const groupTr = document.createElement('tr');
    groupTr.className = 'swimlane-group-header-row';
    groupTr.innerHTML = `
      <td colspan="3"><strong>${escapeHtml(disp)}</strong> <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: normal; margin-left: 8px;">(${laneNotes.length} process tasks)</span></td>
      <td class="text-right"><strong>${laneNotes.length > 0 ? laneDays + 'd' : '0d'}</strong></td>
      <td class="text-right"><strong>${laneCost.toLocaleString('nb-NO')} kr</strong></td>
    `;
    tbody.appendChild(groupTr);

    laneNotes.forEach((note, stepIdx) => {
      const tr = document.createElement('tr');
      const textarea = note.element
        ? note.element.querySelector('textarea')
        : null;
      const taskTitle = textarea
        ? textarea.value.trim()
        : note.text || 'Process Task';
      const stepNum = stepIdx + 1;

      tr.innerHTML = `
        <td style="padding-left: 18px;">${escapeHtml(disp)}</td>
        <td>Step ${stepNum} (${taskCodes[note.id] || 'T10'})</td>
        <td>${escapeHtml(taskTitle)}</td>
        <td class="text-right">${note.duration || 1}d</td>
        <td class="text-right">${note.plannedCost ? Number(note.plannedCost).toLocaleString('nb-NO') + ' kr' : '0 kr'}</td>
      `;
      tbody.appendChild(tr);
    });
  });

  updateSidebarSwimlanes();
}

const btnSwimlaneModeDiagram = document.getElementById(
  'btn-swimlane-mode-diagram'
);
const btnSwimlaneModeTable = document.getElementById('btn-swimlane-mode-table');
const btnExportSwimlanePng = document.getElementById('btn-export-swimlane-png');
const btnSwimlaneFitHeight = document.getElementById('btn-swimlane-fit-height');
const btnSwimlaneZoomOut = document.getElementById('btn-swimlane-zoom-out');
const btnSwimlaneZoomIn = document.getElementById('btn-swimlane-zoom-in');

if (btnSwimlaneFitHeight) {
  btnSwimlaneFitHeight.addEventListener('click', () => {
    swimlaneZoomMode = 'fit';
    updateSwimlaneScale();
  });
}

if (btnSwimlaneZoomOut) {
  btnSwimlaneZoomOut.addEventListener('click', () => {
    if (swimlaneZoomMode === 'fit') {
      const frame = document.getElementById('vs-flowchart-frame');
      const container = document.getElementById('swimlane-diagram-container');
      const availH = container ? container.clientHeight - 24 : 500;
      const frameH = frame ? frame.offsetHeight : 500;
      swimlaneCustomScale = Math.max(0.4, availH / (frameH || 1) - 0.1);
    } else {
      swimlaneCustomScale = Math.max(0.4, swimlaneCustomScale - 0.1);
    }
    swimlaneZoomMode = 'custom';
    updateSwimlaneScale();
  });
}

if (btnSwimlaneZoomIn) {
  btnSwimlaneZoomIn.addEventListener('click', () => {
    if (swimlaneZoomMode === 'fit') {
      const frame = document.getElementById('vs-flowchart-frame');
      const container = document.getElementById('swimlane-diagram-container');
      const availH = container ? container.clientHeight - 24 : 500;
      const frameH = frame ? frame.offsetHeight : 500;
      swimlaneCustomScale = Math.min(2.0, availH / (frameH || 1) + 0.1);
    } else {
      swimlaneCustomScale = Math.min(2.0, swimlaneCustomScale + 0.1);
    }
    swimlaneZoomMode = 'custom';
    updateSwimlaneScale();
  });
}

if (btnExportSwimlanePng) {
  btnExportSwimlanePng.addEventListener('click', () => {
    exportFlowchartAsPng();
  });
}

function exportFlowchartAsPng() {
  const frame = document.getElementById('vs-flowchart-frame');
  if (!frame) return;

  // Create clean printable/export SVG wrapper or image
  const svgEl = document.getElementById('vs-flowchart-svg');
  if (!svgEl) return;

  announceA11y('Exporting Vertical Swimlane Flowchart...');

  // Use canvas drawing or printable window
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to export the Flowchart image/print document.');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Vertical Swimlane Flowchart</title>
        <link rel="stylesheet" href="styles.css">
        <style>
          body { margin: 20px; background: #ffffff; display: flex; justify-content: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .vs-flowchart-frame { box-shadow: none; width: 100%; min-width: 900px; transform: none !important; }
        </style>
      </head>
      <body>
        ${frame.outerHTML}
        <script>
          setTimeout(() => { window.print(); }, 300);
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

if (btnSwimlaneModeDiagram) {
  btnSwimlaneModeDiagram.addEventListener('click', () => {
    currentSwimlaneSubView = 'diagram';
    btnSwimlaneModeDiagram.classList.add('active');
    if (btnSwimlaneModeTable) btnSwimlaneModeTable.classList.remove('active');
    renderSwimlaneView();
  });
}

if (btnSwimlaneModeTable) {
  btnSwimlaneModeTable.addEventListener('click', () => {
    currentSwimlaneSubView = 'table';
    btnSwimlaneModeTable.classList.add('active');
    if (btnSwimlaneModeDiagram)
      btnSwimlaneModeDiagram.classList.remove('active');
    renderSwimlaneView();
  });
}

const autoSwimlaneBtn = document.getElementById('btn-auto-swimlane');
if (autoSwimlaneBtn) {
  autoSwimlaneBtn.addEventListener('click', () => {
    if (stickyNotes.length === 0) {
      alert('Please create some brainstorming sticky notes first!');
      return;
    }
    generateSwimlaneLayoutProposal();
    switchView('swimlane');
  });
}

window.addEventListener('resize', () => {
  if (activeView === 'swimlane') {
    if (swimlaneZoomMode === 'fit') {
      renderSwimlaneView();
    } else {
      const container = document.getElementById('swimlane-diagram-container');
      if (container) drawSwimlaneConnectors(container);
    }
  }
});

// -------------------------------------------------------------
// Gantt Schedule Generation
// -------------------------------------------------------------
let computedScheduleData = [];

function computeGanttSchedule() {
  if (stickyNotes.length === 0) {
    computedScheduleData = [];
    return;
  }

  // Sort notes horizontally so task sequence aligns with board layout
  const horizontalSorted = [...stickyNotes].sort(
    (a, b) => a.x - b.x || a.y - b.y
  );

  // Assign sequential Task IDs (T10, T20, T30...) in horizontal order
  const taskCodes = {};
  horizontalSorted.forEach((n, idx) => {
    taskCodes[n.id] = `T${(idx + 1) * 10}`;
  });

  // Track predecessors
  const predsMap = {};
  stickyNotes.forEach((n) => (predsMap[n.id] = []));
  dependencies.forEach((dep) => {
    if (predsMap[dep.to]) {
      predsMap[dep.to].push(dep.from);
    }
  });

  const taskInfo = {};
  horizontalSorted.forEach((n) => {
    const textarea = n.element ? n.element.querySelector('textarea') : null;
    const title = textarea ? textarea.value.trim() : n.text || 'Task';
    const { key: laneKey, display: lane } = getCanonicalLaneInfo(n.lane);
    taskInfo[n.id] = { title, lane, laneKey };
  });

  // CPM Forward Pass (Early Start / Early Finish)
  const baseStart = parseDateInput(ganttStartDateInput?.value);
  baseStart.setHours(0, 0, 0, 0);

  const es = {};
  const ef = {};

  function calculateEarlyDates(noteId, visited = new Set(), stack = new Set()) {
    if (ef[noteId]) return;
    if (stack.has(noteId)) {
      // Cycle fallback
      const note = stickyNotes.find((n) => n.id === noteId);
      es[noteId] = new Date(baseStart);
      const dur = note.duration || 1;
      ef[noteId] = new Date(
        baseStart.getTime() + (dur - 1) * 24 * 60 * 60 * 1000
      );
      return;
    }
    stack.add(noteId);
    visited.add(noteId);

    const note = stickyNotes.find((n) => n.id === noteId);
    const preds = predsMap[noteId];

    let earlyStart = new Date(baseStart);
    if (preds.length > 0) {
      let maxPredecessorEF = 0;
      preds.forEach((pId) => {
        calculateEarlyDates(pId, visited, stack);
        if (ef[pId] && ef[pId].getTime() > maxPredecessorEF) {
          maxPredecessorEF = ef[pId].getTime();
        }
      });
      if (maxPredecessorEF > 0) {
        earlyStart = new Date(maxPredecessorEF + 24 * 60 * 60 * 1000);
      }
    }

    const durationVal = note.duration || 1;
    const earlyFinish = new Date(
      earlyStart.getTime() + (durationVal - 1) * 24 * 60 * 60 * 1000
    );

    es[noteId] = earlyStart;
    ef[noteId] = earlyFinish;
    stack.delete(noteId);
  }

  stickyNotes.forEach((n) => {
    calculateEarlyDates(n.id);
  });

  // Map successors for Backward Pass
  const successorsMap = {};
  stickyNotes.forEach((n) => (successorsMap[n.id] = []));
  dependencies.forEach((dep) => {
    if (successorsMap[dep.from]) {
      successorsMap[dep.from].push(dep.to);
    }
  });

  // Calculate project finish date (max of all early finishes)
  let projectFinishMs = baseStart.getTime();
  stickyNotes.forEach((n) => {
    if (ef[n.id] && ef[n.id].getTime() > projectFinishMs) {
      projectFinishMs = ef[n.id].getTime();
    }
  });
  const projectFinish = new Date(projectFinishMs);

  // CPM Backward Pass (Late Start / Late Finish)
  const ls = {};
  const lf = {};

  function calculateLateDates(noteId, visited = new Set(), stack = new Set()) {
    if (lf[noteId]) return;
    if (stack.has(noteId)) {
      lf[noteId] = new Date(ef[noteId]);
      ls[noteId] = new Date(es[noteId]);
      return;
    }
    stack.add(noteId);
    visited.add(noteId);

    const note = stickyNotes.find((n) => n.id === noteId);
    const successors = successorsMap[noteId];

    let lateFinish = new Date(projectFinish);
    if (successors.length > 0) {
      let minSuccessorLS = Infinity;
      successors.forEach((sId) => {
        calculateLateDates(sId, visited, stack);
        if (ls[sId] && ls[sId].getTime() < minSuccessorLS) {
          minSuccessorLS = ls[sId].getTime();
        }
      });
      if (minSuccessorLS !== Infinity) {
        lateFinish = new Date(minSuccessorLS - 24 * 60 * 60 * 1000);
      }
    }

    const durationVal = note.duration || 1;
    const lateStart = new Date(
      lateFinish.getTime() - (durationVal - 1) * 24 * 60 * 60 * 1000
    );

    lf[noteId] = lateFinish;
    ls[noteId] = lateStart;
    stack.delete(noteId);
  }

  stickyNotes.forEach((n) => {
    calculateLateDates(n.id);
  });

  // Populate computed schedule with CPM data
  const schedule = [];
  horizontalSorted.forEach((n) => {
    const datesStart = es[n.id];
    const datesEnd = ef[n.id];
    const lateStart = ls[n.id];
    const lateEnd = lf[n.id];
    const totalFloat = Math.round(
      (lateEnd.getTime() - datesEnd.getTime()) / (24 * 60 * 60 * 1000)
    );
    const onCriticalPath = totalFloat === 0;

    const preds =
      predsMap[n.id].map((pId) => `${taskCodes[pId]}FS`).join(', ') || 'None';
    const { title, lane, laneKey } = taskInfo[n.id];

    schedule.push({
      id: n.id,
      code: taskCodes[n.id],
      title: title,
      lane: lane,
      laneKey: laneKey,
      duration: n.duration || 1,
      plannedHours: n.plannedHours || 0,
      plannedCost: n.plannedCost || 0,
      actualHours: n.actualHours || 0,
      actualCost: n.actualCost || 0,
      progress: n.progress || 0,
      predecessors: preds,
      start: datesStart,
      end: datesEnd,
      lateStart: lateStart,
      lateEnd: lateEnd,
      float: totalFloat,
      isCritical: onCriticalPath,
    });
  });

  computedScheduleData = schedule;
}

function getGanttTaskCodes() {
  const taskCodes = {};
  const noteIdsByCode = {};
  const horizontalSorted = [...stickyNotes].sort(
    (a, b) => a.x - b.x || a.y - b.y
  );
  horizontalSorted.forEach((note, index) => {
    const code = `T${(index + 1) * 10}`;
    taskCodes[note.id] = code;
    noteIdsByCode[code] = note.id;
  });
  return { taskCodes, noteIdsByCode };
}

function updateGanttPredecessors(noteId, predecessorText) {
  const { noteIdsByCode } = getGanttTaskCodes();
  const oldDependencies = dependencies.filter(
    (dependency) => dependency.to === noteId
  );
  const requestedCodes = String(predecessorText || '')
    .split(',')
    .map((value) => value.trim().toUpperCase().replace(/FS$/, ''))
    .filter((value) => value && value !== 'NONE');
  const predecessorIds = [...new Set(requestedCodes)]
    .map((code) => noteIdsByCode[code])
    .filter((predecessorId) => predecessorId && predecessorId !== noteId);
  const newDependencies = predecessorIds.map((predecessorId) => ({
    from: predecessorId,
    to: noteId,
  }));

  const dependenciesChanged =
    oldDependencies.length !== newDependencies.length ||
    oldDependencies.some(
      (dependency, index) =>
        dependency.from !== newDependencies[index]?.from ||
        dependency.to !== newDependencies[index]?.to
    );
  if (!dependenciesChanged) return;

  dependencies = dependencies.filter((dependency) => dependency.to !== noteId);
  dependencies.push(...newDependencies);
  pushAction({
    type: 'edit-predecessors',
    noteId,
    oldDependencies,
    newDependencies,
  });
  drawAll();
  refreshGanttSchedule();
  announceA11y('Task predecessors updated.');
}

function updateGanttActuals(noteId, actualHours, actualCost, progress) {
  const note = stickyNotes.find((candidate) => candidate.id === noteId);
  if (!note) return;

  const oldState = {
    actualHours: note.actualHours || 0,
    actualCost: note.actualCost || 0,
    progress: note.progress || 0,
  };
  const newState = {
    actualHours: Math.max(0, Number(actualHours) || 0),
    actualCost: Math.max(0, Number(actualCost) || 0),
    progress: Math.min(100, Math.max(0, Number(progress) || 0)),
  };

  if (
    oldState.actualHours === newState.actualHours &&
    oldState.actualCost === newState.actualCost &&
    oldState.progress === newState.progress
  )
    return;

  Object.assign(note, newState);
  pushAction({ type: 'edit-actuals', noteId, oldState, newState });
  refreshGanttSchedule();
  announceA11y('Task actuals and progress updated.');
}

function getScheduleRAG(endDate, statusDate) {
  const daysFromStatus = Math.ceil(
    (endDate.getTime() - statusDate.getTime()) / (24 * 60 * 60 * 1000)
  );
  if (daysFromStatus <= 0)
    return { level: 'green', label: 'GREEN', daysFromStatus };
  if (daysFromStatus <= 7)
    return { level: 'amber', label: 'AMBER', daysFromStatus };
  return { level: 'red', label: 'RED', daysFromStatus };
}

function renderGanttView() {
  const tbody = document.querySelector('#gantt-view-table tbody');
  tbody.innerHTML = '';

  const timelineScrollArea = document.getElementById(
    'gantt-timeline-scroll-area'
  );
  const timelineContent = document.getElementById('gantt-timeline-content');
  const horizontalRoller = document.getElementById(
    'gantt-horizontal-roller-input'
  );
  const headerRow = document.getElementById('gantt-timeline-header-row');
  const barsContainer = document.getElementById(
    'gantt-timeline-bars-container'
  );
  const statusDateMarker = document.getElementById('gantt-status-date-marker');
  const scheduleRAG = document.getElementById('gantt-schedule-rag');
  headerRow.innerHTML = '';
  barsContainer.innerHTML = '';

  if (stickyNotes.length === 0) {
    if (ganttEndDate) ganttEndDate.innerText = '—';
    if (ganttCriticalPathDays) ganttCriticalPathDays.innerText = '—';
    if (scheduleRAG) {
      scheduleRAG.className = 'gantt-rag-badge amber';
      scheduleRAG.innerText = 'Schedule Status: —';
    }
    if (statusDateMarker) statusDateMarker.style.display = 'none';
    if (timelineContent) timelineContent.style.width = '100%';
    if (horizontalRoller) {
      horizontalRoller.max = '0';
      horizontalRoller.value = '0';
    }
    tbody.innerHTML =
      '<tr><td colspan="13" style="text-align: center; color: var(--text-muted); padding: 24px;">No tasks found. Add sticky notes to the Board first!</td></tr>';
    return;
  }

  computeGanttSchedule();

  // Render WBS table
  computedScheduleData.forEach((item) => {
    const note =
      stickyNotes.find((n) => n.id === item.id) ||
      stickyNotes.find(
        (candidate, index) => `T${(index + 1) * 10}` === item.code
      );

    const tr = document.createElement('tr');
    const taskStatusDate = parseDateInput(
      ganttStatusDateInput?.value,
      item.start
    );
    const taskRAG = getScheduleRAG(new Date(item.end), taskStatusDate);

    // 1. Task ID
    const tdCode = document.createElement('td');
    tdCode.innerHTML = `<span class="gantt-task-code">${item.code}</span>`;

    // 2. WBS Name (Task Title)
    const tdTitle = document.createElement('td');
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'gantt-cell-input gantt-title-input';
    titleInput.value = item.title;
    titleInput.setAttribute('aria-label', `WBS Name for ${item.code}`);
    titleInput.title = 'Edit task title / WBS name';
    titleInput.addEventListener('input', () => {
      if (note) {
        note.text = titleInput.value;
        const textarea = note.element?.querySelector('textarea');
        if (textarea) textarea.value = titleInput.value;
      }
    });
    titleInput.addEventListener('change', () => {
      if (note) {
        note.text = titleInput.value;
        const textarea = note.element?.querySelector('textarea');
        if (textarea) textarea.value = titleInput.value;
        autoSaveCurrentState();
        if (typeof activeView !== 'undefined' && activeView === 'swimlane') {
          renderSwimlaneView();
        }
      }
    });
    titleInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        titleInput.blur();
      } else if (event.key === 'Escape') {
        titleInput.value = item.title;
        titleInput.blur();
      }
    });
    tdTitle.appendChild(titleInput);

    // 3. Role/Lane
    const tdLane = document.createElement('td');
    const laneInput = document.createElement('input');
    laneInput.type = 'text';
    laneInput.className = 'gantt-cell-input gantt-lane-input';
    laneInput.value = item.lane;
    laneInput.setAttribute('aria-label', `Role/Lane for ${item.code}`);
    laneInput.title = 'Edit discipline or swimlane role';
    laneInput.addEventListener('input', () => {
      if (note) {
        note.lane = laneInput.value.trim() || 'Generelt';
        updateNoteBadge(note);
      }
    });
    laneInput.addEventListener('change', () => {
      if (note) {
        note.lane = laneInput.value.trim() || 'Generelt';
        updateNoteBadge(note);
        updateSidebarSwimlanes();
        refreshGanttSchedule();
        autoSaveCurrentState();
      }
    });
    laneInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        laneInput.blur();
      } else if (event.key === 'Escape') {
        laneInput.value = item.lane;
        laneInput.blur();
      }
    });
    tdLane.appendChild(laneInput);

    // 4. Duration
    const tdDuration = document.createElement('td');
    tdDuration.className = 'text-right';
    const durationInput = document.createElement('input');
    durationInput.type = 'text';
    durationInput.inputMode = 'numeric';
    durationInput.className =
      'gantt-cell-input gantt-duration-input text-right';
    durationInput.value = String(item.duration || 1);
    durationInput.setAttribute(
      'aria-label',
      `Duration in days for ${item.code}`
    );
    durationInput.title = 'Duration in days (1 or greater)';
    durationInput.addEventListener('change', () => {
      if (note) {
        const val = Math.max(
          1,
          parseInt(parseFormattedNumber(durationInput.value)) || 1
        );
        durationInput.value = String(val);
        note.duration = val;
        updateNoteBadge(note);
        refreshGanttSchedule();
        autoSaveCurrentState();
      }
    });
    durationInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        durationInput.blur();
      } else if (event.key === 'Escape') {
        durationInput.value = String(item.duration || 1);
        durationInput.blur();
      }
    });
    tdDuration.appendChild(durationInput);

    // 5. Hours (Planned Hours)
    const tdHours = document.createElement('td');
    tdHours.className = 'text-right';
    const hoursInput = document.createElement('input');
    hoursInput.type = 'text';
    hoursInput.inputMode = 'decimal';
    hoursInput.className = 'gantt-cell-input gantt-hours-input text-right';
    hoursInput.value = String(item.plannedHours || 0);
    hoursInput.setAttribute('aria-label', `Planned hours for ${item.code}`);
    hoursInput.title = 'Planned baseline hours (0 or greater)';
    hoursInput.addEventListener('change', () => {
      if (note) {
        const val = parseFormattedNumber(hoursInput.value);
        hoursInput.value = String(val);
        note.plannedHours = val;
        updateNoteBadge(note);
        autoSaveCurrentState();
        if (typeof activeView !== 'undefined' && activeView === 'evm') {
          renderEVMView();
        }
      }
    });
    hoursInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        hoursInput.blur();
      } else if (event.key === 'Escape') {
        hoursInput.value = String(item.plannedHours || 0);
        hoursInput.blur();
      }
    });
    tdHours.appendChild(hoursInput);

    // 6. Cost (Planned Cost - formatted with comma thousand separator, e.g. 25,000)
    const tdCost = document.createElement('td');
    tdCost.className = 'text-right';
    const costInput = document.createElement('input');
    costInput.type = 'text';
    costInput.inputMode = 'numeric';
    costInput.className = 'gantt-cell-input gantt-cost-input text-right';
    costInput.value = formatThousands(item.plannedCost);
    costInput.setAttribute('aria-label', `Planned cost for ${item.code}`);
    costInput.title =
      'Planned budget cost (numbers with comma thousand separator)';
    costInput.addEventListener('focus', () => {
      costInput.select();
    });
    costInput.addEventListener('change', () => {
      if (note) {
        const val = parseFormattedNumber(costInput.value);
        note.plannedCost = val;
        costInput.value = formatThousands(val);
        updateNoteBadge(note);
        autoSaveCurrentState();
        if (typeof activeView !== 'undefined' && activeView === 'evm') {
          renderEVMView();
        }
      }
    });
    costInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        costInput.blur();
      } else if (event.key === 'Escape') {
        costInput.value = formatThousands(item.plannedCost);
        costInput.blur();
      }
    });
    tdCost.appendChild(costInput);

    // 7. Predecessors
    const tdPred = document.createElement('td');
    const predInput = document.createElement('input');
    predInput.type = 'text';
    predInput.className = 'gantt-cell-input gantt-predecessor-input';
    predInput.value = item.predecessors;
    predInput.setAttribute('aria-label', `Predecessors for ${item.code}`);
    predInput.title =
      'Enter task IDs separated by commas, for example T10FS, T20FS';
    predInput.addEventListener('change', () => {
      if (note) updateGanttPredecessors(note.id, predInput.value);
    });
    predInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        predInput.blur();
      } else if (event.key === 'Escape') {
        predInput.value = item.predecessors;
        predInput.blur();
      }
    });
    tdPred.appendChild(predInput);

    // 8. Act Hours (Actual Hours)
    const tdActHours = document.createElement('td');
    tdActHours.className = 'text-right';
    const actHoursInput = document.createElement('input');
    actHoursInput.type = 'text';
    actHoursInput.inputMode = 'decimal';
    actHoursInput.className =
      'gantt-cell-input gantt-acthours-input text-right';
    actHoursInput.value = String(item.actualHours || 0);
    actHoursInput.placeholder = '0';
    actHoursInput.setAttribute('aria-label', `Actual hours for ${item.code}`);
    actHoursInput.title = 'Actual hours spent (0 or greater)';
    actHoursInput.addEventListener('focus', () => {
      actHoursInput.select();
    });
    actHoursInput.addEventListener('change', () => {
      if (note) {
        const val = parseFormattedNumber(actHoursInput.value);
        note.actualHours = val;
        actHoursInput.value = String(val);
        autoSaveCurrentState();
        if (typeof activeView !== 'undefined' && activeView === 'evm') {
          renderEVMView();
        }
      }
    });
    actHoursInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        actHoursInput.blur();
      } else if (event.key === 'Escape') {
        actHoursInput.value = String(item.actualHours || 0);
        actHoursInput.blur();
      }
    });
    tdActHours.appendChild(actHoursInput);

    // 9. Act Cost (Actual Cost - formatted with comma thousand separator, e.g. 15,000)
    const tdActCost = document.createElement('td');
    tdActCost.className = 'text-right';
    const actCostInput = document.createElement('input');
    actCostInput.type = 'text';
    actCostInput.inputMode = 'numeric';
    actCostInput.className = 'gantt-cell-input gantt-actcost-input text-right';
    actCostInput.value = formatThousands(item.actualCost);
    actCostInput.placeholder = '0';
    actCostInput.setAttribute('aria-label', `Actual cost for ${item.code}`);
    actCostInput.title =
      'Actual cost spent (numbers with comma thousand separator)';
    actCostInput.addEventListener('focus', () => {
      actCostInput.select();
    });
    actCostInput.addEventListener('change', () => {
      if (note) {
        const val = parseFormattedNumber(actCostInput.value);
        note.actualCost = val;
        actCostInput.value = formatThousands(val);
        autoSaveCurrentState();
        if (typeof activeView !== 'undefined' && activeView === 'evm') {
          renderEVMView();
        }
      }
    });
    actCostInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        actCostInput.blur();
      } else if (event.key === 'Escape') {
        actCostInput.value = formatThousands(item.actualCost);
        actCostInput.blur();
      }
    });
    tdActCost.appendChild(actCostInput);

    // 10. Progress %
    const tdProgress = document.createElement('td');
    tdProgress.className = 'text-right';
    const progressInput = document.createElement('input');
    progressInput.type = 'text';
    progressInput.inputMode = 'decimal';
    progressInput.className =
      'gantt-cell-input gantt-progress-input text-right';
    progressInput.value = String(item.progress || 0);
    progressInput.placeholder = '0–100';
    progressInput.setAttribute(
      'aria-label',
      `Progress percentage for ${item.code}`
    );
    progressInput.title = 'Progress percentage (0 to 100)';
    progressInput.addEventListener('focus', () => {
      progressInput.select();
    });
    progressInput.addEventListener('change', () => {
      if (note) {
        let val = parseFormattedNumber(progressInput.value);
        if (val > 100) val = 100;
        note.progress = val;
        progressInput.value = String(val);
        autoSaveCurrentState();
        refreshGanttSchedule();
        if (typeof activeView !== 'undefined' && activeView === 'evm') {
          renderEVMView();
        }
      }
    });
    progressInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        progressInput.blur();
      } else if (event.key === 'Escape') {
        progressInput.value = String(item.progress || 0);
        progressInput.blur();
      }
    });
    tdProgress.appendChild(progressInput);

    // 11. Start Date
    const tdStart = document.createElement('td');
    tdStart.innerText = formatScheduleDate(item.start);
    tdStart.className = 'gantt-date-cell';

    // 12. End Date
    const tdEnd = document.createElement('td');
    tdEnd.innerText = formatScheduleDate(item.end);
    tdEnd.className = `gantt-date-cell gantt-date-${taskRAG.level}`;
    tdEnd.title =
      taskRAG.daysFromStatus <= 0
        ? 'Planned end is on or before the Status Date'
        : `Planned end is ${taskRAG.daysFromStatus} day(s) after the Status Date`;

    // 13. Schedule RAG status
    const tdStatus = document.createElement('td');
    const statusBadge = document.createElement('span');
    statusBadge.className = `gantt-rag-badge ${taskRAG.level}`;
    statusBadge.innerText = taskRAG.label;
    statusBadge.title = tdEnd.title;
    statusBadge.setAttribute(
      'aria-label',
      `${item.code} schedule status: ${taskRAG.label}`
    );
    tdStatus.appendChild(statusBadge);

    // Append cells to row
    tr.appendChild(tdCode);
    tr.appendChild(tdTitle);
    tr.appendChild(tdLane);
    tr.appendChild(tdDuration);
    tr.appendChild(tdHours);
    tr.appendChild(tdCost);
    tr.appendChild(tdPred);
    tr.appendChild(tdActHours);
    tr.appendChild(tdActCost);
    tr.appendChild(tdProgress);
    tr.appendChild(tdStart);
    tr.appendChild(tdEnd);
    tr.appendChild(tdStatus);

    tbody.appendChild(tr);
  });

  // Determine date bounds
  let minStart = new Date(
    Math.min(...computedScheduleData.map((d) => d.start.getTime()))
  );
  let maxEnd = new Date(
    Math.max(...computedScheduleData.map((d) => d.end.getTime()))
  );
  const statusDate = parseDateInput(ganttStatusDateInput?.value, minStart);
  const projectRAG = getScheduleRAG(maxEnd, statusDate);
  if (scheduleRAG) {
    scheduleRAG.className = `gantt-rag-badge ${projectRAG.level}`;
    scheduleRAG.innerText =
      projectRAG.daysFromStatus <= 0
        ? 'Schedule Status: GREEN · On or before Status Date'
        : `Schedule Status: ${projectRAG.label} · ${projectRAG.daysFromStatus} day(s) after Status Date`;
    scheduleRAG.title = `Calculated end date ${formatScheduleDate(maxEnd)} compared with Status Date ${formatScheduleDate(statusDate)}`;
  }

  // Keep the status date visible even when it is just before or after the
  // current schedule, while preserving the same scale used by the bars.
  if (statusDate < minStart) minStart = new Date(statusDate);
  if (statusDate > maxEnd) maxEnd = new Date(statusDate);

  const criticalPathDays = Math.max(
    1,
    Math.round(
      (maxEnd.getTime() - minStart.getTime()) / (24 * 60 * 60 * 1000)
    ) + 1
  );
  if (ganttEndDate) ganttEndDate.innerText = formatScheduleDate(maxEnd);
  if (ganttCriticalPathDays)
    ganttCriticalPathDays.innerText = `${criticalPathDays} days`;

  minStart.setHours(0, 0, 0, 0);
  maxEnd.setHours(23, 59, 59, 999);

  const oneDayMs = 24 * 60 * 60 * 1000;
  const totalDays = Math.max(
    1,
    Math.round((maxEnd.getTime() - minStart.getTime()) / oneDayMs) + 1
  );

  // Keep each day readable and let the window roller navigate long schedules.
  const timelineWidth = Math.max(1, totalDays * 48);
  if (timelineContent) timelineContent.style.width = `${timelineWidth}px`;

  if (statusDateMarker) {
    const statusOffsetDays = Math.round(
      (statusDate.getTime() - minStart.getTime()) / oneDayMs
    );
    const statusDateLabel = statusDateMarker.querySelector(
      '.gantt-status-date-label'
    );
    statusDateMarker.style.display = 'block';
    statusDateMarker.style.left = `${(statusOffsetDays / totalDays) * 100}%`;
    statusDateMarker.setAttribute(
      'aria-label',
      `Status date: ${formatScheduleDate(statusDate)}`
    );
    if (statusDateLabel) {
      statusDateLabel.innerText = `Status Date · ${formatScheduleDate(statusDate)}`;
    }
  }

  // Setup grid columns
  headerRow.style.gridTemplateColumns = `repeat(${totalDays}, 1fr)`;

  for (let i = 0; i < totalDays; i++) {
    const dayCell = document.createElement('div');
    dayCell.innerText = `D${i + 1}`;
    dayCell.title = formatScheduleDate(
      new Date(minStart.getTime() + i * oneDayMs)
    );
    headerRow.appendChild(dayCell);
  }

  // Render Gantt bars. Each Role/Lane group gets as many stacked rows as needed
  // to avoid overlapping task bars.
  const groupedSchedule = new Map();
  computedScheduleData.forEach((item) => {
    if (!groupedSchedule.has(item.laneKey)) {
      groupedSchedule.set(item.laneKey, []);
    }
    groupedSchedule.get(item.laneKey).push(item);
  });

  groupedSchedule.forEach((items) => {
    // Sort items by start date
    const sorted = [...items].sort(
      (a, b) => a.start.getTime() - b.start.getTime()
    );
    const tracks = [];

    sorted.forEach((item) => {
      let placed = false;
      for (let i = 0; i < tracks.length; i++) {
        const last = tracks[i][tracks[i].length - 1];

        const lastEnd = new Date(last.end);
        lastEnd.setHours(23, 59, 59, 999);
        const curStart = new Date(item.start);
        curStart.setHours(0, 0, 0, 0);

        if (curStart.getTime() > lastEnd.getTime()) {
          tracks[i].push(item);
          placed = true;
          break;
        }
      }
      if (!placed) {
        tracks.push([item]);
      }
    });

    // Render each track as a row
    tracks.forEach((trackItems) => {
      const row = document.createElement('div');
      row.className = 'gantt-bar-row';
      row.style.gridTemplateColumns = `repeat(${totalDays}, 1fr)`;

      trackItems.forEach((item) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'gantt-bar-wrapper';
        wrapper.style.gridColumn = `1 / span ${totalDays}`;

        const startOffsetDays = Math.round(
          (item.start.getTime() - minStart.getTime()) / oneDayMs
        );
        const durationDays = item.duration;

        const bar = document.createElement('div');
        const barRAG = getScheduleRAG(new Date(item.end), statusDate);
        bar.className =
          `gantt-bar ${barRAG.level}` + (item.isCritical ? ' critical' : '');
        bar.style.left = `${(startOffsetDays / totalDays) * 100}%`;
        bar.style.width = `${(durationDays / totalDays) * 100}%`;
        bar.innerText = `${item.code}: ${item.title}`;
        bar.title = `${item.title} (${durationDays} days: ${formatScheduleDate(item.start)} to ${formatScheduleDate(item.end)})`;

        wrapper.appendChild(bar);
        row.appendChild(wrapper);
      });
      barsContainer.appendChild(row);
    });
  });

  updateGanttHorizontalRoller(timelineScrollArea, horizontalRoller);
}

function updateGanttHorizontalRoller(scrollArea, roller) {
  if (!scrollArea || !roller) return;

  const maxScroll = Math.max(
    0,
    scrollArea.scrollWidth - scrollArea.clientWidth
  );
  roller.max = String(maxScroll);
  roller.value = String(Math.min(scrollArea.scrollLeft, maxScroll));
}

const ganttTimelineScrollArea = document.getElementById(
  'gantt-timeline-scroll-area'
);
const ganttHorizontalRoller = document.getElementById(
  'gantt-horizontal-roller-input'
);
if (ganttTimelineScrollArea && ganttHorizontalRoller) {
  ganttTimelineScrollArea.addEventListener('scroll', () => {
    ganttHorizontalRoller.value = String(ganttTimelineScrollArea.scrollLeft);
  });
  ganttHorizontalRoller.addEventListener('input', () => {
    ganttTimelineScrollArea.scrollLeft = Number(ganttHorizontalRoller.value);
  });
  window.addEventListener('resize', () => {
    updateGanttHorizontalRoller(ganttTimelineScrollArea, ganttHorizontalRoller);
  });
}

function refreshGanttSchedule() {
  if (activeView === 'gantt') renderGanttView();
  if (activeView === 'evm') renderEVMView();
}

if (ganttStartDateInput)
  ganttStartDateInput.addEventListener('change', refreshGanttSchedule);
if (ganttStatusDateInput)
  ganttStatusDateInput.addEventListener('change', refreshGanttSchedule);

const viewGanttBtn = document.getElementById('btn-view-gantt');
if (viewGanttBtn) {
  viewGanttBtn.addEventListener('click', () => {
    if (stickyNotes.length === 0) {
      alert('Please create sticky notes first!');
      return;
    }
    computeGanttSchedule();
    switchView('gantt');
  });
}

// CSV Export
document.getElementById('btn-export-csv-view').addEventListener('click', () => {
  if (computedScheduleData.length === 0) return;

  let csvContent = 'data:text/csv;charset=utf-8,';
  csvContent +=
    'Task ID;Task Name;Lane/Role;Duration (Days);Planned Hours;Planned Cost;Predecessors;Act Hours;Act Cost;Progress %;Start Date;End Date\r\n';

  computedScheduleData.forEach((item) => {
    const row = [
      item.code,
      `"${item.title.replace(/"/g, '""')}"`,
      item.lane,
      item.duration,
      item.plannedHours,
      item.plannedCost,
      item.predecessors,
      item.actualHours,
      item.actualCost,
      item.progress,
      formatScheduleDate(item.start),
      formatScheduleDate(item.end),
    ].join(';');
    csvContent += row + '\r\n';
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `gantt_project_schedule_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});

// Accessibility Announcements Helper
function announceA11y(text) {
  a11yAnnouncer.innerText = text;
}

// Execute Area Erase Function
function executeAreaErase(start, end) {
  const xMin = Math.min(start.x, end.x);
  const xMax = Math.max(start.x, end.x);
  const yMin = Math.min(start.y, end.y);
  const yMax = Math.max(start.y, end.y);

  // Guard against accidental tiny clicks
  if (xMax - xMin < 5 && yMax - yMin < 5) return;

  const erasedStrokes = [];
  const remainingStrokes = [];

  strokes.forEach((stroke) => {
    let isErased = false;
    if (
      [
        'rect',
        'circle',
        'line',
        'arrow',
        'diamond',
        'triangle',
        'text-box',
      ].includes(stroke.tool)
    ) {
      const cx = (stroke.start.x + stroke.end.x) / 2;
      const cy = (stroke.start.y + stroke.end.y) / 2;
      if (cx >= xMin && cx <= xMax && cy >= yMin && cy <= yMax) {
        isErased = true;
      }
    } else {
      // Pen, highlighter, eraser (freehand points)
      const anyPointIn =
        stroke.points &&
        stroke.points.some(
          (p) => p.x >= xMin && p.x <= xMax && p.y >= yMin && p.y <= yMax
        );
      if (anyPointIn) {
        isErased = true;
      }
    }

    if (isErased) {
      erasedStrokes.push(stroke);
    } else {
      remainingStrokes.push(stroke);
    }
  });

  const erasedNotes = [];
  const remainingNotes = [];

  stickyNotes.forEach((note) => {
    const cx = note.x + 80;
    const cy = note.y + 55;
    if (cx >= xMin && cx <= xMax && cy >= yMin && cy <= yMax) {
      erasedNotes.push({
        id: note.id,
        x: note.x,
        y: note.y,
        color: note.color,
        text: note.element.querySelector('textarea').value,
        lane: note.lane,
        duration: note.duration,
        plannedHours: note.plannedHours,
        plannedCost: note.plannedCost,
        actualHours: note.actualHours,
        actualCost: note.actualCost,
        progress: note.progress,
        resource: note.resource,
        riskFactor: note.riskFactor,
        impactFactor: note.impactFactor,
        weightedFactor: note.weightedFactor,
      });
      note.element.remove();
    } else {
      remainingNotes.push(note);
    }
  });

  const erasedNoteIds = erasedNotes.map((n) => n.id);
  const oldDeps = dependencies.filter(
    (d) => erasedNoteIds.includes(d.from) || erasedNoteIds.includes(d.to)
  );

  if (erasedStrokes.length > 0 || erasedNotes.length > 0) {
    strokes = remainingStrokes;
    stickyNotes = remainingNotes;
    dependencies = dependencies.filter(
      (d) => !erasedNoteIds.includes(d.from) && !erasedNoteIds.includes(d.to)
    );

    pushAction({
      type: 'area-erase',
      erasedStrokes: erasedStrokes,
      erasedNotes: erasedNotes,
      oldDependencies: oldDeps,
    });
  }
}

function openTextBoxEditor(stroke, x, y, width, height, isNew = false) {
  const ta = document.createElement('textarea');
  ta.className = 'canvas-textbox-editor';
  ta.style.position = 'absolute';
  ta.style.left = `${x}px`;
  ta.style.top = `${y}px`;
  ta.style.width = `${Math.max(120, width)}px`;
  ta.style.height = `${Math.max(50, height)}px`;
  ta.style.boxSizing = 'border-box';
  ta.style.fontFamily = 'var(--font-family)';
  ta.style.fontSize = '13px';
  ta.style.lineHeight = '1.4';
  ta.style.color = stroke.color || '#1e293b';
  ta.style.padding = '8px';
  ta.style.border = `1.5px dashed ${stroke.color || '#1e293b'}`;
  ta.style.borderRadius = '4px';
  ta.style.outline = 'none';
  ta.style.zIndex = '1000';
  ta.style.resize = 'both';
  ta.style.background = 'rgba(255, 255, 255, 0.96)';
  ta.placeholder = 'Type text or annotation...';
  ta.value = stroke.text || '';

  viewport.appendChild(ta);
  ta.focus();
  if (stroke.text) {
    ta.select();
  }

  const oldText = stroke.text || '';

  const finish = () => {
    const newText = ta.value.trim();
    const finalWidth = parseInt(ta.style.width) || width;
    const finalHeight = parseInt(ta.style.height) || height;
    stroke.end = { x: x + finalWidth, y: y + finalHeight };

    if (isNew) {
      if (newText) {
        stroke.text = newText;
        strokes.push(stroke);
        pushAction({ type: 'draw', stroke: stroke });
        announceA11y('Text box created.');
      }
    } else {
      if (newText !== oldText) {
        stroke.text = newText;
        const strokeIndex = strokes.indexOf(stroke);
        if (strokeIndex !== -1) {
          pushAction({
            type: 'edit-shape-text',
            strokeIndex: strokeIndex,
            oldText: oldText,
            newText: newText,
          });
        }
        announceA11y('Text box updated.');
      }
    }

    ta.remove();
    drawAll();
    autoSaveCurrentState();
  };

  ta.addEventListener('blur', finish, { once: true });
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      ta.blur();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      ta.blur();
    }
  });
}

// Shape and text-box double click to edit text
canvas.addEventListener('dblclick', (e) => {
  const coords = getCoords(e);

  // Find topmost shape clicked (backwards iterate)
  let foundStrokeIndex = -1;
  for (let i = strokes.length - 1; i >= 0; i--) {
    const stroke = strokes[i];
    if (
      ['rect', 'circle', 'diamond', 'triangle', 'text-box'].includes(
        stroke.tool
      )
    ) {
      const xMin = Math.min(stroke.start.x, stroke.end.x);
      const xMax = Math.max(stroke.start.x, stroke.end.x);
      const yMin = Math.min(stroke.start.y, stroke.end.y);
      const yMax = Math.max(stroke.start.y, stroke.end.y);

      if (
        coords.x >= xMin &&
        coords.x <= xMax &&
        coords.y >= yMin &&
        coords.y <= yMax
      ) {
        foundStrokeIndex = i;
        break;
      }
    }
  }

  if (foundStrokeIndex !== -1) {
    const stroke = strokes[foundStrokeIndex];
    const xMin = Math.min(stroke.start.x, stroke.end.x);
    const yMin = Math.min(stroke.start.y, stroke.end.y);
    const w = Math.max(100, Math.abs(stroke.start.x - stroke.end.x));
    const h = Math.max(50, Math.abs(stroke.start.y - stroke.end.y));

    if (stroke.tool === 'text-box') {
      openTextBoxEditor(stroke, xMin, yMin, w, h, false);
      return;
    }

    // Create temporary textarea overlay
    const ta = document.createElement('textarea');
    ta.style.position = 'absolute';
    ta.style.left = `${xMin}px`;
    ta.style.top = `${yMin}px`;
    ta.style.width = `${w}px`;
    ta.style.height = `${h}px`;
    ta.style.fontFamily = 'var(--font-family)';
    ta.style.fontSize = '12px';
    ta.style.textAlign = 'center';
    ta.style.padding = '8px';
    ta.style.border = '1px solid var(--border-focus)';
    ta.style.borderRadius = '4px';
    ta.style.outline = 'none';
    ta.style.zIndex = '1000';
    ta.style.resize = 'none';
    ta.style.background = '#ffffff';
    ta.value = stroke.text || '';

    viewport.appendChild(ta);
    ta.focus();

    ta.addEventListener('blur', () => {
      const oldText = stroke.text || '';
      const newText = ta.value.trim();
      if (oldText !== newText) {
        stroke.text = newText;
        pushAction({
          type: 'edit-shape-text',
          strokeIndex: foundStrokeIndex,
          oldText: oldText,
          newText: newText,
        });
      }
      ta.remove();
      drawAll();
    });

    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        ta.blur();
      }
    });
  }
});

// Window Event Listeners
window.addEventListener('resize', resizeCanvas);

// Global hotkeys helper
window.addEventListener('keydown', (e) => {
  if (e.key === 'Shift') {
    shiftKeyPressed = true;
  }

  if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;

  // Undo/Redo shortcuts
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault();
    undoBtn.click();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
    e.preventDefault();
    redoBtn.click();
  }

  // Escape handler to close modal dialogs
  if (e.key === 'Escape') {
    if (
      userGuideDialog &&
      (userGuideDialog.open || userGuideDialog.hasAttribute('open'))
    ) {
      e.preventDefault();
      closeUserGuide();
      return;
    }
  }

  // Open/Toggle User Guide shortcut
  if (e.key === '?' || (e.shiftKey && e.key === '/') || e.key === 'F1') {
    e.preventDefault();
    if (
      userGuideDialog &&
      (userGuideDialog.open || userGuideDialog.hasAttribute('open'))
    ) {
      closeUserGuide();
    } else {
      openUserGuide();
    }
    return;
  }

  // Tool hotkeys
  switch (e.key.toLowerCase()) {
    case 's':
      document.getElementById('tool-select').click();
      break;
    case 'p':
      document.getElementById('tool-pen').click();
      break;
    case 'h':
      document.getElementById('tool-highlighter').click();
      break;
    case 'e':
      document.getElementById('tool-eraser').click();
      break;
    case 'l':
      document.getElementById('tool-line').click();
      break;
    case 'r':
      document.getElementById('tool-rect').click();
      break;
    case 'c':
      document.getElementById('tool-circle').click();
      break;
    case 'a':
      document.getElementById('tool-arrow').click();
      break;
    case 'd':
      document.getElementById('tool-diamond').click();
      break;
    case 't':
      document.getElementById('tool-triangle').click();
      break;
    case 'x':
      document.getElementById('tool-text-box').click();
      break;
    case 'n':
      document.getElementById('tool-sticky').click();
      break;
  }
});

window.addEventListener('keyup', (e) => {
  if (e.key === 'Shift') {
    shiftKeyPressed = false;
    connectingStartNote = null;
    tempArrowTarget = null;
    drawAll();
  }
});

// -------------------------------------------------------------
// Risk Matrix View
// -------------------------------------------------------------
function getRiskLevel(score) {
  if (score >= 15) return 'high';
  if (score >= 8) return 'medium';
  return 'low';
}

let currentRiskSubView = 'split'; // 'split', 'matrix', 'register'
let selectedRiskCellFilter = null; // null or 'p-i' (e.g. '5-5')

function renderRiskMatrixView() {
  const board = document.getElementById('risk-matrix-board');
  const tableBody = document.querySelector('#risk-register-table tbody');
  const summary = document.getElementById('risk-summary');
  const filterStatus = document.getElementById('risk-filter-status');
  const clearFilterBtn = document.getElementById('btn-risk-clear-filter');
  const riskViewContent = document.getElementById('risk-view-content');

  if (!board || !tableBody || !summary) return;

  // 1. Sync Subview mode classes
  if (riskViewContent) {
    riskViewContent.classList.remove(
      'mode-split',
      'mode-matrix',
      'mode-register'
    );
    riskViewContent.classList.add(`mode-${currentRiskSubView}`);
  }

  // Update subtab buttons active state
  ['split', 'matrix', 'register'].forEach((mode) => {
    const btn = document.getElementById(`btn-risk-mode-${mode}`);
    if (btn) {
      btn.classList.toggle('active', currentRiskSubView === mode);
    }
  });

  board.innerHTML = '';
  tableBody.innerHTML = '';

  // 2. Count risk distribution across 5x5 cells
  const cells = new Map();
  let lowCount = 0;
  let medCount = 0;
  let highCount = 0;

  stickyNotes.forEach((note) => {
    const probability = Math.min(5, Math.max(1, note.riskFactor || 1));
    const impact = Math.min(5, Math.max(1, note.impactFactor || 1));
    const score = probability * impact;
    const level = getRiskLevel(score);

    if (level === 'high') highCount++;
    else if (level === 'medium') medCount++;
    else lowCount++;

    const key = `${probability}-${impact}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(note);
  });

  // Summary Badges
  summary.innerHTML = `
    <span class="swimlane-badge-pill"><strong>${stickyNotes.length}</strong> Risks</span>
    <span class="risk-score-badge high" title="Score 15-25">${highCount} High</span>
    <span class="risk-score-badge medium" title="Score 8-14">${medCount} Med</span>
    <span class="risk-score-badge low" title="Score 1-7">${lowCount} Low</span>
  `;

  // 3. Render 5x5 Matrix Board
  for (let probability = 5; probability >= 1; probability--) {
    for (let impact = 1; impact <= 5; impact++) {
      const cell = document.createElement('div');
      const score = probability * impact;
      const key = `${probability}-${impact}`;
      const level = getRiskLevel(score);
      const isSelected = selectedRiskCellFilter === key;

      cell.className = `risk-matrix-cell ${level} ${isSelected ? 'selected' : ''}`;
      cell.setAttribute('data-key', key);
      cell.setAttribute(
        'title',
        `P:${probability} × I:${impact} (Score: ${score}) - Click to filter`
      );

      const notes = cells.get(key) || [];
      cell.innerHTML = `
        <span class="risk-cell-score">${score}</span>
        ${notes.length > 0 ? `<span class="risk-cell-count ${notes.length > 0 ? 'active' : ''}">${notes.length}</span>` : ''}
      `;

      cell.addEventListener('click', () => {
        if (selectedRiskCellFilter === key) {
          selectedRiskCellFilter = null; // Toggle off
        } else {
          selectedRiskCellFilter = key;
        }
        renderRiskMatrixView();
      });

      board.appendChild(cell);
    }
  }

  // 4. Render Prioritized Risk Register Table
  let filteredNotes = [...stickyNotes];
  if (selectedRiskCellFilter) {
    const [filterP, filterI] = selectedRiskCellFilter.split('-').map(Number);
    filteredNotes = filteredNotes.filter((n) => {
      const p = Math.min(5, Math.max(1, n.riskFactor || 1));
      const i = Math.min(5, Math.max(1, n.impactFactor || 1));
      return p === filterP && i === filterI;
    });

    if (filterStatus) {
      filterStatus.innerHTML = `Filtered: <strong>P:${filterP} × I:${filterI}</strong> (${filteredNotes.length} risks)`;
    }
    if (clearFilterBtn) clearFilterBtn.style.display = 'inline-block';
  } else {
    if (filterStatus) {
      filterStatus.innerText = 'Sorted by Severity (P × I)';
    }
    if (clearFilterBtn) clearFilterBtn.style.display = 'none';
  }

  const sortedNotes = filteredNotes.sort((a, b) => {
    const scoreA = (a.riskFactor || 1) * (a.impactFactor || 1);
    const scoreB = (b.riskFactor || 1) * (b.impactFactor || 1);
    if (scoreB !== scoreA) return scoreB - scoreA;
    return (Number(b.plannedCost) || 0) - (Number(a.plannedCost) || 0);
  });

  sortedNotes.forEach((note) => {
    const textarea = note.element
      ? note.element.querySelector('textarea')
      : null;
    const title = textarea
      ? textarea.value.trim()
      : note.text || 'Untitled task';
    const { display: laneDisplay } = getCanonicalLaneInfo(note.lane);
    const probability = Math.min(5, Math.max(1, note.riskFactor || 1));
    const impact = Math.min(5, Math.max(1, note.impactFactor || 1));
    const score = probability * impact;
    const level = getRiskLevel(score);
    const costStr = note.plannedCost
      ? `${Number(note.plannedCost).toLocaleString('nb-NO')} kr`
      : '0 kr';

    const row = document.createElement('tr');
    row.style.cursor = 'pointer';
    row.title = 'Double-click to edit risk properties';
    row.innerHTML = `
      <td><strong>${escapeHtml(title)}</strong></td>
      <td><span class="swimlane-badge-pill" style="font-size: 0.68rem;">${escapeHtml(laneDisplay)}</span></td>
      <td>${escapeHtml(note.resource || 'Not assigned')}</td>
      <td class="text-right">${probability}</td>
      <td class="text-right">${impact}</td>
      <td class="text-right"><span class="risk-score-badge ${level}">${score}</span></td>
      <td class="text-right">${costStr}</td>
    `;

    row.addEventListener('dblclick', () => {
      contextMenuTargetNoteId = note.id;
      openNotePropertiesDialog('note-prop-risk');
    });

    tableBody.appendChild(row);
  });

  if (sortedNotes.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="risk-empty-state">
          ${selectedRiskCellFilter ? 'No tasks found matching this cell. <button type="button" class="btn-clear-risk-filter" onclick="clearRiskFilter()">Reset Filter</button>' : 'No risks found on the board. Add sticky notes on the Board and assign risk/impact values.'}
        </td>
      </tr>
    `;
  }
}

function clearRiskFilter() {
  selectedRiskCellFilter = null;
  renderRiskMatrixView();
}
window.clearRiskFilter = clearRiskFilter;

const btnRiskModeSplit = document.getElementById('btn-risk-mode-split');
const btnRiskModeMatrix = document.getElementById('btn-risk-mode-matrix');
const btnRiskModeRegister = document.getElementById('btn-risk-mode-register');
const btnRiskClearFilter = document.getElementById('btn-risk-clear-filter');

if (btnRiskModeSplit) {
  btnRiskModeSplit.addEventListener('click', () => {
    currentRiskSubView = 'split';
    renderRiskMatrixView();
  });
}
if (btnRiskModeMatrix) {
  btnRiskModeMatrix.addEventListener('click', () => {
    currentRiskSubView = 'matrix';
    renderRiskMatrixView();
  });
}
if (btnRiskModeRegister) {
  btnRiskModeRegister.addEventListener('click', () => {
    currentRiskSubView = 'register';
    renderRiskMatrixView();
  });
}
if (btnRiskClearFilter) {
  btnRiskClearFilter.addEventListener('click', clearRiskFilter);
}

function formatCurrencyNO(val) {
  const num = Math.round(Number(val) || 0);
  return `${num.toLocaleString('nb-NO')} kr`;
}

function computeEVMData() {
  computeGanttSchedule();
  if (computedScheduleData.length === 0) {
    return {
      tasks: [],
      totalBAC: 0,
      totalPV: 0,
      totalEV: 0,
      totalAC: 0,
      totalCV: 0,
      totalSV: 0,
      cpi: 1,
      spi: 1,
      eac: 0,
      etc: 0,
      vac: 0,
      minStart: new Date(),
      maxEnd: new Date(),
      statusDate: new Date(),
      dailyTimeline: [],
    };
  }

  let minStart = new Date(
    Math.min(...computedScheduleData.map((d) => d.start.getTime()))
  );
  let maxEnd = new Date(
    Math.max(...computedScheduleData.map((d) => d.end.getTime()))
  );
  const statusDate = parseDateInput(ganttStatusDateInput?.value, minStart);

  minStart.setHours(0, 0, 0, 0);
  maxEnd.setHours(23, 59, 59, 999);
  const statusTimeEnd = new Date(
    statusDate.getFullYear(),
    statusDate.getMonth(),
    statusDate.getDate(),
    23,
    59,
    59,
    999
  ).getTime();

  let totalBAC = 0;
  let totalPV = 0;
  let totalEV = 0;
  let totalAC = 0;

  const taskEVMList = computedScheduleData.map((task) => {
    const bac = Math.max(0, Number(task.plannedCost) || 0);
    const ac = Math.max(0, Number(task.actualCost) || 0);
    const progress = Math.min(100, Math.max(0, Number(task.progress) || 0));
    const ev = bac * (progress / 100);

    const startTime = new Date(
      task.start.getFullYear(),
      task.start.getMonth(),
      task.start.getDate(),
      0,
      0,
      0,
      0
    ).getTime();
    const endTime = new Date(
      task.end.getFullYear(),
      task.end.getMonth(),
      task.end.getDate(),
      23,
      59,
      59,
      999
    ).getTime();

    let plannedFraction = 0;
    if (statusTimeEnd >= endTime) {
      plannedFraction = 1;
    } else if (statusTimeEnd <= startTime) {
      plannedFraction = 0;
    } else {
      const totalDur = Math.max(1, endTime - startTime);
      plannedFraction = Math.min(
        1,
        Math.max(0, (statusTimeEnd - startTime) / totalDur)
      );
    }

    const pv = bac * plannedFraction;
    const cv = ev - ac;
    const sv = ev - pv;
    const cpi = ac > 0 ? ev / ac : ev > 0 ? 1 : 1;
    const spi = pv > 0 ? ev / pv : ev > 0 ? 1 : 1;

    totalBAC += bac;
    totalPV += pv;
    totalEV += ev;
    totalAC += ac;

    return {
      ...task,
      bac,
      pv,
      ev,
      ac,
      cv,
      sv,
      cpi,
      spi,
      plannedFraction,
    };
  });

  const totalCV = totalEV - totalAC;
  const totalSV = totalEV - totalPV;
  const cpi = totalAC > 0 ? totalEV / totalAC : totalEV > 0 ? 1 : 1;
  const spi = totalPV > 0 ? totalEV / totalPV : totalEV > 0 ? 1 : 1;
  const eac =
    cpi > 0 ? totalBAC / cpi : totalAC + Math.max(0, totalBAC - totalEV);
  const etc = Math.max(0, eac - totalAC);
  const vac = totalBAC - eac;

  // Build daily timeline from minStart to maxEnd for time-phased S-Curve
  const oneDayMs = 24 * 60 * 60 * 1000;
  const totalDays = Math.max(
    1,
    Math.round((maxEnd.getTime() - minStart.getTime()) / oneDayMs) + 1
  );
  const dailyTimeline = [];

  for (let i = 0; i < totalDays; i++) {
    const dayDate = new Date(minStart.getTime() + i * oneDayMs);
    const dayEndTime = new Date(
      dayDate.getFullYear(),
      dayDate.getMonth(),
      dayDate.getDate(),
      23,
      59,
      59,
      999
    ).getTime();

    // Cumulative planned value across all tasks up to dayEndTime
    let cumPV = 0;
    taskEVMList.forEach((task) => {
      const sTime = new Date(
        task.start.getFullYear(),
        task.start.getMonth(),
        task.start.getDate(),
        0,
        0,
        0,
        0
      ).getTime();
      const eTime = new Date(
        task.end.getFullYear(),
        task.end.getMonth(),
        task.end.getDate(),
        23,
        59,
        59,
        999
      ).getTime();
      if (dayEndTime >= eTime) {
        cumPV += task.bac;
      } else if (dayEndTime > sTime) {
        const fraction = (dayEndTime - sTime) / Math.max(1, eTime - sTime);
        cumPV += task.bac * Math.min(1, Math.max(0, fraction));
      }
    });

    const isPastOrStatus =
      dayEndTime <= statusTimeEnd || (i === 0 && dayDate <= statusDate);
    let cumEV = null;
    let cumAC = null;
    if (isPastOrStatus) {
      cumEV = 0;
      cumAC = 0;
      taskEVMList.forEach((task) => {
        const sTime = new Date(
          task.start.getFullYear(),
          task.start.getMonth(),
          task.start.getDate(),
          0,
          0,
          0,
          0
        ).getTime();
        const eTime = new Date(
          task.end.getFullYear(),
          task.end.getMonth(),
          task.end.getDate(),
          23,
          59,
          59,
          999
        ).getTime();

        const activeEnd = Math.min(eTime, statusTimeEnd);
        const activeDur = activeEnd - sTime;

        if (activeDur > 0) {
          if (dayEndTime >= activeEnd) {
            cumEV += task.ev;
            cumAC += task.ac;
          } else if (dayEndTime > sTime) {
            const fraction = (dayEndTime - sTime) / activeDur;
            cumEV += task.ev * fraction;
            cumAC += task.ac * fraction;
          }
        }
      });
    }

    dailyTimeline.push({
      date: dayDate,
      pv: cumPV,
      ev: cumEV,
      ac: cumAC,
    });
  }

  return {
    tasks: taskEVMList,
    totalBAC,
    totalPV,
    totalEV,
    totalAC,
    totalCV,
    totalSV,
    cpi,
    spi,
    eac,
    etc,
    vac,
    minStart,
    maxEnd,
    statusDate,
    dailyTimeline,
  };
}

function drawEVMSCurve(evmData) {
  const canvas = document.getElementById('evmSCurveCanvas');
  if (!canvas) return;
  const container = document.getElementById('evm-canvas-container');
  if (!container) return;

  const rect = container.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;

  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const padLeft = 85;
  const padRight = 180;
  const padTop = 35;
  const padBottom = 35;

  const width = rect.width - padLeft - padRight;
  const height = rect.height - padTop - padBottom;

  if (evmData.dailyTimeline.length < 2 || evmData.totalBAC <= 0) {
    ctx.fillStyle = '#64748b';
    ctx.font = '13px Inter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      'Assign planned costs and dates to Board tasks to view the cumulative S-Curve.',
      rect.width / 2,
      rect.height / 2
    );
    ctx.restore();
    return;
  }

  const maxVal =
    Math.max(
      1000,
      evmData.totalBAC,
      evmData.totalAC,
      evmData.totalEV,
      evmData.eac
    ) * 1.15;

  // 1. Draw horizontal gridlines (Tufte style: no vertical gridlines)
  ctx.strokeStyle = '#f1f5f9';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#64748b';
  ctx.font = '10px Inter';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  const numTicks = 5;
  for (let i = 0; i <= numTicks; i++) {
    const val = (maxVal * i) / numTicks;
    const y = padTop + height - (height * i) / numTicks;

    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(padLeft + width, y);
    ctx.stroke();

    ctx.fillText(formatCurrencyNO(val), padLeft - 10, y);
  }

  // 2. Draw Bottom X-Axis
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padLeft, padTop + height);
  ctx.lineTo(padLeft + width, padTop + height);
  ctx.stroke();

  // Date labels along X-axis
  const totalDays = evmData.dailyTimeline.length;
  const stepDays = Math.max(1, Math.floor(totalDays / 5));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  for (let i = 0; i < totalDays; i += stepDays) {
    const pt = evmData.dailyTimeline[i];
    const x = padLeft + (width * i) / (totalDays - 1);
    ctx.fillText(formatScheduleDate(pt.date), x, padTop + height + 8);
  }
  const lastPt = evmData.dailyTimeline[totalDays - 1];
  ctx.fillText(
    formatScheduleDate(lastPt.date),
    padLeft + width,
    padTop + height + 8
  );

  // Helper coordinate mapper
  const getX = (index) => padLeft + (width * index) / (totalDays - 1);
  const getY = (val) =>
    padTop + height - (height * Math.min(maxVal, val)) / maxVal;

  // 3. Draw Planned Value (PV) Curve across the schedule
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  evmData.dailyTimeline.forEach((pt, idx) => {
    const x = getX(idx);
    const y = getY(pt.pv);
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Direct Label for PV Curve at the end
  const finalPVX = getX(totalDays - 1);
  const finalPVY = getY(lastPt.pv);
  ctx.fillStyle = '#2563eb';
  ctx.font = '600 11px Inter';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    `Planned (PV) · ${formatCurrencyNO(evmData.totalBAC)}`,
    finalPVX + 8,
    finalPVY
  );

  // Determine Status Date coordinate
  const oneDayMs = 24 * 60 * 60 * 1000;
  const statusDayIdx = Math.min(
    totalDays - 1,
    Math.max(
      0,
      Math.round(
        (evmData.statusDate.getTime() - evmData.minStart.getTime()) / oneDayMs
      )
    )
  );
  const statusX = getX(statusDayIdx);
  const pvAtStatus = evmData.dailyTimeline[statusDayIdx]?.pv || evmData.totalPV;
  const pvAtStatusY = getY(pvAtStatus);
  const evAtStatusY = getY(evmData.totalEV);
  const acAtStatusY = getY(evmData.totalAC);

  // 4. Draw Earned Value (EV) Curve up to Status Date
  const actualDaysCount = Math.min(totalDays, statusDayIdx + 1);
  ctx.strokeStyle = '#16a34a';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let i = 0; i < actualDaysCount; i++) {
    const pt = evmData.dailyTimeline[i];
    if (pt.ev === null) break;
    const x = getX(i);
    const y = getY(pt.ev);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Draw EV Status Point & Direct Label
  ctx.fillStyle = '#16a34a';
  ctx.beginPath();
  ctx.arc(statusX, evAtStatusY, 4, 0, 2 * Math.PI);
  ctx.fill();
  ctx.font = '600 11px Inter';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(
    `Earned (EV) · ${formatCurrencyNO(evmData.totalEV)}`,
    statusX + 8,
    evAtStatusY - 2
  );

  // 5. Draw Actual Cost (AC) Curve up to Status Date
  const isCostUnfavorable = evmData.totalCV < 0;
  ctx.strokeStyle = isCostUnfavorable ? '#dc2626' : '#1e293b';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let i = 0; i < actualDaysCount; i++) {
    const pt = evmData.dailyTimeline[i];
    if (pt.ac === null) break;
    const x = getX(i);
    const y = getY(pt.ac);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Draw AC Status Point & Direct Label
  ctx.fillStyle = isCostUnfavorable ? '#dc2626' : '#1e293b';
  ctx.beginPath();
  ctx.arc(statusX, acAtStatusY, 4, 0, 2 * Math.PI);
  ctx.fill();
  ctx.font = '600 11px Inter';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(
    `Actual (AC) · ${formatCurrencyNO(evmData.totalAC)}`,
    statusX + 8,
    acAtStatusY + 4
  );

  // 6. Draw Status Date Vertical Marker
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(statusX, padTop - 12);
  ctx.lineTo(statusX, padTop + height);
  ctx.stroke();
  ctx.setLineDash([]);

  // Status date marker pill
  ctx.fillStyle = '#475569';
  ctx.font = '600 10px Inter';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`Status Date`, statusX, padTop - 14);

  // 7. Direct Variance Callouts at Status Date
  const cvColor = evmData.totalCV >= 0 ? '#16a34a' : '#dc2626';
  const svColor = evmData.totalSV >= 0 ? '#16a34a' : '#dc2626';

  // Cost Variance Bracket (between EV and AC)
  if (Math.abs(evAtStatusY - acAtStatusY) > 3) {
    const bracketX = Math.max(padLeft + 10, statusX - 14);
    ctx.strokeStyle = cvColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(statusX - 4, evAtStatusY);
    ctx.lineTo(bracketX, evAtStatusY);
    ctx.lineTo(bracketX, acAtStatusY);
    ctx.lineTo(statusX - 4, acAtStatusY);
    ctx.stroke();

    const cvMidY = (evAtStatusY + acAtStatusY) / 2;
    ctx.fillStyle = cvColor;
    ctx.font = '600 10px Inter';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const cvPrefix = evmData.totalCV >= 0 ? '+' : '';
    ctx.fillText(
      `CV: ${cvPrefix}${formatCurrencyNO(evmData.totalCV)}`,
      bracketX - 6,
      cvMidY
    );
  }

  // Schedule Variance Bracket (between EV and PV at Status Date)
  if (Math.abs(evAtStatusY - pvAtStatusY) > 3) {
    const bracketRightX = statusX + 130;
    ctx.strokeStyle = svColor;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(statusX + 4, evAtStatusY);
    ctx.lineTo(bracketRightX, evAtStatusY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(statusX + 4, pvAtStatusY);
    ctx.lineTo(bracketRightX, pvAtStatusY);
    ctx.stroke();
    ctx.setLineDash([]);

    const svMidY = (evAtStatusY + pvAtStatusY) / 2;
    ctx.fillStyle = svColor;
    ctx.font = '600 10px Inter';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const svPrefix = evmData.totalSV >= 0 ? '+' : '';
    ctx.fillText(
      `SV: ${svPrefix}${formatCurrencyNO(evmData.totalSV)}`,
      bracketRightX + 6,
      svMidY
    );
  }

  ctx.restore();
}

function renderEVMView() {
  const evmData = computeEVMData();

  // Status Date Display Badge
  const statusDateBadge = document.getElementById('evm-status-date-display');
  if (statusDateBadge) {
    statusDateBadge.innerText = `Status Date: ${formatScheduleDate(evmData.statusDate)}`;
  }

  // KPI Summary Cards
  const kpiPV = document.getElementById('kpi-pv');
  const kpiEV = document.getElementById('kpi-ev');
  const kpiAC = document.getElementById('kpi-ac');
  const kpiCV = document.getElementById('kpi-cv');
  const kpiSV = document.getElementById('kpi-sv');
  const kpiCPI = document.getElementById('kpi-cpi');
  const kpiSPI = document.getElementById('kpi-spi');
  const kpiBACEAC = document.getElementById('kpi-bac-eac');
  const kpiVACSub = document.getElementById('kpi-vac-sub');

  if (kpiPV) kpiPV.innerText = formatCurrencyNO(evmData.totalPV);
  if (kpiEV) kpiEV.innerText = formatCurrencyNO(evmData.totalEV);
  if (kpiAC) kpiAC.innerText = formatCurrencyNO(evmData.totalAC);

  if (kpiCV) {
    const prefix = evmData.totalCV >= 0 ? '+' : '';
    kpiCV.innerText = `${prefix}${formatCurrencyNO(evmData.totalCV)}`;
    kpiCV.className = `kpi-value ${evmData.totalCV >= 0 ? 'kpi-favorable' : 'kpi-unfavorable'}`;
  }

  if (kpiSV) {
    const prefix = evmData.totalSV >= 0 ? '+' : '';
    kpiSV.innerText = `${prefix}${formatCurrencyNO(evmData.totalSV)}`;
    kpiSV.className = `kpi-value ${evmData.totalSV >= 0 ? 'kpi-favorable' : 'kpi-unfavorable'}`;
  }

  if (kpiCPI) {
    kpiCPI.innerText = evmData.cpi.toFixed(2);
    kpiCPI.className = `kpi-value ${evmData.cpi >= 1.0 ? 'kpi-favorable' : 'kpi-unfavorable'}`;
  }

  if (kpiSPI) {
    kpiSPI.innerText = evmData.spi.toFixed(2);
    kpiSPI.className = `kpi-value ${evmData.spi >= 1.0 ? 'kpi-favorable' : 'kpi-unfavorable'}`;
  }

  if (kpiBACEAC) {
    kpiBACEAC.innerText = `${formatCurrencyNO(evmData.totalBAC)} / ${formatCurrencyNO(evmData.eac)}`;
  }

  if (kpiVACSub) {
    const vacPrefix = evmData.vac >= 0 ? '+' : '';
    kpiVACSub.innerText = `VAC: ${vacPrefix}${formatCurrencyNO(evmData.vac)} · ETC: ${formatCurrencyNO(evmData.etc)}`;
    kpiVACSub.style.color = evmData.vac < 0 ? '#dc2626' : 'var(--text-muted)';
  }

  // Chart Header Meta
  const chartMeta = document.getElementById('evm-chart-meta');
  if (chartMeta) {
    chartMeta.innerText = `BAC: ${formatCurrencyNO(evmData.totalBAC)} | EAC: ${formatCurrencyNO(evmData.eac)} | CPI: ${evmData.cpi.toFixed(2)} | SPI: ${evmData.spi.toFixed(2)}`;
  }

  // Draw S-Curve
  drawEVMSCurve(evmData);

  // Populate WBS Breakdown Table
  const tbody = document.querySelector('#evm-wbs-table tbody');
  if (tbody) {
    tbody.innerHTML = '';
    if (evmData.tasks.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="12" style="text-align: center; color: var(--text-muted); padding: 24px;">No tasks found. Add sticky notes with planned costs on the Board first!</td></tr>';
      return;
    }

    evmData.tasks.forEach((task) => {
      const tr = document.createElement('tr');
      const cvPrefix = task.cv >= 0 ? '+' : '';
      const svPrefix = task.sv >= 0 ? '+' : '';
      tr.innerHTML = `
        <td>${task.code}</td>
        <td><strong>${escapeHtml(task.title)}</strong></td>
        <td>${escapeHtml(task.lane)}</td>
        <td class="text-right">${formatCurrencyNO(task.bac)}</td>
        <td class="text-right">${task.progress.toFixed(1)}%</td>
        <td class="text-right">${formatCurrencyNO(task.pv)}</td>
        <td class="text-right">${formatCurrencyNO(task.ev)}</td>
        <td class="text-right">${formatCurrencyNO(task.ac)}</td>
        <td class="text-right"><span class="evm-variance-tag ${task.cv >= 0 ? 'favorable' : 'unfavorable'}">${cvPrefix}${formatCurrencyNO(task.cv)}</span></td>
        <td class="text-right"><span class="evm-variance-tag ${task.sv >= 0 ? 'favorable' : 'unfavorable'}">${svPrefix}${formatCurrencyNO(task.sv)}</span></td>
        <td class="text-right"><span class="evm-variance-tag ${task.cpi >= 1.0 ? 'favorable' : 'unfavorable'}">${task.cpi.toFixed(2)}</span></td>
        <td class="text-right"><span class="evm-variance-tag ${task.spi >= 1.0 ? 'favorable' : 'unfavorable'}">${task.spi.toFixed(2)}</span></td>
      `;
      tbody.appendChild(tr);
    });
  }
}

function getTriangleDriver() {
  const labels = { budget: 'Budget', quality: 'Quality / Scope', time: 'Time' };
  const maxPriority = Math.max(...Object.values(trianglePriorities));
  return Object.keys(trianglePriorities)
    .filter((key) => trianglePriorities[key] === maxPriority)
    .map((key) => labels[key]);
}

function getTriangleRAG(value) {
  if (value >= 8) return 'red';
  if (value >= 4) return 'amber';
  return 'green';
}

function renderTriangleView() {
  const driver = getTriangleDriver();
  const driverText =
    driver.length > 1 ? `${driver.join(' + ')} (tie)` : driver[0];
  ['budget', 'quality', 'time'].forEach((key) => {
    const value = trianglePriorities[key];
    const range = document.getElementById(`triangle-${key}-range`);
    const number = document.getElementById(`triangle-${key}-value`);
    const display = document.getElementById(`triangle-${key}-display`);
    const rag = document.getElementById(`triangle-${key}-rag`);
    if (range) range.value = value;
    if (number) number.value = value;
    if (display) display.innerText = `${value} / 10`;
    if (rag) {
      const ragLevel = getTriangleRAG(value);
      rag.className = `triangle-rag-badge ${ragLevel}`;
      rag.innerText = ragLevel.toUpperCase();
      rag.setAttribute('aria-label', `${key} priority status: ${ragLevel}`);
    }
  });

  const badge = document.getElementById('triangle-driver-badge');
  const detail = document.getElementById('triangle-driver-detail');
  if (badge) {
    badge.innerText = `Prime Key Driver: ${driverText}`;
    badge.className = `triangle-driver-badge ${getTriangleRAG(Math.max(...Object.values(trianglePriorities)))}`;
  }
  if (detail) {
    detail.innerText =
      driver.length > 1
        ? 'No single driver — priorities are tied'
        : `${driverText} has the highest priority`;
  }
}

['budget', 'quality', 'time'].forEach((key) => {
  const range = document.getElementById(`triangle-${key}-range`);
  const number = document.getElementById(`triangle-${key}-value`);
  const update = (event) => {
    trianglePriorities[key] = Math.min(
      10,
      Math.max(1, Number(event.target.value) || 1)
    );
    renderTriangleView();
    autoSaveCurrentState();
  };
  if (range) range.addEventListener('input', update);
  if (number) number.addEventListener('input', update);
});

// -------------------------------------------------------------
// Tab Switching and Inline Views
// -------------------------------------------------------------
let activeView = 'canvas'; // 'canvas', 'swimlane', 'gantt', 'risk', 'evm', 'triangle'

function switchView(viewName) {
  activeView = viewName;

  // 1. Update tab styling
  document.querySelectorAll('.view-tab-btn').forEach((btn) => {
    btn.classList.remove('active');
    btn.setAttribute('aria-selected', 'false');
    btn.setAttribute('tabindex', '-1');
  });

  const activeTabBtn = document.getElementById(`btn-tab-${viewName}`);
  if (activeTabBtn) {
    activeTabBtn.classList.add('active');
    activeTabBtn.setAttribute('aria-selected', 'true');
    activeTabBtn.setAttribute('tabindex', '0');
  }

  // 2. Toggle DOM views
  const canvasElement = document.getElementById('whiteboardCanvas');
  const swimlanePane = document.getElementById('swimlane-view-pane');
  const ganttPane = document.getElementById('gantt-view-pane');
  const riskPane = document.getElementById('risk-view-pane');
  const evmPane = document.getElementById('evm-view-pane');
  const trianglePane = document.getElementById('triangle-view-pane');

  if (viewName === 'canvas') {
    canvasElement.style.display = 'block';
    swimlanePane.style.display = 'none';
    ganttPane.style.display = 'none';
    riskPane.style.display = 'none';
    if (evmPane) evmPane.style.display = 'none';
    if (trianglePane) trianglePane.style.display = 'none';

    // Show all sticky notes
    stickyNotes.forEach((n) => {
      n.element.style.display = 'flex';
    });

    resizeCanvas();
  } else if (viewName === 'swimlane') {
    canvasElement.style.display = 'none';
    swimlanePane.style.display = 'flex';
    ganttPane.style.display = 'none';
    riskPane.style.display = 'none';
    if (evmPane) evmPane.style.display = 'none';
    if (trianglePane) trianglePane.style.display = 'none';

    // Hide all sticky notes
    stickyNotes.forEach((n) => {
      n.element.style.display = 'none';
    });

    renderSwimlaneView();
    requestAnimationFrame(() => {
      updateSwimlaneScale();
    });
  } else if (viewName === 'gantt') {
    canvasElement.style.display = 'none';
    swimlanePane.style.display = 'none';
    ganttPane.style.display = 'flex';
    riskPane.style.display = 'none';
    if (evmPane) evmPane.style.display = 'none';
    if (trianglePane) trianglePane.style.display = 'none';

    // Hide all sticky notes
    stickyNotes.forEach((n) => {
      n.element.style.display = 'none';
    });

    renderGanttView();
  } else if (viewName === 'risk') {
    canvasElement.style.display = 'none';
    swimlanePane.style.display = 'none';
    ganttPane.style.display = 'none';
    riskPane.style.display = 'flex';
    if (evmPane) evmPane.style.display = 'none';
    if (trianglePane) trianglePane.style.display = 'none';

    stickyNotes.forEach((n) => {
      n.element.style.display = 'none';
    });

    renderRiskMatrixView();
  } else if (viewName === 'evm') {
    canvasElement.style.display = 'none';
    swimlanePane.style.display = 'none';
    ganttPane.style.display = 'none';
    riskPane.style.display = 'none';
    if (evmPane) evmPane.style.display = 'flex';
    if (trianglePane) trianglePane.style.display = 'none';

    stickyNotes.forEach((n) => {
      n.element.style.display = 'none';
    });

    renderEVMView();
    announceA11y('EVM and S-Curve view activated');
  } else if (viewName === 'triangle') {
    canvasElement.style.display = 'none';
    swimlanePane.style.display = 'none';
    ganttPane.style.display = 'none';
    riskPane.style.display = 'none';
    if (evmPane) evmPane.style.display = 'none';
    if (trianglePane) trianglePane.style.display = 'flex';

    stickyNotes.forEach((n) => {
      n.element.style.display = 'none';
    });

    renderTriangleView();
    announceA11y('Cost, Scope, Time driver view activated');
  }
}

// Add tab button click event listeners
document
  .getElementById('btn-tab-canvas')
  .addEventListener('click', () => switchView('canvas'));
document.getElementById('btn-tab-swimlane').addEventListener('click', () => {
  generateSwimlaneLayoutProposal();
  switchView('swimlane');
});
document.getElementById('btn-tab-gantt').addEventListener('click', () => {
  computeGanttSchedule();
  switchView('gantt');
});
document.getElementById('btn-tab-risk').addEventListener('click', () => {
  switchView('risk');
  announceA11y('Risk Matrix view activated');
});
const btnTabEVM = document.getElementById('btn-tab-evm');
if (btnTabEVM) {
  btnTabEVM.addEventListener('click', () => {
    switchView('evm');
  });
}
const btnTabTriangle = document.getElementById('btn-tab-triangle');
if (btnTabTriangle) {
  btnTabTriangle.addEventListener('click', () => switchView('triangle'));
}

window.addEventListener('resize', () => {
  if (activeView === 'evm') {
    renderEVMView();
  } else if (activeView === 'triangle') {
    renderTriangleView();
  } else if (activeView === 'swimlane') {
    const diagramViewport = document.getElementById(
      'swimlane-diagram-viewport'
    );
    if (diagramViewport) drawSwimlaneConnectors(diagramViewport);
  }
});

// Allow the view menu to be navigated with Left/Right, Home, and End.
const viewTabs = [...document.querySelectorAll('.view-tab-btn')];
viewTabs.forEach((tab, index) => {
  tab.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();

    let nextIndex = index;
    if (e.key === 'ArrowLeft')
      nextIndex = (index - 1 + viewTabs.length) % viewTabs.length;
    if (e.key === 'ArrowRight') nextIndex = (index + 1) % viewTabs.length;
    if (e.key === 'Home') nextIndex = 0;
    if (e.key === 'End') nextIndex = viewTabs.length - 1;

    const nextTab = viewTabs[nextIndex];
    nextTab.focus();
    nextTab.click();
  });
});

// Initial Setup
loadInitialBoardState();
if (stickyNotes.length === 0 && strokes.length === 0) {
  switchView('canvas');
  gridToggleBtn.classList.add('active');
}
strokeWidthInput.style.accentColor = currentColor;
strokeValueSpan.style.color = currentColor;

// -------------------------------------------------------------
// User Guide & Workflow Modal Controller
// -------------------------------------------------------------
const userGuideDialog = document.getElementById('user-guide-dialog');
const btnUserGuide = document.getElementById('btn-user-guide');
const btnSidebarGuide = document.getElementById('btn-sidebar-guide');

function openUserGuide() {
  if (userGuideDialog) {
    if (typeof userGuideDialog.showModal === 'function') {
      if (!userGuideDialog.open) {
        userGuideDialog.showModal();
      }
    } else {
      userGuideDialog.setAttribute('open', '');
    }
    announceA11y('User guide opened');

    // Smoothly focus close button so keyboard users can immediately press Esc / Enter / Space
    setTimeout(() => {
      const closeBtn = document.getElementById('btn-close-guide-header');
      if (closeBtn) closeBtn.focus();
    }, 50);
  }
}

function closeUserGuide() {
  if (userGuideDialog) {
    if (typeof userGuideDialog.close === 'function') {
      if (userGuideDialog.open) {
        userGuideDialog.close();
      }
    }
    userGuideDialog.removeAttribute('open');
    announceA11y('User guide closed');
  }
}

window.openUserGuide = openUserGuide;
window.closeUserGuide = closeUserGuide;

if (btnUserGuide) {
  btnUserGuide.addEventListener('click', openUserGuide);
}
if (btnSidebarGuide) {
  btnSidebarGuide.addEventListener('click', openUserGuide);
}

const sidebarWorkflowCard = document.getElementById('sidebar-workflow-card');
if (sidebarWorkflowCard) {
  sidebarWorkflowCard.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openUserGuide();
    }
  });
}

if (userGuideDialog) {
  // Native dialog cancel event (fires on Esc key in supported browsers)
  userGuideDialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    closeUserGuide();
  });

  // Light dismiss on backdrop click
  userGuideDialog.addEventListener('click', (e) => {
    if (e.target === userGuideDialog) {
      closeUserGuide();
      return;
    }
    const rect = userGuideDialog.getBoundingClientRect();
    const isInside =
      rect.top <= e.clientY &&
      e.clientY <= rect.bottom &&
      rect.left <= e.clientX &&
      e.clientX <= rect.right;
    if (!isInside) {
      closeUserGuide();
    }
  });
}

// -------------------------------------------------------------
// Intuitive Floating UI Tooltip Engine (Tufte Data-Ink Precision)
// -------------------------------------------------------------
const appTooltip = document.getElementById('app-tooltip');
let tooltipHideTimeout = null;
let tooltipShowTimeout = null;
let currentTooltipTarget = null;

function hideAppTooltip() {
  if (tooltipShowTimeout) {
    clearTimeout(tooltipShowTimeout);
    tooltipShowTimeout = null;
  }
  if (appTooltip) {
    appTooltip.classList.remove('visible');
    appTooltip.setAttribute('aria-hidden', 'true');
  }
  currentTooltipTarget = null;
}

function showAppTooltip(target) {
  if (!appTooltip || !target) return;

  // Extract tooltip parameters
  const title =
    target.getAttribute('data-tooltip-title') ||
    target.getAttribute('data-tooltip') ||
    target.getAttribute('title') ||
    target.getAttribute('data-original-title');
  const desc = target.getAttribute('data-tooltip-desc') || '';
  const shortcut = target.getAttribute('data-tooltip-shortcut') || '';
  const preferredPos = target.getAttribute('data-tooltip-pos') || 'bottom';

  if (!title && !desc) return;

  // Suppress native title to prevent double tooltips
  if (target.hasAttribute('title')) {
    target.setAttribute('data-original-title', target.getAttribute('title'));
    target.removeAttribute('title');
  }

  // Parse title if shortcut is inside (e.g. "Pen (P)" -> title: "Pen", shortcut: "P")
  let displayTitle = title;
  let displayShortcut = shortcut;
  if (
    !displayShortcut &&
    displayTitle &&
    displayTitle.includes('(') &&
    displayTitle.endsWith(')')
  ) {
    const match = displayTitle.match(/^(.*?)\s*\(([^)]+)\)$/);
    if (match) {
      displayTitle = match[1];
      displayShortcut = match[2];
    }
  }

  // Build HTML
  let headerContent = `<span class="app-tooltip-title">${escapeHtml(displayTitle)}</span>`;
  if (displayShortcut) {
    headerContent += `<kbd class="app-tooltip-kbd">${escapeHtml(displayShortcut)}</kbd>`;
  }

  appTooltip.innerHTML = `
    <div class="app-tooltip-header">${headerContent}</div>
    ${desc ? `<div class="app-tooltip-desc">${escapeHtml(desc)}</div>` : ''}
    <div class="app-tooltip-arrow"></div>
  `;

  // Calculate coordinates with collision avoidance
  const targetRect = target.getBoundingClientRect();
  appTooltip.style.visibility = 'hidden';
  appTooltip.style.display = 'flex';
  appTooltip.classList.add('visible');
  const tooltipRect = appTooltip.getBoundingClientRect();

  const gap = 8;
  let top = 0;
  let left = 0;
  let actualPlacement = preferredPos;

  if (preferredPos === 'right') {
    left = targetRect.right + gap;
    top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
    if (left + tooltipRect.width > window.innerWidth - 10) {
      actualPlacement = 'left';
      left = targetRect.left - tooltipRect.width - gap;
    }
  } else if (preferredPos === 'left') {
    left = targetRect.left - tooltipRect.width - gap;
    top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
    if (left < 10) {
      actualPlacement = 'right';
      left = targetRect.right + gap;
    }
  } else if (preferredPos === 'top') {
    top = targetRect.top - tooltipRect.height - gap;
    left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
    if (top < 10) {
      actualPlacement = 'bottom';
      top = targetRect.bottom + gap;
    }
  } else {
    // default: bottom
    top = targetRect.bottom + gap;
    left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
    if (top + tooltipRect.height > window.innerHeight - 10) {
      actualPlacement = 'top';
      top = targetRect.top - tooltipRect.height - gap;
    }
  }

  // Constrain horizontally within viewport bounds
  left = Math.max(
    10,
    Math.min(window.innerWidth - tooltipRect.width - 10, left)
  );
  top = Math.max(
    10,
    Math.min(window.innerHeight - tooltipRect.height - 10, top)
  );

  appTooltip.setAttribute('data-placement', actualPlacement);
  appTooltip.style.left = `${Math.round(left)}px`;
  appTooltip.style.top = `${Math.round(top)}px`;
  appTooltip.style.visibility = 'visible';
  appTooltip.setAttribute('aria-hidden', 'false');
  currentTooltipTarget = target;
}

function initTooltips() {
  // Delegate event listeners on document
  document.addEventListener(
    'mouseenter',
    (e) => {
      const target = e.target.closest(
        '[data-tooltip-title], [data-tooltip], [data-original-title], [title], .tool-btn, .color-btn, .view-tab-btn, .evm-kpi-card, .menu-item, .utility-btn, .guide-btn'
      );
      if (!target) return;

      // Don't show tooltip on canvas itself
      if (target.id === 'whiteboardCanvas') return;

      if (tooltipHideTimeout) {
        clearTimeout(tooltipHideTimeout);
        tooltipHideTimeout = null;
      }

      // Small 70ms throttle for smooth feel without delay
      tooltipShowTimeout = setTimeout(() => {
        showAppTooltip(target);
      }, 70);
    },
    true
  );

  document.addEventListener(
    'mouseleave',
    (e) => {
      const target = e.target.closest(
        '[data-tooltip-title], [data-tooltip], [data-original-title], [title], .tool-btn, .color-btn, .view-tab-btn, .evm-kpi-card, .menu-item, .utility-btn, .guide-btn'
      );
      if (target) {
        hideAppTooltip();
      }
    },
    true
  );

  // Hide on click, keydown Escape, or scroll
  document.addEventListener('click', hideAppTooltip, true);
  document.addEventListener('scroll', hideAppTooltip, true);
  window.addEventListener('blur', hideAppTooltip);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideAppTooltip();
  });
}

initTooltips();
