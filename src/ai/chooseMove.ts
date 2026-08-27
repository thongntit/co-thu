import {
  applyMove,
  getDenOwner,
  getEffectiveRank,
  getLegalMoves,
  getPiecesForPlayer,
  getTrapOwner,
  isWater,
  opponentOf,
  type GameState,
  type Move,
  type Piece,
  type PlayerId,
} from '../game/rules';

function distanceToDen(piece: Piece): number {
  const targetY = piece.owner === 'red' ? 8 : 0;
  return Math.abs(piece.cell.x - 3) + Math.abs(piece.cell.y - targetY);
}

function scoreMove(state: GameState, move: Move, owner: PlayerId): number {
  const movingPiece = state.pieces[move.pieceId];
  if (!movingPiece) return Number.NEGATIVE_INFINITY;

  const target = move.captureId ? state.pieces[move.captureId] : undefined;
  const targetDen = getDenOwner(move.to) === opponentOf(owner);
  let score = 0;

  if (targetDen) score += 100_000;
  if (target) score += getEffectiveRank(target) * 160 - getEffectiveRank(movingPiece) * 5;
  if (move.kind === 'jump') score += 28;
  if (isWater(move.to)) score += movingPiece.type === 'rat' ? 20 : -100;
  if (getTrapOwner(move.to) === owner) score += 8;
  if (getTrapOwner(move.to) === opponentOf(owner)) score -= getEffectiveRank(movingPiece) * 3;

  const advance = movingPiece.owner === 'red' ? move.to.y - move.from.y : move.from.y - move.to.y;
  score += advance * 9;
  score -= distanceToDen({ ...movingPiece, cell: move.to }) * 1.8;

  try {
    const next = applyMove(state, move).state;
    if (next.status.kind === 'won' && next.status.winner === owner) score += 50_000;
    const enemyMoves = getLegalMoves(next, opponentOf(owner));
    score += Math.max(0, 18 - enemyMoves.length) * 1.5;
    score += getPiecesForPlayer(next, owner).length * 0.25;
  } catch {
    return Number.NEGATIVE_INFINITY;
  }

  return score;
}

export function chooseBotMove(state: GameState, owner: PlayerId = state.currentPlayer): Move | undefined {
  const moves = getLegalMoves(state, owner);
  if (moves.length === 0) return undefined;

  return [...moves]
    .sort((a, b) => {
      const scoreDelta = scoreMove(state, b, owner) - scoreMove(state, a, owner);
      if (Math.abs(scoreDelta) > 0.001) return scoreDelta;
      return `${a.pieceId}:${a.to.y}:${a.to.x}`.localeCompare(`${b.pieceId}:${b.to.y}:${b.to.x}`);
    })
    .at(0);
}
