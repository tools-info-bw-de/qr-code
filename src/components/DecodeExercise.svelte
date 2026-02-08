<script>
  import QrGrid from "./QrGrid.svelte";
  import { tick } from "svelte";
  import qr_kaputt from "../lib/assets/qr_kaputt.png";

  const { model, text } = $props();

  let showByteFrames = $state(true);
  let showBitNumbers = $state(false);

  /** @type {number | null} */
  let activeByteIndex = $state(null);

  const bytes = $derived.by(() => {
    if (!text) return [];
    // ISO-8859-1 / Latin-1 encoding (1 byte per char for this task)
    return Array.from(text, (ch) => ch.charCodeAt(0) & 0xff);
  });

  const expectedBits = $derived.by(() =>
    bytes.map((b) => b.toString(2).padStart(8, "0")),
  );

  const expectedLengthBits = $derived.by(() =>
    (bytes.length ?? 0).toString(2).padStart(8, "0"),
  );

  let lengthInput = $state("");
  /** @type {HTMLInputElement | null} */
  let lengthInputEl = $state(null);

  /** @type {Array<HTMLInputElement | null>} */
  const byteInputEls = [];

  /**
   * Svelte action: register/unregister byte input elements for focus control.
   * @param {HTMLInputElement} node
   * @param {number} i
   */
  function registerByteInput(node, i) {
    byteInputEls[i] = node;
    return {
      destroy() {
        if (byteInputEls[i] === node) byteInputEls[i] = null;
      },
    };
  }

  let inputs = $state([]);

  $effect(() => {
    inputs = expectedBits.map(() => "");
    lengthInput = "";
  });

  function normalizeBits(value) {
    return String(value ?? "")
      .replace(/[^01]/g, "")
      .slice(0, 8);
  }

  async function onInput(i, ev) {
    const v = normalizeBits(ev.currentTarget.value);
    inputs[i] = v;

    if (v.length === 8 && v === expectedBits[i]) {
      await tick();
      const next = byteInputEls[i + 1];
      if (next && !next.disabled) {
        next.focus();
        next.select?.();
      }
    }
  }

  async function onLengthInput(ev) {
    lengthInput = normalizeBits(ev.currentTarget.value);

    if (lengthInput.length === 8 && lengthInput === expectedLengthBits) {
      await tick();
      const first = byteInputEls[0];
      if (first && !first.disabled) {
        first.focus();
        first.select?.();
      }
    }
  }

  function focusLength() {
    activeByteIndex = 0;
  }

  function blurLength() {
    if (activeByteIndex === 0) activeByteIndex = null;
  }

  function focusByte(i) {
    activeByteIndex = i + 1;
  }

  function blurByte(i) {
    if (activeByteIndex === i + 1) activeByteIndex = null;
  }

  function byteToChar(b) {
    return String.fromCharCode(b);
  }

  function isComplete(i) {
    return (inputs[i] ?? "").length === 8;
  }

  function isCorrect(i) {
    return isComplete(i) && inputs[i] === expectedBits[i];
  }

  function isLengthComplete() {
    return (lengthInput ?? "").length === 8;
  }

  function isLengthCorrect() {
    return isLengthComplete() && lengthInput === expectedLengthBits;
  }

  function isByteEnabled(i) {
    if (!isLengthCorrect()) return false;
    if (i === 0) return true;
    for (let k = 0; k < i; k++) {
      if (!isCorrect(k)) return false;
    }
    return true;
  }

  const decodedSoFar = $derived.by(() => {
    if (!isLengthCorrect()) return "";

    let out = "";
    for (let i = 0; i < expectedBits.length; i++) {
      const v = inputs[i] ?? "";
      if (v.length !== 8) break;
      if (v !== expectedBits[i]) break;
      out += byteToChar(bytes[i]);
    }
    return out;
  });
</script>

