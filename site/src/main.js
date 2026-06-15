/**
 * glitch — landing page interactivity
 * Canvas-based particle preview simulating the WebGPU Particle Life behavior
 */

const DEMO_CANVAS_KEY = 'glitch-demo-canvas';

class ParticlePreview {
  constructor(container) {
    this.container = container;
    this.canvas = null;
    this.ctx = null;
    this.particles = [];
    this.animationId = null;
    this.isRunning = false;

    this.NUM_PARTICLES = 200;
    this.TYPES = 6;
    this.INTERACTION_RADIUS = 80;
    this.SPEED = 0.8;
  }

  init() {
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-hidden', 'true');
    this.canvas.setAttribute('role', 'presentation');
    this.canvas.className = 'demo-canvas';

    const rect = this.container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    this.ctx = this.canvas.getContext('2d');

    this.container.innerHTML = '';
    this.container.appendChild(this.canvas);
    this.container.classList.add('demo-area--active');

    this.ctx.scale(dpr, dpr);
    this.W = rect.width;
    this.H = rect.height;

    this._buildRuleMatrix();
    this._spawnParticles();
    this._bindResize();
    this.start();
  }

  _buildRuleMatrix() {
    // Attraction/repulsion matrix between particle types
    this.ruleMatrix = [];
    for (let i = 0; i < this.TYPES; i++) {
      this.ruleMatrix[i] = [];
      for (let j = 0; j < this.TYPES; j++) {
        this.ruleMatrix[i][j] = (Math.random() - 0.5) * 2;
      }
    }
  }

  _spawnParticles() {
    this.particles = [];
    const pad = 20;
    for (let i = 0; i < this.NUM_PARTICLES; i++) {
      this.particles.push({
        x: pad + Math.random() * (this.W - pad * 2),
        y: pad + Math.random() * (this.H - pad * 2),
        vx: (Math.random() - 0.5) * this.SPEED,
        vy: (Math.random() - 0.5) * this.SPEED,
        type: Math.floor(Math.random() * this.TYPES),
      });
    }
  }

  _bindResize() {
    this._resizeHandler = () => {
      const rect = this.container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = rect.width * dpr;
      this.canvas.height = rect.height * dpr;
      this.canvas.style.width = `${rect.width}px`;
      this.canvas.style.height = `${rect.height}px`;
      this.ctx.scale(dpr, dpr);
      this.W = rect.width;
      this.H = rect.height;
    };
    window.addEventListener('resize', this._resizeHandler);
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this._loop();
  }

  stop() {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  destroy() {
    this.stop();
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
    }
  }

  _loop() {
    if (!this.isRunning) return;
    this._update();
    this._draw();
    this.animationId = requestAnimationFrame(() => this._loop());
  }

  _update() {
    const { particles, W, H, INTERACTION_RADIUS: RAD, ruleMatrix, SPEED } = this;

    // Compute forces
    for (let i = 0; i < particles.length; i++) {
      let fx = 0;
      let fy = 0;
      const pi = particles[i];

      for (let j = 0; j < particles.length; j++) {
        if (i === j) continue;
        const pj = particles[j];
        const dx = pj.x - pi.x;
        const dy = pj.y - pi.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0 && dist < RAD) {
          const force = ruleMatrix[pi.type][pj.type] / (dist + 1);
          fx += (dx / dist) * force;
          fy += (dy / dist) * force;
        }
      }

      // Apply velocity damping
      pi.vx += fx * 0.05;
      pi.vy += fy * 0.05;
      pi.vx *= 0.95;
      pi.vy *= 0.95;

      // Clamp velocity
      const maxSpeed = SPEED * 2;
      const speed = Math.sqrt(pi.vx * pi.vx + pi.vy * pi.vy);
      if (speed > maxSpeed) {
        pi.vx = (pi.vx / speed) * maxSpeed;
        pi.vy = (pi.vy / speed) * maxSpeed;
      }

      // Move
      pi.x += pi.vx;
      pi.y += pi.vy;

      // Wrap around edges
      if (pi.x < 0) pi.x += W;
      if (pi.x > W) pi.x -= W;
      if (pi.y < 0) pi.y += H;
      if (pi.y > H) pi.y -= H;
    }
  }

  _draw() {
    const { ctx, W, H, particles, TYPES } = this;
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);

    // Colors per type
    const colors = [
      '#00f0ff', // cyan
      '#ff00aa', // magenta
      '#00ff88', // green
      '#ffaa00', // amber
      '#8866ff', // violet
      '#ff4466', // rose
    ];

    // Draw connections (faint lines between nearby particles)
    ctx.lineWidth = 0.5;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[j].x - particles[i].x;
        const dy = particles[j].y - particles[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 60) {
          const alpha = (1 - dist / 60) * 0.15;
          ctx.strokeStyle = `rgba(0, 240, 255, ${alpha})`;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }

    // Draw particles
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const color = colors[p.type % colors.length];
      const alpha = 0.6 + Math.random() * 0.4;
      ctx.globalAlpha = alpha;

      // Glow
      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 6);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fill();

      // Core dot
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }
}

/**
 * Initialize everything on DOM ready
 */
document.addEventListener('DOMContentLoaded', () => {
  const demoContainer = document.getElementById(DEMO_CANVAS_KEY);
  if (demoContainer) {
    const preview = new ParticlePreview(demoContainer);
    preview.init();
  }

  // Active nav link highlighting via IntersectionObserver
  const sections = document.querySelectorAll('[data-section]');
  const navLinks = document.querySelectorAll('.nav-link');

  if (sections.length && navLinks.length) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('id');
            navLinks.forEach((link) => {
              link.classList.toggle(
                'nav-link--active',
                link.getAttribute('href') === `#${id}`
              );
            });
          }
        });
      },
      { threshold: 0.3 }
    );

    sections.forEach((s) => observer.observe(s));
  }
});
