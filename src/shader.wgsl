// glitch — Particle Life Compute Shader
// WGSL shader for simulating N-body particle interactions

struct SimParams {
  numParticles: u32,
  dt: f32,
  maxDist: f32,
  numTypes: u32,
  domainSize: f32,
  maxSpeed: f32,
  damping: f32,
  mouseX: f32,
  mouseY: f32,
  mouseStrength: f32,
};

@group(0) @binding(0) var<storage, read> positionsIn: array<vec2<f32>>;
@group(0) @binding(1) var<storage, read_write> velocities: array<vec2<f32>>;
@group(0) @binding(2) var<storage, read> types: array<u32>;
@group(0) @binding(3) var<storage, read_write> positionsOut: array<vec2<f32>>;
@group(0) @binding(4) var<storage, read> rules: array<f32>;
@group(0) @binding(5) var<uniform> params: SimParams;

// Shared memory for tile-based interaction (reduces global memory bandwidth)
var<workgroup> sharedPositions: array<vec2<f32>, 256>;
var<workgroup> sharedTypes: array<u32, 256>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>,
        @builtin(local_invocation_id) lid: vec3<u32>,
        @builtin(workgroup_id) wgid: vec3<u32>) {
  let i = gid.x;
  let numP = params.numParticles;
  let numT = params.numTypes;
  let maxD = params.maxDist;
  let maxDSq = maxD * maxD;
  let epsilon: f32 = 0.001;
  let halfDom = params.domainSize * 0.5;

  if (i >= numP) {
    return;
  }

  let posI = positionsIn[i];
  let typeI = types[i];
  var vel = velocities[i];
  var force = vec2<f32>(0.0, 0.0);

  // Tile-based interaction: load tiles into shared memory
  let numTiles = (numP + 255u) / 256u;

  for (var tile = 0u; tile < numTiles; tile = tile + 1u) {
    // Load this tile's particles into shared memory
    let tileStart = tile * 256u;
    
    if (tileStart + lid.x < numP) {
      sharedPositions[lid.x] = positionsIn[tileStart + lid.x];
      sharedTypes[lid.x] = types[tileStart + lid.x];
    } else {
      sharedPositions[lid.x] = vec2<f32>(0.0, 0.0);
      sharedTypes[lid.x] = 0u;
    }
    
    workgroupBarrier();

    // Iterate over particles in this tile
    for (var j_local = 0u; j_local < 256u; j_local = j_local + 1u) {
      let j = tileStart + j_local;
      if (j >= numP) {
        break;
      }
      if (j == i) {
        continue;
      }

      let posJ = sharedPositions[j_local];
      let typeJ = sharedTypes[j_local];

      // Distance with toroidal (wrap-around) topology
      var delta = posJ - posI;
      
      // Wrap-around on both axes
      if (delta.x > halfDom) { delta.x = delta.x - params.domainSize; }
      if (delta.x < -halfDom) { delta.x = delta.x + params.domainSize; }
      if (delta.y > halfDom) { delta.y = delta.y - params.domainSize; }
      if (delta.y < -halfDom) { delta.y = delta.y + params.domainSize; }

      let distSq = dot(delta, delta);
      if (distSq > maxDSq || distSq < epsilon) {
        continue;
      }

      let dist = sqrt(distSq);
      let invDist = 1.0 / dist;
      let normDelta = delta * invDist;

      // Look up the rule value: rules[typeI * numTypes + typeJ]
      let ruleIdx = typeI * numT + typeJ;
      let ruleVal = rules[ruleIdx];

      // Force: rule * (1 - dist/maxDist) * (1/dist)   -> inverse square-ish with cutoff
      // Using (1 - dist/maxDist) for smoother falloff
      let strength = ruleVal * (1.0 - dist / maxD);
      
      force = force + normDelta * strength;
    }

    workgroupBarrier();
  }

  // Euler integration
  vel = vel + force * params.dt;
  
  // Damping (friction)
  vel = vel * params.damping;
  
  // Clamp speed
  let speed = length(vel);
  if (speed > params.maxSpeed) {
    vel = vel * (params.maxSpeed / speed);
  }

  // Update position
  var newPos = posI + vel * params.dt;

  // Toroidal boundary (wrap-around)
  if (newPos.x < 0.0) { newPos.x = newPos.x + params.domainSize; }
  if (newPos.x > params.domainSize) { newPos.x = newPos.x - params.domainSize; }
  if (newPos.y < 0.0) { newPos.y = newPos.y + params.domainSize; }
  if (newPos.y > params.domainSize) { newPos.y = newPos.y - params.domainSize; }

  // Read results
  velocities[i] = vel;
  positionsOut[i] = newPos;

  // Mouse interaction force (attract/repel toward cursor)
  let ms = params.mouseStrength;
  if (abs(ms) > 0.001) {
    let mousePos = vec2<f32>(params.mouseX, params.mouseY);
    var mouseDelta = mousePos - newPos;

    // Toroidal wrap for mouse too
    if (mouseDelta.x > halfDom) { mouseDelta.x = mouseDelta.x - params.domainSize; }
    if (mouseDelta.x < -halfDom) { mouseDelta.x = mouseDelta.x + params.domainSize; }
    if (mouseDelta.y > halfDom) { mouseDelta.y = mouseDelta.y - params.domainSize; }
    if (mouseDelta.y < -halfDom) { mouseDelta.y = mouseDelta.y + params.domainSize; }

    let mouseDistSq = dot(mouseDelta, mouseDelta);
    if (mouseDistSq > 0.1 && mouseDistSq < maxDSq) {
      let mouseDist = sqrt(mouseDistSq);
      let mouseForce = ms * (1.0 - mouseDist / maxD) / mouseDist;
      velocities[i] = velocities[i] + mouseDelta * mouseForce * params.dt;
    }
  }
}
