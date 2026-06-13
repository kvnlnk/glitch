# glitch — Architecture

## Tech Stack
- **Build**: Vite (vanilla JS)
- **GPU Compute**: WebGPU API (WGSL shaders)
- **Rendering**: HTML5 2D Canvas
- **UI**: Vanilla JS, no frameworks

## Data Flow
[UI Controls] → [Config Buffer] → [WGSL Compute Shader] → [Storage Buffers] → [Readback to CPU] → [Canvas 2D]

## Particle Model
- N particles (up to 200k), each with:
  - Position (vec2<f32>)
  - Velocity (vec2<f32>)
  - Type (u32) — one of 6 colors
- Inter-particle forces defined by a 6×6 rule matrix
- Toroidal (wrap-around) boundary
- Tile-based interaction in compute shader (workgroup shared memory)

## File Structure
```
glitch/
├── index.html          # Single-page app
├── vite.config.js      # Vite config
├── package.json        # Dependencies
├── src/
│   ├── main.js         # Entry point, UI, render loop
│   ├── webgpu.js       # WebGPU init, buffers, compute pipeline
│   ├── shader.wgsl     # WGSL particle compute shader
│   └── styles.css      # Dark theme styling
└── dist/               # Production build
```
