import {
  CanvasTexture,
  CatmullRomCurve3,
  CircleGeometry,
  createSystem,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  Path,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  Vector2,
  Vector3,
} from '@iwsdk/core';
import { type HandShape, shapeState } from './hand-shapes.js';
import { modeState, puppetState } from './puppet.js';

type Pt = [number, number];

const SCREEN = { x: 0, y: 1.4, z: -0.985 };
const BLACK = new MeshBasicMaterial({ color: 0x000000, side: DoubleSide });

// A smooth closed outline through the given points.
function smooth(pts: Pt[]): Shape {
  const curve = new CatmullRomCurve3(
    pts.map(([x, y]) => new Vector3(x, y, 0)),
    true,
    'centripetal',
  );
  return new Shape(curve.getPoints(90).map((v) => new Vector2(v.x, v.y)));
}

// A sharp-cornered outline (feathers, fins, tails).
function poly(pts: Pt[]): Shape {
  return new Shape(pts.map(([x, y]) => new Vector2(x, y)));
}

// Cuts a round hole so the scenery shows through, like cut leather.
function hole(shape: Shape, x: number, y: number, r: number): void {
  const p = new Path();
  p.absarc(x, y, r, 0, Math.PI * 2, true);
  shape.holes.push(p);
}

function mesh(shape: Shape, x = 0, y = 0): Mesh {
  const m = new Mesh(new ShapeGeometry(shape), BLACK);
  m.position.set(x, y, 0);
  return m;
}

function disc(r: number, x: number, y: number): Mesh {
  const m = new Mesh(new CircleGeometry(r, 20), BLACK);
  m.position.set(x, y, 0);
  return m;
}

export function makeBird() {
  const group = new Group();
  const body = smooth([
    [0.12, 0.012], [0.075, 0.04], [0.045, 0.03], [0.0, 0.035],
    [-0.12, 0.05], [-0.14, 0.02], [-0.11, 0.0], [-0.04, -0.03],
    [0.03, -0.035], [0.07, -0.015],
  ]);
  hole(body, 0.075, 0.024, 0.006);
  group.add(mesh(body));

  const wingShape = (): Shape =>
    poly([
      [0.02, 0], [-0.02, 0.06], [-0.08, 0.12], [-0.15, 0.15],
      [-0.12, 0.1], [-0.16, 0.1], [-0.11, 0.06], [-0.14, 0.05],
      [-0.08, 0.02], [-0.04, -0.005],
    ]);
  const wingBack = new Group();
  wingBack.position.set(-0.02, 0.03, 0);
  wingBack.add(mesh(wingShape()));
  const wingFront = new Group();
  wingFront.position.set(0.0, 0.03, 0);
  wingFront.add(mesh(wingShape()));
  group.add(wingBack, wingFront);
  return { group, wingBack, wingFront };
}

function makeStalk(): Group {
  const g = new Group();
  g.add(mesh(poly([[-0.004, 0], [0.004, 0], [0.003, 0.06], [-0.003, 0.06]])));
  g.add(disc(0.009, 0, 0.064));
  return g;
}

export function makeSnail() {
  const group = new Group();
  group.add(
    mesh(
      smooth([
        [0.13, 0.03], [0.105, 0.055], [0.075, 0.045], [0.03, 0.035],
        [-0.05, 0.035], [-0.13, 0.02], [-0.17, -0.005], [-0.12, -0.022],
        [0.0, -0.025], [0.1, -0.02], [0.14, 0.0],
      ]),
    ),
  );
  // Shell with a spiral of cut-out dots.
  const shell = new Shape();
  shell.absarc(0, 0, 0.075, 0, Math.PI * 2, false);
  for (let i = 0; i < 12; i++) {
    const t = i * 0.55;
    const r = 0.008 + i * 0.0052;
    hole(shell, Math.cos(t) * r, Math.sin(t) * r, 0.0035);
  }
  group.add(mesh(shell, -0.02, 0.075));

  const stalkA = makeStalk();
  stalkA.position.set(0.1, 0.045, 0);
  const stalkB = makeStalk();
  stalkB.position.set(0.125, 0.04, 0);
  group.add(stalkA, stalkB);
  return { group, stalkA, stalkB };
}

export function makeFish() {
  const group = new Group();
  const body = smooth([
    [0.1, 0.0], [0.06, 0.042], [0.0, 0.055], [-0.06, 0.032],
    [-0.09, 0.006], [-0.06, -0.03], [0.0, -0.05], [0.06, -0.036],
  ]);
  hole(body, 0.07, 0.012, 0.007);
  group.add(mesh(body));
  const tail = new Group();
  tail.position.set(-0.085, 0, 0);
  tail.add(mesh(poly([[0.01, 0], [-0.07, 0.06], [-0.05, 0], [-0.07, -0.06]])));
  group.add(tail);
  group.add(mesh(poly([[0.02, 0.05], [-0.03, 0.095], [-0.06, 0.03]])));
  group.add(mesh(poly([[0.02, -0.045], [-0.02, -0.085], [-0.04, -0.03]])));
  const bubbles = [disc(0.007, 0, 0), disc(0.005, 0, 0), disc(0.009, 0, 0)];
  bubbles.forEach((b) => group.add(b));
  return { group, tail, bubbles };
}

