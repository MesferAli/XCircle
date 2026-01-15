# Atlas - Enterprise AI Layer (EAL) - Design Guidelines

## Brand Identity

**Platform Name**: Atlas  
**Tagline**: Enterprise integration, simplified.  
**Logo Icon**: Globe or Compass (from Lucide)  
**Primary Color**: Dark Blue (HSL 220° 50% 25%)  
**Accent Color**: Muted Teal (HSL 185° 40% 45%)  
**Default Theme**: Light mode  

---

## Design Approach

**Selected System**: Carbon Design System (IBM) with Atlas brand refinements

**Rationale**: Carbon is purpose-built for data-intensive enterprise applications requiring trust, clarity, and scalability. Perfect for complex B2B platforms handling AI recommendations, policy management, and audit workflows.

**Design Principles**:
- **Trust & Transparency**: Clear visual hierarchy, explainable AI outputs, visible system state
- **Efficiency First**: Minimize cognitive load, streamline multi-step workflows
- **Data Density Balance**: Dense information displays without overwhelming users
- **Enterprise Credibility**: Professional, stable aesthetic that conveys reliability
- **Clean White Aesthetic**: Light mode default with muted, professional accent colors

---

## Core Design Elements

### A. Typography

**Font Family**: IBM Plex Sans (via Google Fonts CDN)

**Scale**:
- Display/Hero: text-5xl (48px), font-light
- Page Headers: text-3xl (30px), font-normal  
- Section Headers: text-xl (20px), font-medium
- Card/Component Headers: text-lg (18px), font-medium
- Body: text-base (16px), font-normal
- Captions/Meta: text-sm (14px), font-normal
- Labels: text-xs (12px), font-medium, uppercase, tracking-wide

**Key Contexts**:
- Dashboard titles: text-2xl, font-medium
- Data table headers: text-sm, font-semibold
- Form labels: text-sm, font-medium
- Code/technical data: font-mono, text-sm

### B. Layout System

**Spacing Primitives**: Tailwind units of **2, 4, 8, 12, 16**

**Common Patterns**:
- Component padding: p-4, p-6, p-8
- Section spacing: space-y-8, space-y-12
- Card gaps: gap-4, gap-6
- Margins: m-4, mb-8, mt-12
- Container max-width: max-w-7xl

**Grid System**:
- Dashboard: 12-column grid (grid-cols-12)
- Content areas: 2-column layouts (grid-cols-2) for forms/details
- Data cards: 3-column (grid-cols-3) for metrics
- Always collapse to single column on mobile

### C. Component Library

**Navigation**:
- **Top Nav Bar**: Fixed header (h-16), logo left, user menu right, breadcrumbs for context
- **Sidebar Navigation**: w-64, collapsible to w-16, icon + label pattern, nested sections with indentation
- **Tabs**: Underline style for section switching, contained style for dense UI areas

**Core UI Elements**:
- **Buttons**: 
  - Primary: Solid fill, h-10, px-6, rounded
  - Secondary: Outline, ghost variants
  - Icon buttons: Square (w-10 h-10) for actions
- **Input Fields**: h-10, border-2, rounded, clear focus states
- **Dropdowns**: Consistent h-10 height, searchable for long lists
- **Toggle Switches**: For binary settings
- **Radio/Checkbox**: Clear selection states

**Data Display**:
- **Tables**: 
  - Striped rows for readability
  - Sticky headers for long lists
  - Row hover states
  - Sortable columns with visual indicators
  - Pagination below (showing "1-25 of 1,240")
- **Cards**: 
  - Elevated (shadow-md), rounded-lg
  - Compact: p-4 for metrics
  - Expanded: p-6 for detailed content
- **Stat Blocks**: Large number (text-3xl), label below, trend indicators
- **Code Blocks**: Monospace, syntax highlighting, copy button
- **Progress Indicators**: 
  - Linear for multi-step processes
  - Circular for AI processing states
  - Percentage displays for confidence scores

**Forms**:
- **Wizard Flow**: Step indicators at top, prev/next footer, progress tracking
- **Inline Validation**: Real-time feedback, error states with messages
- **Field Groups**: Logical grouping with dividers/spacing
- **Helper Text**: Below inputs for context

**Overlays**:
- **Modals**: 
  - Small: max-w-md for confirmations
  - Medium: max-w-2xl for forms
  - Large: max-w-5xl for data review
  - Backdrop blur, centered positioning
- **Slide-outs**: Right panel (w-96) for details/settings
- **Toasts**: Top-right positioning, auto-dismiss, stacked
- **Tooltips**: Minimal, on-hover only for supplementary info

**Dashboard Specific**:
- **KPI Cards**: Grid of 4 (grid-cols-4), large number, trend arrow, sparkline
- **Charts**: Use Chart.js or Recharts, Carbon color palette
- **Activity Feed**: Timeline style, avatar + timestamp + description
- **Alert Banners**: Top of page, dismissible, severity-based (info/warning/error)

**AI/ML Specific**:
- **Recommendation Cards**: 
  - Confidence score (0-100%) prominently displayed
  - Explainability section (collapsible)
  - Action buttons (Approve/Reject/Defer)
- **Anomaly Indicators**: Red dot badge, severity levels
- **Capability Badges**: Pills showing discovered features (Read/Write/Draft)

### D. Animations

**Minimal & Purposeful**:
- Page transitions: None (instant load)
- Modal entry: Fade + slight scale (200ms)
- Dropdown: Slide down (150ms)
- Loading states: Skeleton screens (no spinners unless necessary)
- Toast notifications: Slide in from right (200ms)
- **Never animate**: Data tables, charts, form fields, navigation

---

## Platform-Specific Patterns

**Onboarding Wizard** (7-step flow):
- Progress stepper at top
- Large form area (max-w-3xl centered)
- Validation summary sidebar
- Sticky footer with back/next/save-draft

**Mapping Studio**:
- Split pane: Source JSON (left, w-1/2) → Canonical Model (right, w-1/2)
- Drag-drop connection lines
- Transformation builder (modal overlay)
- Live preview panel at bottom

**Policy Editor**:
- Rule builder interface (If/Then blocks)
- JSON preview alongside visual builder
- Permission matrix (table format)

**Audit Log**:
- Dense table, filterable columns
- Expandable rows for full payload
- Export button (top-right)

**Icons**: Heroicons (outline style for navigation, solid for actions)

---

## Images

**No Hero Images**: This is an enterprise platform, not a marketing site. Use data visualizations and functional UI instead.

**Appropriate Image Use**:
- **Empty States**: Illustration + "No data yet" message
- **Onboarding**: Simple diagrams explaining concepts
- **Documentation**: Screenshots for help sections

All functional imagery should be SVG diagrams or UI screenshots, never decorative photos.