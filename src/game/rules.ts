export const BOARD_WIDTH = 7;
export const BOARD_HEIGHT = 9;
export const HALF_MOVE_DRAW_LIMIT = 100;

export type PlayerId = 'red' | 'blue';
export type PieceType =
  | 'rat'
  | 'cat'
  | 'wolf'
  | 'dog'
  | 'leopard'
  | 'tiger'
  | 'lion'
  | 'elephant';
export type MoveKind = 'step' | 'jump';
export type GameStatus =
  | { kind: 'playing' }
  | { kind: 'won'; winner: PlayerId; reason: 'den' | 'elimination' | 'stalemate' }
  | { kind: 'draw'; reason: 'repetition' | 'quiet' };

export interface Cell {
  x: number;
  y: number;
}

export interface Piece {
  id: string;
  owner: PlayerId;
  type: PieceType;
  cell: Cell;
}

export interface Move {
  pieceId: string;
  from: Cell;
  to: Cell;
  kind: MoveKind;
  captureId?: string;
}

export interface MoveRecord extends Move {
  notation: string;
}

export interface GameState {
  board: Array<string | null>;
  pieces: Record<string, Piece>;
  currentPlayer: PlayerId;
  status: GameStatus;
  moveNumber: number;
  halfMoveClock: number;
  repetition: Record<string, number>;
  lastMove?: MoveRecord;
}

export interface AppliedMove {
  state: GameState;
  move: Move;
  capturedPiece?: Piece;
}

export const PIECE_RANK: Record<PieceType, number> = {
  rat: 1,
  cat: 2,
  wolf: 3,
  dog: 4,
  leopard: 5,
  tiger: 6,
  lion: 7,
  elephant: 8,
};

export const PIECE_LABEL: Record<PieceType, string> = {
  rat: 'Chuột',
  cat: 'Mèo',
  wolf: 'Sói',
  dog: 'Chó',
  leopard: 'Báo',
  tiger: 'Hổ',
  lion: 'Sư tử',
  elephant: 'Voi',
};

export const PIECE_SHORT_LABEL: Record<PieceType, string> = {
  rat: 'CH',
  cat: 'MÈO',
  wolf: 'SÓI',
  dog: 'CHÓ',
  leopard: 'BÁO',
  tiger: 'HỔ',
  lion: 'ST',
  elephant: 'VOI',
};

export const PIECE_TYPES: PieceType[] = [
  'rat',
  'cat',
  'wolf',
  'dog',
  'leopard',
  'tiger',
  'lion',
  'elephant',
];

const DIRECTIONS: Cell[] = [
  { x: 0, y: 1 },
  { x: 1, y: 0 },
  { x: 0, y: -1 },
  { x: -1, y: 0 },
];

const WATER_CELLS = new Set([
  '1,3',
  '2,3',
  '1,4',
  '2,4',
  '1,5',
  '2,5',
  '4,3',
  '5,3',
  '4,4',
  '5,4',
  '4,5',
  '5,5',
]);

const TRAP_OWNER: Record<string, PlayerId> = {
  '2,0': 'red',
  '4,0': 'red',
  '3,1': 'red',
  '2,8': 'blue',
  '4,8': 'blue',
  '3,7': 'blue',
};

const DEN_OWNER: Record<string, PlayerId> = {
  '3,0': 'red',
  '3,8': 'blue',
};

