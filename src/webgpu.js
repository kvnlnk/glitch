// glitch — WebGPU initialization and compute pipeline

import shaderSource from './shader.wgsl?raw';

const NUM_TYPES = 6;
const WORKGROUP_SIZE = 256;
const MAX_PARTICLES = 200000;
const DOMAIN_SIZE = 800;

export { NUM_TYPES };

/**
 * Initialize WebGPU device.
 */
export async function initWebGPU() {
  if (!navigator.gpu) {
    throw new Error('WebGPU not supported');
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error('No WebGPU adapter found');
  }

  const device = await adapter.requestDevice();
  if (!device) {
    throw new Error('Failed to create WebGPU device');
  }

  const shaderModule = device.createShaderModule({
    code: shaderSource,
  });

  return { device, shaderModule };
}

/**
 * Create the particle simulation system.
 * Buffers are allocated for MAX_PARTICLES but only count particles are active.
 */
export function createSimulation(device, shaderModule, count) {
  const numTypes = NUM_TYPES;
  const maxDist = 80;
  const activeCount = Math.min(count, MAX_PARTICLES);

  // Allocate for max capacity
  const posSize = MAX_PARTICLES * 2 * 4;
  const velSize = MAX_PARTICLES * 2 * 4;
  const typesSize = MAX_PARTICLES * 4;
  const rulesSize = numTypes * numTypes * 4;
  const paramsSize = 32;

  const posA = device.createBuffer({
    size: posSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
  });
  const posB = device.createBuffer({
    size: posSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
  });
  const velBuffer = device.createBuffer({
    size: velSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  const typesBuffer = device.createBuffer({
    size: typesSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  const rulesBuffer = device.createBuffer({
    size: rulesSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  const paramsBuffer = device.createBuffer({
    size: paramsSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const readBuffer = device.createBuffer({
    size: posSize,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });

  // Bind group layout
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
    ],
  });

  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout],
  });

  const computePipeline = device.createComputePipeline({
    layout: pipelineLayout,
    compute: { module: shaderModule, entryPoint: 'main' },
  });

  // Fill initial data
  function fillInitialData(n) {
    const data = generateParticleData(n, DOMAIN_SIZE, numTypes);
    device.queue.writeBuffer(posA, 0, data.positions);
    device.queue.writeBuffer(posB, 0, data.positions);
    device.queue.writeBuffer(velBuffer, 0, data.velocities);
    device.queue.writeBuffer(typesBuffer, 0, data.types);
  }
  fillInitialData(activeCount);

  const rulesData = generateDefaultRules(numTypes);
  device.queue.writeBuffer(rulesBuffer, 0, rulesData);

  function makeBG(posIn, posOut) {
    return device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: posIn } },
        { binding: 1, resource: { buffer: velBuffer } },
        { binding: 2, resource: { buffer: typesBuffer } },
        { binding: 3, resource: { buffer: posOut } },
        { binding: 4, resource: { buffer: rulesBuffer } },
        { binding: 5, resource: { buffer: paramsBuffer } },
      ],
    });
  }

  let bindGroupA = makeBG(posA, posB);
  let bindGroupB = makeBG(posB, posA);
  let activeIsA = true;
  let currentCount = activeCount;

  // Set active particle count (≤ MAX_PARTICLES)
  function setCount(n) {
    const newCount = Math.min(n, MAX_PARTICLES);
    if (newCount !== currentCount) {
      // Reinitialize positions for the new count
      fillInitialData(newCount);
      currentCount = newCount;
    }
    currentCount = newCount;
  }

  // Compute step
  let mouseData = { x: 0, y: 0, strength: 0 };

  function setMouse(x, y, strength) {
    mouseData = { x, y, strength };
  }

  function computeStep(dt) {
    const buf = new ArrayBuffer(44);
    const view = new DataView(buf);
    view.setUint32(0, currentCount, true);
    view.setFloat32(4, dt, true);
    view.setFloat32(8, maxDist, true);
    view.setUint32(12, numTypes, true);
    view.setFloat32(16, DOMAIN_SIZE, true);
    view.setFloat32(20, 3.0, true);
    view.setFloat32(24, 0.92, true);
    view.setFloat32(28, mouseData.x, true);
    view.setFloat32(28 + 4, mouseData.y, true);
    view.setFloat32(28 + 8, mouseData.strength, true);
    device.queue.writeBuffer(paramsBuffer, 0, buf);

    const bg = activeIsA ? bindGroupA : bindGroupB;
    activeIsA = !activeIsA;

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(computePipeline);
    pass.setBindGroup(0, bg);

    const wg = Math.ceil(currentCount / WORKGROUP_SIZE);
    pass.dispatchWorkgroups(wg);
    pass.end();
    device.queue.submit([encoder.finish()]);
  }

  // Read positions back to CPU
  async function readPositions() {
    const src = activeIsA ? posB : posA;
    const readSize = currentCount * 2 * 4;

    const encoder = device.createCommandEncoder();
    encoder.copyBufferToBuffer(src, 0, readBuffer, 0, readSize);
    device.queue.submit([encoder.finish()]);

    await readBuffer.mapAsync(GPUMapMode.READ);
    const data = new Float32Array(readBuffer.getMappedRange().slice(0, readSize));
    readBuffer.unmap();
    return data;
  }

  function updateRules(newRules) {
    device.queue.writeBuffer(rulesBuffer, 0, newRules);
  }

  function resetParticles(n) {
    const targetCount = Math.min(n || currentCount, MAX_PARTICLES);
    fillInitialData(targetCount);
    currentCount = targetCount;
  }

  return { computeStep, readPositions, updateRules, resetParticles, setCount, setMouse };
}

function generateParticleData(numParticles, domainSize, numTypes) {
  const positions = new Float32Array(numParticles * 2);
  const velocities = new Float32Array(numParticles * 2);
  const types = new Uint32Array(numParticles);
  const margin = domainSize * 0.05;
  const innerSize = domainSize - 2 * margin;

  for (let i = 0; i < numParticles; i++) {
    positions[i * 2] = margin + Math.random() * innerSize;
    positions[i * 2 + 1] = margin + Math.random() * innerSize;
    velocities[i * 2] = (Math.random() - 0.5) * 0.3;
    velocities[i * 2 + 1] = (Math.random() - 0.5) * 0.3;
    types[i] = Math.floor(Math.random() * numTypes);
  }
  return { positions, velocities, types };
}

function generateDefaultRules(numTypes) {
  const rules = new Float32Array(numTypes * numTypes);
  const seed = [
    [ 0.5, -0.4,  0.3, -0.2,  0.1, -0.3],
    [-0.3,  0.6, -0.5,  0.2, -0.1,  0.4],
    [ 0.2, -0.3,  0.7, -0.6,  0.5, -0.1],
    [-0.4,  0.1, -0.2,  0.5, -0.3,  0.6],
    [ 0.3, -0.5,  0.4, -0.1,  0.8, -0.2],
    [-0.1,  0.2, -0.4,  0.3, -0.6,  0.9],
  ];
  for (let i = 0; i < numTypes; i++) {
    for (let j = 0; j < numTypes; j++) {
      rules[i * numTypes + j] = seed[i][j];
    }
  }
  return rules;
}
