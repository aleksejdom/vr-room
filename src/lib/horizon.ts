import sharp from "sharp";

/**
 * Automatische Horizont-/Lot-Erkennung in equirectangularen Panoramen.
 * Alle Winkel in Grad.
 *
 * Primäre Methode — vertikale Kanten (funktioniert v. a. in Innenräumen):
 * In einem nivellierten Equirect-Panorama sind alle senkrechten Kanten der
 * Welt (Türrahmen, Wandecken, Möbel) exakt vertikale Bildspalten. Ist die
 * Kamera um tilt/roll verkippt, neigen sich die Kanten abhängig vom
 * Blickwinkel θ sinusförmig:  ε(θ) ≈ −roll·cosθ + tilt·sinθ.
 * Ein robuster Fit über tausende Kantenpixel liefert tilt und roll direkt.
 *
 * Fallback — Horizontlinie (Außenaufnahmen ohne vertikale Strukturen):
 * Eine horizontale Rundum-Linie (Meer-/Berghorizont) erscheint bei
 * Verkippung als Sinuskurve y(x) = y0 + a·cos(2πx/W) + b·sin(2πx/W).
 * RANSAC sucht die Kurve mit der breitesten Unterstützung; akzeptiert wird
 * nur eine nahezu durchgehende Linie, damit Möbelkanten in Innenräumen
 * keine Fehlkorrekturen auslösen.
 */
export interface HorizonDetection {
  /** Nick-Korrektur zum Begradigen des Panoramas (sphereCorrection.tilt) */
  tiltDeg: number;
  /** Roll-Korrektur zum Begradigen des Panoramas (sphereCorrection.roll) */
  rollDeg: number;
  /** Höhe (Pitch) der erkannten Referenzlinie — nur informativ */
  linePitchDeg: number;
  /** Anteil der stützenden Messungen (0–1), methodenabhängig */
  confidence: number;
  /** Welche Methode das Ergebnis geliefert hat */
  method: "vertical-edges" | "horizon-line";
}

// Klein genug für schnelle Analyse, groß genug für stabile Fits
const SAMPLE_WIDTH = 720;
// Plausibilitätsgrenze: stärkere Verkippungen sind fast immer Fehlerkennungen
const MAX_CORRECTION_DEG = 25;
const MAX_INPUT_PIXELS = 512 * 1024 * 1024;

const DEG = 180 / Math.PI;

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

  const first = estimateFromVerticalEdges(data, w, h, ch);
  if (first) return refineVerticalEstimate(first, data, w, h, ch);
  return estimateFromHorizonLine(data, w, h, ch);
}

/**
 * Zweiter Durchlauf gegen den Restfehler der Kleinwinkel-Näherung (bei
 * starken Verkippungen einige Prozent): die erste Korrektur wird virtuell
 * auf das Analysebild angewendet, der verbleibende Fehler gemessen und
 * beide Rotationen exakt komponiert.
 */
function refineVerticalEstimate(
  first: HorizonDetection,
  data: Buffer,
  w: number,
  h: number,
  ch: number
): HorizonDetection {
  const t1 = first.tiltDeg / DEG;
  const r1 = first.rollDeg / DEG;
  const corrected = remapGray(data, w, h, ch, t1, r1);
  const second = estimateFromVerticalEdges(corrected, w, h, 1);
  if (!second) return first;

  // Content-Lot der Restkorrektur: u2 = R2⁻¹·(0,1,0), dann zurück in den
  // Bildraum des Originals drehen: u = R1⁻¹·u2 mit R = Rx(tilt)·Rz(roll)
  const t2 = second.tiltDeg / DEG;
  const r2 = second.rollDeg / DEG;
  let ux = Math.sin(r2) * Math.cos(t2);
  let uy = Math.cos(r2) * Math.cos(t2);
  let uz = -Math.sin(t2);
  // Rx(-t1)
  const uy1 = Math.cos(t1) * uy + Math.sin(t1) * uz;
  uz = -Math.sin(t1) * uy + Math.cos(t1) * uz;
  uy = uy1;
  // Rz(-r1)
  const ux1 = Math.cos(r1) * ux + Math.sin(r1) * uy;
  uy = -Math.sin(r1) * ux + Math.cos(r1) * uy;
  ux = ux1;

  const tiltDeg = -Math.asin(Math.max(-1, Math.min(1, uz))) * DEG;
  const rollDeg = Math.atan2(ux, uy) * DEG;
  if (Math.abs(tiltDeg) > MAX_CORRECTION_DEG || Math.abs(rollDeg) > MAX_CORRECTION_DEG) {
    return first;
  }
  return { ...first, tiltDeg, rollDeg };
}

