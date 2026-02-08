const SIZE_V1 = 21;
const MAX_PAYLOAD_BYTES = 17;
const STOP_BITS = 4;
const DATA_CODEWORDS_V1L = 19;
const ECC_BYTES_LOW = 7;

function maskCondition(maskId, x, y) {
  // QR mask patterns 0..7 (x=column, y=row)
  switch (maskId) {
    case 0:
      return (x + y) % 2 === 0;
    case 1:
      return y % 2 === 0;
    case 2:
      return x % 3 === 0;
    case 3:
      return (x + y) % 3 === 0;
    case 4:
      return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    case 7:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
    default:
      return false;
  }
}

function applyMask(map, regions, maskId) {
  if (maskId == null) return;
  registerRegion(regions, {
    id: "mask",
    title: `Maske ${maskId}`,
    description:
      "Die Maske wird nur auf Datenmodule angewendet (nicht auf Finder/Timing/Dark/Format).",
  });

  for (const cell of map.values()) {
    const maskable = cell.kind === "data" || cell.kind === "mode";
    if (!maskable) continue;
    if (!maskCondition(maskId, cell.x, cell.y)) continue;

    const nextOn = !cell.on;
    const nextBitValue =
      cell.bitValue === 0 || cell.bitValue === 1
        ? 1 - cell.bitValue
        : cell.bitValue;
    map.set(key(cell.x, cell.y), {
      ...cell,
      on: nextOn,
      bitValue: nextBitValue,
      // keep regionId as-is (masking doesn't change which field it belongs to)
    });
  }
}

function computeFormatStringBitsLow(maskId) {
  // Step 12 (per spec for this learning tool):
  // - Prefix: 2 bits EC level + 3 bits mask id => 5 bits total
  //   EC level L must start with '01'. Mask is 3-bit binary (0..7).
  //   Example mask 7 => data bits '01' + '111' => '01111'.
  // - Then compute 10 BCH bits with generator 0x537.
  // NOTE: We intentionally *do not* apply the final XOR mask 0x5412 here,
  // because the user requirement expects the format string to visibly start with '01'.
  const eccBits = 0b01; // L => '01' (as used by this demo's convention)
  const data5 = ((eccBits & 0b11) << 3) | (maskId & 0b111); // 5 bits

  const G = 0x537;
  let v = data5 << 10;
  for (let bit = 14; bit >= 10; bit--) {
    if (((v >> bit) & 1) === 1) v ^= G << (bit - 10);
  }
  const bch10 = v & 0x3ff;
  const format15Raw = (data5 << 10) | bch10;
  const FORMAT_XOR_MASK = 0b101010000010010; // 0x5412
  const format15 = format15Raw ^ FORMAT_XOR_MASK;

  const bitsMsbFirst = Array.from(
    { length: 15 },
    (_, i) => (format15 >> (14 - i)) & 1,
  );

  const dataBits = Array.from({ length: 5 }, (_, i) => (data5 >> (4 - i)) & 1);
  const bchBits = Array.from({ length: 10 }, (_, i) => (bch10 >> (9 - i)) & 1);

  return {
    data5,
    bch10,
    format15Raw,
    format15,
    dataBits,
    bchBits,
    bitsMsbFirst,
  };
}