const STARTING_PIECES: Array<{ id: string; owner: PlayerId; type: PieceType; cell: Cell }> = [
  { id: 'red-tiger', owner: 'red', type: 'tiger', cell: { x: 0, y: 0 } },
  { id: 'red-lion', owner: 'red', type: 'lion', cell: { x: 6, y: 0 } },
  { id: 'red-cat', owner: 'red', type: 'cat', cell: { x: 1, y: 1 } },
  { id: 'red-dog', owner: 'red', type: 'dog', cell: { x: 5, y: 1 } },
  { id: 'red-elephant', owner: 'red', type: 'elephant', cell: { x: 0, y: 2 } },
  { id: 'red-wolf', owner: 'red', type: 'wolf', cell: { x: 2, y: 2 } },
  { id: 'red-leopard', owner: 'red', type: 'leopard', cell: { x: 4, y: 2 } },
  { id: 'red-rat', owner: 'red', type: 'rat', cell: { x: 6, y: 2 } },
  { id: 'blue-lion', owner: 'blue', type: 'lion', cell: { x: 0, y: 8 } },
  { id: 'blue-tiger', owner: 'blue', type: 'tiger', cell: { x: 6, y: 8 } },
  { id: 'blue-dog', owner: 'blue', type: 'dog', cell: { x: 1, y: 7 } },
  { id: 'blue-cat', owner: 'blue', type: 'cat', cell: { x: 5, y: 7 } },
  { id: 'blue-rat', owner: 'blue', type: 'rat', cell: { x: 0, y: 6 } },
  { id: 'blue-leopard', owner: 'blue', type: 'leopard', cell: { x: 2, y: 6 } },
  { id: 'blue-wolf', owner: 'blue', type: 'wolf', cell: { x: 4, y: 6 } },
  { id: 'blue-elephant', owner: 'blue', type: 'elephant', cell: { x: 6, y: 6 } },
];

export function cellKey(cell: Cell): string {
  return `${cell.x},${cell.y}`;
}

export function cellIndex(cell: Cell): number {
  return cell.y * BOARD_WIDTH + cell.x;
}

export function indexToCell(index: number): Cell {
  return { x: index % BOARD_WIDTH, y: Math.floor(index / BOARD_WIDTH) };
}

export function isInsideBoard(cell: Cell): boolean {
  return cell.x >= 0 && cell.x < BOARD_WIDTH && cell.y >= 0 && cell.y < BOARD_HEIGHT;
}

export function isWater(cell: Cell): boolean {
  return WATER_CELLS.has(cellKey(cell));
}

export function getTrapOwner(cell: Cell): PlayerId | undefined {
  return TRAP_OWNER[cellKey(cell)];
}

export function getDenOwner(cell: Cell): PlayerId | undefined {
  return DEN_OWNER[cellKey(cell)];
}

export function opponentOf(player: PlayerId): PlayerId {
  return player === 'red' ? 'blue' : 'red';
}

export function createInitialGameState(): GameState {
  const board = Array<string | null>(BOARD_WIDTH * BOARD_HEIGHT).fill(null);
  const pieces: Record<string, Piece> = {};

  for (const startingPiece of STARTING_PIECES) {
    const piece: Piece = {
      id: startingPiece.id,
      owner: startingPiece.owner,
      type: startingPiece.type,
      cell: { ...startingPiece.cell },
    };
    pieces[piece.id] = piece;
    board[cellIndex(piece.cell)] = piece.id;
  }

  const state: GameState = {
    board,
    pieces,
    currentPlayer: 'red',
    status: { kind: 'playing' },
    moveNumber: 0,
    halfMoveClock: 0,
    repetition: {},
  };
  const key = getPositionKey(state);
  state.repetition[key] = 1;
  return state;
}

export function getPieceAt(state: GameState, cell: Cell): Piece | undefined {
  const id = state.board[cellIndex(cell)];
  return id ? state.pieces[id] : undefined;
}

export function getPiecesForPlayer(state: GameState, owner: PlayerId): Piece[] {
  return Object.values(state.pieces).filter((piece) => piece.owner === owner);
}

export function getEffectiveRank(piece: Piece): number {
  const trapOwner = getTrapOwner(piece.cell);
  return trapOwner && trapOwner !== piece.owner ? 0 : PIECE_RANK[piece.type];
}