/**
 * Wendet die Begradigung (wie PSV sphereCorrection) bilinear auf das
 * Graustufen-Analysebild an: Ziel(v) = Quelle(Rz(−roll)·Rx(−tilt)·v).
 */
function remapGray(
  src: Buffer,
  w: number,
  h: number,
  ch: number,
  tiltRad: number,
  rollRad: number
): Buffer {
  const ct = Math.cos(tiltRad);
  const st = Math.sin(tiltRad);
  const cr = Math.cos(rollRad);
  const sr = Math.sin(rollRad);
  const out = Buffer.alloc(w * h);

  const sample = (x: number, y: number) => {
    const x0 = Math.floor(x);
    const y0 = Math.max(0, Math.min(h - 1, Math.floor(y)));
    const y1 = Math.min(h - 1, y0 + 1);
    const x0w = ((x0 % w) + w) % w;
    const x1w = (x0w + 1) % w;
    const fx = x - x0;
    const fy = y - y0;
    const p00 = src[(y0 * w + x0w) * ch];
    const p10 = src[(y0 * w + x1w) * ch];
    const p01 = src[(y1 * w + x0w) * ch];
    const p11 = src[(y1 * w + x1w) * ch];
    return (
      p00 * (1 - fx) * (1 - fy) +
      p10 * fx * (1 - fy) +
      p01 * (1 - fx) * fy +
      p11 * fx * fy
    );
  };

  for (let yImg = 0; yImg < h; yImg++) {
    const phi = ((h / 2 - yImg) * Math.PI) / h;
    const cosPhi = Math.cos(phi);
    const sinPhi = Math.sin(phi);
    for (let xImg = 0; xImg < w; xImg++) {
      const th = (2 * Math.PI * xImg) / w - Math.PI;
      const vx = -cosPhi * Math.sin(th);
      const vy = sinPhi;
      const vz = cosPhi * Math.cos(th);
      // Rx(−tilt)
      const y1 = ct * vy + st * vz;
      const z1 = -st * vy + ct * vz;
      // Rz(−roll)
      const x2 = cr * vx + sr * y1;
      const y2 = -sr * vx + cr * y1;
      const phiS = Math.asin(Math.max(-1, Math.min(1, y2)));
      const thS = Math.atan2(-x2, z1);
      const xs = ((thS + Math.PI) / (2 * Math.PI)) * w;
      const ys = h / 2 - (phiS * h) / Math.PI;
      out[yImg * w + xImg] = sample(xs, ys);
    }
  }
  return out;
}

// ───────────────────────── Vertikale Kanten ────────────────────────────────

// Nur nahe des Äquators messen — zu den Polen hin laufen die Meridiane
// zusammen und die Kleinwinkel-Näherung bricht
const VERTICAL_BAND_DEG = 40;
// Mindest-Kontrast einer Kante und maximal erlaubte Neigung (tan ≈ 0.6 ≙ 31°)
const MIN_GRADIENT = 30;
const MAX_EDGE_SLOPE = 0.6;
// Qualitätsgates
const MIN_EDGE_PIXELS = 800;
const MIN_YAW_BINS = 8;
const YAW_BINS = 12;
const MAX_FINAL_MAD_RAD = 0.07;
const TRIM_ITERATIONS = 8;

