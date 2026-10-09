# Interactive Historical Timeline & Chronological Synthesis Engine

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)]()
[![Interactive Demo](https://img.shields.io/badge/demo-GitHub%20Pages-purple.svg)](https://udbhav-shrinet.github.io/timeline/)
[![JavaScript](https://img.shields.io/badge/javascript-ES6%2B-yellow.svg)]()
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

> Single-file high-performance interactive chronological timeline visualizer with dynamic historical querying, category filtering, and event synthesis.

---

## 🚀 Live Interactive Showcase

Explore zoomable interactive historical milestones and chronological narratives:  
👉 **[Launch Timeline Visualizer](https://udbhav-shrinet.github.io/timeline/)**

---

## ✨ Key Capabilities

- **Zero-Dependency Vanilla Architecture**: Fast, lightweight single-file single-page application (SPA) with no heavy runtime dependencies.
- **Chronological Milestone Navigation**: Fluid multi-scale timeline panning, zoomable time brackets, and categorical event filtering.
- **Dynamic Context Synthesis**: Rich historical descriptions, citation grounding, and structured milestone cards.
- **Responsive Mobile & Desktop View**: Dark glassmorphic design optimized for touch and keyboard navigation.

---

## 🛠️ System Architecture

```text
┌─────────────────────────┐       ┌────────────────────────┐       ┌──────────────────────┐
│  Search Query / Subject │ ───>  │  Ground Truth Engine   │ ───>  │ Chronological Sorter │
│  (e.g., Computing 1970) │       │  Historical Datasets   │       │  & Milestone Parser  │
└─────────────────────────┘       └────────────────────────┘       └──────────┬───────────┘
                                                                              │
                                                   ┌──────────────────────────┴──────────────────────────┐
                                                   ▼                                                     ▼
                                       ┌─────────────────────────┐                           ┌───────────────────────┐
                                       │   Event Modal Inspector │                           │  GitHub Pages Studio  │
                                       │   Contextual Deep Dive  │                           │  Interactive Timeline │
                                       └─────────────────────────┘                           └───────────────────────┘
```

---

## 📦 Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/udbhav-shrinet/timeline.git
   cd timeline
   ```

2. **Open locally**:
   ```bash
   python -m http.server 8000
   # Open http://localhost:8000 in your browser
   ```

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
