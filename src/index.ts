/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { VisibilityState, World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { BackdropSystem } from './backdrops.js';
import { CreatureSystem } from './creatures.js';
import { HandShapeSystem } from './hand-shapes.js';
import { PanelSystem } from './panel.js';
import { PuppetSystem } from './puppet.js';
import { RobotSystem } from './robot.js';
import { StorySystem } from './story.js';
import { TheatreSystem } from './theatre.js';

type Game = Awaited<ReturnType<typeof World.create>>;

const NOT_AVAILABLE =
  'Open this page in a Meta Quest browser, or use Chrome with the Immersive Web Emulator extension.';

// The button is created first, so it appears even if something else fails.
const button = document.createElement('button');
button.textContent = 'Enter VR';
button.style.cssText =
  'position:fixed;bottom:28px;left:50%;transform:translateX(-50%);' +
  'padding:14px 32px;font:bold 20px serif;background:#f0d9a8;color:#2a1a10;' +
  'border:0;border-radius:999px;z-index:9999;cursor:pointer';

const note = document.createElement('div');
note.style.cssText =
  'position:fixed;bottom:86px;left:50%;transform:translateX(-50%);' +
  'max-width:80vw;text-align:center;font:16px serif;color:#f0d9a8;' +
  'z-index:9999;pointer-events:none';

document.body.append(button, note);

function markUnavailable(): void {
  button.disabled = true;
  button.textContent = 'VR not available';
  note.textContent = NOT_AVAILABLE;
}

const support = navigator.xr?.isSessionSupported('immersive-vr');
if (support === undefined) {
  markUnavailable();
} else {
  support.then(
    (supported) => {
      if (!supported) {
        markUnavailable();
      }
    },
    () => markUnavailable(),
  );
}

let game: Game | undefined;
button.onclick = () => {
  if (game === undefined) {
    note.textContent = 'Still loading. Try again in a moment.';
    return;
  }
  void game.launchXR();
};

World.create(
  document.getElementById('scene-container') as HTMLDivElement,
  projectOptions,
)
  .then((world) => {
    game = world;

    // Each system starts on its own, so one failure can't break the others.
    const start = (name: string, register: () => void): void => {
      try {
        register();
      } catch (error) {
        console.error('Could not start ' + name, error);
      }
    };
    start('robot', () => world.registerSystem(RobotSystem));
    start('panel', () => world.registerSystem(PanelSystem));
    start('hands', () => world.registerSystem(HandShapeSystem));
    start('puppet', () => world.registerSystem(PuppetSystem));
    start('theatre', () => world.registerSystem(TheatreSystem));
    start('backdrops', () => world.registerSystem(BackdropSystem));
    start('creatures', () => world.registerSystem(CreatureSystem));
    start('story', () => world.registerSystem(StorySystem));

    // Hide the button while a VR session is running.
    world.visibilityState.subscribe((state) => {
      const immersive =
        state === VisibilityState.Visible ||
        state === VisibilityState.VisibleBlurred;
      button.style.display = immersive ? 'none' : 'block';
      note.style.display = immersive ? 'none' : 'block';
    });
  })
  .catch((error) => {
    console.error('Could not start the theatre', error);
    note.textContent = 'Could not start the theatre. Please reload the page.';
  });