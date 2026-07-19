import Phaser from "phaser";
import "./style.css";

class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  create() {
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;

    this.add
      .text(centerX, centerY - 20, "NestledBurrow", {
        color: "#f4ead7",
        fontFamily: "Georgia, serif",
        fontSize: "42px",
      })
      .setOrigin(0.5);

    this.add
      .text(centerX, centerY + 32, "Технический запуск работает", {
        color: "#bfae91",
        fontFamily: "system-ui, sans-serif",
        fontSize: "18px",
      })
      .setOrigin(0.5);
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#201b18",
  width: 960,
  height: 540,
  scene: BootScene,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});
