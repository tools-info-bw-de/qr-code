<script>
  import Stepper from "./components/Stepper.svelte";
  import QrGrid from "./components/QrGrid.svelte";
  import { buildQrGrid, iso88591Encode } from "./lib/qrModel.js";

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
        "Damit ein Scanner später überhaupt erkennt, dass er einen QR-Code vor sich hat, gibt es Erkennungsmuster. Diese sorgen zudem dafür, dass der Code auch aus einem schrägen Winkel erkannt wird. ",
    },
    {
      id: 3,
      title: "Format (reserviert)",
      short: "Enthält Metadaten zum QR-Code (später)",
      enabled: true,
      detail:
        "Um die Erkennungsmuster herum gibt es reservierte Felder für den <b>Format-String</b> (Fehlerkorrektur-Level + Masken-ID). Wir markieren diese Plätze jetzt schon – sie werden erst ganz am Ende mit Daten gefüllt.<br/><br/>Alle Pixel, die jetzt noch frei sind, können ab dem nächsten Schritt für die eigentlichen Daten genutzt werden.",
    },
    {
      id: 4,
      title: "Codierungsmodus",
      short: "Festlegung des Datentyps (Byte, Alphanumerisch, ...)",
      enabled: true,
      detail:
        "Im rechts-unteren 2x2-Block steht binär codiert, um welche Art von Daten es sich handelt. In dieser Demo wird nur der Byte-Modus unterstützt (0100).",
    },
    {
      id: 5,
      title: "Text eingeben",
      short: "Welchen Text soll der QR-Code enthalten?",
      enabled: true,
      detail:
        "Wir codieren den Text in <b>ISO‑8859‑1</b> (Latin‑1) und zeigen die resultierenden Bytes + Byte-Länge. In diesem Schritt wird keine Änderung im QR-Code vorgenommen.",
    },
    {
      id: 6,
      title: "Nutzdaten: Byte-Positionen",
      short: "Zickzack von rechts + Leserichtung",
      enabled: true,
      detail:
        "Jetzt zeigen wir nur, <b>wo</b> die Bytes später liegen und in welcher <b>Richtung</b> sie gelesen/geschrieben werden: von rechts nach links in einem Zickzack. Pfeile markieren die Leserichtung pro Byte. Die Pixel bleiben dabei noch ungefüllt.",
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
        "Als nächstes fügen wir einen <b>Stop-Block</b> hinzu: <b>4 Bits</b> mit dem Wert <code>0000</code> (also nur 0-Bits = weiß). Im Byte-Mode (0100) sind wir danach bereits wieder auf einer <b>Byte-Grenze</b>.",
    },
    {
      id: 10,
      title: "Fehlerkorrektur (Low)",
      short: "Reed–Solomon (7 Bytes) berechnen + schreiben",
      enabled: true,
      detail:
        "Nach dem Stop-Block (0000) füllen wir zunächst die restlichen Datenplätze bis zur Daten-Kapazität mit Auffüll-Bytes (abwechselnd <code>11101100/00010001</code>) auf.<br/><br/> Anschließend berechnen wir die <b>Reed–Solomon</b>-Fehlerkorrektur (Level <b>Low</b>): aus den Daten-Bytes werden <b>7 ECC-Bytes</b> erzeugt (GF(256), Polynom 0x11d) und direkt in den QR-Zickzack geschrieben.",
    },
    {
      id: 11,
      title: "Maske",
      short: "Eine von 8 Masken anwenden",
      enabled: true,
      detail:
        "In diesem Schritt wählen wir eine <b>Maske</b> (0\u20137) und wenden sie auf die <b>Datenmodule</b> an. Die Maske wird <b>nicht</b> auf Finder/Timing/Dark-Module oder den Format-String angewendet. Ohne Masken-Auswahl geht es nicht weiter.",
    },
    {
      id: 12,
      title: "Format-String",
      short: "ECC-Level + Masken-ID eintragen",
      enabled: true,
      detail:
        "Zum Schluss schreiben wir den <b>Format-String</b> in die zuvor reservierten roten Felder: <b>Fehlerkorrektur-Level</b> (hier immer <b>Low/L</b>) + <b>Masken-ID</b> (0\u20137) plus BCH-Prüfbits. Dieser String wird <b>nicht</b> maskiert.",
    },
  ];

  let active = $state(1);
  let text = $state("Informatik");
  let maskId = $state(null);

  const iso = $derived.by(() => iso88591Encode(text));
  const tooLong = $derived.by(() => iso.byteLength > 17);

  const model = $derived.by(() => buildQrGrid(active, text, maskId));

  function select(id) {
    if (tooLong && id >= 6) return;
    if (id >= 12 && maskId == null) return;
    active = id;
  }

  function onMaskSelect(next) {
    maskId = next;
  }

  function onTextChange(next) {
    text = next;

    const nextLen = iso88591Encode(next).byteLength;
    if (nextLen > 17 && active >= 6) {
      active = 5;
    }
  }
</script>

<div class="page">
  <header class="top">
    <div class="brand">
      <div class="logo">QR</div>
      <div>
        <div class="h1">QR-Code Erklärung – Schritt für Schritt</div>
        <div class="sub">
          Hier wird Schritt für Schritt gezeigt, wie ein QR-Code aufgebaut ist.<br
          />
          <b>Klicke</b> dich links durch die einzelnen Schritte. Fahre mit der
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
      />
    </section>

    <section class="right">
      <div class="rightTop">
        <div class="rightTitle">QR-Ansicht</div>
        <div class="rightSub">
          Hover über ein Modul (Pixel), um den Bereich zu sehen.
        </div>
      </div>

      <QrGrid {model} pixelSize={20} />

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

      <div class="panel mini">
        <div class="row">
          <div class="tag">Version</div>
          <div class="value">1 (21×21)</div>
        </div>
      </div>
    </section>
  </main>
</div>

<style>
  .page {
    max-width: 1180px;
    margin: 0 auto;
    padding: 18px;
  }

  .top {
    margin-bottom: 16px;
  }

  .brand {
    display: flex;
    gap: 14px;
    align-items: center;
    padding: 14px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.03);
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
    grid-template-columns: 600px 1fr;
    gap: 16px;
    align-items: start;
  }

  @media (max-width: 980px) {
    .main {
      grid-template-columns: 1fr;
    }
  }

  .left {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .right {
    display: flex;
    flex-direction: column;
    gap: 10px;
    border-radius: 16px;
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

  .panel {
    padding: 14px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.03);
  }

  .panel.mini {
    padding: 12px 14px;
  }

  .row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 0;
  }

  .tag {
    color: var(--muted);
  }

  .value {
    font-weight: 750;
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
