// Archipelago world: ocean, five islands, runway, palms, lighthouse,
// volcano, clouds, sun + shadows, sky and fog. Terrain height is a pure
// function of (x, z) so physics and rendering always agree.

import * as THREE from 'three';
import { WORLD, COLORS, ISLANDS, RUNWAY, DROP_ZONE, HELIPAD } from './config.js';
import { makeRng } from './random.js';

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// Concentric-ring disc for islands: CircleGeometry is only a fan
// (one centre vertex + rim), so vertex colours can only show green at
// the exact peak and the slopes all blend to sand. Rings give the
// grass / sand / rock bands real area. Winding matches CircleGeometry
// after rotateX(-PI/2) (up-facing); the island material is DoubleSide
// as well, so a flipped triangle can never blank an island.
function makeDiscGeometry(radius, ringFracs, seg) {
  const positions = [];
  const indices = [];
  const ringStart = [];
  ringFracs.forEach((f) => {
    ringStart.push(positions.length / 3);
    if (f === 0) {
      positions.push(0, 0, 0);
    } else {
      for (let i = 0; i < seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        positions.push(Math.cos(a) * radius * f, 0, -Math.sin(a) * radius * f);
      }
    }
  });
  const firstRing = ringStart[1];
  for (let i = 0; i < seg; i++) {
    indices.push(ringStart[0], firstRing + (i + 1) % seg, firstRing + i);
  }
  for (let r = 1; r < ringFracs.length - 1; r++) {
    const a0 = ringStart[r];
    const a1 = ringStart[r + 1];
    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg;
      indices.push(a0 + i, a1 + j, a1 + i);
      indices.push(a0 + i, a0 + j, a1 + j);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  return geo;
}

function islandBump(dx, dz, radius, peak) {
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d >= radius) return 0;
  const t = 1 - d / radius;
  // Smooth dome: high centre, gentle beach at the rim.
  return peak * t * t * (3 - 2 * t);
}

export function terrainHeightAt(x, z) {
  let h = 0;
  for (const isle of ISLANDS) {
    h += islandBump(x - isle.x, z - isle.z, isle.radius, isle.peak);
  }
  // Flatten a corridor along the home runway: the strip is drawn at
  // y=0.35, so without this the island dome (~24 high at the centre)
  // would bury the runway completely. Blend out smoothly at the edges.
  // The flat zone extends well south of the threshold so the final
  // approach is clear: the dome's southern slope used to rise 12 m
  // just before the threshold, hiding the runway from a low approach
  // (and blocking a landing from the south).
  if (h > 0) {
    const rx = Math.abs(x - RUNWAY.centerX);
    const fx = 1 - smoothstep(14, 26, rx);
    const south = RUNWAY.centerZ - z; // >0 south of the runway centre
    const north = z - RUNWAY.centerZ;
    const fzS = south <= 0 ? 1 : 1 - smoothstep(220, 260, south);
    const fzN = north <= 0 ? 1 : 1 - smoothstep(RUNWAY.length / 2 + 6, RUNWAY.length / 2 + 26, north);
    const fz = Math.min(fzS, fzN);
    h *= 1 - fx * fz;
  }
  if (h <= 0) return 0;
  // Low rolling variation so flat tops still read as terrain.
  const wobble =
    Math.sin(x * 0.045 + 1.7) * Math.cos(z * 0.038 - 0.6) * 1.6 +
    Math.sin(x * 0.11 - z * 0.07) * 0.7;
  // Twin Peaks gets a second summit bump; volcano gets a crater dip.
  let extra = 0;
  const tp = ISLANDS[2];
  const dTp = Math.hypot(x - (tp.x + 52), z - (tp.z - 38));
  if (dTp < 70) extra += 26 * Math.max(0, 1 - dTp / 70);
  const vo = ISLANDS[3];
  const dVo = Math.hypot(x - vo.x, z - vo.z);
  if (dVo < 34) extra -= 18 * Math.max(0, 1 - dVo / 34);
  return Math.max(0, h + wobble * Math.min(1, h / 12) + extra);
}

