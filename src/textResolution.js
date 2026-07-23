const managedTextByScene = new WeakMap();
const sceneListeners = new WeakMap();

const GLYPH_HEIGHT = 7;
const GLYPH_WIDTH = 5;
const GLYPH_SPACING = 1;
const SPACE_WIDTH = 3;
const LINE_SPACING = 2;

const GLYPHS = Object.freeze({
  " ": ["00000","00000","00000","00000","00000","00000","00000"],
  "!": ["00100","00100","00100","00100","00100","00000","00100"],
  "?": ["01110","10001","00001","00010","00100","00000","00100"],
  ".": ["00000","00000","00000","00000","00000","01100","01100"],
  ",": ["00000","00000","00000","00000","00000","01100","01000"],
  ":": ["00000","01100","01100","00000","01100","01100","00000"],
  ";": ["00000","01100","01100","00000","01100","01000","10000"],
  "-": ["00000","00000","00000","11110","00000","00000","00000"],
  "+": ["00000","00100","00100","11111","00100","00100","00000"],
  "%": ["11001","11010","00100","01000","10110","00110","00000"],
  "/": ["00001","00010","00010","00100","01000","01000","10000"],
  "0": ["01110","10001","10011","10101","11001","10001","01110"],
  "1": ["00100","01100","00100","00100","00100","00100","01110"],
  "2": ["01110","10001","00001","00010","00100","01000","11111"],
  "3": ["11110","00001","00001","01110","00001","00001","11110"],
  "4": ["00010","00110","01010","10010","11111","00010","00010"],
  "5": ["11111","10000","11110","00001","00001","10001","01110"],
  "6": ["00110","01000","10000","11110","10001","10001","01110"],
  "7": ["11111","00001","00010","00100","01000","01000","01000"],
  "8": ["01110","10001","10001","01110","10001","10001","01110"],
  "9": ["01110","10001","10001","01111","00001","00010","01100"],
  a: ["00000","00000","01110","00001","01111","10001","01111"], b: ["10000","10000","10110","11001","10001","11001","10110"], c: ["00000","00000","01110","10000","10000","10000","01110"], d: ["00001","00001","01101","10011","10001","10011","01101"], e: ["00000","00000","01110","10001","11110","10000","01110"], f: ["00110","01001","01000","11100","01000","01000","01000"], g: ["00000","00000","01111","10001","01111","00001","01110"], h: ["10000","10000","10110","11001","10001","10001","10001"], i: ["00100","00000","01100","00100","00100","00100","01110"], j: ["00010","00000","00110","00010","00010","10010","01100"], k: ["10000","10010","10100","11000","10100","10010","10001"], l: ["01100","00100","00100","00100","00100","00100","01110"], m: ["00000","00000","11010","10101","10101","10001","10001"], n: ["00000","00000","10110","11001","10001","10001","10001"], o: ["00000","00000","01110","10001","10001","10001","01110"], p: ["00000","00000","11110","10001","11110","10000","10000"], q: ["00000","00000","01111","10001","01111","00001","00001"], r: ["00000","00000","10110","11001","10000","10000","10000"], s: ["00000","00000","01111","10000","01110","00001","11110"], t: ["01000","01000","11100","01000","01000","01001","00110"], u: ["00000","00000","10001","10001","10001","10011","01101"], v: ["00000","00000","10001","10001","01010","01010","00100"], w: ["00000","00000","10001","10001","10101","10101","01010"], x: ["00000","00000","10001","01010","00100","01010","10001"], y: ["00000","00000","10001","10001","01111","00001","01110"], z: ["00000","00000","11111","00010","00100","01000","11111"],
  а: ["00000","00000","01110","00001","01111","10001","01111"], б: ["11111","10000","11110","10001","10001","10001","11110"], в: ["11110","10001","10001","11110","10001","10001","11110"], г: ["11111","10000","10000","10000","10000","10000","10000"], д: ["00110","01010","01010","01010","10001","11111","10001"], е: ["11111","10000","11110","10000","10000","10000","11111"], ё: ["01010","00000","11111","10000","11110","10000","11111"], ж: ["10101","10101","01110","00100","01110","10101","10101"], з: ["11110","00001","00001","01110","00001","00001","11110"], и: ["10001","10011","10101","10101","11001","10001","10001"], й: ["01010","00100","10011","10101","10101","11001","10001"], к: ["10001","10010","10100","11000","10100","10010","10001"], л: ["00111","01001","01001","01001","01001","10001","10001"], м: ["10001","11011","10101","10101","10001","10001","10001"], н: ["10001","10001","10001","11111","10001","10001","10001"], о: ["01110","10001","10001","10001","10001","10001","01110"], п: ["11111","10001","10001","10001","10001","10001","10001"], р: ["11110","10001","10001","11110","10000","10000","10000"], с: ["01111","10000","10000","10000","10000","10000","01111"], т: ["11111","00100","00100","00100","00100","00100","00100"], у: ["10001","10001","10001","01111","00001","00001","01110"], ф: ["00100","01110","10101","10101","01110","00100","00100"], х: ["10001","01010","00100","00100","00100","01010","10001"], ц: ["10010","10010","10010","10010","10010","11111","00001"], ч: ["10001","10001","10001","01111","00001","00001","00001"], ш: ["10101","10101","10101","10101","10101","10101","11111"], щ: ["10100","10100","10100","10100","10100","11111","00001"], ъ: ["11000","01000","01110","01001","01001","01001","01110"], ы: ["10001","10001","11101","10011","10011","10011","11101"], ь: ["10000","10000","11110","10001","10001","10001","11110"], э: ["11110","00001","00001","01111","00001","00001","11110"], ю: ["10010","10101","10101","11101","10101","10101","10010"], я: ["01111","10001","10001","01111","00101","01001","10001"],
});

