import sharp from "sharp";

/**
 * Ergebnis der automatischen Horizont-Erkennung in einem equirectangularen
 * Panorama. Alle Winkel in Grad.
 *
 * Physik dahinter: Ist die Kamera bei der Aufnahme verkippt, erscheint der
 * Horizont im Equirect-Bild nicht als gerade Linie, sondern näherungsweise
 * als Sinuskurve  y(x) = y0 + a·cos(2πx/W) + b·sin(2πx/W).
 * Aus dem Fit ergeben sich direkt die Korrekturwinkel:
 *   tilt = a·180/H   (Nick-Korrektur, sphereCorrection.tilt)
 *   roll = b·180/H   (Roll-Korrektur, sphereCorrection.roll)
 *   pitch = (H/2 − y0)·180/H   (Höhe des Horizonts → Startansicht)
 */
export interface HorizonDetection {
  /** Pitch, auf dem der Horizont nach der Korrektur liegt — Startansicht darauf zentrieren */
  pitchDeg: number;
  /** Nick-Korrektur zum Begradigen des Panoramas */
  tiltDeg: number;
  /** Roll-Korrektur zum Begradigen des Panoramas */
  rollDeg: number;
  /** Anteil der Bildspalten, die die gefittete Horizontlinie stützen (0–1) */
  confidence: number;
}

// Klein genug für schnelle Analyse, groß genug für einen stabilen Sinus-Fit
const SAMPLE_WIDTH = 720;
// Nur die mittleren 60 % der Bildhöhe absuchen — Zenit und Nadir sind in der
// Equirect-Projektion extrem verzerrt und liefern keine brauchbaren Kanten
const BAND_TOP = 0.2;
const BAND_BOTTOM = 0.8;
// Plausibilitätsgrenzen: stärkere Abweichungen sind fast immer Fehlerkennungen
const MAX_CORRECTION_DEG = 25;
const MAX_PITCH_DEG = 40;
const MIN_CONFIDENCE = 0.35;
const MAX_INPUT_PIXELS = 512 * 1024 * 1024;

