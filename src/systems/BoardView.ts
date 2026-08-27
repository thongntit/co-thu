import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  cellKey,
  getDenOwner,
  getTrapOwner,
  isWater,
  PIECE_LABEL,
  PIECE_RANK,
  type Cell,
  type GameState,
  type Move,
  type Piece,
  type PieceType,
  type PlayerId,
} from '../game/rules';

export const CELL_SIZE = 1.18;
export const TILE_TOP = 0.72;

const BOARD_CENTER_X = (BOARD_WIDTH - 1) / 2;
const BOARD_CENTER_Y = (BOARD_HEIGHT - 1) / 2;
const USE_PIECE_SHADOWS = window.innerWidth >= 720;
const MODEL_TARGET_SIZE = 1.05;
const TEAM_COLORS: Record<PlayerId, string> = {
  red: '#c45144',
  blue: '#3e91a2',
};

type PieceView = {
  group: THREE.Group;
  animalRoot: THREE.Group;
  piece: Piece;
  externalModel?: THREE.Object3D;
};

type MoveAnimation = {
  pieceId: string;
  from: THREE.Vector3;
  to: THREE.Vector3;
  kind: Move['kind'];
  elapsed: number;
  duration: number;
  capturedId?: string;
};

function makeMaterial(color: string, roughness = 0.66, metalness = 0.05): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function addMesh(
  parent: THREE.Group,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: THREE.Vector3 | [number, number, number],
  scale?: [number, number, number],
  rotation?: [number, number, number],
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  if (position instanceof THREE.Vector3) mesh.position.copy(position);
  else mesh.position.set(...position);
  if (scale) mesh.scale.set(...scale);
  if (rotation) mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cellToWorld(cell: Cell, y = TILE_TOP): THREE.Vector3 {
  return new THREE.Vector3(
    (cell.x - BOARD_CENTER_X) * CELL_SIZE,
    y,
    (BOARD_CENTER_Y - cell.y) * CELL_SIZE,
  );
}

function makeTextSprite(text: string, color: string, background = '#171d1a'): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not create text sprite context.');

  context.clearRect(0, 0, 128, 128);
  context.beginPath();
  context.arc(64, 64, 50, 0, Math.PI * 2);
  context.fillStyle = background;
  context.fill();
  context.lineWidth = 7;
  context.strokeStyle = color;
  context.stroke();
  context.fillStyle = '#fff8df';
  context.font = '800 44px Arial, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, 64, 66);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.setScalar(0.38);
  sprite.position.y = 0.68;
  sprite.renderOrder = 8;
  return sprite;
}