export function getIntegerTextResolution(scene) {
  const scale = scene?.scale;
  const zoom = Number(scale?.zoom ?? scale?.displayScale?.x ?? 1);
  return Math.max(1, Math.trunc(Number.isFinite(zoom) ? zoom : 1));
}

export function createManagedText(scene, x, y, text, style = {}) {
  installTextResolutionRefresh(scene);
  const textObject = createPixelText(scene, x, y, text, withTextResolution(scene, style));
  registerManagedText(scene, textObject);
  return refreshTextResolution(textObject, scene);
}

export function setManagedTextStyle(textObject, scene, style) {
  textObject.setStyle(withTextResolution(scene, style));
  return refreshTextResolution(textObject, scene);
}

export function refreshTextResolution(textObject, scene = textObject?.scene) {
  const resolution = getIntegerTextResolution(scene);
  if (typeof textObject?.setResolution === "function") textObject.setResolution(resolution);
  else if (textObject) textObject.resolution = resolution;
  textObject?.updateText?.();
  return textObject;
}

export function refreshSceneTextResolution(scene) {
  for (const textObject of managedTextByScene.get(scene) ?? []) refreshTextResolution(textObject, scene);
}

export function withTextResolution(scene, style = {}) {
  return { ...style, resolution: getIntegerTextResolution(scene) };
}

function createPixelText(scene, x, y, text, style) {
  const graphics = scene.add.graphics();
  graphics.scene = scene;
  graphics.text = String(text ?? "");
  graphics.style = { ...style };
  graphics.resolution = style.resolution ?? 1;
  graphics.width = 0;
  graphics.height = 0;
  graphics.setPosition(Math.trunc(x), Math.trunc(y));
  graphics.setText = (value) => { graphics.text = String(value ?? ""); return updatePixelText(graphics); };
  graphics.setStyle = (nextStyle = {}) => { graphics.style = { ...graphics.style, ...nextStyle }; return updatePixelText(graphics); };
  graphics.setResolution = (value) => { graphics.resolution = Math.max(1, Math.trunc(value)); return updatePixelText(graphics); };
  graphics.updateText = () => updatePixelText(graphics);
  return updatePixelText(graphics);
}

