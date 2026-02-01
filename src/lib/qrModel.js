const SIZE_V1 = 21;

function key(x, y) {
  return `${x},${y}`;
}

function registerRegion(regions, info) {
  regions[info.id] = info;
}

function setCell(map, regions, x, y, patch) {
  const k = key(x, y);
  const prev = map.get(k) ?? {
    x,
    y,
    on: false,
    kind: "empty",
    regionId: "empty",
  };

  map.set(k, { ...prev, ...patch, x, y });

  if (!regions[patch.regionId]) {
    regions[patch.regionId] = {
      id: patch.regionId,
      title: patch.regionId,
      description: "",
    };
  }
}

function drawFinder(map, regions, originX, originY, idSuffix) {
  const regionId = `finder:${idSuffix}`;
  registerRegion(regions, {
    id: regionId,
    title: "Erkennungsmuster",
    description:
      "Das 7×7-Muster in den Ecken hilft dem Scanner, Lage, Drehung und Maßstab zu erkennen.",
  });

  for (let dy = 0; dy < 7; dy++) {
    for (let dx = 0; dx < 7; dx++) {
      const x = originX + dx;
      const y = originY + dy;
      const isOuter = dx === 0 || dy === 0 || dx === 6 || dy === 6;
      const isInner = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
      const on = isOuter || isInner;
      setCell(map, regions, x, y, { kind: "finder", regionId, on });
    }
  }

  const sepId = `separator:${idSuffix}`;
  registerRegion(regions, {
    id: sepId,
    title: "Separator (ruhiger Rand um Erkennungsmuster)",
    description:
      "Eine helle 1-Pixel-Breite Trennlinie um des Erkennungsmuster sorgt für klare Abgrenzung.",
  });

  for (let dy = -1; dy <= 7; dy++) {
    for (let dx = -1; dx <= 7; dx++) {
      const x = originX + dx;
      const y = originY + dy;
      const inBounds = x >= 0 && y >= 0 && x < SIZE_V1 && y < SIZE_V1;
      if (!inBounds) continue;
      const isInsideFinder = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
      const isBorder = !isInsideFinder;
      if (!isBorder) continue;

      const existing = map.get(key(x, y));
      if (existing && existing.kind === "finder") continue;

      setCell(map, regions, x, y, {
        kind: "separator",
        regionId: sepId,
        on: false,
      });
    }
  }
}

function drawTiming(map, regions) {
  const regionId = "timing";
  registerRegion(regions, {
    id: regionId,
    title: "Synchronisation",
    description:
      "Die abwechselnden Pixel helfen, die Pixelbreite korrekt zu erkennen. Das hilft z. B. bei verzerrten Aufnahmen.",
  });

  for (let x = 8; x <= 12; x++) {
    const on = x % 2 === 0;
    setCell(map, regions, x, 6, { kind: "timing", regionId, on });
  }
  for (let y = 8; y <= 12; y++) {
    const on = y % 2 === 0;
    setCell(map, regions, 6, y, { kind: "timing", regionId, on });
  }
}

function drawDarkModule(map, regions) {
  const regionId = "dark";
  registerRegion(regions, {
    id: regionId,
    title: "Dark Module/Pixel",
    description:
      "Ein festes schwarzes Pixel an definierter Position (damit die Kamera weiß, wie schwarze Pixel auszusehen haben).",
  });
  setCell(map, regions, 8, 13, { kind: "dark", regionId, on: true });
}

