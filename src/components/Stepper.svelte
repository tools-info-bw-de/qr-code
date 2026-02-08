<script>
  import { iso88591Encode } from "../lib/qrModel.js";
  import { tick } from "svelte";

  const {
    steps = [],
    active = 1,
    onSelect = (id) => {
      void id;
    },
    text = "",
    onTextChange = (next) => {
      void next;
    },
    maskId = null,
    onMaskSelect = (next) => {
      void next;
    },
    onOpenDecodeExercise = () => {},
    decodeExerciseOpen = false,
  } = $props();

  const MAX_BYTES = 17;

  const iso = $derived.by(() => iso88591Encode(text));
  const tooLong = $derived.by(() => iso.byteLength > MAX_BYTES);

  const maskOptions = [
    { id: 0, rule: "(x + y) mod 2 = 0" },
    { id: 1, rule: "y mod 2 = 0" },
    { id: 2, rule: "x mod 3 = 0" },
    { id: 3, rule: "(x + y) mod 3 = 0" },
    { id: 4, rule: "(⌊y/2⌋ + ⌊x/3⌋) mod 2 = 0" },
    { id: 5, rule: "(x·y mod 2) + (x·y mod 3) = 0" },
    { id: 6, rule: "((x·y mod 2) + (x·y mod 3)) mod 2 = 0" },
    { id: 7, rule: "((x + y mod 2) + (x·y mod 3)) mod 2 = 0" },
  ];

  const PREVIEW_SIZE = 7;
  const range = (n) => Array.from({ length: n }, (_, i) => i);
  const previewXs = range(PREVIEW_SIZE);
  const previewYs = range(PREVIEW_SIZE);

  function maskApplies(mask, x, y) {
    const m = Number(mask);
    if (!Number.isFinite(m)) return false;

    if (m === 0) return (x + y) % 2 === 0;
    if (m === 1) return y % 2 === 0;
    if (m === 2) return x % 3 === 0;
    if (m === 3) return (x + y) % 3 === 0;
    if (m === 4) return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
    if (m === 5) return ((x * y) % 2) + ((x * y) % 3) === 0;
    if (m === 6) return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    if (m === 7) return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
    return false;
  }

  const stepEnabled = (step) => {
    if (!step?.enabled) return false;
    if (tooLong && step.id >= 6) return false;
    if (step.id >= 12 && maskId == null) return false;
    return true;
  };

  function selectStep(step) {
    if (!stepEnabled(step)) return;
    onSelect(step.id);
  }
  const binPreview = $derived.by(() => {
    const groups = iso.bytes
      .slice(0, 64)
      .map((b) => b.toString(2).padStart(8, "0"));

    const lines = [];
    for (let i = 0; i < groups.length; i += 8) {
      lines.push(groups.slice(i, i + 8).join(" "));
    }
    return lines.join(" ");
  });

  /** @type {HTMLDivElement | null} */
  let scrollEl = $state(null);

  /** @type {Map<number, HTMLDivElement>} */
  const itemEls = new Map();

  let postOpenScrollTimer = null;

  /**
   * Svelte action: registers each step's root element so we can scroll it into view.
   * @param {HTMLDivElement} node
   * @param {number} id
   */
  function registerItem(node, id) {
    itemEls.set(id, node);
    return {
      destroy() {
        itemEls.delete(id);
      },
    };
  }

  async function ensureActiveFullyVisible(
    /** @type {ScrollBehavior} */ behavior = "smooth",
  ) {
    await tick();
    const container = scrollEl;
    const item = itemEls.get(active);
    if (!container || !item) return;

    const c = container.getBoundingClientRect();
    const r = item.getBoundingClientRect();
    const pad = 10;

    const topDelta = r.top - (c.top + pad);
    const bottomDelta = r.bottom - (c.bottom - pad);

    if (topDelta < 0) {
      container.scrollBy({ top: topDelta, behavior });
      return;
    }

    if (bottomDelta > 0) {
      container.scrollBy({ top: bottomDelta, behavior });
    }
  }

  $effect(() => {
    active;

    if (postOpenScrollTimer) {
      clearTimeout(postOpenScrollTimer);
      postOpenScrollTimer = null;
    }

    void ensureActiveFullyVisible("smooth");

    // The open/close uses a CSS transition; re-check after it settles.
    postOpenScrollTimer = setTimeout(() => {
      void ensureActiveFullyVisible("smooth");
    }, 220);
  });
</script>

<div
  class="stepsWrap"
  bind:this={scrollEl}
  role="navigation"
  aria-label="Schritte"
