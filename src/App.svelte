<script>
  import Stepper from "./components/Stepper.svelte";
  import QrGrid from "./components/QrGrid.svelte";
  import DecodeExercise from "./components/DecodeExercise.svelte";
  import { buildQrGrid, iso88591Encode } from "./lib/qrModel.js";

  const AUTHOR_NAME = "Marco Kümmel";
  const SOURCE_URL = "https://github.com/tools-info-bw-de/qr-code";
  const LICENSE_URL = `${SOURCE_URL}/blob/HEAD/LICENSE`;

  let infoOpen = $state(false);
  /** @type {HTMLButtonElement | null} */
  let infoBtnEl = $state(null);
  /** @type {HTMLDivElement | null} */
  let infoPopEl = $state(null);

  const steps = [
    {
      id: 1,
      title: "Einführung",
      short: "Worum geht es hier?",
      enabled: true,
      detail: "",
    },
    {
      id: 2,
      title: "Basis-Erkennungsmuster",
      short: "Position + Synchronisation",
      enabled: true,
      detail:
        'Damit ein Scanner später überhaupt erkennt, dass er einen QR-Code vor sich hat, gibt es die drei großen <b>Erkennungsmuster</b> in den Ecken.<br/><br/>Die "gepunkteten" Streifen dazwischen dienen der <b>Synchronisation</b>: Sie helfen dem Scanner, die Größe der einzelnen Module (Pixel) zu bestimmen. Das ist wichtig, wenn der QR-Code z.B. schräg gescannt wird, um die Verzerrung berücksichtigen zu können.<br/><br/>Der einzelne schwarze Punkt heißt <b>Dark Module</b>. Er dient u. a. als Referenzpunkt für die schwarze Farbe.',
    },
    {
      id: 3,
      title: "Format (reserviert)",
      short: "Enthält Metadaten zum QR-Code (später)",
      enabled: true,
      detail:
        "Um die Erkennungsmuster herum gibt es reservierte Felder für den <b>Format-String</b>. Er enthält Metadaten über den QR-Code (Fehlerkorrektur-Level & Masken-ID). Eine Erklärung dazu folgt später.<br/><br/>Wir markieren diese Plätze jetzt schon (hellrot) – sie werden erst ganz am Ende mit Daten gefüllt.<br/><br/>Alle Pixel, die jetzt noch frei sind, können ab dem nächsten Schritt für die eigentlichen Daten genutzt werden.",
    },
    {
      id: 4,
      title: "Codierungsmodus",
      short: "Festlegung des Datentyps (Byte, Alphanumerisch, ...)",
      enabled: true,
      detail:
        "Im rechts-unteren 2x2-Block steht binär codiert, um welche Art von Daten es sich handelt. In dieser Demo wird nur der Byte-Modus unterstützt (0100).<br/>Daten werden immer im Zickzack-Muster geschrieben.",
    },
    {
      id: 5,
      title: "Text eingeben",
      short: "Welchen Text soll der QR-Code enthalten?",
      enabled: true,
      detail:
        'Hier kannst du den Text eingeben, der codiert werden soll. Es wird <abbr title="Eine Codierungsvorschrift vergleichbar mit ASCII oder UTF-8">ISO‑8859‑1</abbr> (Latin‑1) verwendet und die resultierenden Bytes + Byte-Länge werden angezeigt. In diesem Schritt wird keine Änderung im QR-Code vorgenommen.',
    },
    {
      id: 6,
      title: "Nutzdaten: Byte-Positionen",
      short: "Zickzack von rechts + Leserichtung",
      enabled: true,
      detail:
        "Hier siehst du nur, <b>wo</b> die Bytes später liegen und in welcher <b>Richtung und Reihenfolge</b> sie gelesen/geschrieben werden: von rechts nach links in einem Zickzack. Pfeile markieren die Leserichtung pro Byte. Die Pixel bleiben in diesem Schritt noch ungefüllt.",
    },
    {
      id: 7,
      title: "Längenfeld",
      short: "Byte-Länge eintragen (8 Bits)",
      enabled: true,
      detail:
        "Jetzt wird das <b>Längenfeld</b> (8 Bit) in den QR-Zickzack geschrieben: die Byte-Länge der Nutzdaten. Es beginnt <b>direkt nach</b> den 4 Mode-Bits (0100).",
    },
    {
      id: 8,
      title: "Restliche Bytes",
      short: "Nutzdaten schreiben (Byte 1, 2, ...)",
      enabled: true,
      detail:
        "Jetzt werden die <b>Nutzdaten-Bytes</b> (Byte 1, Byte 2, …) bitweise in der QR-Schreibreihenfolge eingetragen.",
    },
    {
      id: 9,
      title: "Stop-Block",
      short: "4 Bit weiß (0000)",
      enabled: true,
      detail:
        "Als nächstes fügen wir einen <b>Stop-Block</b> hinzu: <b>4 Bits</b> mit dem Wert <code>0000</code> (also nur 0-Bits = weiß). <br/>Dieser Block markiert das Ende der eigentlichen Nutzdaten. Prinzipiell ist dieser Block insofern unnötig, da man durch die Längenangabe zu Beginn ja weiß, wie viele Daten man einlesen muss. <br/><br/>Alle weiteren Bits nach diesem Block gehören nicht mehr zu den Daten, sondern werden u. a. für die Fehlerkorrektur verwendet.",
    },
    {
      id: 10,
      title: "Fehlerkorrektur (Low)",
      short: "Reed–Solomon (7 Bytes) berechnen + schreiben",
      enabled: true,
      detail:
        'Nach dem Stop-Block (0000) füllen wir zunächst die restlichen Datenplätze bis zur Daten-Kapazität (hier 17 Bytes) mit Auffüll-Bytes (abwechselnd <code>11101100</code>/<code>00010001</code>) auf.<br/><br/> Anschließend berechnen wir die <b>Reed–Solomon</b>-Fehlerkorrektur (Level <b>Low</b>): aus den vorherigen Daten-Bytes werden <b>7 Fehlerkorrektur-Bytes</b> erzeugt und in den QR-Zickzack geschrieben.<br/><br/>Die Mathematik dahinter ist ziemlich kompliziert. Wer interessiert ist, kann z. B. <a href="https://en.wikipedia.org/wiki/QR_code#Error_correction" target="_blank" rel="noreferrer">diesen Wikipedia-Artikel</a> lesen.',
    },
    {
      id: 11,
      title: "Maske",
      short: "Eine von 8 Masken anwenden",
      enabled: true,
      detail:
        "Je nachdem, welche Daten du eingegeben hast, kann es nun vorkommen, dass die geschriebenen Pixel für große gleichmäßig gefärbte Flächen sorgen. <i>Das kannst du z. B. nachvollziehen, indem du bei Schritt 5 ganze 17x den Buchstaben 'ü' als Zeichen eingibst.</i><br/><br/>Die Kamera hätte nun vielleicht Schwierigkeiten genau zu erkennen, wo ein Pixel aufhört und das andere beginnt.<br/>Daher muss nun eine sogenannte Maske ausgewählt werden. Insgesamt gibt es 8 zur Auswahl. Die Maske wird nur auf die <b>Datenmodule</b> angewendet und <b>nicht</b> auf Erkennungsmuster/Synchronisation/Dark-Module oder den Format-String.<br/><br/>Die Maske wird vollständig über die Datenpixel gelegt und dann per XOR angewendet, d. h. sie kehrt die originalen Pixel überall dort um, wo das Maskenpixel 1 ist.<br/><br/>In echt prüft ein komplexer Algorithmus alle Masken durch und wählt den \"besten\" aus. Hier kannst du einfach alle Masken auswählen und die deiner Meinung nach beste Maske nutzen (die QR-Code-Erkennung sollte später in der Regel mit allen Masken funktionieren).",
    },
    {
      id: 12,
      title: "Format-String",
      short: "Fehlerkorrektur-Level + Masken-ID eintragen",
      enabled: true,
      detail: "",
    },
  ];

  let active = $state(1);
  let text = $state("Informatik");
  let maskId = $state(null);

  const EXERCISE_TEXT = "t1p.de/zq8tt";
  let decodeExerciseOpen = $state(false);

  const iso = $derived.by(() => iso88591Encode(text));
  const tooLong = $derived.by(() => iso.byteLength > 17);

  const model = $derived.by(() => buildQrGrid(active, text, maskId));
  const decodeModel = $derived.by(() => buildQrGrid(10, EXERCISE_TEXT, null));

  function select(id) {
    if (tooLong && id >= 6) return;
    if (id >= 12 && maskId == null) return;
    active = id;
  }

  function onMaskSelect(next) {
    maskId = next;
    if (next == null && active >= 12) {
      active = 11;
    }
  }

  function onTextChange(next) {
    text = next;

    const nextLen = iso88591Encode(next).byteLength;
    if (nextLen > 17 && active >= 6) {
      active = 5;
    }
  }

  function openDecodeExercise() {
    decodeExerciseOpen = true;
  }

  $effect(() => {
    if (!infoOpen) return;

    /** @param {KeyboardEvent} e */
    const onKeyDown = (e) => {
      if (e.key === "Escape") infoOpen = false;
    };

    /** @param {PointerEvent} e */
    const onPointerDown = (e) => {
      const t = /** @type {Node | null} */ (e.target);
      if (!t) return;
      if (infoBtnEl && infoBtnEl.contains(t)) return;
      if (infoPopEl && infoPopEl.contains(t)) return;
      infoOpen = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  });
</script>

<div class="infoRoot">
  <button
    class="infoBtn"
    type="button"
    bind:this={infoBtnEl}
    aria-haspopup="dialog"
    aria-expanded={infoOpen}
    aria-controls="author-info"
    onclick={() => (infoOpen = !infoOpen)}
  >
    info
  </button>

  {#if infoOpen}
    <div
      class="infoPop"
      id="author-info"
      bind:this={infoPopEl}
      role="dialog"
      aria-label="Info"
    >
      <div class="infoTitle">Info</div>
      <div class="infoRow"><span class="k">Autor</span> {AUTHOR_NAME}</div>
      <div class="infoRow">
        <span class="k">Lizenz</span>
        <span class="v">
          GNU GPL v3 (
          <a href={LICENSE_URL} target="_blank" rel="noreferrer">LICENSE</a>
          )
        </span>
      </div>
      <div class="infoRow">
        <span class="k">Quellcode</span>
        <span class="v">
          <a href={SOURCE_URL} target="_blank" rel="noreferrer">{SOURCE_URL}</a>
        </span>
      </div>
    </div>
  {/if}
</div>

<div class="page">
  <div class="content">
    <div class="viewport">
      <header class="top">
        <div class="brand">
          <div class="logo">QR</div>
          <div>
            <div class="h1">QR-Code Erklärung – Schritt für Schritt</div>
            <div class="sub">
              Hier wird Schritt für Schritt gezeigt, wie ein QR-Code aufgebaut
              ist.<br />
              <b>Klicke</b> dich links durch die einzelnen Schritte. Fahre mit
              der
              <b>Maus</b> über den QR-Code, um eine Erklärung der Bereiche anzuzeigen.
            </div>
          </div>
        </div>
      </header>

      <main class="main">
        <section class="left">
          <Stepper
            {steps}
            {active}
            onSelect={select}
            {text}
            {onTextChange}
            {maskId}
            {onMaskSelect}
            onOpenDecodeExercise={openDecodeExercise}
            {decodeExerciseOpen}
          />
        </section>

        <section class="right">
          <div class="rightTop">
            <div class="rightTitle">QR-Ansicht</div>
            <div class="rightSub">
              Hover über ein Modul (Pixel), um den Bereich zu sehen.
            </div>
          </div>

          <QrGrid {model} pixelSize={20} showByteFrames={false} />

          <div class="legend">
            <div class="lg"><span class="sw unset"></span> ungenutzt</div>
            <div class="lg">
              <span class="sw reserved"></span> reserviert (Format)
            </div>
            <div class="lg"><span class="sw data"></span> Byte-Position</div>
            <div class="lg"><span class="sw off"></span> 0</div>
            <div class="lg"><span class="sw on"></span> 1</div>
            <div class="lg"><span class="sw hl"></span> Hover-Highlight</div>
          </div>
        </section>
      </main>
    </div>

    {#if decodeExerciseOpen}
      <div>
        <DecodeExercise model={decodeModel} text={EXERCISE_TEXT} />
      </div>
    {/if}
  </div>
</div>

<style>
  .infoRoot {
    position: fixed;
    top: 12px;
    right: 12px;
    z-index: 200;
  }

  .infoBtn {
    border-radius: 999px;
    border: 1px solid var(--border);
    background: rgba(255, 255, 255, 0.03);
    color: var(--text);
    padding: 7px 12px;
    font-weight: 750;
    cursor: pointer;
  }

  .infoBtn:hover {
    border-color: rgba(110, 231, 255, 0.55);
    box-shadow: 0 0 0 3px rgba(110, 231, 255, 0.08);
  }

  .infoPop {
    position: absolute;
    top: calc(100% + 10px);
    right: 0;
    width: min(360px, calc(100vw - 24px));
    padding: 12px;
    border-radius: 14px;
    border: 1px solid var(--border);
    background: rgba(16, 24, 38, 0.92);
    box-shadow: 0 14px 40px rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(8px);
  }

  .infoTitle {
    font-weight: 850;
    margin-bottom: 8px;
  }

  .infoRow {
    display: grid;
    grid-template-columns: 86px 1fr;
    gap: 10px;
    padding: 4px 0;
    align-items: start;
  }

  .infoRow .k {
    color: var(--muted);
    font-weight: 700;
  }

  .infoRow .v {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  :global(code) {
    padding: 2px 6px;
    border-radius: 8px;
    border: 1px solid rgba(110, 231, 255, 0.22);
    background: rgba(59, 130, 246, 0.1);
    color: rgba(231, 238, 252, 0.96);
  }

  :global(html, body, #app) {
    height: 100%;
  }

  /* Desktop: prevent body scroll; the page itself is the scroll container. */
  @media (min-width: 1021px) {
    :global(body) {
      overflow: hidden;
    }
  }

  /* Mobile: normal document scroll. */
  @media (max-width: 1020px) {
    :global(body) {
      overflow: auto;
    }
  }

  .page {
    width: 100%;
    height: 100dvh;
    overflow-y: auto;
  }

  .content {
    max-width: 1180px;
    margin: 0 auto;
    padding: 18px;
  }

  .viewport {
    height: calc(100dvh - 36px);
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .top {
    margin-bottom: 16px;
    position: sticky;
    top: 0;
    z-index: 140;
    padding-top: 0;
    padding-bottom: 0;
    /* background: var(--bg); */
  }

  .brand {
    margin-top: 10px;
    display: flex;
    gap: 14px;
    align-items: center;
    padding: 14px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--bg);
  }

  .logo {
    width: 44px;
    height: 44px;
    border-radius: 14px;
    display: grid;
    place-items: center;
    font-weight: 900;
    letter-spacing: 0.5px;
    background: linear-gradient(
      135deg,
      rgba(110, 231, 255, 0.35),
      rgba(167, 139, 250, 0.22)
    );
    border: 1px solid rgba(255, 255, 255, 0.12);
  }

  .h1 {
    font-size: 1.2rem;
    font-weight: 850;
  }

  .sub {
    color: var(--muted);
    font-size: 0.98rem;
    margin-top: 2px;
  }

  .main {
    display: grid;
    grid-template-columns: minmax(340px, 1fr) minmax(620px, 1fr);
    gap: 16px;
    align-items: stretch;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  @media (max-width: 1020px) {
    .main {
      grid-template-columns: 1fr;
      overflow: visible;
      min-height: auto;
    }
    .page {
      height: auto;
      min-height: 100dvh;
      overflow: visible;
    }
    .viewport {
      height: auto;
      min-height: 0;
    }
    .content {
      padding: 18px;
    }
  }

  .left {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
    overflow: hidden;
    height: 100%;
  }

  .right {
    display: flex;
    flex-direction: column;
    gap: 10px;
    border-radius: 16px;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior: contain;
    height: 100%;
  }

  .rightTop {
    padding: 12px 12px 0;
  }

  .rightTitle {
    font-weight: 800;
    font-size: 1.05rem;
  }

  .rightSub {
    color: var(--muted);
    font-size: 0.95rem;
    margin-top: 2px;
  }

  .legend {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
    padding: 0 12px;
    color: var(--muted);
  }

  .lg {
    display: inline-flex;
    gap: 8px;
    align-items: center;
  }

  .sw {
    width: 18px;
    height: 18px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.18);
  }

  .sw.off {
    background: #fff;
  }

  .sw.unset {
    background: rgba(156, 163, 175, 0.35);
  }

  .sw.reserved {
    background: rgba(239, 68, 68, 0.22);
  }

  .sw.data {
    background: rgba(59, 130, 246, 0.18);
    box-shadow: inset 0 0 0 1px rgba(59, 130, 246, 0.2);
  }

  .sw.on {
    background: #000;
  }

  .sw.hl {
    background: rgba(110, 231, 255, 0.55);
  }
</style>
