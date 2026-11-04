import {
  CircleGeometry,
  createSystem,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RingGeometry,
} from '@iwsdk/core';
import { beep } from './audio.js';
import { makeBird, makeButterfly, makeFish, makeSnail } from './creatures.js';
import { shapeState } from './hand-shapes.js';
import { modeState, puppetState } from './puppet.js';
import { makePanel } from './story.js';

type Kind = 'bird' | 'snail' | 'fish' | 'butterfly';
const KINDS: Kind[] = ['bird', 'snail', 'fish', 'butterfly'];

const CENTER = { x: 0, y: 1.4 };
const Z = -0.984;
const SHELF_Y = -0.225;
const ZONE_Y = -0.18; // below this line is the shelf zone (drop to remove)
const SHELF_X = [-0.27, -0.09, 0.09, 0.27];
const SHELF_SCALE = 0.5;
const PLACED_SCALE = 0.8;
const PER_KIND = 3;
const PICK_RADIUS = 0.08;
const HOLD_TO_TOGGLE = 2;
const RELEASE_FRAMES = 3;
const NOTE: Record<Kind, number> = {
  bird: 660,
  snail: 196,
  fish: 440,
  butterfly: 880,
};

type Critter = { group: Group; animate: (t: number) => void };
type Slot = {
  kind: Kind;
  critter: Critter;
  active: boolean;
  x: number;
  y: number;
  age: number;
};

function build(kind: Kind): Critter {
  if (kind === 'bird') {
    const b = makeBird();
    return {
      group: b.group,
      animate: (t) => {
        const flap = -0.3 + (0.5 + 0.5 * Math.sin(t * 10)) * 1.6;
        b.wingFront.rotation.z = flap;
        b.wingBack.rotation.z = flap * 0.8 - 0.1;
      },
    };
  }
  if (kind === 'snail') {
    const s = makeSnail();
    return {
      group: s.group,
      animate: (t) => {
        s.stalkA.rotation.z = Math.sin(t * 3) * 0.15;
        s.stalkB.rotation.z = Math.sin(t * 3 + 1.3) * 0.15;
      },
    };
  }
  if (kind === 'fish') {
    const f = makeFish();
    return {
      group: f.group,
      animate: (t) => {
        f.tail.rotation.z = Math.sin(t * 8) * 0.35;
        for (let i = 0; i < f.bubbles.length; i++) {
          const u = (t * 0.35 + i * 0.33) % 1;
          f.bubbles[i].position.set(
            0.12 + Math.sin(t * 3 + i) * 0.01,
            0.02 + u * 0.16,
            0,
          );
        }
      },
    };
  }
  const bf = makeButterfly();
  return {
    group: bf.group,
    animate: (t) => {
      const flap = 0.25 + 0.75 * Math.abs(Math.sin(t * 7));
      bf.wingR.scale.x = flap;
      bf.wingL.scale.x = -flap;
    },
  };
}

export class StudioSystem extends createSystem({}) {
  private root!: Group; // shelf, cursor and text: shown only in the Studio
  private placedRoot!: Group; // placed characters: shown only in the Studio
  private cursor!: Group;
  private shelf: Critter[] = [];
  private slots: Slot[] = [];
  private bothHeld = 0;
  private armed = true;
  private carrying: Slot | null = null;
  private wasPinch = false;
  private releaseCount = 0;
  private ageCounter = 0;

  init(): void {
    this.root = new Group();
    this.root.visible = false;
    this.placedRoot = new Group();
    this.placedRoot.visible = false;

    const strip = new Mesh(
      new PlaneGeometry(0.9, 0.1),
      new MeshBasicMaterial({ color: 0xe8d3a0 }),
    );
    strip.position.set(CENTER.x, CENTER.y + SHELF_Y, -0.988);
    this.root.add(strip);

    KINDS.forEach((kind, i) => {
      const c = build(kind);
      c.group.scale.setScalar(SHELF_SCALE);
      c.group.position.set(CENTER.x + SHELF_X[i], CENTER.y + SHELF_Y, Z);
      this.root.add(c.group);
      this.shelf.push(c);

      for (let n = 0; n < PER_KIND; n++) {
        const critter = build(kind);
        critter.group.scale.setScalar(PLACED_SCALE);
        critter.group.visible = false;
        this.placedRoot.add(critter.group);
        this.slots.push({ kind, critter, active: false, x: 0, y: 0, age: 0 });
      }
    });

    this.cursor = new Group();
    this.cursor.add(
      new Mesh(
        new RingGeometry(0.02, 0.03, 24),
        new MeshBasicMaterial({ color: 0x7a1030 }),
      ),
    );
    this.cursor.add(
      new Mesh(
        new CircleGeometry(0.008, 12),
        new MeshBasicMaterial({ color: 0xff5470 }),
      ),
    );
    this.root.add(this.cursor);

    const title = makePanel(1024, 220, 0.8, 0.172);
    title.mesh.position.set(0, 1.77, -0.98);
    title.set('Studio: build your scene', 64, '#f0d9a8');
    this.root.add(title.mesh);

    const hint = makePanel(1024, 120, 0.8, 0.094);
    hint.mesh.position.set(0, 1.0, -0.98);
    hint.set(
      'Pinch a character, carry it, let go. Drop below the paper to remove. Both hands pinch to exit',
      40,
      '#ffcf7a',
    );
    this.root.add(hint.mesh);

    this.world.createTransformEntity(this.root);
    this.world.createTransformEntity(this.placedRoot);
  }