<section class="decodeChapter" aria-label="Decode-Aufgabe">
  <h2>Aufgabe: QR-Code selbst decodieren</h2>
  <div id="decodeIntro">
    <img
      src={qr_kaputt}
      alt="Kaputter QR-Code"
      style="float: right; margin: 0 0 8px 8px; width: 120px; height: 120px;"
    />
    Der rechte kleine QR-Code ist leider kaputt und kann nicht automatisch gelesen
    werden. Man kann aber noch manuell die Maskierung entfernen und anschließend
    die Bits <b>händisch</b> auslesen. Genau das ist deine Aufgabe!<br />

    <p style="color: #fbbf24">
      Es lohnt sich - es wartet eine süße Belohnung auf dich, wenn du es
      schaffst! 🐹
    </p>
    <ul>
      <li>
        Unten siehst du denselben QR-Code, NACHDEM die Maske entfernt wurde. Du
        kannst also nun direkt die Bits pro Byte-Block aus dem großen QR-Code
        auslesen.
      </li>
      <li>
        Tippe pro Byte-Block die 8 Bits in die Eingabefelder ein (nur 0 und 1,
        keine Leerzeichen).
      </li>
      <li>
        Deine Eingabe wird automatisch überprüft. Nur wenn das Byte korrekt ist,
        geht es mit dem nächsten Byte weiter.
      </li>
      <li>
        Falls du gerade gar nicht weißt, was zu tun ist: Deine Aufgabe
        entspricht quasi den Schritten 6-9 aus der oberen Erklärung.
      </li>
    </ul>
  </div>

  <div class="decodeLayout">
    <div class="decodeLeft">
      <div class="decodeInputs" aria-label="Byte-Eingaben">
        <div class="decodeHeader">
          <div>Block</div>
          <div>Bits (8)</div>
          <div>Status</div>
          <div>Zeichen</div>
        </div>

        <div class="decodeRow">
          <div class="cell mono">Länge</div>
          <div class="cell">
            <input
              class={`bitInput mono ${isLengthComplete() ? (isLengthCorrect() ? "ok" : "bad") : ""}`}
              inputmode="numeric"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
              maxlength="8"
              bind:this={lengthInputEl}
              value={lengthInput}
              oninput={onLengthInput}
              onfocus={focusLength}
              onblur={blurLength}
              aria-label="Bits für Längenfeld"
            />
          </div>
          <div class="cell">
            {#if isLengthComplete()}
              {#if isLengthCorrect()}
                <span class="status ok">korrekt</span>
              {:else}
                <span class="status bad">falsch</span>
              {/if}
            {:else}
              <span class="status idle">…</span>
            {/if}
          </div>
          <div class="cell mono">
            {#if isLengthCorrect()}
              {bytes.length}
            {/if}
          </div>
        </div>

        {#each expectedBits as _bits, i (i)}
          <div class="decodeRow">
            <div class="cell mono">{i + 1}</div>
            <div class="cell">
              <input
                class={`bitInput mono ${isComplete(i) ? (isCorrect(i) ? "ok" : "bad") : ""}`}
                inputmode="numeric"
                autocomplete="off"
                autocapitalize="off"
                spellcheck="false"
                maxlength="8"
                disabled={!isByteEnabled(i)}
                value={inputs[i]}
                use:registerByteInput={i}
                oninput={(e) => onInput(i, e)}
                onfocus={() => focusByte(i)}
                onblur={() => blurByte(i)}
                aria-label={`Bits für Byte ${i + 1}`}
              />
            </div>
            <div class="cell">
              {#if isComplete(i)}
                {#if isCorrect(i)}
                  <span class="status ok">korrekt</span>
                {:else}
                  <span class="status bad">falsch</span>
                {/if}
              {:else}
                <span class="status idle">…</span>
              {/if}
            </div>
            <div class="cell mono">
              {#if isCorrect(i)}
                {byteToChar(bytes[i])}
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>

    <div class="decodeRight" aria-label="QR-Code (unmaskiert)">
      <QrGrid
        {model}
        pixelSize={20}
        quietMargin={72}
        {showByteFrames}
        {showBitNumbers}
        bitNumbersOnlyWhenEnabled={true}
        hideByteTooltipContent={true}
        {activeByteIndex}
      />

      <div class="decodeToggles" aria-label="Anzeigeoptionen">
        <label class="toggle">
          <input type="checkbox" bind:checked={showByteFrames} />
          Rahmen der Byte-Blöcke anzeigen
        </label>
        <label class="toggle">
          <input type="checkbox" bind:checked={showBitNumbers} />
          Bit-Nummern (1–8) pro Byte anzeigen
        </label>
      </div>

      {#if decodedSoFar.length > 0}
        <div class="decodedBox" aria-label="Bisher decodierte Lösung">
          <div class="decodedLabel">Bisher decodiert</div>
          <div class="decodedValue mono">{decodedSoFar}</div>
        </div>
      {/if}
    </div>
  </div>
</section>

<style>
  #decodeIntro {
    margin-bottom: 50px;
  }

  .decodeChapter {
    margin-top: 50px;
    padding: 16px;
    min-width: 0;
  }

  .decodeLayout {
    display: grid;
    grid-template-columns: minmax(380px, 1fr) minmax(560px, 1.2fr);
    gap: 16px;
    align-items: start;
    margin-top: 12px;
  }

  .decodeLeft,
  .decodeRight {
    min-width: 0;
  }

  .decodeToggles {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 10px;
  }

  .toggle {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .decodeInputs {
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
  }

  .decodeHeader,
  .decodeRow {
    display: grid;
    grid-template-columns: 70px minmax(200px, 1fr) 120px 90px;
    gap: 10px;
    align-items: center;
    padding: 10px 12px;
  }

  .decodeHeader {
    background: var(--panel);
    border-bottom: 1px solid var(--border);
    font-weight: 600;
  }

  .decodeRow {
    border-bottom: 1px solid var(--border);
  }

  .decodeRow:last-child {
    border-bottom: none;
  }

  .cell {
    min-width: 0;
  }

  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
      "Liberation Mono", "Courier New", monospace;
  }

  .bitInput {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--bg);
    color: var(--text);
    outline: none;
  }

  .bitInput:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .decodedBox {
    margin-top: 12px;
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.02);
  }

  .decodedLabel {
    font-weight: 750;
    margin-bottom: 6px;
  }

  .decodedValue {
    min-height: 1.4em;
    overflow-wrap: anywhere;
  }

  .bitInput.ok {
    border-color: var(--accent);
  }

  .bitInput.bad {
    border-color: var(--danger);
  }

  .status {
    font-weight: 600;
  }

  .status.ok {
    color: var(--accent);
  }

  .status.bad {
    color: var(--danger);
  }

  .status.idle {
    opacity: 0.7;
  }

  @media (max-width: 1020px) {
    .decodeLayout {
      grid-template-columns: 1fr;
    }
  }
</style>
