import * as THREE from 'three';
import { Loop } from '../core/Loop';
import { createRenderer, resizeRenderer } from '../core/Renderer';
import { chooseBotMove } from '../ai/chooseMove';
import {
  applyMove,
  createInitialGameState,
  getLegalMoves,
  getPieceAt,
  PIECE_TYPES,
  type Cell,
  type GameState,
  type Move,
} from './rules';
import { AudioSystem } from '../systems/AudioSystem';
import { BoardView, getWorldPosition } from '../systems/BoardView';
import { Hud } from '../ui/Hud';

type GameMode = 'local' | 'bot';

// Keep this list explicit so a missing generated asset never creates a noisy
// 404 at runtime. Tripo credit was exhausted while generating dog.glb; its
// readable procedural form remains the intentional fallback until that asset
// can be generated.
const TRIPO_MODEL_TYPES = PIECE_TYPES.filter((pieceType) => pieceType !== 'dog');

type AnimationState = {
  move: Move;
  nextState: GameState;
};

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-8, 8, 6.5, -6.5, 0.1, 80);
  private readonly board = new BoardView();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly audio = new AudioSystem();
  private readonly loop: Loop;
  private readonly hud: Hud;
  private state = createInitialGameState();
  private selectedPieceId: string | null = null;
  private selectedMoves: Move[] = [];
  private animation: AnimationState | null = null;
  private mode: GameMode = 'bot';
  private botTimer: number | null = null;
  private frame = 0;
  private elapsed = 0;
  private pausedForScreenshot = false;
  private reducedMotion = false;
  private cameraShake = 0;
  private seedValue = 1;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = createRenderer(canvas);
    this.renderer.toneMappingExposure = 1.08;
    this.hud = new Hud({
      onReset: () => this.reset(),
      onToggleMode: () => this.toggleMode(),
      onToggleSound: () => this.toggleSound(),
      onRules: () => this.hud.toggleRules(),
    });
    this.loop = new Loop(
      (delta, time) => this.update(delta, time),
      () => this.render(),
    );

    this.createScene();
    this.board.syncState(this.state);
    const useFlatModels = window.innerWidth < 600 || navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches;
    for (const pieceType of TRIPO_MODEL_TYPES) {
      const suffix = useFlatModels ? '-flat' : '';
      void this.board.loadPieceModel(
        pieceType,
        `/assets/models/${pieceType}/${pieceType}${suffix}.glb`,
      );
    }
    this.installInput();
    this.installTestHooks();
    this.resize();
    this.updateHud();
    this.publishDiagnostics();
  }

  start(): void {
    this.loop.start();
  }

  dispose(): void {
    this.loop.stop();
    window.removeEventListener('resize', this.resize);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    if (this.botTimer !== null) window.clearTimeout(this.botTimer);
    this.audio.dispose();
    this.renderer.dispose();
    window.__THREE_GAME_DIAGNOSTICS__ = undefined;
    window.__THREE_GAME_TEST_HOOKS__ = undefined;
  }

  private readonly resize = (): void => {
    resizeRenderer(this.renderer, this.camera, 1.75);
    const aspect = Math.max(0.35, this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight));
    // The board is diagonal in the oblique camera. On portrait screens the
    // horizontal projection needs extra breathing room, otherwise the corner
    // cells are clipped even though the board's world-space width is modest.
    this.camera.zoom = aspect < 0.82 ? Math.max(0.42, aspect / 1.32) : 1;
    this.camera.updateProjectionMatrix();
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    event.preventDefault();
    void this.audio.unlock();
    if (this.pausedForScreenshot || this.animation || this.state.status.kind !== 'playing') return;
    if (this.mode === 'bot' && this.state.currentPlayer === 'blue') return;

    const target = this.pick(event.clientX, event.clientY);
    if (!target) return;

    const pieceId = this.board.getPieceIdFromObject(target);
    if (pieceId) {
      const piece = this.state.pieces[pieceId];
      if (piece?.owner === this.state.currentPlayer) {
        this.selectPiece(pieceId);
        return;
      }
    }

    const cell = this.board.getCellFromObject(target);
    if (!cell || !this.selectedPieceId) return;
    const move = this.selectedMoves.find((candidate) => candidate.to.x === cell.x && candidate.to.y === cell.y);
    if (move) this.commitMove(move);
  };

  private installInput(): void {
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('resize', this.resize);
  }

  private createScene(): void {
    this.scene.background = new THREE.Color('#071713');
    this.scene.fog = new THREE.Fog('#071713', 18, 38);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(42, 34),
      new THREE.MeshStandardMaterial({ color: '#07140f', roughness: 0.96, metalness: 0.02 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const groundRing = new THREE.Mesh(
      new THREE.RingGeometry(9.5, 12.8, 64),
      new THREE.MeshBasicMaterial({ color: '#163b2b', transparent: true, opacity: 0.28, side: THREE.DoubleSide }),
    );
    groundRing.rotation.x = -Math.PI / 2;
    groundRing.position.y = -0.015;
    this.scene.add(groundRing);

    const hemisphere = new THREE.HemisphereLight('#cce2cf', '#09110d', 1.55);
    this.scene.add(hemisphere);

    const keyLight = new THREE.DirectionalLight('#ffe2a5', 2.7);
    keyLight.position.set(-8, 15, 10);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 38;
    keyLight.shadow.camera.left = -15;
    keyLight.shadow.camera.right = 15;
    keyLight.shadow.camera.top = 17;
    keyLight.shadow.camera.bottom = -17;
    this.scene.add(keyLight);

    const redRim = new THREE.PointLight('#c75a45', 1.1, 11, 2);
    redRim.position.set(-7, 4, 7);
    this.scene.add(redRim);
    const blueRim = new THREE.PointLight('#4d9caf', 1.25, 12, 2);
    blueRim.position.set(7, 4, -7);
    this.scene.add(blueRim);

    this.scene.add(this.board.group);
    this.camera.position.set(10.5, 15.2, 14.5);
    this.camera.lookAt(0, 0.25, 0);
  }

  private selectPiece(pieceId: string): void {
    const piece = this.state.pieces[pieceId];
    if (!piece || piece.owner !== this.state.currentPlayer) return;
    this.selectedPieceId = pieceId;
    this.selectedMoves = getLegalMoves(this.state).filter((move) => move.pieceId === pieceId);
    this.board.setLegalMoves(this.selectedMoves, piece.cell);
    this.audio.ui();
    if (this.selectedMoves.length === 0) {
      this.hud.showToast('Quân này đang bị khóa', 'danger');
    }
    this.updateHud();
  }

  private commitMove(move: Move): void {
    if (this.animation || this.state.status.kind !== 'playing') return;
    const applied = applyMove(this.state, move);
    this.animation = { move: applied.move, nextState: applied.state };
    this.selectedPieceId = null;
    this.selectedMoves = [];
    this.board.clearHighlights();
    this.board.startMove(applied.move);
    this.cameraShake = applied.capturedPiece ? 0.12 : 0.035;

    if (applied.move.kind === 'jump') this.audio.jump();
    else if (applied.capturedPiece) this.audio.capture();
    else this.audio.move();
    if (this.isTrapCell(applied.move.to)) this.audio.trap();
    this.updateHud();
  }

  private isTrapCell(cell: Cell): boolean {
    return ((cell.x === 2 || cell.x === 4) && (cell.y === 0 || cell.y === 8)) ||
      (cell.x === 3 && (cell.y === 1 || cell.y === 7));
  }

  private finishAnimation(): void {
    if (!this.animation) return;
    const { nextState } = this.animation;
    this.animation = null;
    this.state = nextState;
    this.board.syncState(this.state);

    if (this.state.status.kind !== 'playing') {
      if (this.state.status.kind === 'won') {
        this.audio.win();
        this.hud.showToast(this.state.status.winner === 'red' ? 'Đỏ thắng!' : 'Xanh thắng!', 'success');
      } else {
        this.hud.showToast('Ván đấu hòa', 'default');
      }
    } else if (this.mode === 'bot' && this.state.currentPlayer === 'blue') {
      this.scheduleBotMove();
    }
    this.updateHud();
  }

  private scheduleBotMove(): void {
    if (this.botTimer !== null) window.clearTimeout(this.botTimer);
    this.botTimer = window.setTimeout(() => {
      this.botTimer = null;
      if (this.state.status.kind !== 'playing' || this.animation || this.mode !== 'bot' || this.state.currentPlayer !== 'blue') return;
      const move = chooseBotMove(this.state, 'blue');
      if (move) this.commitMove(move);
    }, 520);
  }

  private update(delta: number, time: number): void {
    this.frame += 1;
    if (this.pausedForScreenshot) {
      this.publishDiagnostics();
      return;
    }

    this.elapsed += delta;
    this.resize();
    const animationDone = this.board.update(this.reducedMotion ? 0 : delta, this.reducedMotion ? 0 : time);
    if (this.animation && animationDone) this.finishAnimation();
    this.cameraShake = Math.max(0, this.cameraShake - delta * 0.7);
    this.updateCameraShake();
    this.updateHud();
    this.publishDiagnostics();
  }

  private updateCameraShake(): void {
    const shake = this.reducedMotion ? 0 : this.cameraShake;
    this.camera.position.x = 10.5 + Math.sin(this.elapsed * 39) * shake;
    this.camera.position.y = 15.2 + Math.sin(this.elapsed * 47 + 0.7) * shake * 0.55;
    this.camera.position.z = 14.5 + Math.cos(this.elapsed * 41) * shake;
    this.camera.lookAt(0, 0.25, 0);
  }

  private render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private pick(clientX: number, clientY: number): THREE.Object3D | undefined {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster.intersectObjects(this.board.getPickTargets(), true)[0]?.object;
  }

  private reset(): void {
    if (this.botTimer !== null) window.clearTimeout(this.botTimer);
    this.botTimer = null;
    this.animation = null;
    this.state = createInitialGameState();
    this.selectedPieceId = null;
    this.selectedMoves = [];
    this.board.clearHighlights();
    this.board.syncState(this.state);
    this.audio.ui();
    this.hud.showToast('Ván mới bắt đầu', 'default');
    this.updateHud();
  }

  private toggleMode(): void {
    this.mode = this.mode === 'bot' ? 'local' : 'bot';
    this.reset();
    this.hud.showToast(this.mode === 'bot' ? 'Đấu với Bot — Xanh sẽ tự đi' : 'Hai người chơi — thay phiên trên cùng máy');
  }

  private toggleSound(): void {
    this.audio.setMuted(!this.audio.isMuted());
    this.hud.setSoundMuted(this.audio.isMuted());
    if (!this.audio.isMuted()) this.audio.ui();
  }

  private updateHud(): void {
    const selected = this.selectedPieceId ? this.state.pieces[this.selectedPieceId] : undefined;
    this.hud.update(this.state, selected, this.selectedMoves.length, this.mode, Boolean(this.animation));
  }

  private installTestHooks(): void {
    window.__THREE_GAME_TEST_HOOKS__ = {
      seed: (value: number) => {
        this.seedValue = value;
      },
      setState: (name: string) => {
        this.reset();
        if (name === 'complete') {
          const winningPiece = getPieceAt(this.state, { x: 3, y: 1 });
          if (winningPiece) {
            this.state.status = { kind: 'won', winner: 'red', reason: 'den' };
          } else {
            this.state.status = { kind: 'won', winner: 'red', reason: 'elimination' };
          }
          this.updateHud();
        }
      },
      setPausedForScreenshot: (paused: boolean) => {
        this.pausedForScreenshot = paused;
      },
      setReducedMotion: (enabled: boolean) => {
        this.reducedMotion = enabled;
      },
      hideDebugUi: () => undefined,
      getCellScreenPosition: (cell: Cell) => this.getCellScreenPosition(cell),
    };
  }

  private getCellScreenPosition(cell: Cell): { x: number; y: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const point = getWorldPosition(cell).project(this.camera);
    return {
      x: rect.left + ((point.x + 1) / 2) * rect.width,
      y: rect.top + ((1 - point.y) / 2) * rect.height,
    };
  }

  private publishDiagnostics(): void {
    const redCount = Object.values(this.state.pieces).filter((piece) => piece.owner === 'red').length;
    const blueCount = Object.values(this.state.pieces).filter((piece) => piece.owner === 'blue').length;
    window.__THREE_GAME_DIAGNOSTICS__ = {
      frame: this.frame,
      elapsed: this.elapsed,
      score: this.state.moveNumber,
      targetScore: 0,
      complete: this.state.status.kind !== 'playing',
      currentPlayer: this.state.currentPlayer,
      mode: this.mode,
      pieces: { red: redCount, blue: blueCount },
      modelsLoaded: this.board.getLoadedModelCount(),
      player: {
        position: { x: 0, y: 0, z: 0 },
        speed: 0,
      },
      selectedPiece: this.selectedPieceId,
      renderer: {
        calls: this.renderer.info.render.calls,
        triangles: this.renderer.info.render.triangles,
        geometries: this.renderer.info.memory.geometries,
        textures: this.renderer.info.memory.textures,
      },
      canvas: {
        clientWidth: this.canvas.clientWidth,
        clientHeight: this.canvas.clientHeight,
        width: this.canvas.width,
        height: this.canvas.height,
        dpr: this.canvas.clientWidth ? this.canvas.width / this.canvas.clientWidth : 1,
      },
      seed: this.seedValue,
    };
  }
}