function estimateFromVerticalEdges(
  data: Buffer,
  w: number,
  h: number,
  ch: number
): HorizonDetection | null {
  const px = (x: number, y: number) => data[(y * w + x) * ch];
  const bandPx = Math.floor((VERTICAL_BAND_DEG / 180) * h);
  const yMin = Math.max(1, Math.floor(h / 2) - bandPx);
  const yMax = Math.min(h - 1, Math.floor(h / 2) + bandPx);

  // Messpunkte: Neigung ε jeder annähernd vertikalen Kante, normiert auf
  // den Äquator (·cos φ), gegen den Blickwinkel θ der Bildspalte
  const thetas: number[] = [];
  const epsilons: number[] = [];

  for (let y = yMin; y < yMax; y++) {
    const pitch = ((h / 2 - y) * Math.PI) / h;
    const cosPitch = Math.cos(pitch);
    for (let x = 1; x < w - 1; x++) {
      const gx = px(x + 1, y) - px(x - 1, y);
      if (Math.abs(gx) < MIN_GRADIENT) continue;
      const gy = px(x, y + 1) - px(x, y - 1);
      const slope = gy / gx;
      if (Math.abs(slope) > MAX_EDGE_SLOPE) continue;
      thetas.push((2 * Math.PI * x) / w - Math.PI);
      // Bildsteigung s → Lot-Abweichung: δ = s·cos φ (Sphäre), und die
      // Meridian-Neigung wächst mit 1/cos φ → ε = s·cos²φ ist über alle
      // Breiten direkt −roll·cosθ + tilt·sinθ
      epsilons.push(slope * cosPitch * cosPitch);
    }
  }

  if (thetas.length < MIN_EDGE_PIXELS) return null;

  // Robuster Fit ε(θ) = A·cosθ + B·sinθ + C mit Ausreißer-Trimmen
  // (C fängt systematische Verzerrungen ab und wird verworfen)
  let idx = thetas.map((_, i) => i);
  let fit = fitEpsilon(thetas, epsilons, idx);
  if (!fit) return null;

  for (let iter = 0; iter < TRIM_ITERATIONS; iter++) {
    const residuals = idx.map((i) =>
      Math.abs(epsilons[i] - evalEpsilon(fit!, thetas[i]))
    );
    const sorted = [...residuals].sort((p, q) => p - q);
    const mad = sorted[sorted.length >> 1];
    const threshold = Math.max(0.02, mad * 2.0 * 1.4826);
    const kept = idx.filter((_, k) => residuals[k] <= threshold);
    if (kept.length < MIN_EDGE_PIXELS / 2) return null;
    if (kept.length === idx.length) break;
    idx = kept;
    const next = fitEpsilon(thetas, epsilons, idx);
    if (!next) return null;
    fit = next;
  }

  // Streuung der Inlier muss klein sein, sonst gibt es kein konsistentes Lot
  const finalRes = idx
    .map((i) => Math.abs(epsilons[i] - evalEpsilon(fit!, thetas[i])))
    .sort((p, q) => p - q);
  if (finalRes[finalRes.length >> 1] > MAX_FINAL_MAD_RAD) return null;

  // Die Inlier müssen aus vielen Blickrichtungen stammen — sonst ist der
  // Sinus-Fit unterbestimmt (z. B. alle Kanten an einer einzigen Wand)
  const bins = new Set(
    idx.map((i) => Math.floor(((thetas[i] + Math.PI) / (2 * Math.PI)) * YAW_BINS))
  );
  if (bins.size < MIN_YAW_BINS) return null;

  // ε(θ) = A·cosθ + B·sinθ  mit  A = −roll, B = +tilt (Radiant)
  const tiltDeg = fit.b * DEG;
  const rollDeg = -fit.a * DEG;
  if (Math.abs(tiltDeg) > MAX_CORRECTION_DEG || Math.abs(rollDeg) > MAX_CORRECTION_DEG) {
    return null;
  }

  return {
    tiltDeg,
    rollDeg,
    linePitchDeg: 0,
    confidence: idx.length / thetas.length,
    method: "vertical-edges",
  };
}

interface EpsilonFit {
  a: number; // cos-Koeffizient
  b: number; // sin-Koeffizient
  c: number; // konstanter Anteil (verworfen)
}

function evalEpsilon(fit: EpsilonFit, theta: number): number {
  return fit.a * Math.cos(theta) + fit.b * Math.sin(theta) + fit.c;
}

function fitEpsilon(
  thetas: number[],
  epsilons: number[],
  idx: number[]
): EpsilonFit | null {
  const m = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  for (const i of idx) {
    const basis = [Math.cos(thetas[i]), Math.sin(thetas[i]), 1];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) m[r][c] += basis[r] * basis[c];
      m[r][3] += basis[r] * epsilons[i];
    }
  }
  const solved = solve3(m);
  return solved ? { a: solved[0], b: solved[1], c: solved[2] } : null;
}

// ───────────────────────── Horizontlinie (Fallback) ────────────────────────