function makeWing(): Group {
  const g = new Group();
  const upper = smooth([
    [0.005, 0.012], [0.04, 0.075], [0.1, 0.095], [0.125, 0.055],
    [0.095, 0.012], [0.03, -0.004],
  ]);
  hole(upper, 0.075, 0.05, 0.012);
  hole(upper, 0.045, 0.03, 0.006);
  const lower = smooth([
    [0.005, -0.006], [0.07, -0.02], [0.095, -0.065], [0.055, -0.095],
    [0.012, -0.055],
  ]);
  hole(lower, 0.05, -0.05, 0.01);
  g.add(mesh(upper), mesh(lower));
  return g;
}

export function makeButterfly() {
  const group = new Group();
  const wingR = makeWing();
  const wingL = makeWing();
  group.add(wingR, wingL);
  group.add(
    mesh(
      smooth([[0, 0.07], [0.008, 0.0], [0.006, -0.07], [-0.006, -0.07], [-0.008, 0.0]]),
    ),
  );
  group.add(mesh(poly([[0.0, 0.065], [-0.04, 0.12], [-0.037, 0.123], [0.003, 0.068]])));
  group.add(mesh(poly([[0.0, 0.065], [0.04, 0.12], [0.037, 0.123], [-0.003, 0.068]])));
  return { group, wingR, wingL };
}

// Warm lantern glow: bright in the middle, darker at the paper's edges.
function makeGlow(): MeshBasicMaterial {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (ctx !== null) {
    const g = ctx.createRadialGradient(128, 80, 20, 128, 80, 150);
    g.addColorStop(0, 'rgba(255,200,120,0)');
    g.addColorStop(0.6, 'rgba(120,60,10,0.15)');
    g.addColorStop(1, 'rgba(20,8,0,0.7)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 160);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return new MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
}

export class CreatureSystem extends createSystem({}) {
  private bird!: ReturnType<typeof makeBird>;
  private snail!: ReturnType<typeof makeSnail>;
  private fish!: ReturnType<typeof makeFish>;
  private butterfly!: ReturnType<typeof makeButterfly>;
  private glow!: MeshBasicMaterial;

  init(): void {
    this.bird = makeBird();
    this.snail = makeSnail();
    this.fish = makeFish();
    this.butterfly = makeButterfly();

    for (const g of [
      this.bird.group,
      this.snail.group,
      this.fish.group,
      this.butterfly.group,
    ]) {
      g.position.set(SCREEN.x, SCREEN.y, SCREEN.z);
      g.visible = false;
      this.world.createTransformEntity(g);
    }

    this.glow = makeGlow();
    const glowPlane = new Mesh(new PlaneGeometry(0.9, 0.55), this.glow);
    glowPlane.position.set(0, 1.4, -0.99);
    this.world.createTransformEntity(glowPlane);
  }

  update(_delta: number, time: number): void {
    // The right hand is the puppet; the left hand sets the scenery.
    // While the Studio is open, the live puppet is hidden.
    const shape: HandShape = modeState.studio ? 'none' : shapeState.right;

    this.bird.group.visible = shape === 'open';
    this.snail.group.visible = shape === 'fist';
    this.fish.group.visible = shape === 'point';
    this.butterfly.group.visible = shape === 'pinch';

    // Lantern flicker.
    this.glow.opacity =
      0.82 + Math.sin(time * 7) * 0.06 + Math.sin(time * 13.7) * 0.04;

    // The puppet follows the right hand.
    const px = SCREEN.x + puppetState.x;
    const py = SCREEN.y + puppetState.y + Math.sin(time * 2.1) * 0.008;
    const facing = puppetState.facing;

    if (shape === 'open') {
      const b = this.bird;
      b.group.position.set(px, py, SCREEN.z);
      b.group.scale.x = facing;
      const flap = -0.3 + (0.5 + 0.5 * Math.sin(time * 10)) * 1.6;
      b.wingFront.rotation.z = flap;
      b.wingBack.rotation.z = flap * 0.8 - 0.1;
    } else if (shape === 'fist') {
      const s = this.snail;
      s.group.position.set(px, py - 0.03, SCREEN.z);
      s.group.scale.x = facing;
      s.stalkA.rotation.z = Math.sin(time * 3) * 0.15;
      s.stalkB.rotation.z = Math.sin(time * 3 + 1.3) * 0.15;
    } else if (shape === 'point') {
      const f = this.fish;
      f.group.position.set(px, py, SCREEN.z);
      f.group.scale.x = facing;
      f.tail.rotation.z = Math.sin(time * 8) * 0.35;
      for (let i = 0; i < f.bubbles.length; i++) {
        const t = (time * 0.35 + i * 0.33) % 1;
        f.bubbles[i].position.set(
          0.12 + Math.sin(time * 3 + i) * 0.01,
          0.02 + t * 0.16,
          0,
        );
      }
    } else if (shape === 'pinch') {
      const bf = this.butterfly;
      bf.group.position.set(px, py, SCREEN.z);
      const flap = 0.25 + 0.75 * Math.abs(Math.sin(time * 7));
      bf.wingR.scale.x = flap;
      bf.wingL.scale.x = -flap;
      bf.group.rotation.z = Math.sin(time * 1.6) * 0.15;
    }
  }
}