import {
  CanvasTexture,
  createSystem,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from '@iwsdk/core';
import { type HandShape, shapeState } from './hand-shapes.js';

export type Scenery = 'plain' | 'hills' | 'forest' | 'village';

// Shared so captions can show the current scenery name.
export const sceneryState = { name: 'Plain paper' };

// The story can request a scenery; the left hand is then ignored until it changes.
export const sceneryRequest: { value: Scenery | null } = { value: null };
let ignoreLeft: HandShape | null = null;

const W = 1024;
const H = 626;
const STABLE_FRAMES = 6;

const SCENERY_FOR: Partial<Record<HandShape, Scenery>> = {
  open: 'hills',
  point: 'forest',
  pinch: 'village',
  fist: 'plain',
};

const NAMES: Record<Scenery, string> = {
  plain: 'Plain paper',
  hills: 'Moonlit hills',
  forest: 'Forest',
  village: 'Village at sunset',
};

function gradient(ctx: CanvasRenderingContext2D, top: string, bottom: string): void {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function hillLayer(
  ctx: CanvasRenderingContext2D,
  base: number,
  amp: number,
  color: string,
  phase: number,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 16) {
    ctx.lineTo(x, base + Math.sin(x * 0.006 + phase) * amp);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();
}

function paintPlain(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#f0d9a8';
  ctx.fillRect(0, 0, W, H);
}

function paintHills(ctx: CanvasRenderingContext2D): void {
  gradient(ctx, '#b9c4e4', '#f3e6c8');
  ctx.fillStyle = '#fff6dc';
  ctx.beginPath();
  ctx.arc(780, 150, 60, 0, Math.PI * 2);
  ctx.fill();
  hillLayer(ctx, H * 0.62, 60, '#8c9bc0', 0);
  hillLayer(ctx, H * 0.74, 50, '#667aa6', 2);
  hillLayer(ctx, H * 0.88, 40, '#475a85', 4);
}

function tree(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  height: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, baseY - height);
  ctx.lineTo(x + 45, baseY);
  ctx.lineTo(x - 45, baseY);
  ctx.closePath();
  ctx.fill();
}

function paintForest(ctx: CanvasRenderingContext2D): void {
  gradient(ctx, '#dfe6b8', '#f3e6c8');
  for (let i = 0; i < 16; i++) {
    tree(ctx, i * 70 + 10, H * 0.9, 180 + (i % 3) * 50, '#5a7a54');
  }
  ctx.fillStyle = '#35503a';
  ctx.fillRect(0, H * 0.9, W, H * 0.1);
}

function paintVillage(ctx: CanvasRenderingContext2D): void {
  gradient(ctx, '#f08a4b', '#fbe0b0');
  ctx.fillStyle = '#fff1c4';
  ctx.beginPath();
  ctx.arc(250, 260, 70, 0, Math.PI * 2);
  ctx.fill();
  const houses: Array<[number, number, number]> = [
    [60, 150, 120],
    [260, 130, 160],
    [440, 170, 130],
    [660, 140, 170],
    [840, 150, 120],
  ];
  const ground = H * 0.9;
  for (const [x, hw, hh] of houses) {
    ctx.fillStyle = '#7a4e3a';
    ctx.fillRect(x, ground - hh, hw, hh);
    ctx.fillStyle = '#5a3626';
    ctx.beginPath();
    ctx.moveTo(x - 12, ground - hh);
    ctx.lineTo(x + hw / 2, ground - hh - 55);
    ctx.lineTo(x + hw + 12, ground - hh);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffd98a';
    ctx.fillRect(x + hw / 2 - 12, ground - hh + 30, 24, 28);
  }
  ctx.fillStyle = '#4a2f24';
  ctx.fillRect(0, ground, W, H - ground);
}

const PAINTERS: Record<Scenery, (ctx: CanvasRenderingContext2D) => void> = {
  plain: paintPlain,
  hills: paintHills,
  forest: paintForest,
  village: paintVillage,
};

export class BackdropSystem extends createSystem({}) {
  private canvas!: HTMLCanvasElement;
  private texture!: CanvasTexture;
  private current: Scenery = 'plain';
  private candidate: Scenery = 'plain';
  private count = 0;

  init(): void {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.paint('plain');

    // Sits just in front of the paper (z -1.0) and behind the creatures.
    const plane = new Mesh(
      new PlaneGeometry(0.9, 0.55),
      new MeshBasicMaterial({ map: this.texture }),
    );
    plane.position.set(0, 1.4, -0.995);
    this.world.createTransformEntity(plane);
  }

  update(): void {
    if (sceneryRequest.value !== null) {
      this.current = sceneryRequest.value;
      this.candidate = this.current;
      this.count = 0;
      this.paint(this.current);
      sceneryRequest.value = null;
      ignoreLeft = shapeState.left;
    }
    if (ignoreLeft !== null) {
      if (shapeState.left === ignoreLeft) {
        return;
      }
      ignoreLeft = null;
    }

    const next = SCENERY_FOR[shapeState.left];
    if (next === undefined) {
      this.count = 0;
      return;
    }
    if (next === this.candidate) {
      this.count++;
    } else {
      this.candidate = next;
      this.count = 0;
    }
    if (this.count === STABLE_FRAMES && this.candidate !== this.current) {
      this.current = this.candidate;
      this.paint(this.current);
    }
  }

  private paint(scenery: Scenery): void {
    const ctx = this.canvas.getContext('2d');
    if (ctx === null) {
      return;
    }
    PAINTERS[scenery](ctx);
    this.texture.needsUpdate = true;
    sceneryState.name = NAMES[scenery];
  }
}