function writeFormatString(map, regions, maskId) {
  if (maskId == null) return;
  const { dataBits, bchBits, bitsMsbFirst, format15Raw, format15 } =
    computeFormatStringBitsLow(maskId);

  const regionId = "formatBits";
  registerRegion(regions, {
    id: regionId,
    title: "Format-String",
    description: bitsMsbFirst.join(""),
  });

  const bitValueForIndex = (bitIndex) => {
    // bitIndex is 1..15 where 1 = first bit (MSB) and 15 = last bit (LSB)
    if (bitIndex < 1 || bitIndex > 15) return 0;
    return bitsMsbFirst[bitIndex - 1] ?? 0;
  };

  const place = (bitIndex, x, y) => {
    const v = bitValueForIndex(bitIndex);
    setCell(map, regions, x, y, {
      kind: "formatBit",
      regionId,
      on: v === 1,
      bitIndex,
      bitValue: v,
      bitGroup: "format",
      // Actual bit number inside the 15-bit value (0 = LSB .. 14 = MSB)
      formatBitNo: 15 - bitIndex,
    });
  };

  // === Bit numbering/order exactly as requested ===
  // Copy A (top-left):
  // - vertical strip right of top-left finder: start at top with bit 15, count down
  //   (8,0)=15 ... (8,5)=10, then (8,7)=9, then (8,8)=8, then (7,8)=7
  // - horizontal strip below top-left finder: start at left border with bit 1, count right
  //   (0,8)=1 ... (5,8)=6
  for (let y = 0; y <= 5; y++) place(15 - y, 8, y);
  place(9, 8, 7);
  place(8, 8, 8);
  place(7, 7, 8);
  for (let x = 0; x <= 5; x++) place(1 + x, x, 8);

  // Copy B (top-right + bottom-left):
  // - right strip under top-right finder: left->right bits 8..15
  //   (13,8)=8 ... (20,8)=15
  // - bottom-left strip: top->bottom bits 7..1
  //   (8,14)=7 ... (8,20)=1
  for (let x = 13; x <= 20; x++) place(8 + (x - 13), x, 8);
  for (let y = 14; y <= 20; y++) place(7 - (y - 14), 8, y);
}

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
      "4 Bit zeigen, um welche Art von Daten es sich handelt. Hier: 0100 = Byte-Mode (der verbreitetste Modus). Die Bits werden in der QR-Schreibreihenfolge (Zickzack) ab rechts unten gesetzt.",
  });

  // In the QR bitstream the mode indicator is written MSB -> LSB.
  // Placement into modules follows the QR traversal order.
  const bits = [0, 1, 0, 0];
  const path = computeDataModulePath(map);
  const chunk = path.slice(0, 4);
  for (let i = 0; i < chunk.length; i++) {
    const p = chunk[i];
    setCell(map, regions, p.x, p.y, {
      kind: "mode",
      regionId,
      on: bits[i] === 1,
      bitIndex: i + 1,
      bitValue: bits[i],
      bitGroup: "mode",
    });
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
    // For later steps we want to write into the previously reserved preview modules.
    // Therefore, `dataPos` (step 6 placeholders) and already written `data` are treated
    // as part of the traversable path as well.
    return (
      !!c &&
      (c.kind === "empty" ||
        c.kind === "dataPos" ||
        c.kind === "data" ||
        c.kind === "mode")
    );
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

function placeBytePositionsPreview(map, regions, text, step) {
  const { bytes } = iso88591Encode(text);
  const path = computeDataModulePath(map);

  // Bitstream starts with the 4 mode bits. The length field (8 bits) starts at bit 4,
  // then the payload bytes follow.
  const previewByteCount = 1 + bytes.length;

  for (let byteIndex = 0; byteIndex < previewByteCount; byteIndex++) {
    const startBit = 4 + byteIndex * 8;
    const chunk = path.slice(startBit, startBit + 8);
    if (chunk.length < 8) break;

    const dir = arrowDir(chunk[0], chunk[chunk.length - 1]);
    const regionId = `bytepos:${byteIndex}`;
    const isLength = byteIndex === 0;

    registerRegion(regions, {
      id: regionId,
      title: isLength
        ? "Längenfeld (1 Byte) – Position"
        : `Byte ${byteIndex} (Position)`,
      description: isLength
        ? "Dieses Feld (8 Bits) speichert die Länge der Nutzdaten."
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
        bitIndex: i + 1,
        bitGroup: "byte",
        bitValue: null,
      });
    }
  }

  if (step < 10) return;

  // Stop-Block (terminator): 4 bits 0000 directly after the payload.
  const stopStartBit = 12 + bytes.length * 8;
  const stopChunk = path.slice(stopStartBit, stopStartBit + STOP_BITS);
  if (stopChunk.length === STOP_BITS) {
    const stopRegionId = "stoppos";
    registerRegion(regions, {
      id: stopRegionId,
      title: "Stop-Block (4 Bit) – Position",
      description:
        "Nach den Nutzdaten kommen 4 Stop-Bits (0000). Im Byte-Mode endet man danach bereits wieder auf einer Byte-Grenze.",
    });
    for (let i = 0; i < stopChunk.length; i++) {
      const p = stopChunk[i];
      setCell(map, regions, p.x, p.y, {
        kind: "dataPos",
        regionId: stopRegionId,
        on: false,
        byteIndex: null,
        dir: null,
        isHead: false,
        isLength: false,
        bitIndex: i + 1,
        bitGroup: "stop",
        bitValue: null,
      });
    }
  }

  // Pad bytes fill the remaining data codewords (V1-L: 19 data codewords total).
  const dataCodewordsUsed = 2 + bytes.length; // mode+len+payload+stop = 16 + 8n bits = (2+n) bytes
  for (let cw = dataCodewordsUsed; cw < DATA_CODEWORDS_V1L; cw++) {
    const padNumber = cw - dataCodewordsUsed + 1;
    const startBit = cw * 8;
    const chunk = path.slice(startBit, startBit + 8);
    if (chunk.length < 8) break;

    const dir = arrowDir(chunk[0], chunk[chunk.length - 1]);
    const regionId = `bytepos:${cw}`;
    registerRegion(regions, {
      id: regionId,
      title: `Auffüll-Byte ${padNumber} (Position)`,
      description:
        "Auffüll-Bytes füllen den restlichen Platz bis zur Daten-Kapazität. Da sie hinter dem Stop-Block kommen, sind sie inhaltlich bedeutungslos.",
    });

    for (let i = 0; i < chunk.length; i++) {
      const p = chunk[i];
      setCell(map, regions, p.x, p.y, {
        kind: "dataPos",
        regionId,
        on: false,
        byteIndex: cw,
        dir,
        isHead: i === 0,
        isLength: false,
        bitIndex: i + 1,
        bitGroup: "pad",
        bitValue: null,
      });
    }
  }

  // ECC bytes follow after the data codewords.
  for (let i = 0; i < ECC_BYTES_LOW; i++) {
    const byteIndex = DATA_CODEWORDS_V1L + i;
    const startBit = byteIndex * 8;
    const chunk = path.slice(startBit, startBit + 8);
    if (chunk.length < 8) break;

    const dir = arrowDir(chunk[0], chunk[chunk.length - 1]);
    const regionId = `bytepos:${byteIndex}`;
    registerRegion(regions, {
      id: regionId,
      title: `ECC ${i + 1} (Position)`,
      description:
        "Reed-Solomon Fehlerkorrektur-Bytes (Low). Diese werden aus allen Daten-Bits (inkl. Mode/Länge/Nutzdaten/Stop/Pad) berechnet.",
    });

    for (let j = 0; j < chunk.length; j++) {
      const p = chunk[j];
      setCell(map, regions, p.x, p.y, {
        kind: "dataPos",
        regionId,
        on: false,
        byteIndex,
        dir,
        isHead: j === 0,
        isLength: false,
        bitIndex: j + 1,
        bitGroup: "ecc",
        bitValue: null,
      });
    }
  }
}

