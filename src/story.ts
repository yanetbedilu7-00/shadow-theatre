import {
  CanvasTexture,
  CircleGeometry,
  createSystem,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from '@iwsdk/core';
import { beep } from './audio.js';
import { type Scenery, sceneryRequest } from './backdrops.js';
import { type HandShape, shapeState } from './hand-shapes.js';
import { modeState, puppetState } from './puppet.js';

type Pt = [number, number];

type Step = {
  text: string; // narration, shown above the paper
  hint: string; // what to do, shown below the paper
  backdrop?: Scenery; // switch scenery when the step starts
  shape?: HandShape; // right-hand shape required (any shape if omitted)
  goal?: Pt; // glowing goal, in metres from the paper's centre
  leftHand?: boolean; // complete when the left hand makes any shape
  hold?: number; // seconds to hold before the step completes
};

const CENTER = { x: 0, y: 1.4 };
const GOAL_Z = -0.987;
const GOAL_RADIUS = 0.07;
const HOLD = 0.8;
const NOTE_FRAMES = 5;
const TALE_START = 6;

// Landmarks painted in the backdrops, converted to metres from the centre.
const MOON: Pt = [0.246, 0.143];
const WINDOW: Pt = [-0.165, -0.118];
const FIREFLY: Pt = [-0.2, 0.03];
const LIGHT: Pt = [0.22, 0.06];

const NOTES: Record<HandShape, number> = {
  none: 0,
  open: 660,
  fist: 196,
  point: 440,
  pinch: 880,
};

const STEPS: Step[] = [
  // Onboarding
  { text: 'Welcome! Your right hand is the puppet.', hint: 'Open your hand: a bird', shape: 'open' },
  { text: 'Every shape is a new puppet.', hint: 'Make a fist: a snail', shape: 'fist' },
  { text: 'Keep going.', hint: 'Point one finger: a fish', shape: 'point' },
  { text: 'One more.', hint: 'Pinch thumb and finger: a butterfly', shape: 'pinch' },
  { text: 'Now move your hand and the puppet follows.', hint: 'Guide it to the glowing light', goal: LIGHT },
  { text: 'Your left hand paints the scenery.', hint: 'Left hand: open, point, pinch or fist', leftHand: true },
  // The tale
  { text: 'A little bird dreamed of touching the moon.', hint: 'Open hand: fly to the glowing moon', backdrop: 'hills', shape: 'open', goal: MOON },
  { text: 'But the forest was dark, so she followed a firefly.', hint: 'Open hand: follow the firefly', backdrop: 'forest', shape: 'open', goal: FIREFLY },
  { text: 'In the village, a butterfly lit the way home.', hint: 'Pinch: reach the window light', backdrop: 'village', shape: 'pinch', goal: WINDOW },
  { text: 'And at last, the little bird touched the moon.', hint: 'Open hand: fly to the moon', backdrop: 'hills', shape: 'open', goal: MOON },
  { text: 'The End.', hint: 'Fist: tell it again. Both hands pinch: Studio', backdrop: 'hills', shape: 'fist', hold: 1 },
];

export function makePanel(
  canvasW: number,
  canvasH: number,
  planeW: number,
  planeH: number,
) {
  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  const mesh = new Mesh(
    new PlaneGeometry(planeW, planeH),
    new MeshBasicMaterial({ map: texture, transparent: true }),
  );
  let last = '';

  function set(text: string, size: number, color: string): void {
    const key = text + '|' + size + '|' + color;
    if (key === last) {
      return;
    }
    last = key;
    const ctx = canvas.getContext('2d');
    if (ctx === null) {
      return;
    }
    ctx.clearRect(0, 0, canvasW, canvasH);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold ' + size + 'px serif';

    // Break long text into two lines, then shrink until it fits.
    const words = text.split(' ');
    let lines = [text];
    if (ctx.measureText(text).width > canvasW - 60 && words.length > 3) {
      const mid = Math.ceil(words.length / 2);
      lines = [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
    }
    let s = size;
    const widest = (): number =>
      Math.max(...lines.map((l) => ctx.measureText(l).width));
    while (widest() > canvasW - 60 && s > 18) {
      s -= 2;
      ctx.font = 'bold ' + s + 'px serif';
    }
    const lineHeight = s * 1.15;
    lines.forEach((l, i) => {
      ctx.fillText(
        l,
        canvasW / 2,
        canvasH / 2 + (i - (lines.length - 1) / 2) * lineHeight,
      );
    });
    texture.needsUpdate = true;
  }

  return { mesh, set };
}

export class StorySystem extends createSystem({}) {
  private narration!: ReturnType<typeof makePanel>;
  private hintPanel!: ReturnType<typeof makePanel>;
  private marker!: Group;
  private index = 0;
  private progress = 0;
  private paused = false;
  private stable: HandShape = 'none';
  private candidate: HandShape = 'none';
  private candidateFrames = 0;

  init(): void {
    this.narration = makePanel(1024, 220, 0.8, 0.172);
    this.narration.mesh.position.set(0, 1.77, -0.98);
    this.world.createTransformEntity(this.narration.mesh);

    this.hintPanel = makePanel(1024, 120, 0.8, 0.094);
    this.hintPanel.mesh.position.set(0, 1.0, -0.98);
    this.world.createTransformEntity(this.hintPanel.mesh);

    this.marker = new Group();
    const outer = new Mesh(
      new CircleGeometry(0.032, 24),
      new MeshBasicMaterial({ color: 0x7a1030 }),
    );
    const mid = new Mesh(
      new CircleGeometry(0.021, 24),
      new MeshBasicMaterial({ color: 0xff5470 }),
    );
    const core = new Mesh(
      new CircleGeometry(0.009, 16),
      new MeshBasicMaterial({ color: 0xffffff }),
    );
    mid.position.z = 0.0003;
    core.position.z = 0.0006;
    this.marker.add(outer, mid, core);
    this.marker.visible = false;
    this.world.createTransformEntity(this.marker);

    this.enter(0);
  }

  update(delta: number, time: number): void {
    // The story pauses while the Studio is open.
    if (modeState.studio) {
      if (!this.paused) {
        this.paused = true;
        this.narration.mesh.visible = false;
        this.hintPanel.mesh.visible = false;
        this.marker.visible = false;
      }
      return;
    }
    if (this.paused) {
      this.paused = false;
      this.narration.mesh.visible = true;
      this.hintPanel.mesh.visible = true;
      this.marker.visible = STEPS[this.index].goal !== undefined;
    }

    const step = STEPS[this.index];
    const shape = shapeState.right;

    // A note when the puppet changes shape (waits a few frames to avoid flicker).
    if (shape === this.candidate) {
      this.candidateFrames++;
    } else {
      this.candidate = shape;
      this.candidateFrames = 0;
    }
    if (this.candidateFrames === NOTE_FRAMES && this.candidate !== this.stable) {
      this.stable = this.candidate;
      if (NOTES[this.stable] > 0) {
        beep(NOTES[this.stable]);
      }
    }

    // Is the step's condition met right now?
    let ok = false;
    if (step.leftHand === true) {
      ok = shapeState.left !== 'none';
    } else {
      const shapeOk =
        step.shape !== undefined ? shape === step.shape : shape !== 'none';
      if (step.goal !== undefined) {
        const dx = puppetState.x - step.goal[0];
        const dy = puppetState.y - step.goal[1];
        ok = shapeOk && dx * dx + dy * dy < GOAL_RADIUS * GOAL_RADIUS;
      } else {
        ok = shapeOk;
      }
    }

    const hold = step.hold ?? HOLD;
    this.progress = ok
      ? Math.min(hold, this.progress + delta)
      : Math.max(0, this.progress - delta * 2);

    if (step.goal !== undefined) {
      this.marker.scale.setScalar(
        1 + Math.sin(time * 5) * 0.12 + (this.progress / hold) * 0.9,
      );
    }
    this.refreshHint(step, hold);

    if (this.progress >= hold) {
      beep(660, 0.3, 'triangle');
      beep(880, 0.4, 'triangle');
      const next = this.index + 1;
      this.enter(next >= STEPS.length ? TALE_START : next);
    }
  }

  private enter(i: number): void {
    this.index = i;
    this.progress = 0;
    const step = STEPS[i];
    if (step.backdrop !== undefined) {
      sceneryRequest.value = step.backdrop;
    }
    this.narration.set(step.text, 60, '#f0d9a8');
    if (step.goal !== undefined) {
      this.marker.visible = true;
      this.marker.position.set(
        CENTER.x + step.goal[0],
        CENTER.y + step.goal[1],
        GOAL_Z,
      );
    } else {
      this.marker.visible = false;
    }
    this.refreshHint(step, step.hold ?? HOLD);
  }

  private refreshHint(step: Step, hold: number): void {
    const filled = Math.min(5, Math.floor((this.progress / hold) * 5));
    this.hintPanel.set(
      step.hint + '   ' + '■'.repeat(filled) + '□'.repeat(5 - filled),
      46,
      '#ffcf7a',
    );
  }
}