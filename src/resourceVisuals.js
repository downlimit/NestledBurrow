export function drawLog(graphics, remainingHits = 5) {
  const damage = 5 - remainingHits;
  graphics.fillStyle(0x3d2517, 1).fillRect(2, 6, 12, 5);
  graphics.fillStyle(0x6f3f22, 1).fillRect(3, 5, 10, 2).fillRect(3, 10, 10, 2);
  graphics.fillStyle(0x9b6337, 1).fillRect(2, 6, 2, 5).fillRect(12, 6, 2, 5);
  graphics.fillStyle(0xd49a55, 1).fillRect(3, 7, 1, 2).fillRect(12, 7, 1, 2);
  graphics.fillStyle(0xf2eadc, 0.9);
  for (let index = 0; index < damage; index += 1) graphics.fillRect(5 + index * 2, 7 + (index % 2), 1, 3);
  graphics.fillStyle(0x2f6b2f, 1).fillRect(6, 3, 2, 3).fillRect(9, 11, 2, 2);
}

export function drawRuby(graphics, remainingHits = 5) {
  const damage = 5 - remainingHits;
  graphics.fillStyle(0x5c1028, 1).fillRect(6, 2, 4, 2).fillRect(4, 4, 8, 7).fillRect(6, 11, 4, 3);
  graphics.fillStyle(0xd92767, 1).fillRect(6, 3, 3, 8).fillRect(5, 5, 6, 4);
  graphics.fillStyle(0xff8ab3, 1).fillRect(7, 4, 2, 2);
  graphics.fillStyle(0x2f1730, 1).fillRect(4, 13, 8, 2);
  graphics.fillStyle(0xf2eadc, 0.9);
  for (let index = 0; index < damage; index += 1) graphics.fillRect(5 + index * 2, 7, 1, 3);
}
