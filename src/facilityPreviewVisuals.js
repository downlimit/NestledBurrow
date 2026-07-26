export function drawFacility(graphics, type, tint = null) {
  const color = (value) => tint ?? value;
  if (type === "shower") {
    graphics.fillStyle(color(0x8db8c7), tint === null ? 0.35 : 1).fillRect(1, 1, 30, 30);
    graphics.lineStyle(2, color(0xc8e4e8), 1).strokeRect(2, 2, 28, 28);
    graphics.fillStyle(color(0x5d7f89), 1).fillRect(14, 3, 3, 8).fillRect(11, 3, 8, 3);
    return;
  }
  if (type === "toilet") {
    graphics.fillStyle(color(0xe9e4d8), 1).fillRect(7, 5, 18, 8).fillRoundedRect(5, 13, 22, 15, 5);
    graphics.fillStyle(color(0x8db8c7), tint === null ? 0.8 : 1).fillEllipse(16, 19, 12, 7);
    return;
  }
  graphics.fillStyle(color(0x71472f), 1).fillRect(2, 8, 28, 15).fillRect(4, 23, 4, 8).fillRect(24, 23, 4, 8);
  graphics.fillStyle(color(0xd9c18f), 1).fillEllipse(16, 12, 15, 7);
  graphics.fillStyle(color(0xb54f45), 1).fillCircle(16, 10, 3);
}
