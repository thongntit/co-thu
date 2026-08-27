type AudioGroup = 'master' | 'ui' | 'sfx' | 'ambience';

const SOUND_PATHS = {
  move: '/assets/audio/sfx/move.mp3',
  capture: '/assets/audio/sfx/capture.mp3',
  jump: '/assets/audio/sfx/river-jump.mp3',
  trap: '/assets/audio/sfx/trap.mp3',
  win: '/assets/audio/sfx/victory.mp3',
  ambience: '/assets/audio/ambience/jungle-night.mp3',
} as const;

type SoundId = keyof typeof SOUND_PATHS;

export class AudioSystem {
  private context: AudioContext | null = null;
  private readonly buffers = new Map<SoundId, AudioBuffer>();
  private readonly gains = new Map<AudioGroup, GainNode>();
  private ambienceSource: AudioBufferSourceNode | null = null;
  private unlocked = false;
  private muted = false;

  constructor() {
    const unlock = () => {
      void this.unlock();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  async unlock(): Promise<void> {
    if (this.unlocked) return;
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    this.context = new AudioContextClass();
    await this.context.resume();
    this.createGroups();
    this.unlocked = true;
    void this.loadAll();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    const master = this.gains.get('master');
    if (master) master.gain.value = muted ? 0 : 0.78;
    if (!muted) this.startAmbience();
  }

  isMuted(): boolean {
    return this.muted;
  }

  move(): void {
    if (!this.play('move', 'sfx', 0.52)) this.fallbackTone(240, 0.055, 0.07, 'triangle');
  }

  capture(): void {
    if (!this.play('capture', 'sfx', 0.78)) this.fallbackTone(115, 0.13, 0.16, 'sawtooth');
  }

  jump(): void {
    if (!this.play('jump', 'sfx', 0.7)) this.fallbackSweep(260, 610, 0.25);
  }

  trap(): void {
    if (!this.play('trap', 'sfx', 0.62)) this.fallbackTone(180, 0.09, 0.12, 'square');
  }

  win(): void {
    if (!this.play('win', 'sfx', 0.9)) this.fallbackSweep(280, 880, 0.58);
  }

  ui(): void {
    this.fallbackTone(520, 0.045, 0.08, 'sine');
  }

  dispose(): void {
    this.stopAmbience();
    void this.context?.close();
    this.context = null;
    this.buffers.clear();
    this.gains.clear();
  }

  private createGroups(): void {
    if (!this.context) return;
    const master = this.context.createGain();
    master.gain.value = this.muted ? 0 : 0.78;
    master.connect(this.context.destination);
    this.gains.set('master', master);

    for (const [name, value] of [
      ['ui', 0.72],
      ['sfx', 0.9],
      ['ambience', 0.24],
    ] as const) {
      const group = this.context.createGain();
      group.gain.value = value;
      group.connect(master);
      this.gains.set(name, group);
    }
  }

  private async loadAll(): Promise<void> {
    if (!this.context) return;
    const entries = Object.entries(SOUND_PATHS) as Array<[SoundId, string]>;
    await Promise.all(
      entries.map(async ([id, path]) => {
        try {
          const response = await fetch(path);
          if (!response.ok) return;
          const data = await response.arrayBuffer();
          if (!this.context) return;
          this.buffers.set(id, await this.context.decodeAudioData(data));
          if (id === 'ambience') this.startAmbience();
        } catch {
          // Procedural fallbacks keep the loop playable if a generated file is absent.
        }
      }),
    );
  }

  private play(id: SoundId, group: AudioGroup, volume: number): boolean {
    if (!this.context || this.context.state !== 'running' || this.muted) return false;
    const buffer = this.buffers.get(id);
    const output = this.gains.get(group);
    if (!buffer || !output) return false;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(gain).connect(output);
    source.start();
    return true;
  }

  private fallbackTone(frequency: number, volume: number, duration: number, type: OscillatorType): void {
    if (!this.context || this.context.state !== 'running' || this.muted) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const now = this.context.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(this.gains.get('sfx') ?? this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  private fallbackSweep(startFrequency: number, endFrequency: number, duration: number): void {
    if (!this.context || this.context.state !== 'running' || this.muted) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const now = this.context.currentTime;
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(startFrequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.11, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration + 0.05);
    oscillator.connect(gain).connect(this.gains.get('sfx') ?? this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.08);
  }

  private stopAmbience(): void {
    this.ambienceSource?.stop();
    this.ambienceSource?.disconnect();
    this.ambienceSource = null;
  }

  private startAmbience(): void {
    if (!this.context || this.context.state !== 'running' || this.muted || this.ambienceSource) return;
    const buffer = this.buffers.get('ambience');
    const output = this.gains.get('ambience');
    if (!buffer || !output) return;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(output);
    source.start();
    this.ambienceSource = source;
  }
}
