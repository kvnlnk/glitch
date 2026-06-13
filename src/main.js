// glitch — Main Entry Point
// Particle Life Simulator using WebGPU compute shaders

import { initWebGPU, createSimulation, NUM_TYPES } from './webgpu.js';

// --- DOM refs ---
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const fallbackEl = document.getElementById('fallback');
const fpsDisplay = document.getElementById('fpsDisplay');
const particleCountEl = document.getElementById('particleCount');
const btnPause = document.getElementById('btnPause');
const btnReset = document.getElementById('btnReset');
const sliderCount = document.getElementById('sliderCount');
const countValue = document.getElementById('countValue');
const ruleMatrixEl = document.getElementById('ruleMatrix');

// --- State ---
let sim = null;
let device = null;
let shaderModule = null;
let paused = false;
let numParticles = 100000;
let animFrameId = null;
let lastTimestamp = 0;
let frameCount = 0;
let fpsTimer = 0;

// Particle type colors (RGB 0-1)
const TYPE_COLORS = [
  [1.0, 0.42, 0.42],  // red    #ff6b6b
  [0.31, 0.80, 0.77], // teal   #4ecdc4
  [1.0, 0.90, 0.43],  // yellow #ffe66d
  [0.66, 0.90, 0.81], // mint   #a8e6cf
  [1.0, 0.55, 0.58],  // pink   #ff8b94
  [0.58, 0.88, 0.83], // aqua   #95e1d3
];

// --- Canvas sizing ---
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.scale(dpr, dpr);
  return { w, h };
}

let dims = resizeCanvas();
window.addEventListener('resize', () => {
  dims = resizeCanvas();
});

// --- WebGPU fallback ---
if (!navigator.gpu) {
  fallbackEl.classList.remove('hidden');
  canvas.style.display = 'none';
}

