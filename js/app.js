import { CATEGORIE, analizza, chiaveEsercente } from './parser.js';
import * as db from './db.js';
import { caricaImmagine, ridimensiona, riconosci, ritagliaLogo, inBlob } from './ocr.js';
import { generaXml } from './xml.js';

const $ = (s) => document.querySelector(s);
const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
const dataIt = (iso) => iso ? iso.split('-').reverse().join('/') : '';
const ICONE = { Vitto: '🍽️', Alloggio: '🛏️', Parcheggio: '🅿️', Taxi: '🚕', Carburante: '⛽',
  Pedaggi: '🛣️', Trasporti: '🚆', 'Noleggio auto': '🚗', Altro: '🧾' };

let spese = [];
let memoria = {};          // esercente -> categoria scelta in passato
let corrente = null;       // spesa aperta nella scheda
const coda = [];           // file in attesa (selezione multipla da galleria)
const urlOggetti = new Map();

// ---------- avvio ----------
async function avvio() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.storage?.persist?.();
  memoria = (await db.leggiImpostazione('memoria')) || {};
  for (const c of CATEGORIE) {
    $('#f-cat').add(new Option(`${ICONE[c]} ${c}`, c));
    $('#c-categoria').add(new Option(`${ICONE[c]} ${c}`, c));
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = `${ICONE[c]} ${c}`; b.dataset.cat = c;
    b.onclick = () => { $('#c-categoria').value = c; aggiornaChip(); };
    $('#chip-cat').append(b);
  }
  $('#c-categoria').onchange = aggiornaChip;
  for (const id of ['#f-dal', '#f-al', '#f-cat']) $(id).onchange = disegna;
  $('#foto-camera').onchange = (e) => accoda(e.target.files);
  $('#foto-galleria').onchange = (e) => accoda(e.target.files);
  $('#annulla').onclick = chiudiScheda;
  $('#scheda').addEventListener('close', () => { corrente = null; prossimo(); });
  $('#modulo').onsubmit = salva;
  $('#elimina').onclick = elimina;
  $('#ruota').onclick = () => corrente && elabora(corrente.file, (corrente.rotazione + 90) % 360);
  $('#x-scarica').onclick = () => esporta(false);
  $('#x-condividi').onclick = () => esporta(true);
  $('#x-condividi').hidden = !navigator.canShare?.({ files: [new File([''], 'a.xml', { type: 'application/xml' })] });
  spese = await db.tutteLeSpese();
  disegna();
}

// ---------- tabella ----------
function filtrate() {
  const dal = $('#f-dal').value, al = $('#f-al').value, cat = $('#f-cat').value;
  return spese
    .filter(s => (!dal || s.data >= dal) && (!al || s.data <= al) && (!cat || s.categoria === cat))
    .sort((a, b) => b.data.localeCompare(a.data) || b.creato - a.creato);
}

function urlDi(blob) {
  if (!blob) return '';
  if (!urlOggetti.has(blob)) urlOggetti.set(blob, URL.createObjectURL(blob));
  return urlOggetti.get(blob);
}

