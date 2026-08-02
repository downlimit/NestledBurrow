export function drawCoinSprite(graphics, x = 0, y = 0) {
  graphics.fillStyle(0x6b3d17, 1).fillRect(x - 2, y - 2, 5, 5);
  graphics.fillStyle(0xf3c969, 1).fillRect(x - 1, y - 2, 3, 5).fillRect(x - 2, y - 1, 5, 3);
  graphics.fillStyle(0xffe59a, 1).fillRect(x - 1, y - 1, 2, 1);
  return graphics;
}
