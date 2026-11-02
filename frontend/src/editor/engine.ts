// Three.js scene for the editor. Framework-free. Dragging stays local: no network, no rebuild.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Placement, SceneV1 } from "../api/contracts";

export type ViewMode = "orbit" | "top";

export interface EngineEvents {
  onPlacement: (placement: Placement, final: boolean) => void;
}

const SIZE_TOLERANCE_M = 0.01;
const BLOCKED_TINT = 0x9d3e35;

export class EditorEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private perspective = new THREE.PerspectiveCamera(45, 1, 0.05, 100);
  private ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.05, 100);
  private camera: THREE.Camera = this.perspective;
  private controls!: OrbitControls;
  private sofa = new THREE.Group();
  private floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private raycaster = new THREE.Raycaster();
  private dragOffset: THREE.Vector3 | null = null;
  private blocked = false;
  private center = new THREE.Vector3();
  private span = 5;
  private frame = 0;
  private observer: ResizeObserver;

  constructor(private container: HTMLElement, private events: EngineEvents) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color(0xf7f4ed);

    this.scene.add(new THREE.HemisphereLight(0xfffcf6, 0xb8b2a4, 1.7));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(4, 7, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.bias = -0.0005;
    Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, far: 25 });
    this.scene.add(sun);

    this.scene.add(this.sofa);

    // Registered before OrbitControls, so a drag can disable orbiting for the same press.
    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerUp);

    this.controls = new OrbitControls(this.perspective, canvas);
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05;
    this.controls.minDistance = 1;
    this.controls.maxDistance = 25;
    this.controls.addEventListener("change", this.invalidate);

    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(container);
    this.resize();
  }

  /** Loads the room and sofa. Returns a warning if the asset size breaks the contract. */
  async load(scene: SceneV1, assets: { room: string; furniture: string }, headers: Record<string, string>, placement: Placement): Promise<string | null> {
    const loader = new GLTFLoader();
    loader.setRequestHeader(headers);
    const [room, furniture] = await Promise.all([loader.loadAsync(assets.room), loader.loadAsync(assets.furniture)]);

    room.scene.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) node.receiveShadow = true;
    });
    this.scene.add(room.scene);

    furniture.scene.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    this.sofa.add(furniture.scene);
    this.setBlocked(this.blocked);

    const [width, height, depth] = scene.furniture.dimensions;
    const actual = new THREE.Box3().setFromObject(furniture.scene).getSize(new THREE.Vector3());
    const mismatch = Math.max(Math.abs(actual.x - width), Math.abs(actual.y - height), Math.abs(actual.z - depth));

    const xs = scene.floor.map((p) => p[0]);
    const zs = scene.floor.map((p) => p[1]);
    this.center.set((Math.min(...xs) + Math.max(...xs)) / 2, 0.5, (Math.min(...zs) + Math.max(...zs)) / 2);
    this.span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
    this.setPlacement(placement);
    this.setView("orbit");
    return mismatch > SIZE_TOLERANCE_M ? "The 3D model's size doesn't match the confirmed dimensions." : null;
  }

  setPlacement({ position, yaw }: Placement): void {
    this.sofa.position.set(position[0], 0, position[1]);
    this.sofa.rotation.y = yaw;
    this.invalidate();
  }

  getPlacement(): Placement {
    const round = (value: number) => Math.round(value * 1000) / 1000;
    return { position: [round(this.sofa.position.x), round(this.sofa.position.z)], yaw: round(this.sofa.rotation.y) };
  }

  /** Safe to call before the model loads; load() applies the latest value. */
  setBlocked(blocked: boolean): void {
    this.blocked = blocked;
    this.sofa.traverse((node) => {
      const material = (node as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (!material?.emissive) return;
      material.emissive.setHex(BLOCKED_TINT);
      material.emissiveIntensity = blocked ? 0.55 : 0;
    });
    this.invalidate();
  }

  setView(mode: ViewMode): void {
    if (mode === "top") {
      this.camera = this.ortho;
      this.ortho.position.set(this.center.x, 20, this.center.z);
      this.ortho.up.set(0, 0, -1);
      this.ortho.lookAt(this.center.x, 0, this.center.z);
      this.controls.object = this.ortho;
      this.controls.enableRotate = false;
      this.controls.target.set(this.center.x, 0, this.center.z);
    } else {
      this.camera = this.perspective;
      // Portrait screens see less sideways, so pull back to keep the whole floor in view.
      const aspect = this.container.clientWidth / Math.max(this.container.clientHeight, 1);
      const distance = (this.span * 1.35 + 1) * Math.max(1, 1.2 / aspect);
      this.perspective.position.set(this.center.x + distance * 0.72, distance * 0.62, this.center.z + distance * 0.82);
      this.controls.object = this.perspective;
      this.controls.enableRotate = true;
      this.controls.target.copy(this.center);
    }
    this.resize();
    this.controls.update();
    this.invalidate();
  }

  /** A JPEG of the current view, rendered on demand for style previews. */
  snapshot(): Promise<Blob> {
    this.renderer.render(this.scene, this.camera);
    return new Promise((resolve, reject) => {
      this.renderer.domElement.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not capture the view"))),
        "image/jpeg",
        0.9,
      );
    });
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.controls.dispose();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointerdown", this.onPointerDown);
    canvas.removeEventListener("pointermove", this.onPointerMove);
    canvas.removeEventListener("pointerup", this.onPointerUp);
    canvas.removeEventListener("pointercancel", this.onPointerUp);
    this.scene.traverse((node) => {
      const mesh = node as THREE.Mesh;
      mesh.geometry?.dispose();
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => m?.dispose());
    });
    this.renderer.dispose();
    canvas.remove();
  }

  private invalidate = () => {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.renderer.render(this.scene, this.camera));
  };

  private resize = () => {
    const { clientWidth: width, clientHeight: height } = this.container;
    if (!width || !height) return;
    this.renderer.setSize(width, height);
    this.perspective.aspect = width / height;
    this.perspective.updateProjectionMatrix();
    const half = this.span * 0.65;
    const aspect = width / height;
    Object.assign(this.ortho, {
      left: -half * Math.max(aspect, 1),
      right: half * Math.max(aspect, 1),
      top: half / Math.min(aspect, 1),
      bottom: -half / Math.min(aspect, 1),
    });
    this.ortho.updateProjectionMatrix();
    this.invalidate();
  };

  private pointer(event: PointerEvent): THREE.Vector2 {
    const rect = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
  }

  private floorHit(event: PointerEvent): THREE.Vector3 | null {
    this.raycaster.setFromCamera(this.pointer(event), this.camera);
    return this.raycaster.ray.intersectPlane(this.floorPlane, new THREE.Vector3());
  }

  private onPointerDown = (event: PointerEvent) => {
    this.raycaster.setFromCamera(this.pointer(event), this.camera);
    if (this.raycaster.intersectObject(this.sofa, true).length === 0) {
      this.controls.enabled = true;
      return;
    }
    const hit = this.floorHit(event);
    if (!hit) return;
    this.dragOffset = this.sofa.position.clone().sub(hit);
    this.controls.enabled = false;
    this.renderer.domElement.setPointerCapture(event.pointerId);
  };

  private onPointerMove = (event: PointerEvent) => {
    if (!this.dragOffset) return;
    const hit = this.floorHit(event);
    if (!hit) return;
    const next = hit.add(this.dragOffset);
    this.sofa.position.set(next.x, 0, next.z);
    this.invalidate();
    this.events.onPlacement(this.getPlacement(), false);
  };

  private onPointerUp = (event: PointerEvent) => {
    if (!this.dragOffset) return;
    this.dragOffset = null;
    this.controls.enabled = true;
    if (this.renderer.domElement.hasPointerCapture(event.pointerId)) {
      this.renderer.domElement.releasePointerCapture(event.pointerId);
    }
    this.events.onPlacement(this.getPlacement(), true);
  };
}
