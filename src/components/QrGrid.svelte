<script>
  const {
    model,
    pixelSize = 16,
    quietMargin = 80,
    showByteFrames = true,
    showBitNumbers = false,
    bitNumbersOnlyWhenEnabled = false,
    hideByteTooltipContent = false,
  } = $props();

  let hoveredRegionId = $state(null);
  let hoveredCellKey = $state(null);
  let tooltip = $state(null);

  const marginPx = $derived(Math.max(0, Number(quietMargin) || 0));
  const byKey = (c) => `${c.x},${c.y}`;

  function showTooltipAt(e, cell) {
    hoveredRegionId = cell.regionId;
    hoveredCellKey = byKey(cell);
    const info = model?.regions?.[cell.regionId];
    if (!info) {
      tooltip = null;
      return;
    }

    tooltip = {
      x: e.clientX + 14,
      y: e.clientY + 14,
      info,
      cell,
    };
  }

  function onEnterCell(e, cell) {
    showTooltipAt(e, cell);
  }

  function onMove(e) {
    if (!tooltip) return;
    tooltip = { ...tooltip, x: e.clientX + 14, y: e.clientY + 14 };
  }

  function onLeave() {
    hoveredRegionId = null;
    hoveredCellKey = null;
    tooltip = null;
  }

  const arrowFor = (dir) => {
    if (dir === "up") return "↑";
    if (dir === "down") return "↓";
    if (dir === "left") return "←";
    if (dir === "right") return "→";
    return "";
  };

  const cellState = (cell) => {
    if (!cell) return "unset";
    if (cell.kind === "empty") return "unset";
    if (cell.kind === "format") return "reserved";
    if (cell.kind === "formatBit") return cell.on ? "on" : "off";
    if (cell.kind === "dataPos") return "data";
    return cell.on ? "on" : "off";
  };

  const byteBoxes = $derived.by(() => {
    const cells =
      model?.cells?.filter(
        (c) =>
          (c.kind === "dataPos" || c.kind === "data") && c.byteIndex != null,
      ) ?? [];
    /** @type {Map<number, any>} */
    const boxes = new Map();

    for (const c of cells) {
      const i = Number(c.byteIndex);
      if (!Number.isFinite(i)) continue;
      const prev = boxes.get(i);
      if (!prev) {
        boxes.set(i, {
          byteIndex: i,
          minX: c.x,
          maxX: c.x,
          minY: c.y,
          maxY: c.y,
        });
        continue;
      }
      prev.minX = Math.min(prev.minX, c.x);
      prev.maxX = Math.max(prev.maxX, c.x);
      prev.minY = Math.min(prev.minY, c.y);
      prev.maxY = Math.max(prev.maxY, c.y);
    }

    return Array.from(boxes.values()).sort((a, b) => a.byteIndex - b.byteIndex);
  });

  const bitValueText = (cell) => {
    if (!cell) return "";
    if (cell.bitValue === 0 || cell.bitValue === 1)
      return String(cell.bitValue);
    if (cell.kind === "dataPos") return "(noch leer)";
    return cell.on ? "1" : "0";
  };

  const hoveredBitCells = $derived.by(() => {
    if (!model || !hoveredRegionId) return [];
    return (model.cells ?? [])
      .filter((c) => c.regionId === hoveredRegionId && c.bitIndex != null)
      .slice()
      .sort((a, b) => (a.bitIndex ?? 0) - (b.bitIndex ?? 0));
  });

  const visibleBitCells = $derived.by(() => {
    if (!hoveredRegionId) return [];
    if (bitNumbersOnlyWhenEnabled) {
      if (!showBitNumbers) return [];
      return hoveredBitCells;
    }

    // Default behavior: show bit numbers on hover (and also when the toggle is on).
    if (showBitNumbers || hoveredRegionId) return hoveredBitCells;
    return [];
  });

  const isByteLikeCell = (c) => {
    if (!c) return false;
    if (c.kind !== "data") return false;
    if (c.bitGroup === "byte" || c.bitGroup === "pad" || c.bitGroup === "ecc")
      return true;
    if (
      typeof c.regionId === "string" &&
      (c.regionId.startsWith("byte:") ||
        c.regionId.startsWith("pad:") ||
        c.regionId.startsWith("ecc:"))
    )
      return true;
    return false;
  };

  const hideTooltipDescription = $derived.by(() => {
    if (!hideByteTooltipContent) return false;
    return isByteLikeCell(tooltip?.cell);
  });

  const showMaskWarning = $derived.by(() => {
    if (!model?.maskApplied) return false;
    const c = tooltip?.cell;
    if (!c) return false;
    if (c.kind !== "data") return false;
    if (c.bitGroup === "byte" || c.bitGroup === "pad" || c.bitGroup === "ecc")
      return true;
    if (
      typeof c.regionId === "string" &&
      (c.regionId.startsWith("byte:") ||
        c.regionId.startsWith("pad:") ||
        c.regionId.startsWith("ecc:"))
    )
      return true;
    return false;
  });
</script>

<div
  class="wrap"
  role="presentation"
  onpointermove={onMove}
  onpointerleave={onLeave}