function canCapture(attacker: Piece, target: Piece, from: Cell, to: Cell): boolean {
  const attackerInWater = isWater(from);
  const targetInWater = isWater(to);

  if (attackerInWater !== targetInWater) return false;
  if (attackerInWater || targetInWater) {
    return attacker.type === 'rat' && target.type === 'rat';
  }

  if (attacker.type === 'rat' && target.type === 'elephant') return true;
  if (attacker.type === 'elephant' && target.type === 'rat') return false;

  return getEffectiveRank(attacker) >= getEffectiveRank(target);
}

function canOccupyEmptyCell(piece: Piece, target: Cell): boolean {
  if (getDenOwner(target) === piece.owner) return false;
  return !isWater(target) || piece.type === 'rat';
}

function createMoveIfLegal(state: GameState, piece: Piece, to: Cell, kind: MoveKind): Move | undefined {
  if (!isInsideBoard(to)) return undefined;
  const target = getPieceAt(state, to);
  if (target?.owner === piece.owner) return undefined;
  if (!target && !canOccupyEmptyCell(piece, to)) return undefined;
  if (target && !canCapture(piece, target, piece.cell, to)) return undefined;

  return {
    pieceId: piece.id,
    from: { ...piece.cell },
    to: { ...to },
    kind,
    ...(target ? { captureId: target.id } : {}),
  };
}

function getJumpMove(state: GameState, piece: Piece, direction: Cell): Move | undefined {
  const firstWater = { x: piece.cell.x + direction.x, y: piece.cell.y + direction.y };
  if (!isInsideBoard(firstWater) || !isWater(firstWater)) return undefined;

  let cursor = firstWater;
  while (isInsideBoard(cursor) && isWater(cursor)) {
    const occupant = getPieceAt(state, cursor);
    if (occupant?.type === 'rat') return undefined;
    cursor = { x: cursor.x + direction.x, y: cursor.y + direction.y };
  }

  if (!isInsideBoard(cursor)) return undefined;
  return createMoveIfLegal(state, piece, cursor, 'jump');
}

export function getLegalMoves(state: GameState, owner = state.currentPlayer): Move[] {
  if (state.status.kind !== 'playing') return [];
  const moves: Move[] = [];

  for (const piece of getPiecesForPlayer(state, owner)) {
    for (const direction of DIRECTIONS) {
      const destination = {
        x: piece.cell.x + direction.x,
        y: piece.cell.y + direction.y,
      };
      const move = createMoveIfLegal(state, piece, destination, 'step');
      if (move) moves.push(move);
    }

    if (piece.type === 'tiger' || piece.type === 'lion') {
      for (const direction of DIRECTIONS) {
        const jump = getJumpMove(state, piece, direction);
        if (jump) moves.push(jump);
      }
    }
  }

  return moves;
}

function cloneState(state: GameState): GameState {
  const pieces: Record<string, Piece> = {};
  for (const [id, piece] of Object.entries(state.pieces)) {
    pieces[id] = { ...piece, cell: { ...piece.cell } };
  }

  return {
    board: [...state.board],
    pieces,
    currentPlayer: state.currentPlayer,
    status: { ...state.status } as GameStatus,
    moveNumber: state.moveNumber,
    halfMoveClock: state.halfMoveClock,
    repetition: { ...state.repetition },
    ...(state.lastMove ? { lastMove: { ...state.lastMove, from: { ...state.lastMove.from }, to: { ...state.lastMove.to } } } : {}),
  };
}

function sameCell(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y;
}

function containsMove(moves: Move[], candidate: Move): boolean {
  return moves.some(
    (move) =>
      move.pieceId === candidate.pieceId &&
      move.kind === candidate.kind &&
      sameCell(move.from, candidate.from) &&
      sameCell(move.to, candidate.to),
  );
}

export function getPositionKey(state: GameState): string {
  const board = state.board
    .map((id) => {
      if (!id) return '--';
      const piece = state.pieces[id];
      return `${piece.owner[0]}${piece.type[0]}`;
    })
    .join('');
  return `${state.currentPlayer}|${board}`;
}