function createAnimalForm(type: PieceType, owner: PlayerId): THREE.Group {
  const root = new THREE.Group();
  const bodyColor: Record<PieceType, string> = {
    rat: '#8d6d57',
    cat: '#d0a06e',
    wolf: '#85918c',
    dog: '#c18a5b',
    leopard: '#d39a50',
    tiger: '#d57e3a',
    lion: '#c7964e',
    elephant: '#8e9a94',
  };
  const body = makeMaterial(bodyColor[type], 0.78, 0.01);
  const dark = makeMaterial(type === 'tiger' ? '#2a1c16' : '#3a2b23', 0.82, 0.01);
  const light = makeMaterial(type === 'elephant' ? '#b8c3b9' : '#f1c987', 0.74, 0.01);
  const team = makeMaterial(TEAM_COLORS[owner], 0.5, 0.18);

  const bodySize = type === 'elephant' ? [0.31, 0.28, 0.4] : type === 'rat' ? [0.22, 0.17, 0.32] : [0.27, 0.23, 0.34];
  addMesh(root, new THREE.SphereGeometry(1, 14, 10), body, [0, 0.31, 0.05], bodySize as [number, number, number]);

  if (type === 'elephant') {
    addMesh(root, new THREE.SphereGeometry(1, 14, 10), body, [0, 0.49, -0.22], [0.3, 0.31, 0.29]);
    addMesh(root, new THREE.CylinderGeometry(0.075, 0.105, 0.38, 10), light, [0, 0.29, -0.47], [1, 1, 1], [Math.PI / 2, 0, 0]);
    addMesh(root, new THREE.ConeGeometry(0.065, 0.23, 8), light, [-0.16, 0.43, -0.37], [1, 1, 1], [0, 0, 0.55]);
    addMesh(root, new THREE.ConeGeometry(0.065, 0.23, 8), light, [0.16, 0.43, -0.37], [1, 1, 1], [0, 0, -0.55]);
    addMesh(root, new THREE.SphereGeometry(1, 10, 8), light, [-0.29, 0.45, -0.2], [0.16, 0.24, 0.07]);
    addMesh(root, new THREE.SphereGeometry(1, 10, 8), light, [0.29, 0.45, -0.2], [0.16, 0.24, 0.07]);
  } else {
    addMesh(root, new THREE.SphereGeometry(1, 14, 10), body, [0, 0.47, -0.2], type === 'rat' ? [0.2, 0.2, 0.2] : [0.25, 0.25, 0.25]);
    addMesh(root, new THREE.SphereGeometry(1, 10, 8), light, [0, 0.42, -0.4], type === 'rat' ? [0.13, 0.11, 0.12] : [0.16, 0.14, 0.14]);
    addMesh(root, new THREE.SphereGeometry(1, 8, 6), dark, [-0.095, 0.51, -0.39], [0.025, 0.025, 0.025]);
    addMesh(root, new THREE.SphereGeometry(1, 8, 6), dark, [0.095, 0.51, -0.39], [0.025, 0.025, 0.025]);

    const earSize = type === 'rat' ? 0.1 : 0.13;
    addMesh(root, new THREE.ConeGeometry(earSize, earSize * 1.65, 5), dark, [-0.14, 0.68, -0.22], [1, 1, 1], [0, 0, -0.18]);
    addMesh(root, new THREE.ConeGeometry(earSize, earSize * 1.65, 5), dark, [0.14, 0.68, -0.22], [1, 1, 1], [0, 0, 0.18]);

    if (type === 'lion') {
      addMesh(root, new THREE.TorusGeometry(0.29, 0.055, 8, 24), dark, [0, 0.48, -0.21], [1, 1, 1], [Math.PI / 2, 0, 0]);
    }
    if (type === 'tiger') {
      for (const x of [-0.16, -0.05, 0.06, 0.17]) {
        addMesh(root, new THREE.BoxGeometry(0.035, 0.18, 0.06), dark, [x, 0.35, -0.23], [1, 1, 1], [0, 0.28, 0]);
      }
    }
    if (type === 'leopard') {
      for (const [x, z] of [[-0.15, -0.02], [0.15, 0.02], [-0.12, 0.18], [0.11, 0.2]]) {
        addMesh(root, new THREE.SphereGeometry(0.035, 7, 5), dark, [x, 0.48, z]);
      }
    }
  }

  if (type !== 'elephant') {
    const tailLength = type === 'rat' ? 0.34 : 0.24;
    addMesh(root, new THREE.CylinderGeometry(0.025, 0.045, tailLength, 7), team, [0.16, 0.3, 0.38], [1, 1, 1], [Math.PI / 2, 0.55, 0]);
  }

  const collar = addMesh(root, new THREE.TorusGeometry(type === 'elephant' ? 0.28 : 0.23, 0.025, 8, 20), team, [0, 0.3, -0.02], [1, 1, 1], [Math.PI / 2, 0, 0]);
  collar.renderOrder = 5;
  return root;
}

function disposeObjectResources(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) material.dispose();
  });
}

function createTrapMarker(owner: PlayerId): THREE.Group {
  const marker = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: TEAM_COLORS[owner],
    emissive: TEAM_COLORS[owner],
    emissiveIntensity: 0.28,
    roughness: 0.5,
    metalness: 0.22,
  });
  addMesh(marker, new THREE.TorusGeometry(0.28, 0.035, 8, 24), material, [0, 0.09, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);
  addMesh(marker, new THREE.BoxGeometry(0.37, 0.025, 0.04), material, [0, 0.1, 0], [1, 1, 1], [0, 0, Math.PI / 4]);
  addMesh(marker, new THREE.BoxGeometry(0.37, 0.025, 0.04), material, [0, 0.105, 0], [1, 1, 1], [0, 0, -Math.PI / 4]);
  return marker;
}

