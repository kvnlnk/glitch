# glitch TODO

## 1. Project scaffold ✅
- [x] Create ARCHITECTURE.md, SETUP.md, TODO.md
- [x] npm create vite@latest
- [x] Configure vite.config.js
- [x] Create .gitignore (comes with Vite)
- [x] git init

## 2. HTML + CSS ✅
- [x] index.html: fullscreen dark canvas, fallback, control overlay
- [x] styles.css: dark theme, control panel
- [x] commit: "feat: add HTML/CSS scaffold with dark theme"

## 3. WebGPU init ✅
- [x] src/webgpu.js: request device, create buffers, bind groups
- [x] Fallback when WebGPU unavailable
- [x] commit: "feat: add WebGPU init and compute pipeline"

## 4. Compute shader ✅
- [x] src/shader.wgsl: N-body particle forces, Euler integration
- [x] Tile-based shared memory interaction
- [x] commit: "feat: add WGSL compute shader"

## 5. Rendering ✅
- [x] Canvas 2D render from GPU buffer
- [x] Fullscreen resize + DPR handling
- [x] commit: "feat: add canvas rendering"

## 6. Controls ✅
- [x] Rule matrix sliders (36 type-pair interactions)
- [x] Particle count slider (10k–200k)
- [x] Reset + Pause buttons
- [x] commit: "feat: add UI controls"

## 7. Polish ✅
- [x] Build verification
- [x] commit: "feat: final polish"

## 8. Ship
- [ ] Create GitHub repo 'glitch'
- [ ] Push to origin