function drawFormatReservations(map, regions) {
  const regionId = "format";
  registerRegion(regions, {
    id: regionId,
    title: "Format (reserviert)",
    description:
      "Diese Felder sind für den Format-String reserviert (Fehlerkorrektur-Level + Masken-ID). Wir füllen sie erst ganz am Ende.",
  });

  const reserve = (x, y) => {
    if (x < 0 || y < 0 || x >= SIZE_V1 || y >= SIZE_V1) return;
    const existing = map.get(key(x, y));
    if (existing && existing.kind !== "empty") return;
    setCell(map, regions, x, y, { kind: "format", regionId, on: false });
  };

  // Top-left format info (15 modules)
  for (let y = 0; y <= 5; y++) reserve(8, y);
  reserve(8, 7);
  reserve(8, 8);
  reserve(7, 8);
  for (let x = 0; x <= 5; x++) reserve(x, 8);

  // Top-right format info (8 modules)
  for (let x = SIZE_V1 - 1; x >= SIZE_V1 - 8; x--) reserve(x, 8);

  // Bottom-left format info (7 modules)
  for (let y = SIZE_V1 - 1; y >= SIZE_V1 - 7; y--) reserve(8, y);
}

function drawModeBlock(map, regions) {
  const regionId = "mode";
  registerRegion(regions, {
    id: regionId,
    title: "Codierungsmodus",
    description:
      "Für den Anfang zeigen wir die 4 Mode-Bits als 2×2 Block unten rechts (hier fix: 0100 = Byte-Mode).",
  });

  const bits = [0, 1, 0, 0];
  const baseX = 19;
  const baseY = 19;
  let i = 0;
  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      setCell(map, regions, baseX + dx, baseY + dy, {
        kind: "mode",
        regionId,
        on: bits[i++] === 1,
      });
    }
  }
}

function utf8Bytes(text) {
  return Array.from(new TextEncoder().encode(text));
}

/**
 * ISO-8859-1 (Latin-1) encoding used as the default character set for QR Byte mode.
 * Characters outside 0x00..0xFF are replaced with '?'.
 */
export function iso88591Encode(input) {
  const bytes = [];
  let replaced = 0;
  let out = "";

  for (let i = 0; i < input.length; i++) {
    const codeUnit = input.charCodeAt(i);
    if (codeUnit <= 0xff) {
      bytes.push(codeUnit);
      out += String.fromCharCode(codeUnit);
    } else {
      bytes.push(0x3f);
      out += "?";
      replaced++;
    }
  }

  return {
    text: out,
    bytes,
    byteLength: bytes.length,
    replaced,
  };
}

function computeDataModulePath(map) {
  const path = [];

  const isFree = (x, y) => {
    const c = map.get(key(x, y));
    return !!c && c.kind === "empty";
  };

  // QR-style traversal: pairs of columns from right to left, alternating up/down.
  let upward = true;
  for (let x = SIZE_V1 - 1; x > 0; x -= 2) {
    if (x === 6) x -= 1; // skip timing column
    const cols = [x, x - 1];

    if (upward) {
      for (let y = SIZE_V1 - 1; y >= 0; y--) {
        for (const cx of cols) {
          if (isFree(cx, y)) path.push({ x: cx, y });
        }
      }
    } else {
      for (let y = 0; y < SIZE_V1; y++) {
        for (const cx of cols) {
          if (isFree(cx, y)) path.push({ x: cx, y });
        }
      }
    }

    upward = !upward;
  }

  return path;
}

function arrowDir(first, last) {
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  if (Math.abs(dy) >= Math.abs(dx)) return dy <= 0 ? "up" : "down";
  return dx <= 0 ? "left" : "right";
}

function placeBytePositionsPreview(map, regions, text) {
  const { bytes } = iso88591Encode(text);
  const path = computeDataModulePath(map);

  // Byte-Mode (Version 1–9): the character count indicator is 8 bits = 1 byte.
  // For step 6 we already reserve/show this extra byte before the payload bytes.
  const totalBytes = bytes.length + 1;

  for (let byteIndex = 0; byteIndex < totalBytes; byteIndex++) {
    const chunk = path.slice(byteIndex * 8, byteIndex * 8 + 8);
    if (chunk.length < 8) break;

    const dir = arrowDir(chunk[0], chunk[chunk.length - 1]);
    const regionId = `bytepos:${byteIndex}`;

    const isLength = byteIndex === 0;
    registerRegion(regions, {
      id: regionId,
      title: isLength
        ? "Längenfeld (1 Byte) – Position"
        : `Byte ${byteIndex - 1} (Position)`,
      description: isLength
        ? "Dieses Byte (8 Bits) speichert die Länge der Nutzdaten (im Byte-Mode für Version 1–9)."
        : "Position der nächsten 8 Bits im Zickzack-Verlauf. Die Pfeilrichtung zeigt die Leserichtung dieses Bytes.",
    });

    for (let i = 0; i < chunk.length; i++) {
      const p = chunk[i];
      setCell(map, regions, p.x, p.y, {
        kind: "dataPos",
        regionId,
        on: false,
        byteIndex,
        dir,
        isHead: i === 0,
        isLength,
      });
    }
  }
}