>
  {#if model}
    <div class="frame" style={`--m:${marginPx}px;`} aria-label="QR-Code">
      <div
        class="grid"
        style={`--size:${model.size}; --px:${pixelSize}px;`}
        aria-label="QR-Code Raster"
      >
        {#if showByteFrames}
          {#each byteBoxes as box (box.byteIndex)}
            <div
              class={`byteBox ${box.byteIndex === 0 ? "len" : ""}`}
              style={`left:${box.minX * pixelSize}px; top:${box.minY * pixelSize}px; width:${(box.maxX - box.minX + 1) * pixelSize}px; height:${(box.maxY - box.minY + 1) * pixelSize}px;`}
              aria-hidden="true"
            ></div>
          {/each}
        {/if}

        {#each model.cells as cell (byKey(cell))}
          <div
            class={`cell kind-${cell.kind} ${cellState(cell)} ${hoveredRegionId === cell.regionId ? "hl" : ""}`}
            style={`grid-column:${cell.x + 1}; grid-row:${cell.y + 1};`}
            onpointerenter={(e) => onEnterCell(e, cell)}
            onfocus={(e) => onEnterCell(e, cell)}
            role="button"
            tabindex="0"
            aria-label={model.regions?.[cell.regionId]?.title ?? "Pixel"}
          >
            {#if cell.kind === "dataPos" && cell.isHead}
              <span class="arrow" aria-hidden="true">{arrowFor(cell.dir)}</span>
            {/if}
          </div>
        {/each}

        {#if visibleBitCells.length}
          {#each visibleBitCells as c (byKey(c))}
            <div
              class="bitIndex"
              style={`left:${c.x * pixelSize + 1}px; top:${c.y * pixelSize + 1}px;`}
              aria-hidden="true"
            >
              {c.bitIndex}
            </div>
          {/each}
        {/if}
      </div>
    </div>
  {/if}

  {#if tooltip}
    <div
      class="tooltip"
      style={`left:${tooltip.x}px; top:${tooltip.y}px;`}
      role="status"
    >
      <div class="tt-title">{tooltip.info.title}</div>
      {#if !hideTooltipDescription}
        <div class="tt-desc">{tooltip.info.description}</div>
      {/if}
      {#if showMaskWarning}
        <div class="tt-warn">
          Achtung: Ab Schritt 11 liegt eine Maske (XOR) über den Daten – Bits
          können dadurch invertiert sein.
        </div>
      {/if}
      {#if tooltip.cell?.bitIndex != null}
        <div class="tt-meta">
          Bit {tooltip.cell.bitIndex}:
          <span class="tt-val">{bitValueText(tooltip.cell)}</span>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .wrap {
    position: relative;
    display: flex;
    justify-content: center;
    padding: 12px;
  }

  /* Quiet zone as pure white margin (no extra modules). */
  .frame {
    display: inline-block;
    padding: var(--m);
    background: #fff;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 14px 40px rgba(0, 0, 0, 0.35);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(var(--size), var(--px));
    grid-template-rows: repeat(var(--size), var(--px));
    position: relative;
    gap: 0;
    padding: 0;
    border-radius: 6px;
    background: #fff;
    border: 1px solid rgba(0, 0, 0, 0.08);
    overflow: hidden;
  }

  .byteBox {
    position: absolute;
    z-index: 4;
    border-radius: 4px;
    border: 1px solid rgba(59, 130, 246, 0.32);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.35);
    background: transparent;
    pointer-events: none;
  }

  .byteBox.len {
    border-color: rgba(167, 139, 250, 0.35);
    background: transparent;
  }

  .cell {
    position: relative;
    z-index: 2;
    width: var(--px);
    height: var(--px);
    outline: none;
    transition:
      transform 80ms ease,
      background-color 80ms ease,
      box-shadow 80ms ease;
  }

  .cell.off {
    background: #fff;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.08);
    border-radius: 2px;
  }

  .cell.unset {
    background: rgba(156, 163, 175, 0.35);
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06);
    border-radius: 2px;
  }

  .cell.reserved {
    background: rgba(239, 68, 68, 0.22);
    box-shadow: inset 0 0 0 1px rgba(239, 68, 68, 0.18);
    border-radius: 2px;
  }

  .cell.data {
    background: rgba(59, 130, 246, 0.18);
    box-shadow: inset 0 0 0 1px rgba(59, 130, 246, 0.2);
    border-radius: 2px;
  }

  .cell.on {
    background: #000;
  }

  .cell.hl {
    transform: scale(1.05);
    box-shadow:
      0 0 0 2px rgba(110, 231, 255, 0.65) inset,
      0 0 0 3px rgba(110, 231, 255, 0.14);
  }

  /* Full-cell hover tint that keeps the original cell color visible. */
  .cell.hl::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: 2px;
    background: rgba(59, 130, 246, 0.28);
    pointer-events: none;
  }

  .bitIndex {
    position: absolute;
    min-width: calc(var(--px) * 0.42);
    height: calc(var(--px) * 0.7);
    padding: 0 2px;
    display: grid;
    place-items: center;
    font-size: calc(var(--px) * 0.38);
    line-height: 1;
    font-weight: 800;
    font-size: 11px;
    color: rgba(0, 0, 0, 0.86);
    background: rgba(255, 255, 255, 0.85);
    border: 1px solid rgba(0, 0, 0, 0.2);
    border-radius: 6px;
    z-index: 5;
    pointer-events: none;
    user-select: none;
  }

  .arrow {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    font-size: calc(var(--px) * 0.7);
    line-height: 1;
    color: rgba(0, 0, 0, 0.7);
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.4);
    pointer-events: none;
    user-select: none;
  }

  .tooltip {
    position: fixed;
    z-index: 50;
    max-width: min(360px, 90vw);
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: rgba(16, 24, 38, 0.92);
    box-shadow: 0 14px 40px rgba(0, 0, 0, 0.45);
    pointer-events: none;
  }

  .tt-title {
    font-weight: 700;
    margin-bottom: 4px;
  }

  .tt-meta {
    margin-top: 8px;
    font-size: 0.95rem;
    color: rgba(231, 238, 252, 0.9);
  }

  .tt-val {
    font-weight: 800;
  }

  .tt-desc {
    color: var(--muted);
    font-size: 0.95rem;
  }

  .tt-warn {
    margin-top: 8px;
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--danger);
  }
</style>
