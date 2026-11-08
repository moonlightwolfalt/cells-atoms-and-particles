// WebGL 3D preview (three.js): terrain from the shared height field, water, POI towers with
// labels, feature beacons, the storm circle and the bus route.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { heightField, LAND_THRESHOLD, featureStyle, TEAM_COLORS, stormCenters, type MapSpec } from '../../../core/src/index.ts';
import { landColor } from './map2d.ts';

const GRID = 192; // vertices per side
const WORLD = 100; // scene units across
const HEIGHT_SCALE = 16;
const SEA = (LAND_THRESHOLD / 1.6) * HEIGHT_SCALE;

const SKY: Record<string, { sky: number; sun: number; ambient: number; fog: number }> = {
  day: { sky: 0x7cc4ff, sun: 1.6, ambient: 0.9, fog: 0x9fd3ff },
  dawn: { sky: 0xffb38a, sun: 1.2, ambient: 0.8, fog: 0xffc9a8 },
  dusk: { sky: 0xff7f50, sun: 1.0, ambient: 0.7, fog: 0xc06c84 },
  night: { sky: 0x1a2150, sun: 0.6, ambient: 0.6, fog: 0x1a2150 },
};

function labelSprite(text: string, color = '#ffffff'): THREE.Sprite {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d')!;
  const px = 48;
  ctx.font = `900 ${px}px "Arial Black", Arial, sans-serif`;
  const w = Math.ceil(ctx.measureText(text).width) + 40;
  c.width = w;
  c.height = px + 30;
  ctx.font = `900 ${px}px "Arial Black", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 12;
  ctx.strokeStyle = 'rgba(10,12,30,0.95)';
  ctx.strokeText(text, w / 2, c.height / 2);
  ctx.fillStyle = color;
  ctx.fillText(text, w / 2, c.height / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sprite.scale.set((w / c.height) * 2.2, 2.2, 1);
  sprite.renderOrder = 10;
  return sprite;
}

export class IslandScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  private controls: OrbitControls;
  private world = new THREE.Group();
  private raf = 0;
  private resizeObs: ResizeObserver;
  private heights: Float32Array = new Float32Array(GRID * GRID);
  autoRotate = true;
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.position.set(0, 70, 85);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.48;
    this.controls.minDistance = 15;
    this.controls.maxDistance = 220;
    this.controls.addEventListener('start', () => (this.autoRotate = false));
    this.scene.add(this.world);
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    this.resize();
    const tick = () => {
      this.raf = requestAnimationFrame(tick);
      this.controls.autoRotate = this.autoRotate;
      this.controls.autoRotateSpeed = 0.6;
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    tick();
  }

  private resize() {
    const w = this.container.clientWidth || 600;
    const h = this.container.clientHeight || 400;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private heightAtMap(x: number, y: number): number {
    const i = Math.min(GRID - 1, Math.max(0, Math.round(x * (GRID - 1))));
    const j = Math.min(GRID - 1, Math.max(0, Math.round(y * (GRID - 1))));
    return Math.max(SEA, this.heights[j * GRID + i] * HEIGHT_SCALE);
  }

  private toScene(x: number, y: number, lift = 0): THREE.Vector3 {
    return new THREE.Vector3((x - 0.5) * WORLD, this.heightAtMap(x, y) + lift, (y - 0.5) * WORLD);
  }

  setSpec(spec: MapSpec) {
    for (const child of [...this.world.children]) {
      this.world.remove(child);
      child.traverse((o: any) => {
        o.geometry?.dispose?.();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m: any) => (m.map?.dispose?.(), m.dispose?.()));
      });
    }
    for (const l of this.scene.children.filter((c) => (c as THREE.Light).isLight)) this.scene.remove(l);

    const sky = SKY[spec.time_of_day] || SKY.day;
    this.scene.background = new THREE.Color(sky.sky);
    this.scene.fog = new THREE.Fog(sky.sky, 160, 340);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, sky.ambient));
    const sun = new THREE.DirectionalLight(0xffffff, sky.sun);
    sun.position.set(-40, 80, 30);
    this.scene.add(sun);

    // Terrain
    this.heights = heightField(spec, GRID);
    const geo = new THREE.PlaneGeometry(WORLD, WORLD, GRID - 1, GRID - 1);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const night = spec.time_of_day === 'night';
    for (let v = 0; v < pos.count; v++) {
      const i = v % GRID;
      const j = Math.floor(v / GRID);
      const h = this.heights[j * GRID + i];
      pos.setY(v, h * HEIGHT_SCALE);
      const x = i / (GRID - 1);
      const y = j / (GRID - 1);
      const raw = h * 1.6;
      const c = raw > LAND_THRESHOLD ? landColor(spec, x, y, raw) : [200, 190, 150];
      const k = night ? 0.6 : 1;
      colors[v * 3] = (c[0] / 255) * k;
      colors[v * 3 + 1] = (c[1] / 255) * k;
      colors[v * 3 + 2] = (c[2] / 255) * k;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }));
    this.world.add(terrain);

    // Water
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD * 3, WORLD * 3),
      new THREE.MeshStandardMaterial({ color: night ? 0x0c2a55 : 0x1e7fd0, transparent: true, opacity: 0.85, roughness: 0.25, metalness: 0.1 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = SEA - 0.05;
    this.world.add(water);

    // Roads / course path
    for (const rd of spec.roads) {
      const pts = rd.points.map((p) => this.toScene(p.x, p.y, 0.25));
      const curve = new THREE.CatmullRomCurve3(pts);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, pts.length * 12, 0.35, 6, false), new THREE.MeshStandardMaterial({ color: 0xf2e6c9, roughness: 0.8 }));
      this.world.add(tube);
    }

    // POIs: towers + labels
    for (const p of spec.pois) {
      const base = this.toScene(p.x, p.y);
      const hgt = { small: 2.5, medium: 4, large: 6 }[p.size];
      const n = { small: 3, medium: 5, large: 8 }[p.size];
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + p.x * 9;
        const r = k === 0 ? 0 : 1.2 + (k % 3) * 0.6;
        const bh = hgt * (0.5 + ((k * 37) % 10) / 20);
        const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, bh, 1.2), new THREE.MeshStandardMaterial({ color: k === 0 ? 0xfff3d6 : 0xd9d2e9, roughness: 0.7 }));
        box.position.set(base.x + Math.cos(a) * r, base.y + bh / 2, base.z + Math.sin(a) * r);
        this.world.add(box);
      }
      const label = labelSprite(p.name.toUpperCase());
      label.position.set(base.x, base.y + hgt + 3, base.z);
      this.world.add(label);
    }

    // Features: glowing beacons
    for (const f of spec.features) {
      const st = featureStyle(f.type);
      const color = new THREE.Color(f.team ? TEAM_COLORS[f.team] || st.color : st.color);
      const p = this.toScene(f.x, f.y);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.4, 6), new THREE.MeshStandardMaterial({ color: 0xffffff }));
      pole.position.set(p.x, p.y + 1.2, p.z);
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6 }));
      orb.position.set(p.x, p.y + 2.6, p.z);
      this.world.add(pole, orb);
    }

    // Storm: first circle as a translucent wall, final circle marker
    if (spec.storm.phases.length) {
      const first = stormCenters(spec)[0];
      const wall = new THREE.Mesh(
        new THREE.CylinderGeometry(first.r * WORLD, first.r * WORLD, 10, 96, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xb06cff, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }),
      );
      wall.position.set((first.x - 0.5) * WORLD, SEA + 5, (first.y - 0.5) * WORLD);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(first.r * WORLD, 0.25, 6, 128),
        new THREE.MeshBasicMaterial({ color: 0xd8b4ff }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set((first.x - 0.5) * WORLD, SEA + 10, (first.y - 0.5) * WORLD);
      this.world.add(wall, ring);
    }

    // Bus route
    if (spec.bus_route) {
      const a = new THREE.Vector3((spec.bus_route.start.x - 0.5) * WORLD, 34, (spec.bus_route.start.y - 0.5) * WORLD);
      const b = new THREE.Vector3((spec.bus_route.end.x - 0.5) * WORLD, 34, (spec.bus_route.end.y - 0.5) * WORLD);
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 2, gapSize: 1.2 }));
      line.computeLineDistances();
      const bus = new THREE.Mesh(new THREE.BoxGeometry(3, 1.4, 1.6), new THREE.MeshStandardMaterial({ color: 0x2b7bff, emissive: 0x112244 }));
      bus.position.copy(a);
      bus.lookAt(b);
      this.world.add(line, bus);
    }
  }

  screenshot(): HTMLCanvasElement {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement;
  }

  resetView() {
    this.camera.position.set(0, 70, 85);
    this.controls.target.set(0, 0, 0);
    this.autoRotate = true;
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.resizeObs.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
