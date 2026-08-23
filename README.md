# Project Controls Whiteboard 📊

A minimalist, high data-ink ratio project management and project controlling whiteboard application. Designed specifically for **Project Controllers**, **Financial Controllers**, and **Engineering Project Managers** in maritime, defense, and capital-intensive industries.

---

## 🌟 Key Features

### 1. 🎨 Freeform Project Whiteboard

- **Drawing Tools**: Pen, Highlighter, Eraser, Area Eraser, Shapes (Rectangles, Circles, Arrows, Lines, Diamonds, Triangles).
- **Interactive Sticky Notes**: Color-coded notes with customizable **WBS Codes**, **Responsible Roles / Swimlanes**, **Durations**, **Planned Costs (BAC)**, **Actual Costs (AC)**, **Progress %**, and **Risk/Impact scores**.
- **Visual Dependency Connectors**: Draw dependency arrows between sticky notes directly on the board.
- **Smart Snap-to-Grid & Templates**: Dot grid, grid lines, and swimlane backgrounds.
- **Undo / Redo & Auto-Save**: Full command pattern history and persistent local-first storage.

### 2. 🏊 Swimlane & Role View

- Groups all sticky notes and tasks by responsible discipline/role (e.g., _Engineering_, _Procurement_, _Production_, _Quality_, _Commissioning_).
- Auto-generates structured swimlane layouts from freeform brainstorming sticky notes.

### 3. 📊 Gantt Schedule & WBS Schedule

- **Critical Path Method (CPM)**: Computes earliest start/end dates, total durations, and critical path days based on network predecessors.
- **Interactive WBS Table**: Fully visible schedule with live inline editing for Predecessors, Actual Hours, Actual Costs, and Progress %. Numeric cells are aligned and select their current values on focus for fast updates.
- **Schedule RAG Status**: Compares planned task/project end dates with the Status Date: Green (on or before), Amber (1–7 days late), and Red (more than 7 days late).
- **Dual-Pane Layout**: Table on the left, synchronized interactive Gantt timeline with a horizontal roller on the right.
- **Export to CSV**: One-click download formatted for direct import into Microsoft Excel and Power BI.

### 4. ⚠️ 5×5 Risk Matrix & Risk Register

- Visual 5×5 probability vs. impact matrix with automatic risk scoring ($Probability \times Impact$).
- Categorized risk badges (_Low_, _Medium_, _High_).
- Dynamic Risk Register table ranked by risk score.

### 5. 📈 Earned Value Management (EVM) & S-Curve

- **EVM Metrics**:
  - **Planned Value ($PV$ / BCWS)**: Time-phased baseline curve based on task schedules.
  - **Earned Value ($EV$ / BCWP)**: Budgeted cost of work performed ($BAC \times \text{Progress } \%$).
  - **Actual Cost ($AC$ / ACWP)**: Incurred cost up to the Status Date.
  - **Cost Variance ($CV$)**: $CV = EV - AC$ (favorable $> 0$, unfavorable $< 0$).
  - **Schedule Variance ($SV$)**: $SV = EV - PV$ (ahead $> 0$, behind $< 0$).
  - **Cost Performance Index ($\text{CPI}$)**: $\text{CPI} = EV / AC$.
  - **Schedule Performance Index ($\text{SPI}$)**: $\text{SPI} = EV / PV$.
  - **Estimate at Completion ($\text{EAC}$)**: $\text{EAC} = BAC / \text{CPI}$.
  - **Estimate to Complete ($\text{ETC}$)**: $\text{ETC} = \text{EAC} - AC$.
  - **Variance at Completion ($\text{VAC}$)**: $\text{VAC} = BAC - \text{EAC}$.
- **Edward Tufte S-Curve Chart**:
  - **Direct Labeling**: Direct labels on the curves without detached legend clutter.
  - **Variance Callouts**: Visual vertical delta brackets at the Status Date with explicit $+/-$ variance labels for $CV$ and $SV$.
  - **High Data-Ink Ratio**: Horizontal grid lines only, clean typography, retina-sharp canvas rendering.

### 6. 🔺 Cost, Scope, Time Driver

- Set relative priorities for **Budget**, **Quality / Scope**, and **Time** on a 1–10 scale.
- Identifies the **Prime Key Driver**, including tied priorities.
- Uses live RAG formatting: Green (1–3), Amber (4–7), and Red (8–10).

### 7. 📖 Interactive User Guide & Workflow Tutorial

- **Embedded Infographic Workflow**: Illustrated step-by-step walkthrough of the 4-step _Brainstorm to Gantt_ methodology with `assets/Whiteboard App.png`.
- **Keyboard Shortcuts Cheat Sheet**: Quick reference for canvas tools, shape text, undo/redo, and note connections.
- **Project Controlling & EVM Standards**: In-app mathematical formula reference and Edward Tufte visualization guidelines.
- **Fast Access**: Triggerable from the top toolbar, the sidebar utility menu, or pressing <kbd>?</kbd> / <kbd>F1</kbd>.

---

## 📁 Project Directory Structure

```text
Whiteboard_app/
├── index.html               # Main HTML entry point & view panes
├── styles.css               # Tufte-compliant CSS stylesheet
├── app.js                   # Application state, canvas engine, Gantt & EVM logic
├── manifest.json            # PWA manifest for desktop/mobile app installation
├── sw.js                    # Service Worker for 100% offline functionality
├── server.py                # Local Python server launcher with auto-port detection
├── Dockerfile               # Production container image (Alpine Nginx)
├── docker-compose.yml       # One-command container orchestration
├── nginx.conf               # Production Nginx web server configuration
├── assets/                  # Application icons and supporting screenshots
│   └── screenshots/         # Reference images used during planning
├── samples/                 # Sample project files and exported datasets
│   ├── New Garden Shed - Full Board.json
│   ├── New Garden Shed.json
│   ├── Patrol Vessel Hull Fabrication.json
│   ├── Project Management Simplified Gantt.xlsx
│   └── gantt_project_schedule_new_shed.csv
├── templates/               # Project management PDF guides and templates
├── scripts/                 # Optional development/helper scripts
│   └── prototype1.py
└── archive/                 # Historical UI versions and duplicate legacy files
  ├── legacy/
  └── test-versions/
```

---

## 🚀 How to Run Locally

### Option 1: Python Local Server (Recommended)

Run the bundled dependency-free server:

```bash
python server.py
```

This automatically finds an open port (default `8000`), opens your default browser, and starts serving the application.

### Option 2: Direct Browser

Double-click `index.html` in Windows Explorer. The app operates 100% in-browser with zero external build steps.

---

## 🚢 Deployment Options

### 1. Docker / Docker Compose

Build and run the lightweight Alpine Nginx container:

```bash
docker compose up -d
```

Access the application at `http://localhost:8080`.

### 2. GitHub Pages

1. Push the repository to GitHub.
2. Go to **Settings** > **Pages**.
3. Under **Branch**, select `main` and root `/`.
4. Click **Save**. The app will be live within seconds.

### 3. Netlify / Vercel / Cloudflare Pages

- **Build Command**: _(None needed / Static)_
- **Publish Directory**: `.` (Root directory)

---

## 🔒 Privacy & Data Sovereignty

- **100% Local-First**: All board sketches, schedules, EVM figures, and project files are processed in-memory and in browser `localStorage`.
- **Zero Telemetry**: No cookies, trackers, or cloud dependencies.
- **Export & Import**: Export whole projects as `.json` or download schedules as `.csv`.
