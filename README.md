# Project Controls Whiteboard 📊

A minimalist, high data-ink ratio project management and project controlling whiteboard web application. Designed specifically for **Project Controllers**, **Financial Controllers**, and **Engineering Project Managers** in maritime, defense, engineering, and capital-intensive industries. Adheres strictly to **Edward Tufte's Data-Ink Ratio** principles (no vertical table gridlines, muted colors, direct labeling on S-Curves, right-aligned numeric data, and zero decorative clutter).

Available in two synchronized interfaces:
1. **Desktop Project Controls Suite (`index.html`)**: Full freeform whiteboard canvas, parametric sticky notes, touch/shift dependency linking, automatic vertical swimlane diagrams, interactive CPM Gantt schedule with dual-pane split scrolling, 5×5 risk matrix, and Earned Value Management (EVM) S-Curves.
2. **Smartphone Mobile App (`mobile.html`)**: Streamlined mobile web app optimized for rapid on-site/field task entry, thumb-zone navigation, visual swimlane card board, Tufte WBS task table, and 1-tap JSON file export/import with 100% desktop schema parity.

---

## 🌟 Key Modules & Capabilities

### 1. 🎨 Freeform Project Whiteboard (`index.html`)

- **Drawing & Sketching Tools**: Pen, Highlighter, Eraser, Area Eraser, Shapes (Rectangles, Circles, Arrows, Lines, Diamonds, Triangles).
- **Parametric Sticky Notes**: Color-coded notes with customizable **WBS Codes**, **Responsible Roles / Swimlanes**, **Durations (Days)**, **Planned Hours & Costs (BAC)**, **Actual Hours & Costs (AC)**, **Progress %**, and **Probability × Impact Risk Scores**.
- **Touch-First Dependency Linking**: Connect tasks by tapping the `🔗` button on Note A and tapping Note B, or via desktop <kbd>Shift</kbd>-drag.
- **Touch-First Property Inspector**: Access full task parameters via the header `⚙` button or desktop right-click.
- **Smart Snap-to-Grid & Templates**: Dot grid, grid lines, and swimlane backgrounds.
- **Undo / Redo & Local Persistence**: Full command pattern history and persistent local-first storage.

### 2. 📱 Smartphone Mobile Application (`mobile.html`)

An ultra-lightweight, touch-ergonomic mobile interface dedicated to **rapid task entry in the field** and **direct file saving**:
- **Thumb-Zone Bottom Navigation**: Four thumb-accessible tabs fixed at the bottom:
  - ➕ **Add Task**: Fast task input with quick-select discipline pills (*Engineering*, *Procurement*, *Production*, *Project Management*, *Quality & Inspection*, *Logistics*), custom swimlane input, duration in days, planned effort hours, and baseline cost (BAC in kr).
  - 🎨 **Board**: Visual swimlane card board displaying tasks grouped by discipline with duration/cost badges and quick `✏️ Edit` / `🗑️ Delete` actions.
  - 📋 **Tasks**: Edward Tufte-compliant WBS table with left-aligned text, right-aligned numbers, and zero vertical lines.
  - 💾 **Files**: 1-tap saving to `<ProjectName>.json`, file import from smartphone storage, date settings, and quick-loaders for curated sample projects.
- **Auto-Grid Coordinate Engine**: Notes created on mobile automatically calculate canvas coordinates `(X, Y)` mapped to swimlane columns (`x = 80 + colIndex * 280`, `y = 120 + rowIndex * 180`), ensuring tasks appear neatly aligned when opened on desktop.
- **100% Data Parity**: Uses identical JSON schema as desktop `app.js`. Projects created on your phone open seamlessly on desktop into the full whiteboard, CPM Gantt schedule, and EVM S-Curve.
- **Instant Device Switching**: Toggle between mobile (`mobile.html`) and desktop (`index.html`) using header switcher buttons.

### 3. 🏊 Vertical Swimlanes & Flowchart View

