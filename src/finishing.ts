import {
  CanvasTexture,
  createSystem,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
} from '@iwsdk/core';
import { sceneryState } from './backdrops.js';
import { type HandShape, shapeState } from './hand-shapes.js';

const CAPTIONS: Record<HandShape, string> = {
  none: 'Right hand: make a shape',
  open: 'Open hand: a bird',
  fist: 'Fist: a snail',
  point: 'Point: a fish',
  pinch: 'Pinch: a butterfly',
};

const NOTES: Record<HandShape, number> = {
  none: 0,
  open: 660,
  fist: 196,
  point: 440,
  pinch: 880,
};

const STABLE_FRAMES = 5;

export class FinishingSystem extends createSystem({}) {
  private canvas!: HTMLCanvasElement;
  private texture!: CanvasTexture;
  private audio?: AudioContext;
  private shown: HandShape = 'none';
  private shownScenery = '';
  private candidate: HandShape = 'none';
  private count = 0;

  init(): void {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1024;
    this.canvas.height = 256;
    this.texture = new CanvasTexture(this.canvas);
    this.draw();

    const caption = new Mesh(
      new PlaneGeometry(0.9, 0.225),
      new MeshBasicMaterial({ map: this.texture, transparent: true }),
    );
    caption.position.set(0, 1.0, -0.98);
    this.world.createTransformEntity(caption);
  }

  update(): void {
    // The right hand is the puppet.
    const shape: HandShape = shapeState.right;
    let changed = false;

    if (shape === this.candidate) {
      this.count++;
    } else {
      this.candidate = shape;
      this.count = 0;
    }

    if (this.count === STABLE_FRAMES && this.candidate !== this.shown) {
      this.shown = this.candidate;
      this.playNote(NOTES[this.shown]);
      changed = true;
    }
    if (sceneryState.name !== this.shownScenery) {
      changed = true;
    }
    if (changed) {
      this.draw();
    }
  }

  private draw(): void {
    const ctx = this.canvas.getContext('2d');
    if (ctx === null) {
      return;
    }
    this.shownScenery = sceneryState.name;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = '#f0d9a8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 64px serif';
    ctx.fillText(CAPTIONS[this.shown], 512, 70);
    ctx.font = '42px serif';
    ctx.fillText('Scenery: ' + this.shownScenery, 512, 148);
    ctx.font = '34px serif';
    ctx.fillText('Left hand changes it: open / point / pinch / fist', 512, 205);
    this.texture.needsUpdate = true;
  }

  private playNote(freq: number): void {
    if (freq === 0) {
      return;
    }
    try {
      if (this.audio === undefined) {
        this.audio = new AudioContext();
      }
      const ctx = this.audio;
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch {
      // Audio is optional; ignore failures.
    }
  }
}