function makePalm(rng) {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: COLORS.palmTrunk, flatShading: true });
  const leafMat = new THREE.MeshLambertMaterial({ color: COLORS.palmLeaf, flatShading: true });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.42, 5.2, 6), trunkMat);
  trunk.position.y = 2.6;
  trunk.rotation.z = rng.range(-0.12, 0.12);
  g.add(trunk);
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.4, 4), leafMat);
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 1.1, 5.6, Math.sin(a) * 1.1);
    leaf.rotation.set(Math.sin(a) * 1.15, 0, -Math.cos(a) * 1.15);
    leaf.scale.set(1, 1, 0.28);
    g.add(leaf);
  }
  const nut = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0x8a5a2b, flatShading: true }),
  );
  nut.position.y = 5.1;
  g.add(nut);
  return g;
}

export function buildWorld(scene, seed = WORLD.seed) {
  const rng = makeRng(seed);
  const group = new THREE.Group();
  group.name = 'archipelago';
  scene.add(group);

  // Sky: big gradient dome (BackSide) + fog for depth.
  scene.fog = new THREE.Fog(COLORS.waterDeep, WORLD.fogNear, WORLD.fogFar);
  scene.background = new THREE.Color(WORLD.skyBottom);
  const skyGeo = new THREE.SphereGeometry(2600, 24, 12);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(WORLD.skyTop) },
      bottom: { value: new THREE.Color(WORLD.skyBottom) },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 bottom; void main(){ float t = clamp(normalize(vP).y * 1.4 + 0.25, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, t), 1.0); }',
  });
  group.add(new THREE.Mesh(skyGeo, skyMat));

  // Sun + hemisphere light.
  const sun = new THREE.DirectionalLight(0xfff2d0, 2.4);
  sun.position.set(...WORLD.sunPosition);
  sun.castShadow = true;
  sun.shadow.mapSize.set(WORLD.shadowMapSize, WORLD.shadowMapSize);
  sun.shadow.camera.left = -260;
  sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260;
  sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 1400;
  sun.shadow.bias = -0.0006;
  group.add(sun);
  group.add(new THREE.HemisphereLight(0xbfe8ff, 0x3d7a4a, 1.1));
  // Sun: radial-gradient sprite so the light source is always a round
  // disc with a soft glow, never a flat polygon, from any angle.
  function makeSunTexture() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,250,220,1)');
    g.addColorStop(0.22, 'rgba(255,240,180,0.95)');
    g.addColorStop(0.5, 'rgba(255,220,120,0.4)');
    g.addColorStop(1, 'rgba(255,210,100,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeSunTexture(), fog: false, depthWrite: false, transparent: true,
  }));
  sunSprite.position.set(900, 700, 500);
  sunSprite.scale.setScalar(340);
  sunSprite.name = 'sun';
  group.add(sunSprite);

  // Ocean: large flat plane, slightly transparent teal.
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.oceanSize, WORLD.oceanSize, 1, 1),
    new THREE.MeshLambertMaterial({ color: COLORS.water, transparent: true, opacity: 0.94 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = WORLD.waterLevel;
  ocean.receiveShadow = true;
  group.add(ocean);

  // Islands: displaced disc geometry per island, sand rim + grass top
  // via vertex colours. Heights use the same terrainHeightAt as physics.
  const islandMeshes = [];
  for (const isle of ISLANDS) {
    const seg = 48;
    // Radial-grid disc (not a CircleGeometry fan) so vertex colours
    // have real area — see makeDiscGeometry.
    const geo = makeDiscGeometry(isle.radius, [0, 0.2, 0.38, 0.55, 0.68, 0.82, 0.92, 1.0], seg);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const sand = new THREE.Color(COLORS.sand);
    const grass = new THREE.Color(isle.kind === 'volcano' ? COLORS.volcanoRock : COLORS.grass);
    const grassDark = new THREE.Color(COLORS.grassDark);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + isle.x;
      const z = pos.getZ(i) + isle.z;
      const h = terrainHeightAt(x, z);
      // Vertices must be written in world coords: the mesh itself sits
      // at the origin, so without setX/setZ all five islands would
      // render stacked on top of each other at (0, 0) while physics
      // terrain sits at the correct offsets.
      pos.setX(i, x);
      pos.setZ(i, z);
      pos.setY(i, h);
      // Distance from THIS island's centre (vertices are in world
      // coords) — the old code measured from the world origin, so every
      // island except Home came out all sand.
      const d = Math.hypot(pos.getX(i) - isle.x, pos.getZ(i) - isle.z) / isle.radius;
      const c = d > 0.82 ? sand : d > 0.55 ? grass.clone().lerp(sand, 0.25) : (isle.kind === 'peaks' && h > 48 ? new THREE.Color(COLORS.rock) : grass.clone().lerp(grassDark, 0.3));
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }),
    );
    mesh.position.set(isle.x, 0, isle.z);
    // CircleGeometry is centred, so shift vertices back: geometry was
    // built around origin then displaced in world coords — recentre mesh.
    mesh.position.set(0, 0, 0);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    group.add(mesh);
    islandMeshes.push(mesh);
  }

  // Home runway: dark strip + white centreline dashes + threshold bars.
  const runwayGroup = new THREE.Group();
  runwayGroup.name = 'runway';
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(RUNWAY.width, RUNWAY.length),
    new THREE.MeshLambertMaterial({ color: 0x3a3f46 }),
  );
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(RUNWAY.centerX, 0.35, RUNWAY.centerZ);
  strip.receiveShadow = true;
  runwayGroup.add(strip);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (let i = 0; i < 9; i++) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 8), dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(RUNWAY.centerX, 0.4, RUNWAY.centerZ - RUNWAY.length / 2 + 14 + i * 22);
    runwayGroup.add(dash);
  }
  group.add(runwayGroup);

  // Hangar + windsock on Home Island.
  const hangar = new THREE.Mesh(
    new THREE.BoxGeometry(22, 9, 16),
    new THREE.MeshLambertMaterial({ color: COLORS.fuselageWhite, flatShading: true }),
  );
  hangar.position.set(-34, 4.5 + terrainHeightAt(-34, 18), 18);
  hangar.castShadow = true;
  group.add(hangar);
  const hangarRoof = new THREE.Mesh(
    new THREE.CylinderGeometry(8, 8, 22, 12, 1, false, 0, Math.PI),
    new THREE.MeshLambertMaterial({ color: COLORS.teal, flatShading: true }),
  );
  hangarRoof.rotation.z = Math.PI / 2;
  hangarRoof.rotation.y = Math.PI / 2;
  hangarRoof.position.set(-34, 9 + terrainHeightAt(-34, 18), 18);
  group.add(hangarRoof);
  const sockPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 7, 6),
    new THREE.MeshLambertMaterial({ color: 0xdddddd }),
  );
  sockPole.position.set(16, 3.5 + terrainHeightAt(16, -8), -8);
  group.add(sockPole);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(0.7, 3.2, 8),
    new THREE.MeshLambertMaterial({ color: COLORS.amber, flatShading: true }),
  );
  sock.rotation.z = Math.PI / 2;
  sock.position.set(17.6, 6.6 + terrainHeightAt(16, -8), -8);
  sock.name = 'windsock';
  group.add(sock);

  // Lighthouse on Palm Cay.
  const cay = ISLANDS[1];
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 4.2, 18, 10),
    new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }),
  );
  tower.position.set(cay.x, terrainHeightAt(cay.x, cay.z) + 9, cay.z);
  tower.castShadow = true;
  group.add(tower);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 12, 8),
    new THREE.MeshBasicMaterial({ color: COLORS.gold }),
  );
  lamp.position.set(cay.x, terrainHeightAt(cay.x, cay.z) + 19.5, cay.z);
  lamp.name = 'lighthouse-lamp';
  group.add(lamp);

  // Volcano: cone, glowing crater, smoke column (animated in main loop).
  const vo = ISLANDS[3];
  const crater = new THREE.Mesh(
    new THREE.CircleGeometry(20, 20),
    new THREE.MeshBasicMaterial({ color: COLORS.lava }),
  );
  crater.rotation.x = -Math.PI / 2;
  crater.position.set(vo.x, terrainHeightAt(vo.x, vo.z) + 0.6, vo.z);
  crater.name = 'lava-crater';
  group.add(crater);
  const smoke = [];
  for (let i = 0; i < 7; i++) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(6 + i * 1.6, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0x9a9a9a, transparent: true, opacity: 0.75, flatShading: true }),
    );
    puff.position.set(vo.x + rng.range(-4, 4), terrainHeightAt(vo.x, vo.z) + 8 + i * 7, vo.z + rng.range(-4, 4));
    puff.name = 'smoke-puff';
    group.add(puff);
    smoke.push(puff);
  }

  // Helipad disc on the volcano rim + drop-zone ring on Far Atoll.
  const pad = new THREE.Mesh(
    new THREE.CircleGeometry(HELIPAD.radius, 24),
    new THREE.MeshLambertMaterial({ color: COLORS.amber, transparent: true, opacity: 0.85 }),
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(HELIPAD.x + 26, terrainHeightAt(HELIPAD.x + 26, HELIPAD.z) + 0.5, HELIPAD.z);
  pad.name = 'helipad';
  group.add(pad);
  const dropRing = new THREE.Mesh(
    new THREE.RingGeometry(DROP_ZONE.radius - 2, DROP_ZONE.radius, 32),
    new THREE.MeshBasicMaterial({ color: COLORS.gold, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
  );
  dropRing.rotation.x = -Math.PI / 2;
  dropRing.position.set(DROP_ZONE.x, terrainHeightAt(DROP_ZONE.x, DROP_ZONE.z) + 0.5, DROP_ZONE.z);
  dropRing.name = 'drop-zone';
  group.add(dropRing);

  // Palms: InstancedMesh, deterministic placement on grassy ground.
  const palmTemplate = makePalm(rng);
  const palmCount = 90;
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.42, 5.2, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: COLORS.palmTrunk, flatShading: true });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmCount);
  const leafGeo = new THREE.ConeGeometry(0.55, 3.4, 4);
  const leafMat = new THREE.MeshLambertMaterial({ color: COLORS.palmLeaf, flatShading: true });
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, palmCount * 6);
  const dummy = new THREE.Object3D();
  let placed = 0;
  let leafIdx = 0;
  let guard = 0;
  while (placed < palmCount && guard++ < 4000) {
    const isle = rng.pick(ISLANDS);
    if (isle.kind === 'volcano') continue;
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(18, isle.radius * 0.86);
    const x = isle.x + Math.cos(a) * r;
    const z = isle.z + Math.sin(a) * r;
    const h = terrainHeightAt(x, z);
    if (h < 1.2 || h > 34) continue;
    // Keep the runway clear.
    if (Math.abs(x - RUNWAY.centerX) < 16 && Math.abs(z - RUNWAY.centerZ) < RUNWAY.length / 2 + 12) continue;
    const s = rng.range(1.4, 2.3);
    dummy.position.set(x, h + 2.6 * s, z);
    dummy.rotation.set(0, rng.range(0, Math.PI * 2), rng.range(-0.1, 0.1));
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    trunks.setMatrixAt(placed, dummy.matrix);
    for (let i = 0; i < 6; i++) {
      const la = (i / 6) * Math.PI * 2 + dummy.rotation.y;
      dummy.position.set(x + Math.cos(la) * 1.1 * s, h + 5.6 * s, z + Math.sin(la) * 1.1 * s);
      dummy.rotation.set(Math.sin(la) * 1.15, 0, -Math.cos(la) * 1.15);
      dummy.scale.set(s, s, s * 0.28);
      dummy.updateMatrix();
      leaves.setMatrixAt(leafIdx++, dummy.matrix);
    }
    placed++;
  }
  trunks.count = placed;
  leaves.count = leafIdx;
  trunks.castShadow = true;
  group.add(trunks);
  group.add(leaves);
  void palmTemplate;

  // Clouds: bright, round, puffy sphere clusters (emissive lift so the
  // undersides never read as grey plates).
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x8f8f8f, flatShading: true, transparent: true, opacity: 0.95 });
  const clouds = [];
  for (let i = 0; i < 16; i++) {
    const cloud = new THREE.Group();
    const puffs = rng.int(4, 6);
    for (let j = 0; j < puffs; j++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(rng.range(8, 15), 10, 8), cloudMat);
      s.position.set(rng.range(-10, 10), rng.range(-2, 3), rng.range(-6, 6));
      s.scale.y = rng.range(0.75, 0.95);
      cloud.add(s);
    }
    cloud.position.set(rng.range(-900, 900), rng.range(120, 210), rng.range(-900, 900));
    cloud.name = 'cloud';
    cloud.userData.speed = rng.range(1.2, 3.2);
    group.add(cloud);
    clouds.push(cloud);
  }

  return { group, clouds, smoke, lamp, crater, sock, sun };
}