// Nur die mittleren 60 % der Bildhöhe absuchen — Zenit und Nadir sind in der
// Equirect-Projektion extrem verzerrt
const BAND_TOP = 0.2;
const BAND_BOTTOM = 0.8;
const CANDIDATES_PER_COLUMN = 5;
const RANSAC_ITERATIONS = 800;
const inlierTolerance = (h: number) => Math.max(2.5, h * 0.008);
// Streng: nur eine fast durchgehende Rundum-Linie zählt als Horizont.
// Möbel-/Tischkanten in Innenräumen erreichen diese Abdeckung nicht.
const MIN_SUPPORT_OF_TOTAL = 0.65;

interface EdgeCandidate {
  x: number;
  y: number;
  strength: number;
}

function estimateFromHorizonLine(
  data: Buffer,
  w: number,
  h: number,
  ch: number
): HorizonDetection | null {
  const candidates = collectEdgeCandidates(data, w, h, ch);
  const totalColumns = w - 2;
  const tol = inlierTolerance(h);
  const maxAmplitudePx = (MAX_CORRECTION_DEG * h) / 180;

  const best = ransacCurve(candidates, w, h, tol, maxAmplitudePx);
  if (!best) return null;

  // Verfeinern: Kleinste-Quadrate über die Inlier, zweimal nachgezogen
  let fit = best;
  for (let i = 0; i < 2; i++) {
    const inliers = selectInliers(candidates, fit, w, tol);
    if (inliers.length < 30) return null;
    const refined = leastSquaresCurve(inliers, w);
    if (!refined) break;
    fit = refined;
  }

  const support = countSupportingColumns(candidates, fit, w, tol);
  if (support < totalColumns * MIN_SUPPORT_OF_TOTAL) return null;

  // Pixel → Grad: die volle Bildhöhe eines Equirect-Panoramas entspricht 180°
  const tiltDeg = (fit.a * 180) / h;
  const rollDeg = (fit.b * 180) / h;
  const linePitchDeg = ((h / 2 - fit.y0) * 180) / h;
  if (Math.abs(tiltDeg) > MAX_CORRECTION_DEG || Math.abs(rollDeg) > MAX_CORRECTION_DEG) {
    return null;
  }

  return {
    tiltDeg,
    rollDeg,
    linePitchDeg,
    confidence: support / totalColumns,
    method: "horizon-line",
  };
}

/**
 * Pro Bildspalte die stärksten horizontalen Kanten sammeln (lokale Maxima
 * des vertikalen Gradienten, über 3 Spalten gemittelt).
 */