function bitsFromByte(b) {
  const bits = [];
  for (let bit = 7; bit >= 0; bit--) bits.push((b >> bit) & 1);
  return bits;
}

function writeByteToPath(
  map,
  regions,
  regionId,
  title,
  description,
  byteIndex,
  startBit,
  byteValue,
  bitGroup,
) {
  if (title || description) {
    registerRegion(regions, {
      id: regionId,
      title: title ?? regionId,
      description: description ?? "",
    });
  }

  const path = computeDataModulePath(map);
  const chunk = path.slice(startBit, startBit + 8);
  if (chunk.length < 8) return;

  const bits = bitsFromByte(byteValue);
  for (let i = 0; i < 8; i++) {
    const p = chunk[i];
    setCell(map, regions, p.x, p.y, {
      kind: "data",
      regionId,
      on: bits[i] === 1,
      byteIndex,
      bitIndex: i + 1,
      bitValue: bits[i],
      bitGroup,
    });
  }
}

function writeLengthByte(map, regions, byteLength) {
  writeByteToPath(
    map,
    regions,
    "len",
    "Längenfeld (1 Byte)",
    "Dieses Byte (8 Bits) speichert die Länge der Nutzdaten.",
    0,
    4,
    byteLength & 0xff,
    "len",
  );
}

function byteBits8(b) {
  const v = b & 0xff;
  return v.toString(2).padStart(8, "0");
}

