import {
  BackSide,
  BoxGeometry,
  createSystem,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SphereGeometry,
} from '@iwsdk/core';

// Sizes are in meters. The paper screen is kept small and close so it fits
// inside the narrow Meta VR Glasses view (about 37 degrees left and right).
const SCREEN_W = 0.9;
const SCREEN_H = 0.55;
const SCREEN_POS = { x: 0, y: 1.4, z: -1.0 };

export class TheatreSystem extends createSystem({}) {
  init(): void {
    // Dark room: an inside-out sphere that hides the template scene.
    const room = new Mesh(
      new SphereGeometry(1.4, 32, 16),
      new MeshBasicMaterial({ color: 0x07060c, side: BackSide }),
    );
    room.position.set(0, 1.5, 0);
    this.world.createTransformEntity(room);

    // Wooden frame behind the paper.
    const frame = new Mesh(
      new BoxGeometry(SCREEN_W + 0.08, SCREEN_H + 0.08, 0.03),
      new MeshBasicMaterial({ color: 0x2a1a10 }),
    );
    frame.position.set(SCREEN_POS.x, SCREEN_POS.y, SCREEN_POS.z - 0.025);
    this.world.createTransformEntity(frame);

    // Glowing paper screen where the shadows will appear.
    const paper = new Mesh(
      new PlaneGeometry(SCREEN_W, SCREEN_H),
      new MeshBasicMaterial({ color: 0xf0d9a8 }),
    );
    paper.position.set(SCREEN_POS.x, SCREEN_POS.y, SCREEN_POS.z);
    this.world.createTransformEntity(paper);

    // Lantern: a warm glowing ball with a soft halo.
    const lantern = new Mesh(
      new SphereGeometry(0.06, 16, 12),
      new MeshBasicMaterial({ color: 0xffb347 }),
    );
    lantern.position.set(0.55, 0.95, -0.8);
    this.world.createTransformEntity(lantern);

    const halo = new Mesh(
      new SphereGeometry(0.13, 16, 12),
      new MeshBasicMaterial({
        color: 0xff9a2e,
        transparent: true,
        opacity: 0.25,
      }),
    );
    halo.position.copy(lantern.position);
    this.world.createTransformEntity(halo);
  }
}