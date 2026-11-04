import { createSystem } from '@iwsdk/core';
import { handPos } from './hand-shapes.js';

// Where the puppet sits relative to the paper's centre (metres).
export const puppetState = { x: 0, y: 0, facing: 1 };

// Shared mode flag: true while the Studio (build mode) is open.
export const modeState = { studio: false };

const X_GAIN = 1.8; // paper movement per metre of hand movement
const Y_GAIN = 1.5;
const LIMIT_X = 0.36;
const STORY_LIMIT_Y = 0.17;
const STUDIO_LIMIT_Y = 0.27; // reaches the shelf at the bottom

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export class PuppetSystem extends createSystem({}) {
  private wasTracked = false;
  private baseX = 0;
  private baseY = 0;

  update(delta: number): void {
    const h = handPos.right;
    const limitY = modeState.studio ? STUDIO_LIMIT_Y : STORY_LIMIT_Y;
    let tx = 0;
    let ty = 0;
    if (h.tracked) {
      if (!this.wasTracked) {
        // Centre the puppet on wherever the hand first appears.
        this.baseX = h.x;
        this.baseY = h.y;
      }
      tx = clamp((h.x - this.baseX) * X_GAIN, -LIMIT_X, LIMIT_X);
      ty = clamp((h.y - this.baseY) * Y_GAIN, -limitY, limitY);
    }
    this.wasTracked = h.tracked;

    const k = 1 - Math.exp(-delta * 10);
    const nx = puppetState.x + (tx - puppetState.x) * k;
    const dx = nx - puppetState.x;
    if (dx > 0.0004) {
      puppetState.facing = 1;
    } else if (dx < -0.0004) {
      puppetState.facing = -1;
    }
    puppetState.x = nx;
    puppetState.y += (ty - puppetState.y) * k;
  }
}