function byteBits8WithPrintable(b) {
  const v = b & 0xff;
  const printable = v >= 32 && v <= 126 ? String.fromCharCode(v) : "";
  return `${byteBits8(v)}${printable ? ` ('${printable}')` : ""}`;
}

function writePayloadBytes(map, regions, bytes) {
  for (let payloadIndex = 0; payloadIndex < bytes.length; payloadIndex++) {
    const byteNumber = payloadIndex + 1; // user-facing numbering
    const b = bytes[payloadIndex];
    const regionId = `byte:${byteNumber}`;
    writeByteToPath(
      map,
      regions,
      regionId,
      `Byte ${byteNumber}`,
      `binär: ${byteBits8WithPrintable(b)}`,
      byteNumber,
      12 + payloadIndex * 8,
      b,
      "byte",
    );
  }
}

function writeStopAndPadBits(map, regions, payloadLen) {
  const regionId = "stop";
  registerRegion(regions, {
    id: regionId,
    title: "Stop-Block (4 Bit)",
    description:
      "Stop-Block sind 4 Bits mit 0 (weiß) direkt nach den Nutzdaten (0000). Im Byte-Mode endet man danach bereits wieder auf einer Byte-Grenze.",
  });

  const totalBits = STOP_BITS;
  const startBit = 12 + payloadLen * 8;
  const path = computeDataModulePath(map);
  const chunk = path.slice(startBit, startBit + totalBits);
  for (let i = 0; i < chunk.length; i++) {
    const p = chunk[i];
    setCell(map, regions, p.x, p.y, {
      kind: "data",
      regionId,
      on: false,
      byteIndex: null,
      bitIndex: i + 1,
      bitValue: 0,
      bitGroup: "stop",
    });
  }
}

function initGfTables() {
  // GF(256) with primitive polynomial 0x11d (used by QR codes)
  const exp = new Uint8Array(512);
  const log = new Uint8Array(256);
  let x = 1;
  for (let i = 0; i < 255; i++) {
    exp[i] = x;
    log[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) exp[i] = exp[i - 255];
  return { exp, log };
}

const GF = initGfTables();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF.exp[GF.log[a] + GF.log[b]];
}

function polyMul(p, q) {
  const out = new Uint8Array(p.length + q.length - 1);
  for (let i = 0; i < p.length; i++) {
    for (let j = 0; j < q.length; j++) {
      out[i + j] ^= gfMul(p[i], q[j]);
    }
  }
  return out;
}

function rsGeneratorPoly(ecLen) {
  let g = new Uint8Array([1]);
  for (let i = 0; i < ecLen; i++) {
    g = polyMul(g, new Uint8Array([1, GF.exp[i]]));
  }
  return g;
}

function rsEncode(dataBytes, ecLen) {
  const gen = rsGeneratorPoly(ecLen);
  const ecc = new Uint8Array(ecLen);

  for (const d of dataBytes) {
    const factor = d ^ ecc[0];
    for (let i = 0; i < ecLen - 1; i++) ecc[i] = ecc[i + 1];
    ecc[ecLen - 1] = 0;

    for (let j = 0; j < ecLen; j++) {
      ecc[j] ^= gfMul(gen[j + 1], factor);
    }
  }

  return Array.from(ecc);
}

