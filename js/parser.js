// Estrazione dati dal testo OCR di uno scontrino. Puro JS, nessuna dipendenza:
// gira identico nel browser e in Node (per i test).

export const CATEGORIE = [
  'Vitto', 'Alloggio', 'Parcheggio', 'Taxi', 'Carburante',
  'Pedaggi', 'Trasporti', 'Noleggio auto', 'Altro',
];

// Parole chiave per categoria con peso. Cercate nel testo normalizzato (maiuscolo, senza accenti).
const REGOLE = {
  'Vitto': [
    ['RISTORANTE', 3], ['TRATTORIA', 3], ['OSTERIA', 3], ['PIZZERIA', 3], ['PIZZA', 2],
    ['BAR ', 2], ['CAFFE', 2], ['CAFFETTERIA', 3], ['PASTICCERIA', 2], ['GELATERIA', 2],
    ['TAVOLA CALDA', 3], ['BISTROT', 3], ['PANINOTECA', 3], ['ENOTECA', 2], ['MCDONALD', 3],
    ['BURGER', 2], ['AUTOGRILL', 2], ['COPERTO', 3], ['COPERTI', 3], ['PRANZO', 2], ['CENA', 2],
    ['MENU', 1], ['ACQUA', 1], ['BIBITA', 1], ['VINO', 1], ['BIRRA', 1], ['CAPPUCCINO', 2],
    ['ESPRESSO', 1], ['CORNETTO', 2], ['BRIOCHE', 2], ['PRIMO', 1], ['SECONDO', 1], ['DOLCE', 1],
    ['SUSHI', 3], ['KEBAB', 3], ['RISTORAZIONE', 3], ['SNACK', 1], ['PANINO', 2], ['TRAMEZZINO', 2],
  ],
  'Alloggio': [
    ['HOTEL', 4], ['ALBERGO', 4], ['B&B', 4], ['BED AND BREAKFAST', 4], ['BED & BREAKFAST', 4],
    ['AFFITTACAMERE', 4], ['RESIDENCE', 3], ['OSTELLO', 4], ['HOSTEL', 4], ['AGRITURISMO', 3],
    ['PERNOTTAMENTO', 4], ['PERNOTTAMENTI', 4], ['TASSA DI SOGGIORNO', 4], ['IMPOSTA DI SOGGIORNO', 4],
    ['CAMERA', 2], ['NOTTI', 2], ['ROOM', 2], ['RESORT', 3], ['INN ', 2], ['LOCANDA', 3],
  ],
  'Parcheggio': [
    ['PARCHEGGIO', 4], ['PARKING', 4], ['PARK', 2], ['SOSTA', 3], ['AUTORIMESSA', 4],
    ['GARAGE', 3], ['PARCOMETRO', 4], ['TICKET SOSTA', 4], ['APCOA', 4], ['SABA ', 3],
    ['EASYPARK', 4], ['TELEPASS PAY', 2], ['ENTRATA', 1], ['USCITA', 1], ['PERMANENZA', 3],
  ],
  'Taxi': [
    ['TAXI', 5], ['RADIOTAXI', 5], ['RADIO TAXI', 5], ['NCC', 3], ['NOLEGGIO CON CONDUCENTE', 5],
    ['TASSAMETRO', 4], ['LICENZA N', 2], ['CORSA', 2], ['UBER', 4], ['FREENOW', 4], ['FREE NOW', 4],
    ['ITTAXI', 5], ['WETAXI', 5],
  ],
  'Carburante': [
    ['CARBURANTE', 4], ['BENZINA', 4], ['GASOLIO', 4], ['DIESEL', 4], ['SENZA PB', 4], ['SP95', 4],
    ['GPL', 3], ['METANO', 3], ['LITRI', 3], ['LT ', 1], ['SELF', 2], ['EROGATORE', 4], ['POMPA', 3],
    ['ENI', 2], ['ENILIVE', 4], ['Q8', 3], ['TAMOIL', 4], ['IP ', 1], ['ESSO', 3], ['API ', 1],
    ['SHELL', 3], ['TOTALENERGIES', 4], ['STAZIONE DI SERVIZIO', 3], ['ADBLUE', 3],
  ],
  'Pedaggi': [
    ['PEDAGGIO', 5], ['AUTOSTRAD', 3], ['CASELLO', 4], ['STAZIONE DI ENTRATA', 4], ['TELEPASS', 3],
    ['TRAFORO', 3], ['TANGENZIALE', 2], ['VIACARD', 4], ['A.S.P.I', 3], ['SATAP', 3],
  ],
  'Trasporti': [
    ['TRENITALIA', 5], ['ITALO', 3], ['TRENORD', 5], ['FRECCIAROSSA', 5], ['BIGLIETTO', 2],
    ['TRENO', 3], ['FERROVI', 3], ['BUS', 2], ['AUTOBUS', 3], ['METRO', 2], ['ATM ', 2], ['ATAC', 4],
    ['FLIXBUS', 5], ['TRAGHETTO', 4], ['ALITALIA', 4], ['ITA AIRWAYS', 5], ['RYANAIR', 5],
    ['EASYJET', 5], ['VOLO', 2], ['AEROPORTO', 2], ['NAVETTA', 3], ['SHUTTLE', 3], ['CORSA SEMPLICE', 3],
  ],
  'Noleggio auto': [
    ['NOLEGGIO', 2], ['RENT', 2], ['HERTZ', 5], ['AVIS', 5], ['EUROPCAR', 5], ['SIXT', 5],
    ['MAGGIORE', 3], ['CAR SHARING', 4], ['ENJOY', 2], ['SHARE NOW', 4],
  ],
};

