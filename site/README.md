# 🌐 glitch — WebGPU Particle Life Simulator

**Emergent patterns from simple rules. 100k particles simulated on your GPU.**

---

## 🤖 Fully Vibecoded with Hermes Agent

This project was built entirely through natural language conversations with [Hermes Agent](https://hermes-agent.nousresearch.com) — an autonomous AI coding assistant. From architecture to deployment, every line of code was generated, tested, and shipped via chat prompts.

---

## ✨ Features

- **🧬 Particle Life Algorithm** — Each particle type attracts or repels others, creating emergent organic patterns
- **⚡ 100k+ Particles** — GPU compute shaders handle the simulation, not the CPU
- **🎨 6 Particle Types** — Full 6×6 rule matrix with 36 interactive sliders
- **🔁 Real-time Controls** — Pause, play, reset, adjust particle count (10k–200k)
- **🌌 Dark Cyberpunk Theme** — Cyan glow, neon accents, CRT scanlines
- **📱 Fullscreen Responsive** — Adapts to any screen size with DPR-aware rendering
- **⬇️ WebGPU Required** — Falls back gracefully with an informative message

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | Vanilla JS (ES2020) + WGSL |
| Bundler | Vite 6 |
| GPU API | WebGPU Compute Shaders |
| Rendering | Canvas 2D |
| Design | Cyberpunk/Glitch (frontend-design skill) |
| Hosting | Vercel (Static) |

---

## 🚀 Deployment

```bash
# 1. Build
npm install
npm run build

# 2. Deploy to Vercel
vercel --prod
```

Live unter: `glitch-site.vercel.app`

---

## 🎮 How It Works

1. **WebGPU Compute Shader** updates particle positions on the GPU (tile-based N-body with shared memory)
2. **Canvas 2D** renders each particle as a colored circle with semi-transparent trails
3. **Rule Matrix** defines attraction/repulsion between each pair of the 6 particle types
4. **Toroidal World** — particles wrap around edges for seamless simulation

---

## 🧪 Controls

| Control | Description |
|---------|-------------|
| Particle count slider | Adjust 10,000 to 200,000 particles |
| Rule matrix (36 sliders) | Tune attraction (-1) ↔ repulsion (+1) for each type pair |
| Pause/Play | Freeze the simulation |
| Reset | Randomize all particle positions |
| FPS counter | Monitor performance |

---

## 📁 Project Structure

```
glitch/
├── index.html              # Single-page app
├── package.json
├── vite.config.js
├── src/
│   ├── main.js             # Canvas rendering + animation loop
│   ├── webgpu.js           # WebGPU device init, buffers, dispatch
│   ├── shader.wgsl         # WGSL compute shader (particle update)
│   └── styles.css          # Dark cyberpunk theme
└── README.md
```

---

## 📄 License

MIT

---

<p align="center">Made with ❤️ by <a href="https://github.com/kvnlnk">kvnlnk</a></p>