function collectEdgeCandidates(
  data: Buffer,
  w: number,
  h: number,
  ch: number
): EdgeCandidate[] {
  const px = (x: number, y: number) => data[(y * w + x) * ch];
  const yMin = Math.max(1, Math.floor(h * BAND_TOP));
  const yMax = Math.min(h - 1, Math.ceil(h * BAND_BOTTOM));
  const minStrength = 24;

  const candidates: EdgeCandidate[] = [];
  const gradient = new Float64Array(yMax - yMin);

  for (let x = 1; x < w - 1; x++) {
    for (let y = yMin; y < yMax; y++) {
      let g = 0;
      for (let dx = -1; dx <= 1; dx++) {
        g += px(x + dx, y + 1) - px(x + dx, y - 1);
      }
      gradient[y - yMin] = Math.abs(g);
    }

    // Lokale Maxima über der Rauschschwelle, stärkste zuerst
    const maxima: EdgeCandidate[] = [];
    for (let i = 1; i < gradient.length - 1; i++) {
      const g = gradient[i];
      if (g >= minStrength && g >= gradient[i - 1] && g >= gradient[i + 1]) {
        maxima.push({ x, y: i + yMin, strength: g });
      }
    }
    maxima.sort((p, q) => q.strength - p.strength);

    // Top-Kandidaten mit vertikalem Mindestabstand übernehmen
    const taken: EdgeCandidate[] = [];
    for (const m of maxima) {
      if (taken.length >= CANDIDATES_PER_COLUMN) break;
      if (taken.every((t) => Math.abs(t.y - m.y) >= 4)) taken.push(m);
    }
    candidates.push(...taken);
  }
  return candidates;
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

function ransacCurve(
  candidates: EdgeCandidate[],
  w: number,
  h: number,
  tol: number,
  maxAmplitudePx: number
): CurveFit | null {
  const n = candidates.length;
  if (n < 30) return null;
  const minSeparation = w / 8;
  const yMin = h * BAND_TOP;
  const yMax = h * BAND_BOTTOM;

  let bestFit: CurveFit | null = null;
  let bestSupport = 0;
  // Deterministisches LCG statt Math.random — reproduzierbare Ergebnisse
  let seed = 12345;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  for (let iter = 0; iter < RANSAC_ITERATIONS; iter++) {
    const p1 = candidates[Math.floor(rand() * n)];
    const p2 = candidates[Math.floor(rand() * n)];
    const p3 = candidates[Math.floor(rand() * n)];
    // Spalten müssen weit auseinander liegen, sonst ist das System
    // schlecht konditioniert (zyklischer Abstand wegen 360°-Wrap)
    if (
      cyclicDistance(p1.x, p2.x, w) < minSeparation ||
      cyclicDistance(p1.x, p3.x, w) < minSeparation ||
      cyclicDistance(p2.x, p3.x, w) < minSeparation
    ) {
      continue;
    }

    const fit = exactCurve(p1, p2, p3, w);
    if (!fit) continue;
    if (
      Math.abs(fit.a) > maxAmplitudePx ||
      Math.abs(fit.b) > maxAmplitudePx ||
      fit.y0 < yMin ||
      fit.y0 > yMax
    ) {
      continue;
    }

    const support = countSupportingColumns(candidates, fit, w, tol);
    if (support > bestSupport) {
      bestSupport = support;
      bestFit = fit;
    }
  }
  return bestFit;
}

function cyclicDistance(x1: number, x2: number, width: number): number {
  const d = Math.abs(x1 - x2);
  return Math.min(d, width - d);
}

/** Zählt Bildspalten, in denen mindestens ein Kandidat nahe der Kurve liegt */
function countSupportingColumns(
  candidates: EdgeCandidate[],
  fit: CurveFit,
  w: number,
  tol: number
): number {
  const supporting = new Set<number>();
  for (const c of candidates) {
    if (!supporting.has(c.x) && Math.abs(c.y - evalCurve(fit, c.x, w)) <= tol) {
      supporting.add(c.x);
    }
  }
  return supporting.size;
}

/** Pro Spalte den besten kurvennahen Kandidaten für den Feinfit auswählen */
function selectInliers(
  candidates: EdgeCandidate[],
  fit: CurveFit,
  w: number,
  tol: number
): EdgeCandidate[] {
  const bestPerColumn = new Map<number, { c: EdgeCandidate; r: number }>();
  for (const c of candidates) {
    const r = Math.abs(c.y - evalCurve(fit, c.x, w));
    if (r > tol) continue;
    const prev = bestPerColumn.get(c.x);
    if (!prev || r < prev.r) bestPerColumn.set(c.x, { c, r });
  }
  return [...bestPerColumn.values()].map((v) => v.c);
}

/** Exakte Sinuskurve durch drei Punkte (3×3-System) */
function exactCurve(
  p1: EdgeCandidate,
  p2: EdgeCandidate,
  p3: EdgeCandidate,
  width: number
): CurveFit | null {
  const rows = [p1, p2, p3].map((p) => {
    const t = (2 * Math.PI * p.x) / width;
    return [1, Math.cos(t), Math.sin(t), p.y];
  });
  const solved = solve3(rows);
  return solved ? { y0: solved[0], a: solved[1], b: solved[2] } : null;
}

/**
 * Kleinste-Quadrate-Fit von y = y0 + a·cos(2πx/W) + b·sin(2πx/W)
 * über die Normalengleichungen.
 */
function leastSquaresCurve(points: EdgeCandidate[], width: number): CurveFit | null {
  if (points.length < 8) return null;
  const m = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  for (const p of points) {
    const t = (2 * Math.PI * p.x) / width;
    const basis = [1, Math.cos(t), Math.sin(t)];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) m[r][c] += basis[r] * basis[c];
      m[r][3] += basis[r] * p.y;
    }
  }
  const solved = solve3(m);
  return solved ? { y0: solved[0], a: solved[1], b: solved[2] } : null;
}

/** Löst ein 3×3-Gleichungssystem [A|b] per Gauß-Elimination mit Pivotisierung */
function solve3(m: number[][]): [number, number, number] | null {
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
  return [m[0][3] / m[0][0], m[1][3] / m[1][1], m[2][3] / m[2][2]];
}
