// Studio 3D. "inside" sits at a real room's 360° capture point, so the photo is never distorted and
// furniture lands on the real floor at true scale. "model" and "plan" show the whole apartment.
// Renders on demand only: an idle studio draws nothing.

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { itemPolygon, measureItem, roomAt } from "./analysis";
import {
  APARTMENT,
  CATALOG_BY_ID,
  EXTERIOR_WALL,
  HALL_WIDTH,
  INTERIOR_WALL,
  ROOM_BY_ID,
  ROOMS,
  WALLS,
  WALL_HEIGHT,
  clampToRoom,
  type PlacedItem,
  type Room,
  type WallDef,
} from "./apartment";

export type StudioMode = "model" | "plan" | "inside";

export interface StudioEvents {
  onSelect: (uid: string | null) => void;
  onItemsChange: (items: PlacedItem[], final: boolean) => void;
  onProgress: (loaded: number, total: number) => void;
}

const CANVAS = 0x1d2e26;
const WALL_COLOR = 0xf1ebe0;
const FRAME_COLOR = 0x273d32;
const SELECT = 0xc66b48;
const BLOCKED = 0x9d3e35;
const TILE_M = 2.4;

interface Live {
  group: THREE.Group;
  proxy: THREE.Mesh;
}

function softShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d")!;
  context.filter = "blur(9px)";
  context.fillStyle = "rgba(18, 14, 10, 0.9)";
  context.fillRect(16, 16, 96, 96);
  return new THREE.CanvasTexture(canvas);
}

function rugTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 360;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#8f8778";
  c.fillRect(0, 0, 512, 360);
  c.strokeStyle = "#6a6253";
  c.lineWidth = 3;
  c.strokeRect(22, 22, 468, 316);
  c.strokeRect(34, 34, 444, 292);
  for (let y = 0; y < 360; y += 2) {
    c.fillStyle = `rgba(70, 58, 44, ${0.02 + (((y * 31) % 7) / 7) * 0.05})`;
    c.fillRect(0, y, 512, 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class StudioEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private perspective = new THREE.PerspectiveCamera(36, 1, 0.05, 120);
  private ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 60);
  private camera: THREE.Camera = this.perspective;
  private controls: OrbitControls;
  private model = new THREE.Group();
  private walls = new THREE.Group();
  private furniture = new THREE.Group();
  private sun = new THREE.DirectionalLight(0xfff2e2, 1.5);
  private catcher: THREE.Mesh;
  private raycaster = new THREE.Raycaster();
  private floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private loader = new GLTFLoader();
  private templates = new Map<string, Promise<THREE.Object3D>>();
  private panoCache = new Map<string, Promise<{ background: THREE.Texture; environment: THREE.Texture }>>();
  private skyEnv: Promise<THREE.Texture> | null = null;
  private pmrem: THREE.PMREMGenerator;
  private shadowTexture = softShadowTexture();
  private live = new Map<string, Live>();
  private items: PlacedItem[] = [];
  private selected: string | null = null;
  private outline: THREE.LineLoop;
  private outlineMaterial = new THREE.LineBasicMaterial({ color: SELECT, depthTest: false, transparent: true });
  private exterior: { wall: WallDef; meshes: THREE.Mesh[]; center: THREE.Vector3 }[] = [];
  private labels: { element: HTMLElement; position: THREE.Vector3 }[] = [];
  private press: { x: number; y: number; uid: string | null; offset: THREE.Vector3 | null; dragging: boolean } | null = null;
  private mode: StudioMode = "model";
  private room: Room = ROOMS[0];
  private frame = 0;
  private observer: ResizeObserver;
  private disposed = false;
  private loadToken = 0;

  constructor(private container: HTMLElement, private events: StudioEvents) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    container.appendChild(this.renderer.domElement);
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.background = new THREE.Color(CANVAS);

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.radius = 5;
    Object.assign(this.sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 0.5, far: 34 });
    this.scene.add(this.sun, this.sun.target, this.model, this.furniture);

    this.catcher = new THREE.Mesh(new THREE.PlaneGeometry(60, 60).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.3, color: 0x17110c }));
    this.catcher.position.set(APARTMENT.width / 2, 0.002, APARTMENT.depth / 2);
    this.catcher.receiveShadow = true;
    this.catcher.visible = false;
    this.scene.add(this.catcher);

    this.outline = new THREE.LineLoop(new THREE.BufferGeometry(), this.outlineMaterial);
    this.outline.renderOrder = 10;
    this.outline.visible = false;
    this.scene.add(this.outline);

    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerUp);
    canvas.addEventListener("wheel", this.onWheel, { passive: false });

    this.controls = new OrbitControls(this.perspective, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.09;
    this.controls.addEventListener("change", this.invalidate);

    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(container);
    this.buildApartment();
    this.resize();
  }

  async start(items: PlacedItem[]): Promise<void> {
    await this.setItems(items);
    await this.setMode("model");
  }

  registerLabel(element: HTMLElement, x: number, z: number): void {
    this.labels.push({ element, position: new THREE.Vector3(x, 0.05, z) });
    this.invalidate();
  }

  clearLabels(): void {
    this.labels = [];
  }

  getMode(): StudioMode {
    return this.mode;
  }

  async setMode(mode: StudioMode, roomId?: string): Promise<void> {
    this.mode = mode;
    if (roomId) this.room = ROOM_BY_ID.get(roomId) ?? this.room;
    const token = ++this.loadToken;
    const inside = mode === "inside";
    this.model.visible = !inside;
    // Lower walls in the model view, so you see into every room.
    this.walls.scale.y = mode === "model" ? 0.6 : 1;
    this.catcher.visible = inside;
    this.applyItemVisibility();

    if (inside) {
      const { background, environment } = await this.loadPano(this.room);
      if (this.disposed || token !== this.loadToken) return;
      this.scene.background = background;
      this.scene.environment = environment;
      this.scene.environmentIntensity = 1.05;
      this.sun.position.set(this.room.origin[0] + 3.6, 3.4, this.room.origin[1] + 0.6);
      this.sun.target.position.set(this.room.origin[0], 0, this.room.origin[1]);
      this.sun.intensity = 0.9;
      this.camera = this.perspective;
      this.perspective.fov = 60;
      this.controls.object = this.perspective;
      this.controls.enabled = true;
      this.controls.enableRotate = true;
      this.controls.enableZoom = false;
      this.controls.enablePan = false;
      this.controls.rotateSpeed = -0.32;
      this.controls.minPolarAngle = 0.55;
      this.controls.maxPolarAngle = Math.PI - 0.5;
      const eye = new THREE.Vector3(this.room.origin[0], this.room.captureHeight, this.room.origin[1]);
      this.perspective.position.copy(eye);
      // Open along the room's length, at its main piece and slightly downward, like a room photograph.
      this.controls.target.copy(eye).add(new THREE.Vector3(this.room.look[0] * 0.01, -0.0028, this.room.look[1] * 0.01));
    } else {
      const environment = await this.loadSky();
      if (this.disposed || token !== this.loadToken) return;
      this.scene.background = new THREE.Color(CANVAS);
      this.scene.environment = environment;
      this.scene.environmentIntensity = 0.82;
      this.sun.position.set(APARTMENT.width + 7, 11, 2);
      this.sun.target.position.set(APARTMENT.width / 2, 0, APARTMENT.depth / 2);
      this.sun.intensity = 1.5;
      this.controls.rotateSpeed = 0.7;
      this.controls.enableZoom = true;
      this.controls.enablePan = false;
      this.controls.minPolarAngle = 0;
      this.controls.maxPolarAngle = Math.PI / 2 - 0.1;
      this.controls.minDistance = 4;
      this.controls.maxDistance = 26;
      const center = new THREE.Vector3(APARTMENT.width / 2, 0, APARTMENT.depth / 2);
      if (mode === "plan") {
        this.camera = this.ortho;
        this.ortho.position.set(center.x, 30, center.z);
        this.ortho.up.set(0, 0, -1);
        this.ortho.lookAt(center);
        this.controls.object = this.ortho;
        this.controls.enableRotate = false;
        this.controls.target.copy(center);
      } else {
        this.camera = this.perspective;
        this.perspective.fov = 34;
        const aspect = this.container.clientWidth / Math.max(this.container.clientHeight, 1);
        const distance = 17 * Math.max(1, 1.25 / aspect);
        this.perspective.position.set(center.x + distance * 0.62, distance * 0.72, center.z + distance * 0.42);
        this.controls.object = this.perspective;
        this.controls.enableRotate = true;
        this.controls.target.copy(center);
      }
    }
    this.perspective.updateProjectionMatrix();
    this.updateCutaway();
    this.resize();
    this.controls.update();
    this.renderer.shadowMap.needsUpdate = true;
    this.invalidate();
    this.select(this.selected && this.isShown(this.selected) ? this.selected : null);
  }

  /** Reconciles the scene with a layout, reusing what is already loaded. */
  async setItems(items: PlacedItem[]): Promise<void> {
    this.items = items;
    const wanted = new Set(items.map((item) => item.uid));
    for (const [uid, live] of this.live) {
      if (!wanted.has(uid)) {
        this.furniture.remove(live.group);
        this.live.delete(uid);
      }
    }
    const missing = items.filter((item) => !this.live.has(item.uid));
    let loaded = items.length - missing.length;
    this.events.onProgress(loaded, items.length);
    await Promise.all(
      missing.map(async (item) => {
        const live = await this.buildItem(item);
        loaded += 1;
        this.events.onProgress(loaded, items.length);
        if (this.disposed || !this.items.some((current) => current.uid === item.uid) || this.live.has(item.uid)) return;
        this.live.set(item.uid, live);
        this.furniture.add(live.group);
      }),
    );
    this.syncTransforms();
    this.applyItemVisibility();
    this.select(this.selected && wanted.has(this.selected) ? this.selected : null);
    this.renderer.shadowMap.needsUpdate = true;
    this.invalidate();
  }

  select(uid: string | null): void {
    if (uid !== this.selected) {
      this.selected = uid;
      this.events.onSelect(uid);
    }
    this.refreshOutline();
    this.invalidate();
  }

  /** Points the view at an item, entering its room when inside. */
  frameItem(uid: string): void {
    const item = this.items.find((entry) => entry.uid === uid);
    if (!item) return;
    this.select(uid);
    if (this.mode === "inside") this.lookAt(item.x, item.z);
  }

  private lookAt(x: number, z: number): void {
    const eye = this.perspective.position;
    const direction = new THREE.Vector3(x, 0.35, z).sub(eye).normalize();
    this.controls.target.copy(eye).addScaledVector(direction, 0.01);
    this.controls.update();
    this.invalidate();
  }

  resetView(): void {
    void this.setMode(this.mode);
  }

  zoomBy(delta: number): void {
    if (this.mode === "inside") {
      this.perspective.fov = THREE.MathUtils.clamp(this.perspective.fov + delta, 28, 78);
      this.perspective.updateProjectionMatrix();
    } else if (this.mode === "plan") {
      this.ortho.zoom = THREE.MathUtils.clamp(this.ortho.zoom * (1 - delta * 0.01), 0.6, 4);
      this.ortho.updateProjectionMatrix();
    } else {
      const offset = this.perspective.position.clone().sub(this.controls.target);
      offset.multiplyScalar(1 + delta * 0.012);
      offset.setLength(THREE.MathUtils.clamp(offset.length(), this.controls.minDistance, this.controls.maxDistance));
      this.perspective.position.copy(this.controls.target).add(offset);
    }
    this.updateCutaway();
    this.invalidate();
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.controls.dispose();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointerdown", this.onPointerDown);
    canvas.removeEventListener("pointermove", this.onPointerMove);
    canvas.removeEventListener("pointerup", this.onPointerUp);
    canvas.removeEventListener("pointercancel", this.onPointerUp);
    canvas.removeEventListener("wheel", this.onWheel);
    this.scene.traverse((node) => {
      const mesh = node as THREE.Mesh;
      mesh.geometry?.dispose();
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) => material?.dispose());
    });
    this.pmrem.dispose();
    this.renderer.dispose();
    canvas.remove();
  }

  private isShown(uid: string): boolean {
    const item = this.items.find((entry) => entry.uid === uid);
    return Boolean(item) && (this.mode !== "inside" || roomAt(item!.x, item!.z)?.id === this.room.id);
  }

  private applyItemVisibility(): void {
    for (const item of this.items) {
      const live = this.live.get(item.uid);
      if (live) live.group.visible = this.isShown(item.uid);
    }
  }

  private syncTransforms(): void {
    for (const item of this.items) {
      const live = this.live.get(item.uid);
      if (!live) continue;
      live.group.position.set(item.x, CATALOG_BY_ID.get(item.catalogId)?.lift ?? 0, item.z);
      live.group.rotation.y = item.yaw;
    }
  }

  private template(model: string): Promise<THREE.Object3D> {
    let template = this.templates.get(model);
    if (!template) {
      template = this.loader.loadAsync(`/studio/models/${model}.glb`).then((gltf) => {
        gltf.scene.traverse((node) => {
          const mesh = node as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
          }
        });
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const center = box.getCenter(new THREE.Vector3());
        const holder = new THREE.Group();
        gltf.scene.position.set(-center.x, -box.min.y, -center.z);
        holder.add(gltf.scene);
        return holder;
      });
      this.templates.set(model, template);
    }
    return template;
  }

  private async buildItem(item: PlacedItem): Promise<Live> {
    const data = CATALOG_BY_ID.get(item.catalogId)!;
    const group = new THREE.Group();
    const [width, depth, height] = data.size;
    if (data.model) {
      const instance = (await this.template(data.model)).clone(true);
      instance.rotation.y = ((data.yawOffset ?? 0) * Math.PI) / 180;
      group.add(instance);
      if (data.role !== "lamp") {
        const shadow = new THREE.Mesh(
          new THREE.PlaneGeometry(width * 1.14, depth * 1.14).rotateX(-Math.PI / 2),
          new THREE.MeshBasicMaterial({ map: this.shadowTexture, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }),
        );
        shadow.position.y = 0.006;
        shadow.raycast = () => undefined;
        group.add(shadow);
      }
    } else {
      const rug = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 0.95 }),
      );
      rug.position.y = height / 2;
      rug.receiveShadow = true;
      group.add(rug);
    }
    // A simple invisible box is what clicks test against, which keeps picking instant.
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(width, Math.max(height, 0.03), depth), new THREE.MeshBasicMaterial());
    proxy.position.y = Math.max(height, 0.03) / 2;
    proxy.visible = false;
    proxy.userData.uid = item.uid;
    group.add(proxy);
    return { group, proxy };
  }

  private loadPano(room: Room) {
    let entry = this.panoCache.get(room.pano);
    if (!entry) {
      entry = (async () => {
        const [background, hdr] = await Promise.all([
          new THREE.TextureLoader().loadAsync(`/studio/rooms/${room.pano}.jpg`),
          new RGBELoader().loadAsync(`/studio/rooms/${room.pano}.hdr`),
        ]);
        background.mapping = THREE.EquirectangularReflectionMapping;
        background.colorSpace = THREE.SRGBColorSpace;
        background.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        hdr.mapping = THREE.EquirectangularReflectionMapping;
        const environment = this.pmrem.fromEquirectangular(hdr).texture;
        hdr.dispose();
        return { background, environment };
      })();
      this.panoCache.set(room.pano, entry);
    }
    return entry;
  }

  private loadSky(): Promise<THREE.Texture> {
    if (!this.skyEnv) {
      this.skyEnv = new RGBELoader().loadAsync("/studio/tex/sky.hdr").then((hdr) => {
        hdr.mapping = THREE.EquirectangularReflectionMapping;
        const texture = this.pmrem.fromEquirectangular(hdr).texture;
        hdr.dispose();
        return texture;
      });
    }
    return this.skyEnv;
  }

  private floorMaterial(url: string): THREE.MeshStandardMaterial {
    const texture = new THREE.TextureLoader().load(url, this.invalidate);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.62, color: 0xd9d2c6 });
  }

  private buildApartment(): void {
    const materials: Record<string, THREE.MeshStandardMaterial> = {};
    const floorOf = (kind: string) => (materials[kind] ??= this.floorMaterial(`/studio/tex/${kind}.jpg`));
    const floor = (minX: number, maxX: number, minZ: number, maxZ: number, kind: string) => {
      const geometry = new THREE.PlaneGeometry(maxX - minX, maxZ - minZ).rotateX(-Math.PI / 2);
      const position = geometry.attributes.position;
      const uv = geometry.attributes.uv;
      const cx = (minX + maxX) / 2;
      const cz = (minZ + maxZ) / 2;
      for (let index = 0; index < position.count; index += 1) {
        uv.setXY(index, (position.getX(index) + cx) / TILE_M, (position.getZ(index) + cz) / TILE_M);
      }
      const mesh = new THREE.Mesh(geometry, floorOf(kind));
      mesh.position.set(cx, 0, cz);
      mesh.receiveShadow = true;
      this.model.add(mesh);
    };
    for (const room of ROOMS) floor(HALL_WIDTH, APARTMENT.width, room.rect[2], room === ROOMS[2] ? APARTMENT.depth : room.rect[3], room.floor);
    floor(0, HALL_WIDTH, 0, APARTMENT.depth, "stone");

    this.model.add(this.walls);
    const wallMaterial = new THREE.MeshStandardMaterial({ color: WALL_COLOR, roughness: 0.9 });
    const frameMaterial = new THREE.MeshStandardMaterial({ color: FRAME_COLOR, roughness: 0.5 });
    const glassMaterial = new THREE.MeshStandardMaterial({ color: 0xcfdcd8, transparent: true, opacity: 0.22, roughness: 0.05, depthWrite: false });
    for (const wall of WALLS) {
      const meshes = this.buildWall(wall, wallMaterial, frameMaterial, glassMaterial);
      if (wall.exterior) {
        const center = new THREE.Vector3((wall.a[0] + wall.b[0]) / 2, WALL_HEIGHT / 2, (wall.a[1] + wall.b[1]) / 2);
        this.exterior.push({ wall, meshes, center });
      }
    }
  }

  private buildWall(wall: WallDef, wallMaterial: THREE.Material, frameMaterial: THREE.Material, glass: THREE.Material): THREE.Mesh[] {
    const thickness = wall.exterior ? EXTERIOR_WALL : INTERIOR_WALL;
    const length = Math.hypot(wall.b[0] - wall.a[0], wall.b[1] - wall.a[1]);
    const ux = (wall.b[0] - wall.a[0]) / length;
    const uz = (wall.b[1] - wall.a[1]) / length;
    const yaw = Math.atan2(-uz, ux);
    const meshes: THREE.Mesh[] = [];
    const piece = (from: number, to: number, bottom: number, top: number, material: THREE.Material, depth = thickness, cast = true) => {
      if (to - from < 0.001 || top - bottom < 0.001) return;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(to - from, top - bottom, depth), material.clone());
      const middle = (from + to) / 2;
      mesh.position.set(wall.a[0] + ux * middle, (bottom + top) / 2, wall.a[1] + uz * middle);
      mesh.rotation.y = yaw;
      mesh.castShadow = cast;
      mesh.receiveShadow = true;
      this.walls.add(mesh);
      meshes.push(mesh);
    };
    let cursor = 0;
    for (const opening of [...wall.openings].sort((p, q) => p.from - q.from)) {
      piece(cursor, opening.from, 0, WALL_HEIGHT, wallMaterial);
      const head = opening.head ?? 2.1;
      piece(opening.from, opening.to, head, WALL_HEIGHT, wallMaterial);
      if (opening.kind === "window") {
        const sill = opening.sill ?? 0.45;
        piece(opening.from, opening.to, 0, sill, wallMaterial);
        piece(opening.from, opening.to, sill, head, glass, 0.012, false);
        piece(opening.from - 0.03, opening.from + 0.03, sill, head, frameMaterial, thickness + 0.02);
        piece(opening.to - 0.03, opening.to + 0.03, sill, head, frameMaterial, thickness + 0.02);
        piece(opening.from, opening.to, head - 0.03, head + 0.03, frameMaterial, thickness + 0.02);
        piece(opening.from, opening.to, sill - 0.03, sill + 0.03, frameMaterial, thickness + 0.02);
      } else {
        piece(opening.from - 0.03, opening.from, 0, head, frameMaterial, thickness + 0.03);
        piece(opening.to, opening.to + 0.03, 0, head, frameMaterial, thickness + 0.03);
        piece(opening.from - 0.03, opening.to + 0.03, head, head + 0.05, frameMaterial, thickness + 0.03);
      }
      cursor = opening.to;
    }
    piece(cursor, length, 0, WALL_HEIGHT, wallMaterial);
    return meshes;
  }

  /** Hides exterior walls facing the camera, while they keep casting shadow. */
  private updateCutaway(): void {
    const camera = this.perspective.position;
    for (const { wall, meshes, center } of this.exterior) {
      const outward = wall.outward!;
      const facing = this.mode === "model" && (camera.x - center.x) * outward[0] + (camera.z - center.z) * outward[1] > 0;
      for (const mesh of meshes) {
        const material = mesh.material as THREE.Material;
        material.colorWrite = !facing;
        material.depthWrite = !facing && !material.transparent;
      }
    }
  }

  private refreshOutline(): void {
    const item = this.items.find((entry) => entry.uid === this.selected);
    if (!item || !this.isShown(item.uid)) {
      this.outline.visible = false;
      return;
    }
    const points = itemPolygon(item).map(([x, z]) => new THREE.Vector3(x, 0.02, z));
    this.outline.geometry.setFromPoints(points);
    this.outlineMaterial.color.setHex(measureItem(item, this.items).overlaps.length ? BLOCKED : SELECT);
    this.outline.visible = true;
  }

  private invalidate = () => {
    if (this.disposed) return;
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => {
      const moving = this.controls.update();
      if (this.mode === "model") this.updateCutaway();
      this.renderer.render(this.scene, this.camera);
      this.placeLabels();
      if (moving) this.invalidate();
    });
  };

  private placeLabels(): void {
    const { clientWidth: width, clientHeight: height } = this.container;
    const point = new THREE.Vector3();
    for (const { element, position } of this.labels) {
      point.copy(position).project(this.camera);
      element.style.transform = `translate3d(${((point.x + 1) / 2) * width}px, ${((1 - point.y) / 2) * height}px, 0) translate(-50%, -50%)`;
    }
  }

  private resize = () => {
    const { clientWidth: width, clientHeight: height } = this.container;
    if (!width || !height) return;
    this.renderer.setSize(width, height);
    this.perspective.aspect = width / height;
    this.perspective.updateProjectionMatrix();
    const aspect = width / height;
    const halfZ = APARTMENT.depth / 2 + 1;
    const halfX = APARTMENT.width / 2 + 1;
    const half = Math.max(halfZ, halfX / aspect);
    Object.assign(this.ortho, { left: -half * aspect, right: half * aspect, top: half, bottom: -half });
    this.ortho.updateProjectionMatrix();
    this.invalidate();
  };

  private pointerNdc(event: PointerEvent): THREE.Vector2 {
    const rect = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
  }

  private floorHit(event: PointerEvent): THREE.Vector3 | null {
    this.raycaster.setFromCamera(this.pointerNdc(event), this.camera);
    return this.raycaster.ray.intersectPlane(this.floorPlane, new THREE.Vector3());
  }

  private pickItem(event: PointerEvent): string | null {
    this.raycaster.setFromCamera(this.pointerNdc(event), this.camera);
    const proxies = this.items
      .filter((item) => this.isShown(item.uid) && item.uid !== undefined)
      .map((item) => this.live.get(item.uid)?.proxy)
      .filter((proxy): proxy is THREE.Mesh => Boolean(proxy));
    const hits = this.raycaster.intersectObjects(proxies, false);
    // A rug is under everything, so anything else at the same spot wins.
    const solid = hits.find((hit) => CATALOG_BY_ID.get(this.items.find((item) => item.uid === hit.object.userData.uid)!.catalogId)?.role !== "rug");
    return (solid ?? hits[0])?.object.userData.uid ?? null;
  }

  private onPointerDown = (event: PointerEvent) => {
    const uid = this.pickItem(event);
    let offset: THREE.Vector3 | null = null;
    if (uid) {
      const hit = this.floorHit(event);
      const item = this.items.find((entry) => entry.uid === uid)!;
      if (hit) offset = new THREE.Vector3(item.x, 0, item.z).sub(hit);
      this.controls.enabled = false;
      this.renderer.domElement.setPointerCapture(event.pointerId);
    }
    this.press = { x: event.clientX, y: event.clientY, uid, offset, dragging: false };
  };

  private onPointerMove = (event: PointerEvent) => {
    if (!this.press?.uid || !this.press.offset) return;
    if (!this.press.dragging && Math.hypot(event.clientX - this.press.x, event.clientY - this.press.y) < 4) return;
    this.press.dragging = true;
    const hit = this.floorHit(event);
    if (!hit) return;
    const next = hit.add(this.press.offset);
    const index = this.items.findIndex((entry) => entry.uid === this.press!.uid);
    const item = this.items[index];
    // Stays in the room it is in when inside; between rooms only from the model and plan views.
    const room = this.mode === "inside" ? this.room : roomAt(next.x, next.z) ?? roomAt(item.x, item.z) ?? this.room;
    const placed = clampToRoom({ ...item, x: next.x, z: next.z }, room);
    this.items = this.items.map((entry, position) => (position === index ? { ...entry, ...placed } : entry));
    this.syncTransforms();
    if (this.selected !== item.uid) this.select(item.uid);
    this.refreshOutline();
    this.invalidate();
    this.events.onItemsChange(this.items, false);
  };

  private onPointerUp = (event: PointerEvent) => {
    const press = this.press;
    this.press = null;
    this.controls.enabled = true;
    if (!press) return;
    if (this.renderer.domElement.hasPointerCapture(event.pointerId)) this.renderer.domElement.releasePointerCapture(event.pointerId);
    if (press.dragging) {
      this.renderer.shadowMap.needsUpdate = true;
      this.invalidate();
      this.events.onItemsChange(this.items, true);
    } else if (press.uid) {
      this.select(press.uid);
    } else if (Math.hypot(event.clientX - press.x, event.clientY - press.y) < 4) {
      this.select(null);
    }
  };

  private onWheel = (event: WheelEvent) => {
    event.preventDefault();
    this.zoomBy(Math.sign(event.deltaY) * Math.min(Math.abs(event.deltaY) * 0.02, 3));
  };
}

