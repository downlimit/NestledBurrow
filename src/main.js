import Phaser from "phaser";
import "./style.css";

const GAME_WIDTH = 960;
const GAME_HEIGHT = 540;
const WALL_SIZE = 24;
const PLAYER_SIZE = 32;
const PLAYER_SPEED = 260;

class RoomScene extends Phaser.Scene {
  constructor() {
    super("room");
  }

  create() {
    this.roomBounds = new Phaser.Geom.Rectangle(
      WALL_SIZE,
      WALL_SIZE,
      GAME_WIDTH - WALL_SIZE * 2,
      GAME_HEIGHT - WALL_SIZE * 2,
    );

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x25211d);
    this.add.rectangle(GAME_WIDTH / 2, WALL_SIZE / 2, GAME_WIDTH, WALL_SIZE, 0x6d5f4b);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - WALL_SIZE / 2, GAME_WIDTH, WALL_SIZE, 0x4f6a57);
    this.add.rectangle(WALL_SIZE / 2, GAME_HEIGHT / 2, WALL_SIZE, GAME_HEIGHT, 0x5f4c6b);
    this.add.rectangle(GAME_WIDTH - WALL_SIZE / 2, GAME_HEIGHT / 2, WALL_SIZE, GAME_HEIGHT, 0x6a4f4a);

    this.player = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      PLAYER_SIZE,
      PLAYER_SIZE,
      0xd9c18f,
    );

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys("W,A,S,D");
  }

  update(_time, delta) {
    const left = this.cursors.left.isDown || this.wasd.A.isDown;
    const right = this.cursors.right.isDown || this.wasd.D.isDown;
    const up = this.cursors.up.isDown || this.wasd.W.isDown;
    const down = this.cursors.down.isDown || this.wasd.S.isDown;

    const direction = new Phaser.Math.Vector2(
      Number(right) - Number(left),
      Number(down) - Number(up),
    );

    if (direction.lengthSq() === 0) {
      return;
    }

    direction.normalize().scale(PLAYER_SPEED * (delta / 1000));

    this.player.x = Phaser.Math.Clamp(
      this.player.x + direction.x,
      this.roomBounds.left + PLAYER_SIZE / 2,
      this.roomBounds.right - PLAYER_SIZE / 2,
    );
    this.player.y = Phaser.Math.Clamp(
      this.player.y + direction.y,
      this.roomBounds.top + PLAYER_SIZE / 2,
      this.roomBounds.bottom - PLAYER_SIZE / 2,
    );
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#201b18",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  scene: RoomScene,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});