function disegna() {
  const righe = filtrate();
  const tb = $('#tabella tbody');
  tb.replaceChildren(...righe.map(s => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="logo">${s.logo ? `<img alt="">` : ''}</td>
      <td>${dataIt(s.data)}</td><td class="eserc"></td>
      <td><span class="tag">${ICONE[s.categoria] || ''} ${s.categoria}</span></td>
      <td class="num">${euro.format(s.importo)}</td>`;
    if (s.logo) tr.querySelector('img').src = urlDi(s.logo);
    tr.querySelector('.eserc').textContent = s.esercente || '—';
    tr.onclick = () => apriScheda(s);
    return tr;
  }));
  $('#vuoto').hidden = righe.length > 0;
  $('#tabella').hidden = righe.length === 0;

  const tot = {};
  let totale = 0;
  for (const s of righe) { tot[s.categoria] = (tot[s.categoria] || 0) + s.importo; totale += s.importo; }
  $('#riepilogo').innerHTML = righe.length ? Object.entries(tot).sort((a, b) => b[1] - a[1])
    .map(([c, v]) => `<div class="voce"><span>${ICONE[c]} ${c}</span><b>${euro.format(v)}</b></div>`).join('')
    + `<div class="voce totale"><span>Totale (${righe.length})</span><b>${euro.format(totale)}</b></div>` : '';
}

// ---------- acquisizione ----------
function accoda(files) {
  coda.push(...files);
  $('#foto-camera').value = ''; $('#foto-galleria').value = '';
  if (!$('#scheda').open) prossimo();
}
function prossimo() { const f = coda.shift(); if (f) nuovo(f); }

function nuovo(file) {
  corrente = { nuovo: true, file, rotazione: 0 };
  $('#scheda-titolo').textContent = coda.length ? `Nuovo scontrino (altri ${coda.length} in coda)` : 'Nuovo scontrino';
  $('#elimina').hidden = true;
  $('#ruota').hidden = false;
  compila({ data: '', importo: null, esercente: '', categoria: 'Altro', piva: '', note: '' });
  $('#c-testo').textContent = '';
  $('#img-logo').removeAttribute('src');
  $('#scheda').showModal();
  elabora(file, 0);
}

async function elabora(file, rotazione) {
  corrente.rotazione = rotazione;
  const stato = $('#stato'), barra = $('#progresso-barra'), testoStato = $('#stato-testo');
  stato.hidden = false; $('#salva').disabled = true; barra.style.width = '0%';
  testoStato.textContent = 'Preparo l\'immagine…';
  try {
    const canvas = await caricaImmagine(file, rotazione);
    const foto = await inBlob(ridimensiona(canvas, 1600), 0.75);
    $('#img-foto').src = URL.createObjectURL(foto);
    corrente.foto = foto;
    const { testo, righe } = await riconosci(canvas, (m) => {
      if (m.status === 'recognizing text') {
        barra.style.width = `${Math.round(m.progress * 100)}%`;
        testoStato.textContent = `Lettura testo… ${Math.round(m.progress * 100)}%`;
      } else testoStato.textContent = 'Carico il motore OCR (solo la prima volta)…';
    });
    if (!$('#scheda').open || corrente?.file !== file) return;
    const r = analizza(testo, memoria);
    corrente.testo = testo;
    corrente.logo = await inBlob(ritagliaLogo(canvas, righe, r.esercente), 0.8);
    $('#img-logo').src = URL.createObjectURL(corrente.logo);
    $('#c-testo').textContent = testo;
    compila({ ...r, note: $('#c-note').value });
    $('#c-suggerita').textContent = r.fonteCategoria === 'memoria' ? '(come l\'ultima volta)'
      : r.fonteCategoria === 'parole chiave' ? '(suggerita)' : '';
    const mancanti = [!r.data && 'data', !r.importo && 'importo'].filter(Boolean);
    toast(mancanti.length ? `Controlla: non ho trovato ${mancanti.join(' e ')}` : 'Controlla i dati e salva');
  } catch (e) {
    console.error(e);
    toast('Errore nella lettura: inserisci i dati a mano');
  } finally {
    stato.hidden = true; $('#salva').disabled = false;
  }
}

// ---------- scheda ----------
function compila(s) {
  $('#c-esercente').value = s.esercente || '';
  $('#c-data').value = s.data || '';
  $('#c-importo').value = s.importo != null ? s.importo.toFixed(2).replace('.', ',') : '';
  $('#c-categoria').value = s.categoria || 'Altro';
  $('#c-piva').value = s.piva || '';
  $('#c-note').value = s.note || '';
  aggiornaChip();
}
function aggiornaChip() {
  for (const b of $('#chip-cat').children) b.classList.toggle('attivo', b.dataset.cat === $('#c-categoria').value);
}

function apriScheda(s) {
  corrente = { ...s, nuovo: false };
  $('#scheda-titolo').textContent = 'Modifica scontrino';
  $('#elimina').hidden = false;
  $('#ruota').hidden = true;
  $('#stato').hidden = true;
  $('#c-suggerita').textContent = '';
  compila(s);
  $('#c-testo').textContent = s.testo || '';
  $('#img-logo').src = urlDi(s.logo);
  $('#img-foto').src = urlDi(s.foto);
  $('#scheda').showModal();
}

function chiudiScheda() { $('#scheda').close(); }

async function salva(e) {
  e.preventDefault();
  const importo = parseFloat($('#c-importo').value.replace(/\s/g, '').replace(',', '.'));
  if (!$('#c-data').value || !Number.isFinite(importo)) { toast('Data e importo sono obbligatori'); return; }
  const s = {
    id: corrente.id || crypto.randomUUID(),
    creato: corrente.creato || Date.now(),
    data: $('#c-data').value,
    importo: Math.round(importo * 100) / 100,
    esercente: $('#c-esercente').value.trim(),
    categoria: $('#c-categoria').value,
    piva: $('#c-piva').value.replace(/\D/g, '') || null,
    note: $('#c-note').value.trim(),
    testo: corrente.testo || '',
    logo: corrente.logo || null,
    foto: corrente.foto || null,
  };
  await db.salvaSpesa(s);
  // Impara la scelta per questo esercente
  for (const k of [chiaveEsercente(s.esercente, null), s.piva && chiaveEsercente('', s.piva)]) if (k) memoria[k] = s.categoria;
  await db.scriviImpostazione('memoria', memoria);
  spese = spese.filter(x => x.id !== s.id).concat(s);
  disegna();
  toast('Salvato');
  chiudiScheda();
}

async function elimina() {
  if (!corrente?.id || !confirm('Eliminare questo scontrino?')) return;
  await db.eliminaSpesa(corrente.id);
  spese = spese.filter(x => x.id !== corrente.id);
  disegna();
  chiudiScheda();
}

// ---------- export ----------
async function esporta(condividi) {
  const righe = filtrate().reverse();
  if (!righe.length) { toast('Nessuna riga da esportare'); return; }
  const xml = await generaXml(righe, { dal: $('#f-dal').value, al: $('#f-al').value, immagini: $('#x-img').checked });
  const nome = `nota-spese-${new Date().toISOString().slice(0, 10)}.xml`;
  const file = new File([xml], nome, { type: 'application/xml' });
  if (condividi) {
    try { await navigator.share({ files: [file], title: 'Nota spese' }); } catch { /* annullato */ }
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file); a.download = nome;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3000);
}

avvio();