function writeEccLow(map, regions, payloadBytes) {
  // Build the data bitstream (V1-L: 19 data codewords) starting at the mode bits.
  // Mode (0100) + length (8 bits) + payload + stop (0000), then pad bytes to capacity.
  const bits = [];
  bits.push(0, 1, 0, 0); // byte mode = 0100
  bits.push(...bitsFromByte(payloadBytes.length & 0xff));
  for (const b of payloadBytes) bits.push(...bitsFromByte(b));
  for (let i = 0; i < STOP_BITS; i++) bits.push(0);

  while (bits.length % 8 !== 0) bits.push(0);

  const padPattern = [0xec, 0x11];
  let padI = 0;
  while (bits.length < DATA_CODEWORDS_V1L * 8) {
    bits.push(...bitsFromByte(padPattern[padI++ % padPattern.length]));
  }
  bits.length = DATA_CODEWORDS_V1L * 8;

  const dataBytes = [];
  for (let i = 0; i < DATA_CODEWORDS_V1L; i++) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | (bits[i * 8 + j] & 1);
    dataBytes.push(v);
  }

  const ecc = rsEncode(dataBytes, ECC_BYTES_LOW);

  const startByteIndex = DATA_CODEWORDS_V1L;
  registerRegion(regions, {
    id: "ecc",
    title: "Reed-Solomon (Low)",
    description:
      "Wir erzeugen 7 Fehlerkorrektur-Bytes aus den Daten-Bytes (Länge + Nutzdaten + Stop-Block + Padding) mit Reed–Solomon über GF(256) (Polynom 0x11d).",
  });

  for (let i = 0; i < ecc.length; i++) {
    const byteIndex = startByteIndex + i;
    const b = ecc[i];
    writeByteToPath(
      map,
      regions,
      `ecc:${i + 1}`,
      `Fehlerkorrektur ${i + 1}`,
      `Fehlerkorrektur-Byte ${i + 1} (aus Reed–Solomon, Low). Wert (binär): ${byteBits8(b)}.`,
      byteIndex,
      byteIndex * 8,
      b,
      "ecc",
    );
  }
}

function writePadBytes(map, regions, payloadLen) {
  // Pad bytes start right after the 4 stop bits. In byte mode this is already byte-aligned.
  const stopPadByteIndex = payloadLen + 1; // used only for user-facing numbering (Pad-Byte 1, 2, ...)

  const padPattern = [0xec, 0x11];
  let padI = 0;
  for (
    let byteIndex = payloadLen + 2;
    byteIndex < DATA_CODEWORDS_V1L;
    byteIndex++
  ) {
    const b = padPattern[padI++ % padPattern.length];
    writeByteToPath(
      map,
      regions,
      `pad:${byteIndex - stopPadByteIndex}`,
      `Auffüll-Byte ${byteIndex - stopPadByteIndex}`,
      `Auffüll-Byte (wechselnd 11101100/00010001). Wert (binär): ${b
        .toString(2)
        .padStart(8, "0")}.`,
      byteIndex,
      byteIndex * 8,
      b,
      "pad",
    );
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
    registerRegion(regions, {
      id: regionId,
      title: `Byte ${byteIndex}`,
      description: `binär: ${byteBits8WithPrintable(b)}`,
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
export function buildQrGrid(step, text, maskId = null) {
  let effectiveStep = step;
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
  if (effectiveStep >= 4) drawModeBlock(map, regions);

  // Step 5: Text-Eingabe (noch keine Pixel)

  const { bytes: payloadBytes } = iso88591Encode(text);
  if (payloadBytes.length > MAX_PAYLOAD_BYTES && effectiveStep >= 6) {
    effectiveStep = 5;
  }

  // Step 6: Zeige nur Byte-Positionen + Leserichtung (noch ungefüllt)
  if (effectiveStep >= 6) {
    placeBytePositionsPreview(map, regions, text, effectiveStep);
  }

  // Step 7: Längenfeld (8 Bit) schreiben
  if (effectiveStep >= 7) {
    writeLengthByte(map, regions, payloadBytes.length);
  }

  // Step 8: Nutzdaten-Bytes schreiben
  if (effectiveStep >= 8) {
    writePayloadBytes(map, regions, payloadBytes);
  }

  // Step 9: Stop-Block (4 Bit 0000) schreiben
  if (effectiveStep >= 9) {
    writeStopAndPadBits(map, regions, payloadBytes.length);
  }

  // Step 10: Reed-Solomon Fehlerkorrektur (Low) schreiben
  if (effectiveStep >= 10) {
    writePadBytes(map, regions, payloadBytes.length);
    writeEccLow(map, regions, payloadBytes);
  }

  // Step 11: Maske anwenden (nur auf Datenmodule)
  if (effectiveStep >= 11 && maskId != null) {
    applyMask(map, regions, maskId);
  }

  // Step 12: Format-String schreiben (ECC-Level + Masken-ID)
  if (effectiveStep >= 12 && maskId != null) {
    writeFormatString(map, regions, maskId);
  }

  const maskApplied = effectiveStep >= 11 && maskId != null;
  return {
    size: SIZE_V1,
    cells: Array.from(map.values()),
    regions,
    maskApplied,
    maskId,
  };
}