- Groups all sticky notes and tasks by responsible discipline or role (e.g., _Project Management_, _Engineering_, _Procurement_, _Composite Fabrication_, _Machinery & Outfitting_, _Quality & Sea Trials_).
- Auto-arranges sequential node-and-link flowchart diagrams across vertical column tracks.
- Precise alignment for milestone rectangles, standard task boxes, and decision diamonds.

### 4. 📊 Gantt Schedule & Interactive WBS

- **Critical Path Method (CPM)**: Computes earliest start and finish dates, total project duration, and critical path days based on network Finish-to-Start (FS) dependencies.
- **Dual-Pane Split Layout**: 12-column WBS table on the left (Task ID, WBS Name, Role/Lane, Duration, Hours, Cost, Predecessors, Act Hours, Act Cost, Progress) with horizontal scrolling, and a synchronized interactive timeline with a horizontal roller on the right.
- **Inline Editing & Fast Input**: Live inline editing for Predecessors, Actual Hours, Actual Costs, and Progress % with auto-select on focus.
- **Schedule RAG Status**: Live comparison against Status Date: Green (on or before), Amber (1–7 days late), and Red (more than 7 days late).
- **Export to CSV**: One-click download formatted for direct import into Microsoft Excel Power Query, DuckDB, and Power BI.

### 5. ⚠️ 5×5 Risk Matrix & Risk Register

- Visual 5×5 probability vs. impact matrix with automatic risk scoring ($Probability \times Impact$).
- Categorized risk badges (_Low: 1–7_, _Medium: 8–14_, _High: 15–25_).
- Dynamic Risk Register table ranked by risk score with direct filtering by clicking any heatmap cell.

### 6. 📈 Earned Value Management (EVM) & S-Curve

- **Core Performance Metrics**:
  - **Planned Value ($PV$ / BCWS)**: Time-phased baseline schedule curve.
  - **Earned Value ($EV$ / BCWP)**: Budgeted cost of work performed ($BAC \times \text{Progress } \%$).
  - **Actual Cost ($AC$ / ACWP)**: Incurred expenditure to the Status Date.
  - **Cost Variance ($CV$)**: $CV = EV - AC$ (favorable $> 0$, unfavorable $< 0$).
  - **Schedule Variance ($SV$)**: $SV = EV - PV$ (ahead $> 0$, behind $< 0$).
  - **Cost Performance Index ($\text{CPI}$)**: $\text{CPI} = EV / AC$.
  - **Schedule Performance Index ($\text{SPI}$)**: $\text{SPI} = EV / PV$.
  - **Estimate at Completion ($\text{EAC}$)**: $\text{EAC} = BAC / \text{CPI}$.
  - **Estimate to Complete ($\text{ETC}$)**: $\text{ETC} = \text{EAC} - AC$.
  - **Variance at Completion ($\text{VAC}$)**: $\text{VAC} = BAC - \text{EAC}$.
- **Edward Tufte S-Curve Chart**:
  - **Direct Labeling**: Explicit on-chart labels for $PV$, $EV$, and $AC$ without detached legend clutter.
  - **Variance Callouts**: Visual vertical delta brackets at the Status Date indicating exact numeric cost and schedule variances.
  - **High Data-Ink Ratio**: Horizontal grid lines only, clean typography, retina-sharp canvas rendering.

---

## 📁 Curated Sample Datasets (`samples/`)

All project datasets have been verified for CPM schedule calculation and Gantt rendering:

