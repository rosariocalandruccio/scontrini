// OCR interamente nel browser con Tesseract.js (WebAssembly). Motore e lingua
// italiana sono serviti dall'app stessa: nessuna chiamata a server esterni.
const abs = (p) => new URL(p, location.href).href;
let workerP;

function worker(onProgress) {
  workerP ??= (async () => {
    const w = await Tesseract.createWorker('ita', 1, {
      workerPath: abs('vendor/tesseract/worker.min.js'),
      corePath: abs('vendor/tesseract/core'),
      langPath: abs('vendor/lang'),
      gzip: true,
      logger: (m) => workerP.onProgress?.(m),
    });
    await w.setParameters({ tessedit_pageseg_mode: '4', preserve_interword_spaces: '1' });
    return w;
  })();
  workerP.onProgress = onProgress;
  return workerP;
}

// Carica l'immagine (rispettando l'orientamento EXIF) ruotata di `rotazione` gradi.
export async function caricaImmagine(file, rotazione = 0) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const giro = rotazione % 180 !== 0;
  const c = document.createElement('canvas');
  c.width = giro ? bmp.height : bmp.width;
  c.height = giro ? bmp.width : bmp.height;
  const g = c.getContext('2d');
  g.translate(c.width / 2, c.height / 2);
  g.rotate((rotazione * Math.PI) / 180);
  g.drawImage(bmp, -bmp.width / 2, -bmp.height / 2);
  bmp.close?.();
  return c;
}

export function ridimensiona(src, maxLato) {
  const k = Math.min(1, maxLato / Math.max(src.width, src.height));
  const c = document.createElement('canvas');
  c.width = Math.round(src.width * k); c.height = Math.round(src.height * k);
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return c;
}

// Scala di grigi + stiramento del contrasto (aiuta molto con la carta termica sbiadita).
function preparaPerOcr(src) {
  const larghezza = Math.min(2000, Math.max(1200, src.width));
  const k = larghezza / src.width;
  const c = document.createElement('canvas');
  c.width = Math.round(src.width * k); c.height = Math.round(src.height * k);
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(src, 0, 0, c.width, c.height);
  const img = g.getImageData(0, 0, c.width, c.height), d = img.data;
  const isto = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const y = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000 | 0;
    d[i] = y; isto[y]++;
  }
  const n = d.length / 4; let acc = 0, lo = 0, hi = 255;
  for (let v = 0; v < 256; v++) { acc += isto[v]; if (acc < n * 0.02) lo = v; if (acc < n * 0.98) hi = v; }
  const scala = 255 / Math.max(1, hi - lo);
  for (let i = 0; i < d.length; i += 4) {
    const y = Math.max(0, Math.min(255, (d[i] - lo) * scala));
    d[i] = d[i + 1] = d[i + 2] = y;
  }
  g.putImageData(img, 0, 0);
  return { canvas: c, scala: k };
}

export async function riconosci(canvas, onProgress) {
  const w = await worker(onProgress);
  const { canvas: pronto, scala } = preparaPerOcr(canvas);
  const { data } = await w.recognize(pronto, {}, { text: true, blocks: true });
  const righe = [];
  for (const b of data.blocks || []) for (const p of b.paragraphs) for (const l of p.lines) {
    righe.push({ testo: l.text.trim(), bbox: {
      x0: l.bbox.x0 / scala, y0: l.bbox.y0 / scala, x1: l.bbox.x1 / scala, y1: l.bbox.y1 / scala } });
  }
  return { testo: data.text, righe };
}

// "Logo": la testata dello scontrino, dall'alto fino alla riga con il nome dell'esercente.
export function ritagliaLogo(canvas, righe, esercente) {
  let fondo = canvas.height * 0.15;
  // fondo dell'ultima riga che contiene una parola del nome (insegne su più righe)
  const parole = (esercente || '').toUpperCase().split(' ').filter(p => p.length > 2);
  const riga = righe.slice(0, 6).filter(r => parole.some(p => r.testo.toUpperCase().includes(p))).pop();
  if (riga) fondo = riga.bbox.y1 + (riga.bbox.y1 - riga.bbox.y0) * 0.4;
  else if (righe[0]) fondo = Math.max(righe[0].bbox.y1, canvas.height * 0.08);
  fondo = Math.min(Math.max(fondo, canvas.height * 0.06), canvas.height * 0.35);
  const c = document.createElement('canvas');
  const k = Math.min(1, 480 / canvas.width);
  c.width = Math.round(canvas.width * k); c.height = Math.round(fondo * k);
  c.getContext('2d').drawImage(canvas, 0, 0, canvas.width, fondo, 0, 0, c.width, c.height);
  return c;
}

export const inBlob = (c, q = 0.8) => new Promise(r => c.toBlob(r, 'image/jpeg', q));