function createDenMarker(owner: PlayerId): THREE.Group {
  const marker = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: '#c99a45',
    emissive: TEAM_COLORS[owner],
    emissiveIntensity: 0.42,
    roughness: 0.4,
    metalness: 0.4,
  });
  addMesh(marker, new THREE.CylinderGeometry(0.35, 0.4, 0.06, 32), material, [0, 0.09, 0]);
  addMesh(marker, new THREE.TorusGeometry(0.26, 0.035, 8, 28), material, [0, 0.14, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);
  addMesh(marker, new THREE.ConeGeometry(0.16, 0.2, 6), material, [0, 0.22, 0]);
  return marker;
}

export class BoardView {
  readonly group = new THREE.Group();
  private readonly pieceViews = new Map<string, PieceView>();
  private readonly highlights = new Map<string, THREE.Mesh>();
  private readonly pickTargets: THREE.Object3D[] = [];
  private readonly waterSurfaces: THREE.Mesh[] = [];
  private readonly fireflies: THREE.Mesh[] = [];
  private readonly pieceRoot = new THREE.Group();
  private moveAnimation: MoveAnimation | null = null;
  private readonly modelTemplates = new Map<PieceType, THREE.Object3D>();

  constructor() {
    this.group.name = 'jungle-board';
    this.createPlatform();
    this.createTiles();
    this.createWorldDetails();
    this.group.add(this.pieceRoot);
  }

  getPickTargets(): THREE.Object3D[] {
    return this.pickTargets;
  }

  getCellFromObject(object: THREE.Object3D): Cell | undefined {
    let current: THREE.Object3D | null = object;
    while (current) {
      const cell = current.userData.cell as Cell | undefined;
      if (cell) return cell;
      current = current.parent;
    }
    return undefined;
  }

  getPieceIdFromObject(object: THREE.Object3D): string | undefined {
    let current: THREE.Object3D | null = object;
    while (current) {
      const pieceId = current.userData.pieceId as string | undefined;
      if (pieceId) return pieceId;
      current = current.parent;
    }
    return undefined;
  }

  syncState(state: GameState): void {
    const active = new Set(Object.keys(state.pieces));
    for (const piece of Object.values(state.pieces)) {
      let view = this.pieceViews.get(piece.id);
      if (!view) {
        view = this.createPieceView(piece);
        this.pieceViews.set(piece.id, view);
        this.pieceRoot.add(view.group);
      }
      view.piece = piece;
      view.group.visible = true;
      view.group.scale.setScalar(1);
      view.group.rotation.set(0, 0, 0);
      view.group.position.copy(cellToWorld(piece.cell));
      view.group.userData.cell = { ...piece.cell };
    }

    for (const [pieceId, view] of this.pieceViews) {
      if (!active.has(pieceId)) view.group.visible = false;
    }
  }

  setLegalMoves(moves: Move[], selectedCell: Cell | null): void {
    const visible = new Set(moves.map((move) => cellKey(move.to)));

    for (const [key, highlight] of this.highlights) {
      highlight.visible = visible.has(key);
    }

    if (selectedCell) {
      const selectedKey = cellKey(selectedCell);
      const selectedTile = this.highlights.get(selectedKey);
      if (selectedTile) selectedTile.visible = true;
    }
  }

  clearHighlights(): void {
    for (const highlight of this.highlights.values()) highlight.visible = false;
  }

  startMove(move: Move): void {
    const moving = this.pieceViews.get(move.pieceId);
    if (!moving) return;

    const captured = move.captureId ? this.pieceViews.get(move.captureId) : undefined;
    this.moveAnimation = {
      pieceId: move.pieceId,
      from: cellToWorld(move.from),
      to: cellToWorld(move.to),
      kind: move.kind,
      elapsed: 0,
      duration: move.kind === 'jump' ? 0.68 : captured ? 0.52 : 0.34,
      ...(captured ? { capturedId: captured.piece.id } : {}),
    };
    moving.group.position.copy(this.moveAnimation.from);
  }

