/* ===========================================================
 * Phaser 启动器：uni-app 页面中调用 startGame(container, hooks)
 * =========================================================== */

import Phaser from 'phaser';
import GuandanScene, { W, H } from './scenes/GameScene.js';

let game = null;

export function startGame(parent, hooks = {}) {
  if (game) {
    game.destroy(true);
    game = null;
  }

  const config = {
    type: Phaser.AUTO,
    parent,
    width: W,
    height: H,
    backgroundColor: '#0b3a24',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    render: { antialias: true, roundPixels: false },
    scene: [GuandanScene]
  };

  game = new Phaser.Game(config);

  game.events.once('ready', () => {
    const sc = game.scene.getScene('guandan');
    if (sc && hooks.onExit) sc.onExit = hooks.onExit;
    // 便于自动化测试与调试
    // #ifdef H5
    window.__gdGame = game;
    window.__gdScene = sc;
    // #endif
  });

  return game;
}

export function destroyGame() {
  if (game) {
    game.destroy(true);
    game = null;
  }
}

export default { startGame, destroyGame };