| File Name | Format | Status | CPM Duration | Tasks | Description |
|---|:---:|:---:|:---:|:---:|---|
| **`Patrol Vessel Hull Fabrication.json`** | JSON | ✅ Verified | **80 days** | 24 | Maritime & naval defense shipbuilding project (Frank Ellingsen). 6 swimlanes (*Engineering, Procurement, Composite Fabrication, Machinery, PM, Sea Trials*), 25 dependencies, and industrial EAC/ETC parameters. |
| **`New Garden Shed.json`** | JSON | ✅ Verified | **31 days** | 20 | Residential construction baseline with 5 swimlanes (*Clear Garden, Foundations, Buy Shed, Install Shed, Legal*) and 20 dependencies. |
| **`New Garden Shed - Full Board.json`** | JSON | ✅ Verified | **63 days** | 20 | Complete garden shed board with full drawing annotations, foundation sketches, and extended duration model. |
| **`Wedding Planning Project.json`** | JSON | ✅ Verified | **64 days** | 18 | Commercial event management project with 18 tasks across 5 swimlanes, reception whiteboard layout, and EVM performance tracking. |
| **`Wedding Planning Project2.json`** | JSON | ✅ Verified | **64 days** | 18 | Alternative wedding planning milestone and risk dataset. |
| **`gantt_project_schedule_new_shed.csv`** | CSV | ℹ️ Export | — | — | Schedule export dataset generated by the app's *Export CSV* tool for direct import into Microsoft Excel Power Query and Power BI. |
| **`Project Management Simplified Gantt.xlsx`** | XLSX | ℹ️ Reference | — | — | External reference spreadsheet template. |

---

## 📁 Project Directory Structure

```text
Whiteboard_app/
├── index.html                   # Desktop whiteboard suite, CPM Gantt, EVM & Risk Matrix
├── styles.css                   # Tufte-compliant CSS stylesheet & desktop responsive system
├── app.js                       # Canvas engine, CPM scheduling, EVM calculation, and state
├── mobile.html                  # Smartphone mobile app entry point (rapid task entry & file save)
├── mobile.css                   # Mobile-first stylesheet for touch ergonomics and safe areas
├── mobile.js                    # Mobile task entry, swimlanes, and JSON file I/O engine
├── manifest.json                # PWA manifest for desktop/mobile app installation
├── sw.js                        # Offline Service Worker (Network-First with fallback)
├── server.py                    # Local Python server launcher with auto-port detection
├── Dockerfile                   # Production container image (Alpine Nginx)
├── docker-compose.yml           # One-command container orchestration
├── nginx.conf                   # Production Nginx web server configuration
├── assets/                      # Icons, favicons, and workflow guide assets
│   ├── favicon.svg              # Application vector icon
│   └── Whiteboard App.png       # 4-Step Brainstorm to Gantt infographic
├── samples/                     # Curated sample project datasets (.json, .csv, .xlsx)
│   ├── Patrol Vessel Hull Fabrication.json
│   ├── New Garden Shed.json
│   ├── New Garden Shed - Full Board.json
│   ├── Wedding Planning Project.json
│   ├── Wedding Planning Project2.json
│   ├── gantt_project_schedule_new_shed.csv
│   └── Project Management Simplified Gantt.xlsx
├── templates/                   # Project management reference guides & PDF templates
├── scripts/                     # Utility scripts
└── archive/                     # Historical UI versions and legacy backups
```

---

## 🚀 How to Run Locally

### Option 1: Python Local Server (Recommended)

Run the bundled server:

```bash
python server.py
```

Or run standard Python HTTP server:

```bash
python -m http.server 8080
```

Access in your browser:
- **Desktop Whiteboard & Gantt Suite**: `http://localhost:8080/index.html`
- **Smartphone Mobile App**: `http://localhost:8080/mobile.html`

### Option 2: Direct Browser

Open either `index.html` or `mobile.html` directly in any web browser (Chrome, Edge, Safari, Firefox). The application runs 100% clientside with zero external build steps or npm dependencies.

---

## 🚢 Deployment Options

### 1. Docker / Docker Compose

Build and run the lightweight Alpine Nginx container:

```bash
docker compose up -d
```

Access at `http://localhost:8080`.

### 2. GitHub Pages / Static Hosting

1. Push the repository to GitHub.
2. Navigate to **Settings** > **Pages**.
3. Under **Branch**, select `main` and root `/`.
4. Click **Save**. The app is ready to use worldwide.

---

## 🔒 Privacy & Data Sovereignty

- **100% Local-First**: All board sketches, CPM schedules, EVM figures, and project states are stored in browser `localStorage` and client memory.
- **Zero Telemetry**: No cookies, third-party trackers, or cloud dependencies.
- **Complete Exportability**: Export entire projects as standard `.json` files or download schedules as formatted `.csv` for Excel/Power BI.