  update(delta: number, elapsed: number): boolean {
    for (const [index, surface] of this.waterSurfaces.entries()) {
      surface.position.y = TILE_TOP + 0.09 + Math.sin(elapsed * 1.25 + index * 0.65) * 0.012;
      const material = surface.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 0.2 + Math.sin(elapsed * 1.4 + index) * 0.035;
    }

    for (const [index, firefly] of this.fireflies.entries()) {
      const angle = elapsed * (0.16 + index * 0.01) + index * 1.8;
      firefly.position.y = 1.1 + Math.sin(elapsed * 1.4 + index) * 0.22;
      firefly.position.x += Math.cos(angle) * delta * 0.045;
      firefly.position.z += Math.sin(angle * 1.17) * delta * 0.045;
      const material = firefly.material as THREE.MeshBasicMaterial;
      material.opacity = 0.38 + (Math.sin(elapsed * 2.4 + index) + 1) * 0.18;
    }

    if (!this.moveAnimation) return false;
    const animation = this.moveAnimation;
    animation.elapsed += delta;
    const t = Math.min(1, animation.elapsed / animation.duration);
    const eased = THREE.MathUtils.smootherstep(t, 0, 1);
    const moving = this.pieceViews.get(animation.pieceId);
    if (moving) {
      moving.group.position.lerpVectors(animation.from, animation.to, eased);
      const arc = animation.kind === 'jump' ? Math.sin(t * Math.PI) * 0.95 : Math.sin(t * Math.PI) * 0.12;
      moving.group.position.y += arc;
      moving.group.rotation.y = Math.sin(t * Math.PI) * (animation.kind === 'jump' ? 0.24 : 0.04);
    }

    if (animation.capturedId) {
      const captured = this.pieceViews.get(animation.capturedId);
      if (captured) {
        const collapse = Math.max(0.04, 1 - eased);
        captured.group.scale.setScalar(collapse);
        captured.group.rotation.z = eased * Math.PI * 0.5;
      }
    }

    if (t < 1) return false;
    this.moveAnimation = null;
    return true;
  }

  getLoadedModelCount(): number {
    return this.modelTemplates.size;
  }