// --- Drawing ---
function drawParticles(posData) {
  const { w, h } = dims;

  // Semi-transparent clear for motion trails
  ctx.fillStyle = 'rgba(10, 10, 15, 0.92)';
  ctx.fillRect(0, 0, w, h);

  if (!posData || posData.length < 2) return;

  const domainSize = 800;
  const scaleX = w / domainSize;
  const scaleY = h / domainSize;
  const scale = Math.min(scaleX, scaleY);
  const offsetX = (w - domainSize * scale) / 2;
  const offsetY = (h - domainSize * scale) / 2;

  const count = posData.length / 2;
  const radius = Math.max(1.0, Math.min(2.5, 1200 / Math.sqrt(count)));

  // Draw each particle colored by position hash
  for (let i = 0; i < count; i++) {
    const px = posData[i * 2];
    const py = posData[i * 2 + 1];
    const x = px * scale + offsetX;
    const y = py * scale + offsetY;

    if (x < -10 || x > w + 10 || y < -10 || y > h + 10) continue;

    // Deterministic color from position
    const typeIdx = Math.abs(Math.floor(px * 0.73 + py * 0.37)) % NUM_TYPES;
    const col = TYPE_COLORS[typeIdx];

    ctx.fillStyle = `rgba(${(col[0] * 255) | 0}, ${(col[1] * 255) | 0}, ${(col[2] * 255) | 0}, 0.85)`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --- Initialize ---
async function init() {
  if (!navigator.gpu) return;

  try {
    const result = await initWebGPU();
    device = result.device;
    shaderModule = result.shaderModule;

    particleCountEl.textContent = `${numParticles.toLocaleString()} particles`;
    countValue.textContent = `${(numParticles / 1000).toFixed(0)}k`;

    setupSimulation();
    setupControls();
    startLoop();
  } catch (err) {
    console.error('Init failed:', err);
    fallbackEl.classList.remove('hidden');
    canvas.style.display = 'none';
    fallbackEl.innerHTML = `
      <h1>WebGPU Error</h1>
      <p>${err.message}</p>
      <p>Try Chrome 113+, Edge 113+, or Firefox Nightly.</p>
    `;
  }
}

function setupSimulation() {
  sim = createSimulation(device, shaderModule, numParticles);
}

// --- Game Loop ---
function startLoop() {
  lastTimestamp = performance.now();
  fpsTimer = lastTimestamp;
  frameCount = 0;

  async function loop(timestamp) {
    if (!device) return;

    const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.05);
    lastTimestamp = timestamp;

    // FPS
    frameCount++;
    if (timestamp - fpsTimer > 1000) {
      fpsDisplay.textContent = `${frameCount} FPS`;
      frameCount = 0;
      fpsTimer = timestamp;
    }

    if (!paused && sim) {
      sim.computeStep(dt * 2.0);

      try {
        const posData = await sim.readPositions();
        drawParticles(posData);
      } catch (err) {
        // Silently handle read errors (e.g., during resize)
      }
    }

    animFrameId = requestAnimationFrame(loop);
  }

  animFrameId = requestAnimationFrame(loop);
}

// --- UI Controls ---
function setupControls() {
  btnPause.addEventListener('click', () => {
    paused = !paused;
    btnPause.textContent = paused ? '▶ Play' : '⏸ Pause';
  });

  btnReset.addEventListener('click', () => {
    if (sim) sim.resetParticles(numParticles);
  });

  sliderCount.addEventListener('input', () => {
    const val = parseInt(sliderCount.value);
    countValue.textContent = `${(val / 1000).toFixed(0)}k`;
  });

  sliderCount.addEventListener('change', () => {
    numParticles = parseInt(sliderCount.value);
    if (sim) sim.resetParticles(numParticles);
    particleCountEl.textContent = `${numParticles.toLocaleString()} particles`;
  });

  buildRuleControls();
}

function buildRuleControls() {
  ruleMatrixEl.innerHTML = '<label>Type Rules (← repels | attracts →)</label>';

  const labels = ['R', 'T', 'Y', 'M', 'P', 'A'];
  const hexColors = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#a8e6cf', '#ff8b94', '#95e1d3'];

  for (let i = 0; i < NUM_TYPES; i++) {
    for (let j = 0; j < NUM_TYPES; j++) {
      const row = document.createElement('div');
      row.className = 'rule-slider';

      const l1 = document.createElement('span');
      l1.className = 'rule-label';
      l1.style.background = hexColors[i];
      l1.textContent = labels[i];

      const arrow = document.createElement('span');
      arrow.textContent = '→';
      arrow.style.color = '#555';
      arrow.style.fontSize = '0.65rem';

      const l2 = document.createElement('span');
      l2.className = 'rule-label';
      l2.style.background = hexColors[j];
      l2.textContent = labels[j];

      const sl = document.createElement('input');
      sl.type = 'range';
      sl.min = '-1';
      sl.max = '1';
      sl.step = '0.05';
      sl.value = '0';

      const vd = document.createElement('span');
      vd.className = 'rule-value';
      vd.textContent = '0.00';

      sl.addEventListener('input', () => {
        vd.textContent = parseFloat(sl.value).toFixed(2);
        rebuildRules();
      });

      row.append(l1, arrow, l2, sl, vd);
      ruleMatrixEl.appendChild(row);
    }
  }

  setTimeout(setDefaultRules, 50);
}

function rebuildRules() {
  if (!sim) return;
  const sliders = ruleMatrixEl.querySelectorAll('input[type="range"]');
  const rules = new Float32Array(NUM_TYPES * NUM_TYPES);
  sliders.forEach((s, i) => { rules[i] = parseFloat(s.value) || 0; });
  sim.updateRules(rules);
}

function setDefaultRules() {
  const defaults = [
    0.5, -0.4,  0.3, -0.2,  0.1, -0.3,
   -0.3,  0.6, -0.5,  0.2, -0.1,  0.4,
    0.2, -0.3,  0.7, -0.6,  0.5, -0.1,
   -0.4,  0.1, -0.2,  0.5, -0.3,  0.6,
    0.3, -0.5,  0.4, -0.1,  0.8, -0.2,
   -0.1,  0.2, -0.4,  0.3, -0.6,  0.9,
  ];

  const sliders = ruleMatrixEl.querySelectorAll('input[type="range"]');
  const displays = ruleMatrixEl.querySelectorAll('.rule-value');

  sliders.forEach((s, i) => {
    if (i < defaults.length) {
      s.value = defaults[i].toString();
      if (displays[i]) displays[i].textContent = defaults[i].toFixed(2);
    }
  });

  rebuildRules();
}

// --- Start ---
document.addEventListener('DOMContentLoaded', init);
