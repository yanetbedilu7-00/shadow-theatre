import { createSystem } from '@iwsdk/core';

export type HandShape = 'none' | 'open' | 'fist' | 'point' | 'pinch';
export type Side = 'left' | 'right';

// Shared with other systems (creatures, backdrops and the story read this).
export const shapeState: Record<Side, HandShape> = {
  left: 'none',
  right: 'none',
};

// Wrist position in metres (x = right, y = up), shared the same way.
export const handPos: Record<Side, { x: number; y: number; tracked: boolean }> = {
  left: { x: 0, y: 0, tracked: false },
  right: { x: 0, y: 0, tracked: false },
};

// Standard WebXR hand joints: 25 per hand, each stored as a 4x4 matrix
// (16 floats). Position is at offsets 12, 13, 14 of each matrix.
const WRIST = 0;
const THUMB_TIP = 4;
const INDEX_PROX = 6;
const INDEX_TIP = 9;
const MIDDLE_PROX = 11;
const MIDDLE_TIP = 14;
const RING_PROX = 16;
const RING_TIP = 19;
const PINKY_PROX = 21;
const PINKY_TIP = 24;

const EXTENDED_RATIO = 1.5; // fingertip is 1.5x farther from wrist than its knuckle
const PINCH_DISTANCE = 0.03; // metres between thumb tip and index tip
const MIN_LENGTH = 25 * 16;

function dist(t: Float32Array, a: number, b: number): number {
  return Math.hypot(
    t[a * 16 + 12] - t[b * 16 + 12],
    t[a * 16 + 13] - t[b * 16 + 13],
    t[a * 16 + 14] - t[b * 16 + 14],
  );
}

function extended(t: Float32Array, prox: number, tip: number): boolean {
  return dist(t, WRIST, tip) > dist(t, WRIST, prox) * EXTENDED_RATIO;
}

function classify(t: Float32Array): HandShape {
  if (t.length < MIN_LENGTH) {
    return 'none';
  }
  const index = extended(t, INDEX_PROX, INDEX_TIP);
  const middle = extended(t, MIDDLE_PROX, MIDDLE_TIP);
  const ring = extended(t, RING_PROX, RING_TIP);
  const pinky = extended(t, PINKY_PROX, PINKY_TIP);

  if (dist(t, THUMB_TIP, INDEX_TIP) < PINCH_DISTANCE) {
    return 'pinch';
  }
  if (index && !middle && !ring && !pinky) {
    return 'point';
  }
  if (index && middle && ring && pinky) {
    return 'open';
  }
  if (!index && !middle && !ring && !pinky) {
    return 'fist';
  }
  return 'none';
}

export class HandShapeSystem extends createSystem({}) {
  private shapes: Record<Side, HandShape> = { left: 'none', right: 'none' };
  private hasData: Record<Side, boolean> = { left: false, right: false };
  private label!: HTMLDivElement;
  private lastShown = '';

  init(): void {
    this.label = document.createElement('div');
    this.label.style.cssText =
      'position:fixed;top:8px;left:8px;padding:8px 12px;background:#000a;' +
      'color:#fff;font:16px monospace;z-index:9999;pointer-events:none';
    document.body.appendChild(this.label);
    this.cleanupFuncs.push(() => this.label.remove());
  }

  getShape(side: Side): HandShape {
    return this.shapes[side];
  }

  update(): void {
    const adapters = this.input.xr.visualAdapters.hand;
    this.read('left', adapters.left.jointTransforms);
    this.read('right', adapters.right.jointTransforms);

    const text =
      'L: ' + this.describe('left') + '   R: ' + this.describe('right');
    if (text !== this.lastShown) {
      this.lastShown = text;
      this.label.textContent = text;
    }
  }

  private read(side: Side, t: Float32Array | undefined): void {
    this.hasData[side] = t !== undefined && t.length >= MIN_LENGTH;
    this.shapes[side] = this.hasData[side]
      ? classify(t as Float32Array)
      : 'none';
    shapeState[side] = this.shapes[side];

    handPos[side].tracked = this.hasData[side];
    if (this.hasData[side]) {
      const joints = t as Float32Array;
      handPos[side].x = joints[12];
      handPos[side].y = joints[13];
    }
  }

  private describe(side: Side): string {
    return this.hasData[side] ? this.shapes[side] : 'no joint data';
  }
}