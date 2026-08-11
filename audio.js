/**
 * 戳戳樂 — 音效：戳開（click ogg）＋ Web Audio 合成中獎／銘謝／過關。
 */
export class StamppadAudio {
  constructor() {
    this.enabled = true;
    this.ctx = null;
    this.cache = {};
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
  }

  async unlock() {
    this.ensure();
    if (this.ctx?.state === "suspended") await this.ctx.resume();
  }

  setEnabled(on) {
    this.enabled = on;
  }

  playFile(src, volume = 0.5) {
    if (!this.enabled) return;
    this.ensure();
    const ctx = this.ctx;
    if (!ctx) return;
    if (!this.cache[src]) {
      const a = new Audio(src);
      a.preload = "auto";
      this.cache[src] = a;
    }
    const a = this.cache[src];
    a.volume = volume;
    a.currentTime = 0;
    const p = a.play();
    if (p && p.catch) p.catch(() => {});
  }

  tone(freq, dur, type = "square", gain = 0.08, when = 0) {
    if (!this.enabled) return;
    this.ensure();
    const ctx = this.ctx;
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain * 0.6, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(0.05, dur));
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.04);
  }

  punch() {
    this.playFile("assets/sfx/click1.ogg", 0.6);
  }

  prize() {
    this.tone(523, 0.09, "square", 0.09);
    this.tone(784, 0.12, "square", 0.09, 0.08);
  }

  again() {
    this.playFile("assets/sfx/switch1.ogg", 0.45);
    this.tone(659, 0.07, "triangle", 0.07);
    this.tone(880, 0.07, "triangle", 0.07, 0.07);
  }

  bust() {
    this.tone(220, 0.1, "sawtooth", 0.06);
  }

  win() {
    const seq = [523, 659, 784, 1047];
    seq.forEach((f, i) => this.tone(f, 0.14, "square", 0.09, i * 0.11));
    this.tone(1319, 0.4, "square", 0.08, 0.46);
  }
}