>
  <div class="steps">
    {#each steps as step (step.id)}
      <div
        class={`item ${step.id === active ? "open" : ""} ${stepEnabled(step) ? "" : "disabled"}`}
        use:registerItem={step.id}
      >
        <button
          class="head"
          type="button"
          disabled={!stepEnabled(step)}
          aria-expanded={step.id === active}
          aria-controls={`step-detail-${step.id}`}
          onclick={() => selectStep(step)}
        >
          <div class="num">{step.id}</div>
          <div class="meta">
            <div class="title">{step.title}</div>
            <div class="short">{step.short}</div>
          </div>
          {#if !step.enabled}
            <div class="soon">später</div>
          {:else}
            <div class={`chev ${step.id === active ? "up" : ""}`}>▾</div>
          {/if}
        </button>

        <div class="detail" id={`step-detail-${step.id}`}>
          <div class="detailInner">
            {#if step.detail}
              <p class="p">{@html step.detail}</p>
            {/if}

            {#if step.id === 1}
              <ul class="p">
                <li>
                  Hier geht es um die <b>Codierung</b> (also die Erstellung) und
                  nicht um die Dekodierung (also das Lesen) eines
                  <abbr
                    title="'Quick Response' ('schnelle Antwort'), 1994 in Japan entwickelt. "
                    >QR-Codes</abbr
                  >.<br />
                  Die Reihenfolge der Schritte ist wichtig!
                </li>
                <li>Mit jedem Schritt wird der QR-Code erweitert.</li>
                <li>
                  Fahre mit der Maus über den QR-Code, um zu jedem Schritt eine
                  Erklärung der Bereiche anzuzeigen.
                </li>
                <li>
                  <b
                    ><u>Einschränkung:</u> Diese Seite unterstützt nur einfachste
                    QR-Codes (21×21 Pixel groß) für kurzen Text (max. 17 Bytes) mit
                    geringer Fehlerkorrektur.</b
                  >
                </li>
              </ul>
            {/if}

            {#if step.id === 2}
              <p class="hint">
                Tipp: Hover mit der Maus über den QR-Code, um eine Erklärung zu
                sehen.
              </p>
            {/if}

            {#if step.id === 3}{/if}

            {#if step.id === 4}
              <div class="pillrow">
                <div class="pill">
                  <span class="k">Mode</span> <span class="v">0100</span>
                </div>
                <div class="pill">
                  <span class="k">Typ</span> <span class="v">Byte</span>
                </div>
              </div>
              <p class="hint">
                Fahre mit der Maus über den 2x2-Block, um die Zähl-Reihenfolge
                der Bits zu sehen.
              </p>
            {/if}

            {#if step.id === 5}
              <label class="label">
                Text
                <input
                  class="input"
                  type="text"
                  value={text}
                  placeholder="z.B. Hallo"
                  maxlength="40"
                  oninput={(e) => onTextChange(e.currentTarget.value)}
                />
              </label>

              {#if tooLong}
                <div class="warning">
                  Zu lang: <b>{iso.byteLength}</b> Bytes (max. {MAX_BYTES}).
                  Bitte kürzen – Alle weiteren Schritte sind gesperrt.
                </div>
              {/if}

              <div class="isoBox">
                <div class="isoRow">
                  <div class="isoKey">
                    Mit ISO‑8859‑1 erkannt wurde: <code>{iso.text}</code>
                  </div>
                </div>
                <div class="isoRow">
                  <div class="isoKey">
                    Byte‑Länge: <code>{iso.byteLength}</code>
                  </div>
                </div>
                {#if iso.replaced > 0}
                  <div class="warning small">
                    Hinweis: {iso.replaced} Zeichen waren nicht in ISO‑8859‑1 darstellbar
                    und wurden durch <b>?</b> ersetzt.
                  </div>
                {/if}
                <div class="small">
                  Bytes (binär, 8 Bit){iso.byteLength > 64
                    ? " (erste 64)"
                    : ""}:
                </div>
                <pre
                  class="codeBlock"
                  aria-label="ISO-8859-1 Bytes (binär)">{binPreview}</pre>
              </div>
            {/if}

            {#if step.id === 6}
              <p class="hint">
                Fahre mit der Maus über die blauen Byte-Positionen, um die
                Zähl-Reihenfolge der Bytes zu sehen.
              </p>
            {/if}

            {#if step.id === 7}
              <p class="hint">
                Jetzt wird das <b>Längenfeld</b> geschrieben:
                <b>{iso.byteLength}</b>
                als 8-Bit-Zahl.
              </p>
              <div class="pillrow">
                <div class="pill">
                  <span class="k">Länge</span>
                  <span class="v">{iso.byteLength}</span>
                </div>
                <div class="pill">
                  <span class="k">binär</span>
                  <span class="v"
                    >{iso.byteLength.toString(2).padStart(8, "0")}</span
                  >
                </div>
              </div>
            {/if}

            {#if step.id === 8}
              <p class="hint">Erinnerung: Die Eingabe aus Schritt 5 lautet:</p>
              <code>{iso.text}</code>
              <pre
                class="codeBlock"
                aria-label="ISO-8859-1 Bytes (binär)">{binPreview}</pre>
            {/if}

            {#if step.id === 9}{/if}

            {#if step.id === 10}{/if}

            {#if step.id === 11}
              <div class="maskGrid" role="group" aria-label="Masken-Auswahl">
                {#each maskOptions as m (m.id)}
                  <button
                    type="button"
                    class={`maskBtn ${maskId === m.id ? "sel" : ""}`}
                    onclick={() => onMaskSelect(maskId === m.id ? null : m.id)}
                  >
                    <div class="mMeta">
                      <div class="mTitle">Maske {m.id}</div>
                      <div class="mRule">{m.rule}</div>
                    </div>
                    <div
                      class="mPreview"
                      style={`--pv:${PREVIEW_SIZE};`}
                      aria-hidden="true"
                    >
                      {#each previewYs as y}
                        {#each previewXs as x}
                          <span
                            class={`pCell ${maskApplies(m.id, x, y) ? "on" : ""}`}
                          ></span>
                        {/each}
                      {/each}
                    </div>
                  </button>
                {/each}
              </div>
              {#if maskId == null}
                <div class="warning">
                  Bitte wähle eine Maske aus, sonst geht es nicht weiter.
                </div>
              {/if}
            {/if}

            {#if step.id === 12}
              <p class="p">
                Zum Schluss wird der <b>Format-String</b> in die zuvor
                reservierten roten Felder geschrieben:
                <b>Fehlerkorrektur-Level</b>
                (hier immer
                <b>Low/L</b> = Bitfolge <code>01</code>) + <b>Masken-ID</b> in
                binär (aktuell <code>{maskId}</code> = binär
                <code
                  >{maskId != null
                    ? maskId.toString(2).padStart(3, "0")
                    : ""}</code
                >). Anschließend wird auch für diese 5 Bits des Formatstrings
                noch eine Fehlerkorrektur berechnet und angehängt. Dieser String
                wird zusätzlich auf eine andere Art maskiert.<br /><br />Damit
                hast du es geschafft 🎉 Du kannst den QR-Code nun
                <b>einscannen</b>.
              </p>

              {#if !decodeExerciseOpen}
                <div class="decodeCta">
                  <button
                    class="decodeBtn"
                    type="button"
                    onclick={() => onOpenDecodeExercise()}
                  >
                    Decode-Aufgabe öffnen
                  </button>
                </div>
              {:else}
                <div class="warning">
                  Die Decode-Aufgabe ist geöffnet. Scrolle nach unten, um sie zu
                  sehen.
                </div>
              {/if}
            {/if}
          </div>
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .stepsWrap {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-right: 4px;
  }

  .warning {
    color: #fbbf24 !important;
  }

  .maskGrid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
    margin-top: 10px;
  }

  .decodeCta {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 12px;
  }

  .decodeBtn {
    border-radius: 12px;
    border: 1px solid rgba(110, 231, 255, 0.55);
    background: rgba(110, 231, 255, 0.08);
    color: var(--text);
    padding: 10px 12px;
    cursor: pointer;
    font-weight: 750;
  }

  .decodeBtn:hover {
    border-color: rgba(110, 231, 255, 0.9);
    box-shadow: 0 0 0 3px rgba(110, 231, 255, 0.12);
  }

  .maskBtn {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 12px;
    text-align: left;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: rgba(255, 255, 255, 0.02);
    color: var(--text);
    padding: 10px 10px;
    cursor: pointer;
    transition:
      border-color 140ms ease,
      box-shadow 140ms ease,
      background 140ms ease;
  }

  .maskBtn:hover {
    border-color: rgba(110, 231, 255, 0.55);
    box-shadow: 0 0 0 3px rgba(110, 231, 255, 0.08);
  }

  .maskBtn.sel {
    border-color: rgba(110, 231, 255, 0.9);
    box-shadow: 0 0 0 3px rgba(110, 231, 255, 0.12);
    background: rgba(110, 231, 255, 0.06);
  }

  .maskBtn.sel .mPreview {
    border-color: rgba(110, 231, 255, 0.55);
  }

  .mMeta {
    min-width: 0;
  }

  .mPreview {
    --cell: 5px;
    display: grid;
    grid-template-columns: repeat(var(--pv), var(--cell));
    grid-auto-rows: var(--cell);
    padding: 6px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: rgba(136, 136, 136, 0.849);
  }

  .pCell {
    background: rgba(231, 238, 252, 0.92);
  }

  .pCell.on {
    background: rgba(0, 0, 0, 0.8);
  }

  .mTitle {
    font-weight: 700;
    margin-bottom: 2px;
  }

  .mRule {
    font-size: 12px;
    opacity: 0.85;
  }

  .steps {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .item {
    border-radius: 14px;
    border: 1px solid var(--border);

    overflow: hidden;
    transition:
      border-color 140ms ease,
      box-shadow 140ms ease;
  }

  .item.open {
    border-color: rgba(110, 231, 255, 0.75);
    box-shadow: 0 0 0 3px rgba(110, 231, 255, 0.1);
  }

  .item.disabled {
    opacity: 0.55;
  }

  .head {
    width: 100%;
    display: grid;
    grid-template-columns: 30px 1fr auto;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border: 0;
    background: transparent;
    color: var(--text);
    text-align: left;
    cursor: pointer;
  }

  .head:hover:not(:disabled) {
    background: rgba(110, 231, 255, 0.06);
  }

  .isoBox {
    margin-top: 10px;
    padding: 10px;
    border-radius: 12px;
    border: 1px solid rgba(110, 231, 255, 0.22);
    background: rgba(59, 130, 246, 0.08);
  }

  .isoRow {
    display: grid;
    gap: 8px;
    padding: 4px 0;
  }

  /* All code areas slightly blue tinted */
  code {
    padding: 2px 6px;
    border-radius: 8px;
    border: 1px solid rgba(110, 231, 255, 0.22);
    background: rgba(59, 130, 246, 0.1);
    color: rgba(231, 238, 252, 0.96);
  }

  .codeBlock {
    margin: 6px 0 0 0;
    padding: 8px 10px;
    border-radius: 10px;
    border: 1px solid rgba(110, 231, 255, 0.22);
    background: rgba(59, 130, 246, 0.1);
    color: rgba(231, 238, 252, 0.92);
    overflow: auto;
    max-height: 140px;
    font-size: 0.9rem;
    line-height: 1.35;
    white-space: pre-wrap;
  }

  .head:disabled {
    cursor: not-allowed;
  }

  .num {
    width: 30px;
    height: 30px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    font-weight: 800;
    background: rgba(110, 231, 255, 0.18);
    color: var(--text);
  }

  .title {
    font-weight: 700;
    line-height: 1.1;
  }

  .short {
    color: var(--muted);
    font-size: 0.95rem;
    margin-top: 3px;
  }

  .soon {
    font-size: 0.85rem;
    color: rgba(167, 139, 250, 0.9);
    padding: 4px 8px;
    border: 1px solid rgba(167, 139, 250, 0.35);
    border-radius: 999px;
  }

  .chev {
    font-size: 1.05rem;
    color: var(--muted);
    transition: transform 140ms ease;
    padding: 4px 8px;
    border-radius: 10px;
  }

  .chev.up {
    transform: rotate(180deg);
  }

  .detail {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows 180ms ease;
  }

  .item.open .detail {
    grid-template-rows: 1fr;
  }

  .detailInner {
    overflow: hidden;
    padding: 0 12px 12px 12px;
  }

  .p {
    margin: 6px 0;
    color: rgba(231, 238, 252, 0.92);
  }

  .hint {
    margin: 8px 0 0 0;
    color: var(--muted);
  }

  .pillrow {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 10px;
  }

  .pill {
    display: inline-flex;
    gap: 10px;
    align-items: center;
    padding: 8px 10px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: rgba(0, 0, 0, 0.18);
  }

  .pill .k {
    color: var(--muted);
    font-weight: 650;
  }

  .pill .v {
    font-weight: 800;
  }

  .label {
    display: grid;
    gap: 6px;
    margin-top: 10px;
    color: var(--muted);
  }

  .input {
    width: 100%;
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: rgba(0, 0, 0, 0.22);
    color: var(--text);
    outline: none;
  }

  .input:focus {
    border-color: rgba(110, 231, 255, 0.65);
    box-shadow: 0 0 0 3px rgba(110, 231, 255, 0.1);
  }

  .small {
    margin-top: 8px;
    color: var(--muted);
    font-size: 0.95rem;
  }
</style>
