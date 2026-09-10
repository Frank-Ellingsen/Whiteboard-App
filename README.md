# Project Controls Whiteboard 📊

A minimalist, high data-ink ratio project management and project controlling whiteboard web application. Designed specifically for **Project Controllers**, **Financial Controllers**, and **Engineering Project Managers** in maritime, defense, engineering, and capital-intensive industries. Adheres strictly to **Edward Tufte's Data-Ink Ratio** principles (no vertical table gridlines, muted colors, direct labeling on S-Curves, and zero decorative clutter).

---

## 🌟 Key Modules & Capabilities

### 1. 🎨 Freeform Project Whiteboard

- **Drawing & Sketching Tools**: Pen, Highlighter, Eraser, Area Eraser, Shapes (Rectangles, Circles, Arrows, Lines, Diamonds, Triangles).
- **Parametric Sticky Notes**: Color-coded notes with customizable **WBS Codes**, **Responsible Roles / Swimlanes**, **Durations (Days)**, **Planned Hours & Costs (BAC)**, **Actual Hours & Costs (AC)**, **Progress %**, and **Probability × Impact Risk Scores**.
- **Touch-First Dependency Linking**: Connect tasks by tapping the `🔗` button on Note A and tapping Note B, or via desktop <kbd>Shift</kbd>-drag.
- **Touch-First Property Inspector**: Access full task parameters via the header `⚙` button or desktop right-click.
- **Smart Snap-to-Grid & Templates**: Dot grid, grid lines, and swimlane backgrounds.
- **Undo / Redo & Local Persistence**: Full command pattern history and persistent local-first storage.

### 2. 🏊 Vertical Swimlanes & Flowchart View

- Groups all sticky notes and tasks by responsible discipline or role (e.g., _Venue & Logistics_, _Engineering_, _Procurement_, _Production_, _Quality_).
- Auto-arranges sequential node-and-link flowchart diagrams across vertical column tracks.
- Precise alignment for milestone rectangles, standard task boxes, and decision diamonds.

### 3. 📊 Gantt Schedule & Interactive WBS

- **Critical Path Method (CPM)**: Computes earliest start and finish dates, total project duration, and critical path days based on network Finish-to-Start (FS) dependencies.
- **Dual-Pane Split Layout**: 12-column WBS table on the left (Task ID, WBS Name, Role/Lane, Duration, Hours, Cost, Predecessors, Act Hours, Act Cost, Progress) with horizontal scrolling, and a synchronized interactive timeline with a horizontal roller on the right.
- **Inline Editing & Fast Input**: Live inline editing for Predecessors, Actual Hours, Actual Costs, and Progress % with auto-select on focus.
- **Schedule RAG Status**: Live comparison against Status Date: Green (on or before), Amber (1–7 days late), and Red (more than 7 days late).
- **Export to CSV**: One-click download formatted for direct import into Microsoft Excel and Power BI.

### 4. ⚠️ 5×5 Risk Matrix & Risk Register

- Visual 5×5 probability vs. impact matrix with automatic risk scoring ($Probability \times Impact$).
- Categorized risk badges (_Low: 1–7_, _Medium: 8–14_, _High: 15–25_).
- Dynamic Risk Register table ranked by risk score with direct filtering by clicking any heatmap cell.

### 5. 📈 Earned Value Management (EVM) & S-Curve

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

### 6. 📱 Smartphone & Touch Ergonomics

Optimized for mobile browsers and tablets without sacrificing desktop functionality:
- **Thumb-Zone Bottom Navigation (`.mobile-bottom-nav`)**: 5 thumb-accessible view tabs (`🎨 Board`, `🏊 Swimlanes`, `📊 Gantt`, `⚠️ Risk`, `📈 EVM`) fixed at the screen bottom on viewports $\le 768\text{px}$.
- **Keyboard-Free Dependency Linking**: Tapping `🔗` arms linking mode for single-finger dependency creation.
- **Mobile Bottom-Sheet Modal**: Converts the task properties dialog into an ergonomic swipeable bottom sheet.
- **Collapsible Drawing Drawer (`🛠️`)**: Automatically collapses drawing tool panels on small screens to maximize chart and table workspace.

### 7. 💍 Built-In Sample Projects

- **Wedding Planning Project (`💍 Wedding Plan`)**:
  - 18 tasks across 5 disciplines (*Venue & Logistics*, *Guest Management*, *Catering*, *Attire & Beauty*, *Photo & Entertainment*).
  - Total BAC: 386 500 kr, 76-day CPM critical path.
  - Complete 18-risk 5×5 heatmap and EVM performance tracking (CPI 0.92, SPI 0.66).
  - Architectural reception whiteboard sketch (dining tables, dance floor/stage, aisle arrow, ceremony arch).
- **New Garden Shed Project (`💡 Demo Shed`)**:
  - Classic residential engineering project with 18 tasks, groundworks, electrical installation, and risk tracking.

---

## 📁 Project Directory Structure

```text
Whiteboard_app/
├── index.html                   # Main HTML entry point, navigation & view panes
├── styles.css                   # Tufte-compliant CSS stylesheet & mobile responsive system
├── app.js                       # Canvas engine, CPM scheduling, EVM calculation, and state
├── manifest.json                # PWA manifest for desktop/mobile app installation
├── sw.js                        # Offline Service Worker (Network-First with fallback)
├── server.py                    # Local Python server launcher with auto-port detection
├── Dockerfile                   # Production container image (Alpine Nginx)
├── docker-compose.yml           # One-command container orchestration
├── nginx.conf                   # Production Nginx web server configuration
├── Wedding Planning Project.json# Wedding planning sample dataset (root copy)
├── New Garden Shed.json         # Garden shed sample dataset (root copy)
├── assets/                      # Icons, favicons, and workflow guide assets
│   ├── favicon.svg              # Application vector icon
│   └── Whiteboard App.png       # 4-Step Brainstorm to Gantt infographic
├── samples/                     # Curated sample project datasets
│   ├── Wedding Planning Project.json
│   ├── New Garden Shed - Full Board.json
│   ├── New Garden Shed.json
│   ├── Patrol Vessel Hull Fabrication.json
│   ├── Project Management Simplified Gantt.xlsx
│   └── gantt_project_schedule_new_shed.csv
├── templates/                   # Project management reference guides
├── scripts/                     # Utility scripts
└── archive/                     # Historical UI versions and legacy backups
```

---

## 🚀 How to Run Locally

### Option 1: Python Local Server (Recommended)

Run the bundled dependency-free server:

```bash
python server.py
```

Or run standard Python HTTP server:

```bash
python -m http.server 8080
```

Open `http://localhost:8080` in your web browser.

### Option 2: Direct Browser

Open `index.html` directly in any modern web browser (Chrome, Edge, Safari, Firefox). The application runs 100% clientside with zero external build steps or npm dependencies.

---

## 🚢 Deployment Options

### 1. Docker / Docker Compose

Build and run the lightweight Alpine Nginx container:

```bash
docker compose up -d
```

Access the application at `http://localhost:8080`.

### 2. GitHub Pages / Static Hosting

1. Push the repository to GitHub.
2. Navigate to **Settings** > **Pages**.
3. Under **Branch**, select `main` and root `/`.
4. Click **Save**. The app is ready to use worldwide.

---

## 🔒 Privacy & Data Sovereignty

- **100% Local-First**: All board sketches, CPM schedules, EVM figures, and project states are stored in browser `localStorage` and client memory.
- **Zero Telemetry**: No cookies, third-party trackers, or cloud dependencies.
- **Complete Exportability**: Export entire projects as `.json` or download schedules as formatted `.csv` for Excel/Power BI.
