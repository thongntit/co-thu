import {
  describeStatus,
  getCapturedTypes,
  getPiecesForPlayer,
  PIECE_LABEL,
  PIECE_RANK,
  type GameState,
  type Piece,
} from '../game/rules';

type HudActions = {
  onReset: () => void;
  onToggleMode: () => void;
  onToggleSound: () => void;
  onRules: () => void;
};

export class Hud {
  private readonly turn = this.getElement('#turn-value');
  private readonly turnCaption = this.getElement('#turn-caption');
  private readonly redCount = this.getElement('#red-count');
  private readonly blueCount = this.getElement('#blue-count');
  private readonly redCaptured = this.getElement('#red-captured');
  private readonly blueCaptured = this.getElement('#blue-captured');
  private readonly status = this.getElement('#status-line');
  private readonly selection = this.getElement('#selection-info');
  private readonly moveLog = this.getElement('#move-log');
  private readonly modeButton = this.getElement<HTMLButtonElement>('#mode-toggle');
  private readonly soundButton = this.getElement<HTMLButtonElement>('#sound-toggle');
  private readonly toast = this.getElement('#toast');
  private toastTimer = 0;

  constructor(actions: HudActions) {
    this.getElement<HTMLButtonElement>('#reset-button').addEventListener('click', actions.onReset);
    this.modeButton.addEventListener('click', actions.onToggleMode);
    this.soundButton.addEventListener('click', actions.onToggleSound);
    this.getElement<HTMLButtonElement>('#rules-button').addEventListener('click', actions.onRules);
    this.getElement<HTMLButtonElement>('#rules-close').addEventListener('click', actions.onRules);
    this.getElement('#rules-modal').addEventListener('click', (event) => {
      if (event.target === this.getElement('#rules-modal')) actions.onRules();
    });
  }

  update(state: GameState, selected: Piece | undefined, legalMoveCount: number, mode: 'local' | 'bot', resolving: boolean): void {
    const currentLabel = state.currentPlayer === 'red' ? 'ĐỎ' : 'XANH';
    this.turn.textContent = currentLabel;
    this.turnCaption.textContent = resolving ? 'ĐANG DIỄN HOẠT' : mode === 'bot' && state.currentPlayer === 'blue' ? 'BOT ĐANG TÍNH' : 'ĐẾN LƯỢT';
    this.turn.className = `turn-value ${state.currentPlayer}`;

    this.redCount.textContent = String(getPiecesForPlayer(state, 'red').length);
    this.blueCount.textContent = String(getPiecesForPlayer(state, 'blue').length);
    this.renderCaptured(this.redCaptured, getCapturedTypes(state, 'red'));
    this.renderCaptured(this.blueCaptured, getCapturedTypes(state, 'blue'));

    if (state.status.kind !== 'playing') {
      this.status.textContent = describeStatus(state.status);
      this.status.dataset.tone = state.status.kind === 'draw' ? 'draw' : 'win';
    } else if (resolving) {
      this.status.textContent = 'Đang thực hiện nước đi…';
      this.status.dataset.tone = 'neutral';
    } else if (selected) {
      this.status.textContent = legalMoveCount > 0 ? `Chọn ô đích cho ${PIECE_LABEL[selected.type]}` : 'Quân này không còn nước đi';
      this.status.dataset.tone = legalMoveCount > 0 ? 'active' : 'danger';
    } else {
      this.status.textContent = `Lượt ${currentLabel.toLowerCase()} — chọn một quân`;
      this.status.dataset.tone = 'neutral';
    }

    this.selection.textContent = selected
      ? `${PIECE_LABEL[selected.type]} · hạng ${PIECE_RANK[selected.type]} · ${legalMoveCount} nước hợp lệ`
      : 'Chọn một quân để xem nước đi';
    this.modeButton.textContent = mode === 'bot' ? 'Đấu với Bot' : 'Hai người chơi';
    this.moveLog.textContent = state.lastMove?.notation ?? 'Ván đấu mới — Đỏ đi trước';
  }

  setSoundMuted(muted: boolean): void {
    this.soundButton.textContent = muted ? 'Âm thanh: tắt' : 'Âm thanh: bật';
    this.soundButton.setAttribute('aria-pressed', String(!muted));
  }

  showToast(message: string, tone: 'default' | 'danger' | 'success' = 'default'): void {
    window.clearTimeout(this.toastTimer);
    this.toast.textContent = message;
    this.toast.dataset.tone = tone;
    this.toast.classList.add('visible');
    this.toastTimer = window.setTimeout(() => this.toast.classList.remove('visible'), 1900);
  }

  toggleRules(): void {
    const modal = this.getElement('#rules-modal');
    const hidden = modal.hasAttribute('hidden');
    if (hidden) {
      modal.removeAttribute('hidden');
      this.getElement<HTMLButtonElement>('#rules-close').focus();
    } else {
      modal.setAttribute('hidden', '');
    }
  }

  private renderCaptured(element: HTMLElement, types: Array<keyof typeof PIECE_LABEL>): void {
    element.replaceChildren(
      ...types.map((type) => {
        const chip = document.createElement('span');
        chip.className = 'captured-chip';
        chip.textContent = PIECE_LABEL[type].slice(0, 2).toUpperCase();
        chip.title = `${PIECE_LABEL[type]} đã bị bắt`;
        return chip;
      }),
    );
  }

  private getElement<T extends HTMLElement = HTMLElement>(selector: string): T {
    const element = document.querySelector<T>(selector);
    if (!element) throw new Error(`Missing HUD element: ${selector}`);
    return element;
  }
}
