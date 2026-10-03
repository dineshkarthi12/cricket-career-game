/**
 * A procedural 3D cricket ground: outfield with mowing stripes, pitch and
 * creases, stumps, 30-yard circle, rope, boards, tiered stands with an
 * instanced crowd, floodlights, sight-screens, a live scoreboard, and a sky.
 *
 * Everything is generated (geometry + canvas textures) - there are no
 * imported stadium models. Detail scales with the quality tier.
 */
import * as THREE from 'three';
import { createStumps } from '../characters/props';
import { PITCH } from '../physics/ballFlight';

export type Quality = 'low' | 'medium' | 'high';
export type TimeOfDay = 'day' | 'night';

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d')!);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export interface StadiumHandles {
  group: THREE.Group;
  strikerStumps: { group: THREE.Group; bails: THREE.Mesh[] };
  bowlerStumps: { group: THREE.Group; bails: THREE.Mesh[] };
  setScoreboard(lines: { title: string; score: string; detail: string; footer: string }): void;
  /** Animate the crowd a little (cheer > 0 makes them jump). */
  update(time: number, cheer: number): void;
  setTimeOfDay(t: TimeOfDay): void;
  dispose(): void;
}

export function createStadium(scene: THREE.Scene, quality: Quality, time: TimeOfDay): StadiumHandles {
  const group = new THREE.Group();
  group.name = 'Stadium';
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(x: T): T => {
    disposables.push(x);
    return x;
  };

  // --- Outfield ------------------------------------------------------------
  const grass = track(
    canvasTexture(1024, 1024, (ctx) => {
      ctx.fillStyle = '#3f8f3a';
      ctx.fillRect(0, 0, 1024, 1024);
      for (let i = 0; i < 16; i += 1) {
        ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.045)';
        ctx.fillRect(i * 64, 0, 64, 1024);
      }
      // Fine noise so the grass is not flat colour.
      const img = ctx.getImageData(0, 0, 1024, 1024);
      for (let p = 0; p < img.data.length; p += 4) {
        const n = (Math.random() - 0.5) * 14;
        img.data[p] += n;
        img.data[p + 1] += n;
        img.data[p + 2] += n * 0.5;
      }
      ctx.putImageData(img, 0, 0);
    }),
  );
  const field = new THREE.Mesh(
    track(new THREE.CircleGeometry(PITCH.boundaryRadius + 6, 96)),
    track(new THREE.MeshStandardMaterial({ map: grass, roughness: 0.95 })),
  );
  field.rotation.x = -Math.PI / 2;
  field.receiveShadow = true;
  group.add(field);

  // --- Pitch and creases ----------------------------------------------------
  const pitchTex = track(
    canvasTexture(256, 2048, (ctx) => {
      const scale = 2048 / 24;
      ctx.fillStyle = '#c9b183';
      ctx.fillRect(0, 0, 256, 2048);
      for (let i = 0; i < 2500; i += 1) {
        ctx.fillStyle = `rgba(${90 + Math.random() * 60},${70 + Math.random() * 40},40,${Math.random() * 0.12})`;
        ctx.fillRect(Math.random() * 256, Math.random() * 2048, 2 + Math.random() * 6, 1 + Math.random() * 3);
      }
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 5;
      const z = (m: number) => 1024 - m * scale;
      for (const end of [-1, 1]) {
        const stumps = end * PITCH.bowlerStumpsZ;
        const popping = stumps - end * PITCH.creaseOffset;
        ctx.beginPath();
        ctx.moveTo(0, z(popping));
        ctx.lineTo(256, z(popping));
        ctx.moveTo(40, z(stumps));
        ctx.lineTo(216, z(stumps));
        for (const x of [40, 216]) {
          ctx.moveTo(x, z(popping));
          ctx.lineTo(x, z(stumps + end * 0.9));
        }
        ctx.stroke();
      }
    }),
  );
  const pitch = new THREE.Mesh(track(new THREE.PlaneGeometry(3.05, 24)), track(new THREE.MeshStandardMaterial({ map: pitchTex, roughness: 0.9 })));
  pitch.rotation.x = -Math.PI / 2;
  pitch.position.y = 0.005;
  pitch.receiveShadow = true;
  group.add(pitch);

  const strikerStumps = createStumps();
  strikerStumps.group.position.set(0, 0, PITCH.strikerStumpsZ);
  const bowlerStumps = createStumps();
  bowlerStumps.group.position.set(0, 0, PITCH.bowlerStumpsZ);
  group.add(strikerStumps.group, bowlerStumps.group);

  // --- 30-yard circle and rope ---------------------------------------------
  const ringMat = track(new THREE.MeshBasicMaterial({ color: '#f4f4f4' }));
  const dot = track(new THREE.CircleGeometry(0.22, 8));
  const dots = new THREE.InstancedMesh(dot, ringMat, 64);
  const m = new THREE.Matrix4();
  for (let i = 0; i < 64; i += 1) {
    const a = (i / 64) * Math.PI * 2;
    m.makeRotationX(-Math.PI / 2).setPosition(Math.sin(a) * 27.4, 0.01, Math.cos(a) * 27.4);
    dots.setMatrixAt(i, m);
  }
  group.add(dots);
  const rope = new THREE.Mesh(track(new THREE.TorusGeometry(PITCH.boundaryRadius, 0.09, 6, 160)), track(new THREE.MeshStandardMaterial({ color: '#1e5ef0', roughness: 0.6 })));
  rope.rotation.x = Math.PI / 2;
  rope.position.y = 0.08;
  group.add(rope);

  // --- Boards ---------------------------------------------------------------
  const boardTex = track(
    canvasTexture(1024, 64, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 1024, 0);
      g.addColorStop(0, '#0f1b33');
      g.addColorStop(0.5, '#1e5ef0');
      g.addColorStop(1, '#0f1b33');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1024, 64);
      ctx.fillStyle = '#f5c518';
      ctx.font = 'bold 34px Poppins, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText('CRICKET CAREER 26  ·  LIVE PvP', 40, 33);
      ctx.fillStyle = '#ffffff';
      ctx.fillText('CRICKET CAREER 26', 640, 33);
    }),
  );
  boardTex.wrapS = THREE.RepeatWrapping;
  // Seen from inside the cylinder (BackSide), so flip the texture to read left to right.
  boardTex.repeat.set(-10, 1);
  const boards = new THREE.Mesh(
    track(new THREE.CylinderGeometry(PITCH.boundaryRadius + 3, PITCH.boundaryRadius + 3, 0.9, 128, 1, true)),
    track(new THREE.MeshStandardMaterial({ map: boardTex, side: THREE.BackSide, emissive: '#ffffff', emissiveMap: boardTex, emissiveIntensity: 0.35 })),
  );
  boards.position.y = 0.45;
  group.add(boards);

  // --- Sight-screens -------------------------------------------------------
  for (const end of [-1, 1]) {
    const screen = new THREE.Mesh(track(new THREE.BoxGeometry(14, 6, 0.4)), track(new THREE.MeshStandardMaterial({ color: '#eef2f8', roughness: 0.8 })));
    screen.position.set(0, 3, end * (PITCH.boundaryRadius + 5));
    group.add(screen);
  }

  // --- Stands ---------------------------------------------------------------
  const inner = PITCH.boundaryRadius + 7;
  const tiers = quality === 'low' ? 10 : 16;
  const profile: THREE.Vector2[] = [new THREE.Vector2(inner, 0)];
  for (let i = 0; i < tiers; i += 1) {
    const r = inner + 1.6 + i * 1.6;
    const y = 1.2 + i * 1.05;
    profile.push(new THREE.Vector2(r - 1.6, y), new THREE.Vector2(r, y));
  }
  const outer = inner + 1.6 + tiers * 1.6;
  profile.push(new THREE.Vector2(outer, 1.2 + tiers * 1.05 + 4), new THREE.Vector2(outer + 2, 0));
  const stands = new THREE.Mesh(
    track(new THREE.LatheGeometry(profile, quality === 'low' ? 48 : 96)),
    track(new THREE.MeshStandardMaterial({ color: '#2c3a57', roughness: 0.9, side: THREE.DoubleSide })),
  );
  stands.receiveShadow = quality === 'high';
  group.add(stands);
  // Roof ring.
  const roof = new THREE.Mesh(
    track(new THREE.RingGeometry(outer - 9, outer + 3, 96, 1)),
    track(new THREE.MeshStandardMaterial({ color: '#0f1b33', roughness: 0.6, side: THREE.DoubleSide })),
  );
  roof.rotation.x = -Math.PI / 2;
  roof.position.y = 1.2 + tiers * 1.05 + 6;
  group.add(roof);

  // --- Crowd ----------------------------------------------------------------
  const crowdCount = quality === 'low' ? 2000 : quality === 'medium' ? 4500 : 8000;
  const person = track(new THREE.CapsuleGeometry(0.27, 0.45, 2, 6));
  const crowdMat = track(new THREE.MeshStandardMaterial({ roughness: 0.9 }));
  const crowd = new THREE.InstancedMesh(person, crowdMat, crowdCount);
  const palette = ['#1e5ef0', '#f5c518', '#e5484d', '#ffffff', '#22a45d', '#0f1b33', '#f59e0b', '#7c3aed', '#0ea5e9'].map((c) => new THREE.Color(c));
  const seats: { x: number; y: number; z: number; phase: number }[] = [];
  for (let i = 0; i < crowdCount; i += 1) {
    const tier = Math.floor(Math.random() * tiers);
    const a = Math.random() * Math.PI * 2;
    // Leave a gap behind each sight-screen.
    if (Math.abs(Math.sin(a)) < 0.12) {
      i -= 1;
      continue;
    }
    const r = inner + 0.8 + tier * 1.6;
    const y = 1.2 + tier * 1.05 + 0.48;
    seats.push({ x: Math.sin(a) * r, y, z: Math.cos(a) * r, phase: Math.random() * Math.PI * 2 });
    m.makeTranslation(Math.sin(a) * r, y, Math.cos(a) * r);
    crowd.setMatrixAt(i, m);
    crowd.setColorAt(i, palette[Math.floor(Math.random() * palette.length)]);
  }
  crowd.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(crowd);

  // --- Floodlights ------------------------------------------------------------
  const towerMat = track(new THREE.MeshStandardMaterial({ color: '#9aa3b5', metalness: 0.4, roughness: 0.5 }));
  const lampMat = track(new THREE.MeshStandardMaterial({ color: '#fffbe8', emissive: '#fff6d0', emissiveIntensity: time === 'night' ? 2.2 : 0.2 }));
  for (let i = 0; i < 4; i += 1) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const r = outer + 6;
    const tower = new THREE.Mesh(track(new THREE.CylinderGeometry(0.6, 1, 46, 8)), towerMat);
    tower.position.set(Math.sin(a) * r, 23, Math.cos(a) * r);
    const lamp = new THREE.Mesh(track(new THREE.BoxGeometry(9, 5, 1)), lampMat);
    lamp.position.set(Math.sin(a) * (r - 1), 47, Math.cos(a) * (r - 1));
    lamp.lookAt(0, 0, 0);
    group.add(tower, lamp);
  }

  // --- Scoreboard -------------------------------------------------------------
  const boardCanvas = document.createElement('canvas');
  boardCanvas.width = 1024;
  boardCanvas.height = 512;
  const scoreTex = track(new THREE.CanvasTexture(boardCanvas));
  scoreTex.colorSpace = THREE.SRGBColorSpace;
  const scoreboard = new THREE.Mesh(
    track(new THREE.PlaneGeometry(24, 12)),
    track(new THREE.MeshBasicMaterial({ map: scoreTex })),
  );
  scoreboard.position.set(-38, 28, -outer + 2);
  scoreboard.lookAt(0, 12, 0);
  group.add(scoreboard);
  const setScoreboard: StadiumHandles['setScoreboard'] = (lines) => {
    const ctx = boardCanvas.getContext('2d')!;
    ctx.fillStyle = '#0b1426';
    ctx.fillRect(0, 0, 1024, 512);
    ctx.strokeStyle = '#f5c518';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, 1014, 502);
    ctx.fillStyle = '#f5c518';
    ctx.font = 'bold 54px Poppins, sans-serif';
    ctx.fillText(lines.title, 48, 100);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 150px Poppins, sans-serif';
    ctx.fillText(lines.score, 48, 270);
    ctx.font = '48px Poppins, sans-serif';
    ctx.fillStyle = '#c9d6f5';
    ctx.fillText(lines.detail, 48, 360);
    ctx.fillStyle = '#7fa6ff';
    ctx.font = 'bold 40px Poppins, sans-serif';
    ctx.fillText(lines.footer, 48, 450);
    scoreTex.needsUpdate = true;
  };
  setScoreboard({ title: 'CRICKET CAREER 26', score: '0/0', detail: 'Live PvP', footer: 'Welcome' });

  // --- Sky ------------------------------------------------------------------
  const skyMat = track(
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } },
      vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying float h; void main(){ gl_FragColor = vec4(mix(bottom, top, clamp(h*1.6,0.0,1.0)), 1.0); }',
    }),
  );
  const sky = new THREE.Mesh(track(new THREE.SphereGeometry(450, 32, 16)), skyMat);
  group.add(sky);

  // --- Lights ---------------------------------------------------------------
  const hemi = new THREE.HemisphereLight('#dfe9ff', '#3d5a2a', 1);
  const sun = new THREE.DirectionalLight('#ffffff', 2.4);
  sun.position.set(-40, 80, 30);
  sun.castShadow = quality !== 'low';
  sun.shadow.mapSize.set(quality === 'high' ? 2048 : 1024, quality === 'high' ? 2048 : 1024);
  const sc = sun.shadow.camera;
  sc.left = -30;
  sc.right = 30;
  sc.top = 30;
  sc.bottom = -30;
  sc.near = 10;
  sc.far = 200;
  sun.shadow.bias = -0.0005;
  sun.target.position.set(0, 0, -2);
  group.add(hemi, sun, sun.target);

  const setTimeOfDay = (t: TimeOfDay) => {
    if (t === 'night') {
      skyMat.uniforms.top.value.set('#050b1c');
      skyMat.uniforms.bottom.value.set('#1b2f5c');
      hemi.intensity = 0.55;
      hemi.color.set('#c7d6ff');
      sun.intensity = 2.8;
      sun.color.set('#f4f1ff');
      lampMat.emissiveIntensity = 2.2;
      scene.fog = new THREE.Fog('#0b1630', 180, 420);
    } else {
      skyMat.uniforms.top.value.set('#3f7fe0');
      skyMat.uniforms.bottom.value.set('#cfe3ff');
      hemi.intensity = 1.05;
      hemi.color.set('#dfe9ff');
      sun.intensity = 2.4;
      sun.color.set('#fff6e6');
      lampMat.emissiveIntensity = 0.2;
      scene.fog = new THREE.Fog('#cfe3ff', 220, 460);
    }
  };
  setTimeOfDay(time);
  scene.add(group);

  const crowdLimit = Math.min(seats.length, quality === 'low' ? 300 : 900);
  return {
    group,
    strikerStumps,
    bowlerStumps,
    setScoreboard,
    setTimeOfDay,
    update(t, cheer) {
      if (cheer <= 0.01) return;
      // Only a slice of the crowd is animated - enough to read as a cheer.
      for (let i = 0; i < crowdLimit; i += 1) {
        const s = seats[i];
        m.makeTranslation(s.x, s.y + Math.max(0, Math.sin(t * 9 + s.phase)) * 0.35 * cheer, s.z);
        crowd.setMatrixAt(i, m);
      }
      crowd.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      scene.remove(group);
      for (const d of disposables) d.dispose();
      crowd.dispose();
      dots.dispose();
      strikerStumps.group.traverse((o) => o instanceof THREE.Mesh && o.geometry.dispose());
      bowlerStumps.group.traverse((o) => o instanceof THREE.Mesh && o.geometry.dispose());
      scene.fog = null;
    },
  };
}