function placeByteBlocks(map, regions, bytes) {
  const blockW = 2;
  const blockH = 4;

  const reserved = (x, y) => {
    const c = map.get(key(x, y));
    return !!c && c.kind !== "empty" && c.kind !== "data";
  };

  const candidates = [];
  for (let y = SIZE_V1 - blockH; y >= 0; y--) {
    for (let x = SIZE_V1 - blockW; x >= 0; x--) {
      candidates.push({ x, y });
    }
  }

  let byteIndex = 0;
  for (const pos of candidates) {
    if (byteIndex >= bytes.length) break;

    let fits = true;
    for (let dy = 0; dy < blockH; dy++) {
      for (let dx = 0; dx < blockW; dx++) {
        const x = pos.x + dx;
        const y = pos.y + dy;
        if (reserved(x, y)) {
          fits = false;
          break;
        }
      }
      if (!fits) break;
    }
    if (!fits) continue;

    const b = bytes[byteIndex];
    const regionId = `byte:${byteIndex}`;
    const printable = b >= 32 && b <= 126 ? String.fromCharCode(b) : "";
    registerRegion(regions, {
      id: regionId,
      title: `Byte ${byteIndex}`,
      description: `0x${b.toString(16).padStart(2, "0").toUpperCase()}${
        printable ? ` ('${printable}')` : ""
      }`,
    });

    const bits = [];
    for (let bit = 7; bit >= 0; bit--) bits.push((b >> bit) & 1);

    let i = 0;
    for (let dy = 0; dy < blockH; dy++) {
      for (let dx = 0; dx < blockW; dx++) {
        const on = bits[i++] === 1;
        setCell(map, regions, pos.x + dx, pos.y + dy, {
          kind: "data",
          regionId,
          on,
        });
      }
    }

    byteIndex++;
  }
}

/**
 * Baut ein vereinfachtes QR-Grid (Version 1, 21×21) für Demo-Schritte.
 * @param {number} step
 * @param {string} text
 */
export function buildQrGrid(step, text) {
  const map = new Map();
  const regions = {
    empty: {
      id: "empty",
      title: "Leer",
      description: "Noch nicht belegte Pixel.",
    },
  };

  for (let y = 0; y < SIZE_V1; y++) {
    for (let x = 0; x < SIZE_V1; x++) {
      map.set(key(x, y), { x, y, on: false, kind: "empty", regionId: "empty" });
    }
  }

  // Step 1: Intro / leeres Raster
  // Step 2: Basis-Muster
  if (step >= 2) {
    drawFinder(map, regions, 0, 0, "tl");
    drawFinder(map, regions, SIZE_V1 - 7, 0, "tr");
    drawFinder(map, regions, 0, SIZE_V1 - 7, "bl");
    drawTiming(map, regions);
    drawDarkModule(map, regions);
  }

  // Step 3: Format-String (reserviert)
  if (step >= 3) drawFormatReservations(map, regions);

  // Step 4: Mode Bits
  if (step >= 4) drawModeBlock(map, regions);

  // Step 5: Text-Eingabe (noch keine Pixel)

  // Step 6: Zeige nur Byte-Positionen + Leserichtung (noch ungefüllt)
  if (step >= 6) {
    placeBytePositionsPreview(map, regions, text);
  }

  return { size: SIZE_V1, cells: Array.from(map.values()), regions };
}
