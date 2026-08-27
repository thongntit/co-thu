import { expect, test } from '@playwright/test';
import type * as RuleApi from '../src/game/rules';

test('rules engine exposes the intended Cờ Thú setup and movement', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const rules = await import('/src/game/' + 'rules.ts') as typeof RuleApi;
    const initial = rules.createInitialGameState();
    const tigerMoves = rules.getLegalMoves(initial).filter((move) => move.pieceId === 'red-tiger');
    return {
      pieces: Object.keys(initial.pieces).length,
      currentPlayer: initial.currentPlayer,
      tigerMoves: tigerMoves.map((move) => `${move.to.x},${move.to.y}`).sort(),
      riverIsWater: rules.isWater({ x: 1, y: 3 }),
      landIsWater: rules.isWater({ x: 0, y: 3 }),
    };
  });

  expect(result).toEqual({
    pieces: 16,
    currentPlayer: 'red',
    tigerMoves: ['0,1', '1,0'],
    riverIsWater: true,
    landIsWater: false,
  });
});

test('tiger jumps across the river and a rat blocks the jump', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const rules = await import('/src/game/' + 'rules.ts') as typeof RuleApi;
    const state = rules.createInitialGameState();
    const tiger = state.pieces['red-tiger'];
    const rat = state.pieces['red-rat'];
    state.board[tiger.cell.y * rules.BOARD_WIDTH + tiger.cell.x] = null;
    tiger.cell = { x: 1, y: 2 };
    state.board[tiger.cell.y * rules.BOARD_WIDTH + tiger.cell.x] = tiger.id;
    const openJump = rules.getLegalMoves(state).some((move) => move.pieceId === tiger.id && move.kind === 'jump' && move.to.x === 1 && move.to.y === 6);

    state.board[rat.cell.y * rules.BOARD_WIDTH + rat.cell.x] = null;
    rat.cell = { x: 1, y: 4 };
    state.board[rat.cell.y * rules.BOARD_WIDTH + rat.cell.x] = rat.id;
    const blockedJump = rules.getLegalMoves(state).some((move) => move.pieceId === tiger.id && move.kind === 'jump' && move.to.x === 1 && move.to.y === 6);
    return { openJump, blockedJump };
  });

  expect(result).toEqual({ openJump: true, blockedJump: false });
});

test('rat can capture elephant and reaching the enemy den wins', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const rules = await import('/src/game/' + 'rules.ts') as typeof RuleApi;
    const captureState = rules.createInitialGameState();
    const rat = captureState.pieces['red-rat'];
    const elephant = captureState.pieces['blue-elephant'];
    captureState.board[rat.cell.y * rules.BOARD_WIDTH + rat.cell.x] = null;
    captureState.board[elephant.cell.y * rules.BOARD_WIDTH + elephant.cell.x] = null;
    rat.cell = { x: 0, y: 6 };
    elephant.cell = { x: 0, y: 7 };
    captureState.board[rat.cell.y * rules.BOARD_WIDTH + rat.cell.x] = rat.id;
    captureState.board[elephant.cell.y * rules.BOARD_WIDTH + elephant.cell.x] = elephant.id;
    const capture = rules.getLegalMoves(captureState).find((move) => move.pieceId === rat.id && move.captureId === elephant.id);

    const denState = rules.createInitialGameState();
    const denRat = denState.pieces['red-rat'];
    denState.board[denRat.cell.y * rules.BOARD_WIDTH + denRat.cell.x] = null;
    denRat.cell = { x: 3, y: 7 };
    denState.board[denRat.cell.y * rules.BOARD_WIDTH + denRat.cell.x] = denRat.id;
    const denMove = rules.getLegalMoves(denState).find((move) => move.pieceId === denRat.id && move.to.x === 3 && move.to.y === 8);
    const won = denMove ? rules.applyMove(denState, denMove).state.status : null;
    return { capture: capture?.captureId ?? null, won };
  });

  expect(result.capture).toBe('blue-elephant');
  expect(result.won).toEqual({ kind: 'won', winner: 'red', reason: 'den' });
});