const MESI = {
  GEN: 1, GENNAIO: 1, JAN: 1, FEB: 2, FEBBRAIO: 2, MAR: 3, MARZO: 3, APR: 4, APRILE: 4,
  MAG: 5, MAGGIO: 5, MAY: 5, GIU: 6, GIUGNO: 6, JUN: 6, LUG: 7, LUGLIO: 7, JUL: 7,
  AGO: 8, AGOSTO: 8, AUG: 8, SET: 9, SETTEMBRE: 9, SEP: 9, OTT: 10, OTTOBRE: 10, OCT: 10,
  NOV: 11, NOVEMBRE: 11, DIC: 12, DICEMBRE: 12, DEC: 12,
};

export function normalizza(s) {
  return (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase();
}

// ---------- DATA ----------

function dataValida(g, m, a, oggi) {
  if (a < 100) a += 2000;
  if (m < 1 || m > 12 || g < 1 || g > 31) return null;
  const d = new Date(Date.UTC(a, m - 1, g));
  if (d.getUTCMonth() !== m - 1) return null;
  const limiteFuturo = new Date(oggi.getTime() + 2 * 86400000);
  const limitePassato = new Date(Date.UTC(oggi.getUTCFullYear() - 10, 0, 1));
  if (d > limiteFuturo || d < limitePassato) return null;
  return `${a}-${String(m).padStart(2, '0')}-${String(g).padStart(2, '0')}`;
}

export function estraiData(testo, oggi = new Date()) {
  const t = normalizza(testo)
    // errori OCR tipici dentro le date
    .replace(/(\d)[O](\d)/g, '$10$2');
  const candidati = [];

  // 12/11/2026, 12-11-26, 12.11.2026
  const reNum = /(?<!\d)(\d{1,2})\s?[\/\-.]\s?(\d{1,2})\s?[\/\-.]\s?(\d{4}|\d{2})(?!\d)/g;
  for (const m of t.matchAll(reNum)) {
    const d = dataValida(+m[1], +m[2], +m[3], oggi);
    if (d) candidati.push({ d, pos: m.index, peso: m[3].length === 4 ? 2 : 1 });
  }
  // 2026-11-12
  const reIso = /(?<!\d)(20\d{2})[\/\-.](\d{1,2})[\/\-.](\d{1,2})(?!\d)/g;
  for (const m of t.matchAll(reIso)) {
    const d = dataValida(+m[3], +m[2], +m[1], oggi);
    if (d) candidati.push({ d, pos: m.index, peso: 2 });
  }
  // 12 NOV 2026 / 12 NOVEMBRE 26
  const reTesto = /(?<!\d)(\d{1,2})[\s\-.]*([A-Z]{3,9})[\s\-.,]*(\d{4}|\d{2})(?!\d)/g;
  for (const m of t.matchAll(reTesto)) {
    const mese = MESI[m[2]] || MESI[m[2].slice(0, 3)];
    if (!mese) continue;
    const d = dataValida(+m[1], mese, +m[3], oggi);
    if (d) candidati.push({ d, pos: m.index, peso: 2 });
  }
  if (!candidati.length) return null;

  // Preferisci le date vicino alla parola DATA / con anno a 4 cifre.
  for (const c of candidati) {
    const prima = t.slice(Math.max(0, c.pos - 15), c.pos);
    if (/DATA|DEL|DATE/.test(prima)) c.peso += 2;
  }
  candidati.sort((a, b) => b.peso - a.peso || a.pos - b.pos);
  return candidati[0].d;
}

// ---------- IMPORTO ----------

// Cattura importi tipo 1.234,56  1234,56  12.50  12, 50  (OCR a volte mette spazi)
const RE_IMPORTO = /(?<![\d,.])(\d{1,3}(?:[.'\s]\d{3})+|\d+)\s?[,.]\s?(\d{2})(?![\d])/g;

function importiNellaRiga(riga) {
  const out = [];
  const r = riga.replace(/[€]|EUR(O)?/gi, ' ').replace(/(\d)[O](\d)/g, '$10$2');
  for (const m of r.matchAll(RE_IMPORTO)) {
    const intero = m[1].replace(/[.'\s]/g, '');
    const v = parseFloat(`${intero}.${m[2]}`);
    if (Number.isFinite(v)) out.push(v);
  }
  return out;
}

const PAROLE_TOTALE = [
  [/TOTALE\s+COMPLESSIVO/, 10], [/IMPORTO\s+PAGATO/, 9], [/TOTALE\s+(EURO|EUR|€)/, 9],
  [/TOTALE\s+DA\s+PAGARE/, 9], [/DA\s+PAGARE/, 7], [/TOTALE\s+DOCUMENTO/, 9],
  [/(?<!SUB\s?)TOTALE/, 8], [/(?<!SUB\s?)TOTAL\b/, 7], [/\bTOT\.?\b/, 5], [/IMPORTO/, 4],
  [/PAGAMENTO\s+(ELETTRONICO|CARTA|BANCOMAT|POS)/, 3], [/\bPAGATO\b/, 4], [/\bNETTO\b/, 2],
];
const PAROLE_ESCLUSE = /SUBTOTALE|SUB\s?TOTAL|\bIVA\b|IMPOSTA|RESTO|SCONTO|IMPONIBILE|ALIQUOTA|NON\s+RISCOSSO|CONTANTE|CONTANTI|NR\.?\s*PEZZI|PUNTI|RESIDUO|CREDITO|BUONO|ARROTONDAMENTO/;

export function estraiImporto(testo) {
  const righe = normalizza(testo).split(/\r?\n/).map(r => r.trim()).filter(Boolean);
  let migliore = null;

  righe.forEach((riga, i) => {
    let punteggio = 0;
    for (const [re, p] of PAROLE_TOTALE) if (re.test(riga)) punteggio = Math.max(punteggio, p);
    if (!punteggio) return;
    if (PAROLE_ESCLUSE.test(riga) && punteggio < 9) return;
    let valori = importiNellaRiga(riga);
    // Spesso l'importo sta sulla riga successiva
    if (!valori.length && righe[i + 1]) { valori = importiNellaRiga(righe[i + 1]); punteggio -= 1; }
    if (!valori.length) return;
    const v = valori[valori.length - 1];
    if (v <= 0) return;
    if (!migliore || punteggio > migliore.punteggio ||
        (punteggio === migliore.punteggio && i > migliore.i)) {
      migliore = { v, punteggio, i };
    }
  });
  if (migliore) return migliore.v;

  // Fallback: importo massimo escludendo le righe di resto/contanti/IVA
  let max = null;
  for (const riga of righe) {
    if (PAROLE_ESCLUSE.test(riga)) continue;
    for (const v of importiNellaRiga(riga)) if (v < 100000 && (max === null || v > max)) max = v;
  }
  return max;
}

// ---------- ESERCENTE / P.IVA ----------

export function estraiPartitaIva(testo) {
  const t = normalizza(testo);
  const m = t.match(/(?:P\.?\s?IVA|PARTITA\s+IVA|P\.?\s?I\.?|C\.?F\.?\s*\/?\s*P\.?\s?IVA|VAT)[^\d]{0,6}((?:IT)?\s?\d[\d\s]{9,13}\d)/);
  const grezzo = m ? m[1] : (t.match(/(?<!\d)(\d{11})(?!\d)/) || [])[1];
  if (!grezzo) return null;
  const cifre = grezzo.replace(/\D/g, '');
  return cifre.length === 11 ? cifre : null;
}

const RIGHE_RUMORE = /DOCUMENTO\s+COMMERCIALE|SCONTRINO|RICEVUTA|FATTURA|^VIA\b|^V\.LE|^VIALE|^PIAZZA|^P\.ZZA|^CORSO|^C\.SO|^LARGO|^STRADA|\bTEL\b|TELEFONO|^FAX|P\.?\s?IVA|PARTITA|C\.?F\.?|CODICE\s+FISCALE|^\d|WWW\.|HTTP|@|VENDITA|PRESTAZIONE|BENVENUTI|WELCOME|^CAP\b|\b\d{5}\b/;

function rigaNome(riga) {
  const n = normalizza(riga);
  const lettere = (n.match(/[A-Z]/g) || []).length;
  if (lettere < 3) return false;
  if (lettere / n.replace(/\s/g, '').length < 0.6) return false; // troppi simboli: rumore OCR
  return !RIGHE_RUMORE.test(n.replace(/^[^A-Z0-9]+/, ''));
}

export function estraiEsercente(testo) {
  const righe = (testo || '').split(/\r?\n/).map(r => r.trim()).filter(Boolean).slice(0, 8);
  const i = righe.findIndex(rigaNome);
  if (i < 0) return '';
  let nome = pulisciNome(righe[i]);
  // Insegne su due righe (es. "OSTERIA" / "IL GALLO"): unisci se entrambe brevi e maiuscole.
  const dopo = righe[i + 1] && pulisciNome(righe[i + 1]);
  if (dopo && rigaNome(dopo) && nome.split(' ').length <= 2 && dopo.split(' ').length <= 3 &&
      nome === nome.toUpperCase() && dopo === dopo.toUpperCase()) nome += ' ' + dopo;
  return nome;
}

function pulisciNome(s) {
  return s.replace(/[^\p{L}\p{N}&'.\-\s]/gu, ' ').replace(/\s{2,}/g, ' ')
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}.]+$/gu, '').trim();
}

// ---------- CATEGORIA ----------

export function chiaveEsercente(nome, piva) {
  if (piva) return 'piva:' + piva;
  const n = normalizza(nome).replace(/[^A-Z0-9]/g, '');
  return n ? 'nome:' + n : null;
}

export function suggerisciCategoria(testo, memoria = {}, esercente = '', piva = null) {
  // 1) Quello che l'utente ha già scelto per lo stesso esercente vince su tutto.
  for (const k of [piva && chiaveEsercente('', piva), chiaveEsercente(esercente, null)]) {
    if (k && memoria[k]) return { categoria: memoria[k], fonte: 'memoria', punteggi: {} };
  }
  // 2) Parole chiave
  const t = ' ' + normalizza(testo).replace(/\s+/g, ' ') + ' ';
  const testa = ' ' + normalizza(esercente) + ' ';
  const punteggi = {};
  for (const [cat, regole] of Object.entries(REGOLE)) {
    let s = 0;
    for (const [parola, peso] of regole) {
      if (t.includes(parola)) s += peso;
      if (testa.includes(parola)) s += peso; // il nome dell'esercente conta doppio
    }
    if (s) punteggi[cat] = s;
  }
  const ordinate = Object.entries(punteggi).sort((a, b) => b[1] - a[1]);
  return {
    categoria: ordinate.length ? ordinate[0][0] : 'Altro',
    fonte: ordinate.length ? 'parole chiave' : 'nessuna',
    punteggi,
  };
}

// ---------- TUTTO INSIEME ----------

export function analizza(testo, memoria = {}, oggi = new Date()) {
  const esercente = estraiEsercente(testo);
  const piva = estraiPartitaIva(testo);
  const sugg = suggerisciCategoria(testo, memoria, esercente, piva);
  return {
    esercente,
    piva,
    data: estraiData(testo, oggi),
    importo: estraiImporto(testo),
    categoria: sugg.categoria,
    fonteCategoria: sugg.fonte,
  };
}