export function applyMove(state: GameState, candidate: Move): AppliedMove {
  if (state.status.kind !== 'playing') throw new Error('Cannot move after the game has ended.');

  const legalMove = getLegalMoves(state, state.currentPlayer).find((move) => containsMove([move], candidate));
  if (!legalMove) throw new Error(`Illegal move: ${candidate.pieceId}`);

  const next = cloneState(state);
  const movingPiece = next.pieces[legalMove.pieceId];
  if (!movingPiece) throw new Error(`Missing moving piece: ${legalMove.pieceId}`);

  const capturedId = next.board[cellIndex(legalMove.to)];
  const capturedPiece = capturedId ? next.pieces[capturedId] : undefined;
  next.board[cellIndex(legalMove.from)] = null;
  next.board[cellIndex(legalMove.to)] = movingPiece.id;
  movingPiece.cell = { ...legalMove.to };
  if (capturedPiece) delete next.pieces[capturedPiece.id];

  next.moveNumber += 1;
  next.halfMoveClock = capturedPiece ? 0 : next.halfMoveClock + 1;
  next.currentPlayer = opponentOf(state.currentPlayer);
  next.lastMove = {
    ...legalMove,
    ...(capturedPiece ? { captureId: capturedPiece.id } : {}),
    notation: formatMove(state, legalMove, capturedPiece),
  };

  const enemy = opponentOf(movingPiece.owner);
  if (getDenOwner(legalMove.to) === enemy) {
    next.status = { kind: 'won', winner: movingPiece.owner, reason: 'den' };
  } else if (getPiecesForPlayer(next, enemy).length === 0) {
    next.status = { kind: 'won', winner: movingPiece.owner, reason: 'elimination' };
  } else {
    const nextKey = getPositionKey(next);
    next.repetition[nextKey] = (next.repetition[nextKey] ?? 0) + 1;
    if (next.repetition[nextKey] >= 3) {
      next.status = { kind: 'draw', reason: 'repetition' };
    } else if (next.halfMoveClock >= HALF_MOVE_DRAW_LIMIT) {
      next.status = { kind: 'draw', reason: 'quiet' };
    } else if (getLegalMoves(next, next.currentPlayer).length === 0) {
      next.status = { kind: 'won', winner: movingPiece.owner, reason: 'stalemate' };
    }
  }

  return { state: next, move: legalMove, ...(capturedPiece ? { capturedPiece } : {}) };
}

export function formatMove(state: GameState, move: Move, capturedPiece?: Piece): string {
  const piece = state.pieces[move.pieceId];
  if (!piece) return 'Nước đi';
  const from = `${String.fromCharCode(97 + move.from.x)}${move.from.y + 1}`;
  const to = `${String.fromCharCode(97 + move.to.x)}${move.to.y + 1}`;
  const action = capturedPiece ? '×' : '→';
  return `${PIECE_LABEL[piece.type]} ${from}${action}${to}`;
}

export function describeStatus(status: GameStatus): string {
  if (status.kind === 'playing') return '';
  if (status.kind === 'draw') {
    return status.reason === 'repetition' ? 'Thế cờ lặp lại — hòa' : 'Rừng im tiếng — hòa sau chuỗi nước dài';
  }

  if (status.reason === 'den') return `${status.winner === 'red' ? 'Đỏ' : 'Xanh'} đã chiếm hang đối thủ`;
  if (status.reason === 'elimination') return `${status.winner === 'red' ? 'Đỏ' : 'Xanh'} đã hạ toàn bộ quân địch`;
  return `${status.winner === 'red' ? 'Đỏ' : 'Xanh'} thắng vì đối thủ không còn nước đi`;
}

export function getCapturedTypes(state: GameState, owner: PlayerId): PieceType[] {
  return PIECE_TYPES.filter((type) => !Object.values(state.pieces).some((piece) => piece.owner === owner && piece.type === type));
}