export async function detectHorizon(input: Buffer): Promise<HorizonDetection | null> {
  const { data, info } = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
    .rotate()
    .grayscale()
    .resize({ width: SAMPLE_WIDTH, withoutEnlargement: true })
    .blur(1.2)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const ch = info.channels;
  if (w < 64 || h < 32) return null;

  const px = (x: number, y: number) => data[(y * w + x) * ch];

  const yMin = Math.max(1, Math.floor(h * BAND_TOP));
  const yMax = Math.min(h - 1, Math.ceil(h * BAND_BOTTOM));

  // Pro Bildspalte die stärkste horizontale Kante suchen (vertikaler
  // Gradient, über 3 Spalten gemittelt zur Rauschunterdrückung)
  const colX: number[] = [];
  const colY: number[] = [];
  const colStrength: number[] = [];

  for (let x = 1; x < w - 1; x++) {
    let bestY = -1;
    let bestG = 0;
    for (let y = yMin; y < yMax; y++) {
      let g = 0;
      for (let dx = -1; dx <= 1; dx++) {
        g += px(x + dx, y + 1) - px(x + dx, y - 1);
      }
      const ag = Math.abs(g);
      if (ag > bestG) {
        bestG = ag;
        bestY = y;
      }
    }
    if (bestY >= 0) {
      colX.push(x);
      colY.push(bestY);
      colStrength.push(bestG);
    }
  }

  const totalColumns = w - 2;
  if (colX.length < totalColumns * 0.5) return null;

  // Spalten ohne markante Kante verwerfen (unter 35 % der Median-Stärke)
  const sortedStrength = [...colStrength].sort((p, q) => p - q);
  const medianStrength = sortedStrength[sortedStrength.length >> 1];
  const minStrength = Math.max(24, medianStrength * 0.35);

  let xs: number[] = [];
  let ys: number[] = [];
  for (let i = 0; i < colX.length; i++) {
    if (colStrength[i] >= minStrength) {
      xs.push(colX[i]);
      ys.push(colY[i]);
    }
  }
  if (xs.length < totalColumns * 0.35) return null;

  // Robuster Fit: wiederholt fitten und Ausreißer (Möbel, Bäume, Fenster …)
  // über den Median der Residuen aussortieren
  let fit = fitHorizonCurve(xs, ys, w);
  if (!fit) return null;

  for (let iter = 0; iter < 3; iter++) {
    const residuals = xs.map((x, i) => Math.abs(ys[i] - evalCurve(fit!, x, w)));
    const sortedRes = [...residuals].sort((p, q) => p - q);
    const mad = sortedRes[sortedRes.length >> 1];
    const threshold = Math.max(4, mad * 2.5 * 1.4826);

    const keptX: number[] = [];
    const keptY: number[] = [];
    for (let i = 0; i < xs.length; i++) {
      if (residuals[i] <= threshold) {
        keptX.push(xs[i]);
        keptY.push(ys[i]);
      }
    }
    if (keptX.length < 30) return null;
    if (keptX.length === xs.length) break;

    xs = keptX;
    ys = keptY;
    const nextFit = fitHorizonCurve(xs, ys, w);
    if (!nextFit) return null;
    fit = nextFit;
  }

  const confidence = xs.length / totalColumns;
  if (confidence < MIN_CONFIDENCE) return null;

  // Qualitätsgate: die Inlier müssen eng an der Kurve liegen. Bei Bildern
  // ohne echte Horizontlinie (z. B. reine Textur) streuen die Kanten wild —
  // der Fit "konvergiert" dann zwar, ist aber bedeutungslos.
  const finalResiduals = xs
    .map((x, i) => Math.abs(ys[i] - evalCurve(fit!, x, w)))
    .sort((p, q) => p - q);
  const finalMad = finalResiduals[finalResiduals.length >> 1];
  if (finalMad > Math.max(3, h * 0.012)) return null;

  // Pixel → Grad: die volle Bildhöhe eines Equirect-Panoramas entspricht 180°
  const pitchDeg = ((h / 2 - fit.y0) * 180) / h;
  const tiltDeg = (fit.a * 180) / h;
  const rollDeg = (fit.b * 180) / h;

  if (
    Math.abs(tiltDeg) > MAX_CORRECTION_DEG ||
    Math.abs(rollDeg) > MAX_CORRECTION_DEG ||
    Math.abs(pitchDeg) > MAX_PITCH_DEG
  ) {
    return null;
  }

  return { pitchDeg, tiltDeg, rollDeg, confidence };
}

interface CurveFit {
  y0: number;
  a: number;
  b: number;
}

function evalCurve(fit: CurveFit, x: number, width: number): number {
  const t = (2 * Math.PI * x) / width;
  return fit.y0 + fit.a * Math.cos(t) + fit.b * Math.sin(t);
}

/**
 * Kleinste-Quadrate-Fit von y = y0 + a·cos(2πx/W) + b·sin(2πx/W)
 * über die Normalengleichungen (3×3, Gauß-Elimination).
 */
function fitHorizonCurve(xs: number[], ys: number[], width: number): CurveFit | null {
  const n = xs.length;
  if (n < 8) return null;

  // Basisfunktionen: [1, cos t, sin t]
  const m = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  for (let i = 0; i < n; i++) {
    const t = (2 * Math.PI * xs[i]) / width;
    const basis = [1, Math.cos(t), Math.sin(t)];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) m[r][c] += basis[r] * basis[c];
      m[r][3] += basis[r] * ys[i];
    }
  }

  // Gauß-Elimination mit Pivotisierung
  for (let col = 0; col < 3; col++) {
    let pivot = col;
    for (let r = col + 1; r < 3; r++) {
      if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    }
    if (Math.abs(m[pivot][col]) < 1e-9) return null;
    [m[col], m[pivot]] = [m[pivot], m[col]];
    for (let r = 0; r < 3; r++) {
      if (r === col) continue;
      const factor = m[r][col] / m[col][col];
      for (let c = col; c < 4; c++) m[r][c] -= factor * m[col][c];
    }
  }

  return {
    y0: m[0][3] / m[0][0],
    a: m[1][3] / m[1][1],
    b: m[2][3] / m[2][2],
  };
}