  async loadPieceModel(type: PieceType, path: string): Promise<boolean> {
    if (this.modelTemplates.has(type)) return true;
    try {
      const gltf = await new GLTFLoader().loadAsync(path);
      const template = gltf.scene;
      template.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.castShadow = USE_PIECE_SHADOWS;
          object.receiveShadow = true;
        }
      });

      const bounds = new THREE.Box3().setFromObject(template);
      const size = bounds.getSize(new THREE.Vector3());
      const maxSize = Math.max(size.x, size.y, size.z);
      if (!Number.isFinite(maxSize) || maxSize <= 0) return false;
      template.scale.setScalar(MODEL_TARGET_SIZE / maxSize);
      const scaledBounds = new THREE.Box3().setFromObject(template);
      template.position.y += -scaledBounds.min.y + 0.04;
      this.modelTemplates.set(type, template);
      for (const view of this.pieceViews.values()) {
        if (view.piece.type === type) this.replaceWithExternalModel(view);
      }
      return true;
    } catch {
      return false;
    }
  }

  private replaceWithExternalModel(view: PieceView): void {
    const template = this.modelTemplates.get(view.piece.type);
    if (!template) return;
    if (view.externalModel) view.animalRoot.remove(view.externalModel);
    for (const child of [...view.animalRoot.children]) {
      disposeObjectResources(child);
      view.animalRoot.remove(child);
    }
    const clone = template.clone(true);
    clone.position.copy(template.position);
    // Animal meshes face local -Z. Red starts at world +Z and looks toward
    // the board center (-Z); blue starts at world -Z and looks toward (+Z).
    clone.rotation.set(0, 0, 0);
    clone.scale.setScalar(1);
    view.animalRoot.add(clone);
    view.externalModel = clone;
  }

  private createPlatform(): void {
    const platform = new THREE.Group();
    const baseMaterial = makeMaterial('#3a271e', 0.72, 0.16);
    const trimMaterial = makeMaterial('#b9813d', 0.45, 0.35);
    addMesh(platform, new THREE.BoxGeometry(9.5, 0.42, 12.1), baseMaterial, [0, 0.28, 0]);
    addMesh(platform, new THREE.BoxGeometry(9.12, 0.12, 11.72), trimMaterial, [0, 0.53, 0]);
    addMesh(platform, new THREE.BoxGeometry(8.72, 0.08, 11.32), makeMaterial('#1a2920', 0.8, 0.02), [0, 0.63, 0]);

    const frameMaterial = makeMaterial('#79502b', 0.68, 0.2);
    addMesh(platform, new THREE.BoxGeometry(9.6, 0.64, 0.38), frameMaterial, [0, 0.76, -5.84]);
    addMesh(platform, new THREE.BoxGeometry(9.6, 0.64, 0.38), frameMaterial, [0, 0.76, 5.84]);
    addMesh(platform, new THREE.BoxGeometry(0.38, 0.64, 11.3), frameMaterial, [-4.62, 0.76, 0]);
    addMesh(platform, new THREE.BoxGeometry(0.38, 0.64, 11.3), frameMaterial, [4.62, 0.76, 0]);

    for (const x of [-4.45, 4.45]) {
      for (const z of [-5.55, 5.55]) {
        addMesh(platform, new THREE.CylinderGeometry(0.2, 0.25, 0.72, 10), trimMaterial, [x, 1.02, z]);
        addMesh(platform, new THREE.SphereGeometry(0.22, 10, 8), trimMaterial, [x, 1.47, z]);
      }
    }
    this.group.add(platform);
  }

  private createTiles(): void {
    const landMaterial = makeMaterial('#536646', 0.82, 0.01);
    const landAltMaterial = makeMaterial('#46583d', 0.84, 0.01);
    const waterMaterial = new THREE.MeshStandardMaterial({
      color: '#236e75',
      emissive: '#0b3f43',
      emissiveIntensity: 0.22,
      roughness: 0.28,
      metalness: 0.12,
    });
    const waterSurfaceMaterial = new THREE.MeshStandardMaterial({
      color: '#55b7a8',
      emissive: '#1b7770',
      emissiveIntensity: 0.25,
      transparent: true,
      opacity: 0.58,
      roughness: 0.2,
      metalness: 0.08,
    });

    for (let y = 0; y < BOARD_HEIGHT; y += 1) {
      for (let x = 0; x < BOARD_WIDTH; x += 1) {
        const cell = { x, y };
        const key = cellKey(cell);
        const water = isWater(cell);
        const terrainOwner = getDenOwner(cell) ?? getTrapOwner(cell);
        const material = water ? waterMaterial : x % 2 === y % 2 ? landMaterial : landAltMaterial;
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(CELL_SIZE - 0.06, 0.15, CELL_SIZE - 0.06), material);
        mesh.position.copy(cellToWorld(cell, TILE_TOP));
        mesh.userData.cell = { ...cell };
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        this.group.add(mesh);
        this.pickTargets.push(mesh);

        if (water) {
          const surface = new THREE.Mesh(new THREE.PlaneGeometry(CELL_SIZE - 0.18, CELL_SIZE - 0.18), waterSurfaceMaterial.clone());
          surface.rotation.x = -Math.PI / 2;
          surface.position.copy(cellToWorld(cell, TILE_TOP + 0.09));
          surface.userData.cell = { ...cell };
          this.group.add(surface);
          this.waterSurfaces.push(surface);
        }

        if (terrainOwner && getDenOwner(cell)) {
          const den = createDenMarker(terrainOwner);
          den.position.copy(cellToWorld(cell, TILE_TOP + 0.02));
          this.group.add(den);
        } else if (terrainOwner) {
          const trap = createTrapMarker(terrainOwner);
          trap.position.copy(cellToWorld(cell, TILE_TOP + 0.02));
          this.group.add(trap);
        }

        const highlight = new THREE.Mesh(
          new THREE.RingGeometry(0.31, 0.38, 28),
          new THREE.MeshBasicMaterial({ color: '#e9bf63', transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthTest: false }),
        );
        highlight.rotation.x = -Math.PI / 2;
        highlight.position.copy(cellToWorld(cell, TILE_TOP + 0.16));
        highlight.visible = false;
        highlight.renderOrder = 7;
        highlight.userData.cell = { ...cell };
        this.group.add(highlight);
        this.highlights.set(key, highlight);
      }
    }
  }

  private createWorldDetails(): void {
    const foliage = makeMaterial('#173d2b', 0.94, 0.01);
    const foliageLight = makeMaterial('#28634a', 0.88, 0.01);
    const trunk = makeMaterial('#4e3424', 0.95, 0.01);
    const gold = makeMaterial('#d7a14e', 0.5, 0.3);

    const treePositions: Array<[number, number, number]> = [
      [-6.2, 0.2, -5.8],
      [6.1, 0.2, -5.65],
      [-6.3, 0.2, 5.6],
      [6.35, 0.2, 5.55],
      [-6.6, 0.2, -1.6],
      [6.65, 0.2, 1.5],
    ];
    for (const [x, y, z] of treePositions) {
      const tree = new THREE.Group();
      addMesh(tree, new THREE.CylinderGeometry(0.16, 0.24, 1.3, 8), trunk, [0, 0.75, 0]);
      addMesh(tree, new THREE.ConeGeometry(0.8, 1.2, 8), foliage, [0, 1.55, 0]);
      addMesh(tree, new THREE.ConeGeometry(0.62, 1.05, 8), foliageLight, [0, 2.2, 0]);
      tree.position.set(x, y, z);
      tree.rotation.y = (x + z) * 0.08;
      this.group.add(tree);
    }

    for (const [x, z] of [[-5.6, -4.9], [5.65, -4.7], [-5.7, 4.7], [5.8, 4.8]]) {
      const lantern = new THREE.Group();
      addMesh(lantern, new THREE.CylinderGeometry(0.07, 0.07, 0.72, 8), trunk, [0, 0.95, 0]);
      addMesh(lantern, new THREE.SphereGeometry(0.13, 10, 8), gold, [0, 1.34, 0]);
      const light = new THREE.PointLight('#e4a74d', 0.7, 3.2, 2);
      light.position.y = 1.35;
      lantern.add(light);
      lantern.position.set(x, 0, z);
      this.group.add(lantern);
    }

    const fireflyMaterial = new THREE.MeshBasicMaterial({ color: '#e8ca71', transparent: true, opacity: 0.65 });
    for (let index = 0; index < 14; index += 1) {
      const firefly = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), fireflyMaterial.clone());
      firefly.position.set(-6 + (index * 1.11) % 12, 1.2 + (index % 3) * 0.25, -5 + ((index * 1.83) % 10));
      this.fireflies.push(firefly);
      this.group.add(firefly);
    }
  }

  private createPieceView(piece: Piece): PieceView {
    const group = new THREE.Group();
    group.name = `piece-${piece.id}`;
    group.userData.pieceId = piece.id;
    group.userData.cell = { ...piece.cell };

    const baseMaterial = makeMaterial(TEAM_COLORS[piece.owner], 0.42, 0.32);
    const base = addMesh(group, new THREE.CylinderGeometry(0.36, 0.42, 0.16, 28), baseMaterial, [0, 0.09, 0]);
    base.userData.pieceId = piece.id;
    addMesh(group, new THREE.TorusGeometry(0.32, 0.035, 8, 24), makeMaterial('#d2a45a', 0.48, 0.4), [0, 0.18, 0], [1, 1, 1], [Math.PI / 2, 0, 0]).userData.pieceId = piece.id;

    const animalRoot = createAnimalForm(piece.type, piece.owner);
    animalRoot.userData.pieceId = piece.id;
    animalRoot.rotation.y = piece.owner === 'red' ? 0 : Math.PI;
    animalRoot.traverse((object) => {
      object.userData.pieceId = piece.id;
    });
    group.add(animalRoot);

    const badge = makeTextSprite(String(PIECE_RANK[piece.type]), TEAM_COLORS[piece.owner]);
    badge.userData.pieceId = piece.id;
    group.add(badge);
    group.traverse((object) => {
      if (object instanceof THREE.Mesh) object.castShadow = USE_PIECE_SHADOWS;
    });
    this.pickTargets.push(group);
    return { group, animalRoot, piece };
  }
}

export function getWorldPosition(cell: Cell): THREE.Vector3 {
  return cellToWorld(cell);
}

export function pieceDisplayName(piece: Piece): string {
  return `${PIECE_LABEL[piece.type]} ${piece.owner === 'red' ? 'Đỏ' : 'Xanh'}`;
}