  update(delta: number, time: number): void {
    // Both hands pinching for 2 seconds opens or closes the Studio.
    const both = shapeState.left === 'pinch' && shapeState.right === 'pinch';
    if (both) {
      if (this.armed) {
        this.bothHeld += delta;
        if (this.bothHeld >= HOLD_TO_TOGGLE) {
          this.toggle();
          this.armed = false;
          this.bothHeld = 0;
        }
      }
    } else {
      this.bothHeld = 0;
      this.armed = true;
    }

    if (!modeState.studio) {
      return;
    }

    for (const c of this.shelf) {
      c.animate(time);
    }
    for (const s of this.slots) {
      if (s.active) {
        s.critter.animate(time);
      }
    }

    this.cursor.position.set(
      CENTER.x + puppetState.x,
      CENTER.y + puppetState.y,
      Z + 0.002,
    );
    this.cursor.visible = this.carrying === null;

    // Right-hand pinch grabs; the left hand must not be pinching.
    const pinching = shapeState.right === 'pinch' && shapeState.left !== 'pinch';
    if (pinching) {
      this.releaseCount = 0;
      if (!this.wasPinch) {
        this.grab();
      }
      this.wasPinch = true;
    } else if (this.wasPinch) {
      this.releaseCount++;
      if (this.releaseCount >= RELEASE_FRAMES) {
        this.release();
        this.wasPinch = false;
      }
    }

    const held = this.carrying;
    if (held !== null) {
      held.x = puppetState.x;
      held.y = puppetState.y;
      held.critter.group.visible = true;
      held.critter.group.position.set(CENTER.x + held.x, CENTER.y + held.y, Z);
    }
  }

  private near(x: number, y: number): boolean {
    const dx = puppetState.x - x;
    const dy = puppetState.y - y;
    return dx * dx + dy * dy < PICK_RADIUS * PICK_RADIUS;
  }

  private grab(): void {
    // First try a character already on the stage (newest on top).
    let best: Slot | null = null;
    for (const s of this.slots) {
      if (s.active && this.near(s.x, s.y) && (best === null || s.age > best.age)) {
        best = s;
      }
    }
    // Otherwise take a new one from the shelf.
    if (best === null) {
      for (let i = 0; i < KINDS.length; i++) {
        if (this.near(SHELF_X[i], SHELF_Y)) {
          best = this.allocate(KINDS[i]);
          break;
        }
      }
    }
    if (best !== null) {
      this.ageCounter++;
      best.age = this.ageCounter;
      best.active = true;
      this.carrying = best;
      beep(NOTE[best.kind], 0.15);
    }
  }

  // An unused slot of this kind, or else the oldest one placed.
  private allocate(kind: Kind): Slot | null {
    let pick: Slot | null = null;
    for (const s of this.slots) {
      if (s.kind !== kind) {
        continue;
      }
      if (pick === null) {
        pick = s;
      } else if (!s.active && pick.active) {
        pick = s;
      } else if (s.active === pick.active && s.age < pick.age) {
        pick = s;
      }
    }
    return pick;
  }

  private release(): void {
    const s = this.carrying;
    this.carrying = null;
    if (s === null) {
      return;
    }
    if (s.y < ZONE_Y) {
      s.active = false;
      s.critter.group.visible = false;
      beep(150, 0.2, 'triangle');
    } else {
      beep(NOTE[s.kind], 0.2, 'triangle');
    }
  }

  private toggle(): void {
    modeState.studio = !modeState.studio;
    const on = modeState.studio;
    this.root.visible = on;
    this.placedRoot.visible = on;
    if (!on && this.carrying !== null) {
      this.release();
      this.wasPinch = false;
    }
    beep(on ? 523 : 392, 0.3, 'triangle');
  }
}