function updatePixelText(textObject) {
  textObject.clear();
  const color = parseCssColor(textObject.style.color ?? "#ffffff");
  const pixelSize = getPixelSize(textObject.style.fontSize);
  const lines = wrapText(textObject.text, textObject.style.wordWrap?.width, pixelSize);
  textObject.width = Math.max(0, ...lines.map((line) => measureLine(line, pixelSize)));
  textObject.height = lines.length ? lines.length * GLYPH_HEIGHT * pixelSize + (lines.length - 1) * LINE_SPACING * pixelSize : 0;
  textObject.fillStyle(color, 1);
  lines.forEach((line, lineIndex) => drawLine(textObject, line, 0, lineIndex * (GLYPH_HEIGHT + LINE_SPACING) * pixelSize, pixelSize));
  return textObject;
}

function getPixelSize(fontSize = "9px") {
  const size = Number.parseFloat(String(fontSize));
  return Math.max(1, Math.floor((Number.isFinite(size) ? size : 9) / GLYPH_HEIGHT));
}

function wrapText(text, width, pixelSize) {
  const maxWidth = Number(width);
  if (!Number.isFinite(maxWidth) || maxWidth <= 0) return String(text).split("\n");
  const lines = [];
  for (const sourceLine of String(text).split("\n")) {
    let current = "";
    for (const word of sourceLine.split(/(\s+)/u)) {
      const candidate = current + word;
      if (current && measureLine(candidate, pixelSize) > maxWidth) { lines.push(current.trimEnd()); current = word.trimStart(); }
      else current = candidate;
    }
    lines.push(current.trimEnd());
  }
  return lines;
}

function measureLine(line, pixelSize) {
  return [...String(line)].reduce((width, char, index) => width + glyphAdvance(char, pixelSize) + (index ? 0 : 0), 0) - (line.length ? GLYPH_SPACING * pixelSize : 0);
}

function glyphAdvance(char, pixelSize) { return ((char === " " ? SPACE_WIDTH : GLYPH_WIDTH) + GLYPH_SPACING) * pixelSize; }

function drawLine(graphics, line, x, y, pixelSize) {
  let cursorX = Math.trunc(x);
  for (const char of line) {
    const glyph = GLYPHS[char] ?? GLYPHS[char.toLowerCase()] ?? GLYPHS["?"];
    for (let row = 0; row < GLYPH_HEIGHT; row += 1) {
      for (let col = 0; col < GLYPH_WIDTH; col += 1) {
        if (glyph[row]?.[col] === "1") graphics.fillRect(cursorX + col * pixelSize, y + row * pixelSize, pixelSize, pixelSize);
      }
    }
    cursorX += glyphAdvance(char, pixelSize);
  }
}

function parseCssColor(color) {
  const hex = String(color).trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/iu.test(hex)) return Number.parseInt([...hex].map((c) => `${c}${c}`).join(""), 16);
  if (/^[0-9a-f]{6}$/iu.test(hex)) return Number.parseInt(hex, 16);
  return 0xffffff;
}

function registerManagedText(scene, textObject) {
  if (!managedTextByScene.has(scene)) managedTextByScene.set(scene, new Set());
  managedTextByScene.get(scene).add(textObject);
  textObject.once?.("destroy", () => managedTextByScene.get(scene)?.delete(textObject));
}

function installTextResolutionRefresh(scene) {
  if (!scene || sceneListeners.has(scene)) return;
  const refresh = () => refreshSceneTextResolution(scene);
  scene.scale?.on?.("resize", refresh);
  globalThis.document?.addEventListener?.("fullscreenchange", refresh);
  scene.events?.once?.("shutdown", () => cleanup(scene, refresh));
  scene.events?.once?.("destroy", () => cleanup(scene, refresh));
  sceneListeners.set(scene, refresh);
}

function cleanup(scene, refresh) {
  scene.scale?.off?.("resize", refresh);
  globalThis.document?.removeEventListener?.("fullscreenchange", refresh);
  sceneListeners.delete(scene);
  managedTextByScene.delete(scene);
}
