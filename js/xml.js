// Esportazione in XML (UTF-8). Le immagini, se richieste, sono incluse in base64.
const esc = (s) => String(s ?? '').replace(/[<>&'"]/g, c =>
  ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);

async function base64(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

export async function generaXml(spese, { dal, al, immagini = false } = {}) {
  const r = [];
  r.push('<?xml version="1.0" encoding="UTF-8"?>');
  r.push(`<NotaSpese generato="${new Date().toISOString()}" valuta="EUR"${dal ? ` dal="${dal}"` : ''}${al ? ` al="${al}"` : ''}>`);
  const totali = {};
  let totale = 0;
  for (const s of spese) {
    totali[s.categoria] ??= { n: 0, t: 0 };
    totali[s.categoria].n++; totali[s.categoria].t += s.importo; totale += s.importo;
    r.push(`  <Spesa id="${esc(s.id)}">`);
    r.push(`    <Data>${esc(s.data)}</Data>`);
    r.push(`    <Esercente>${esc(s.esercente)}</Esercente>`);
    if (s.piva) r.push(`    <PartitaIVA>${esc(s.piva)}</PartitaIVA>`);
    r.push(`    <Categoria>${esc(s.categoria)}</Categoria>`);
    r.push(`    <Importo>${s.importo.toFixed(2)}</Importo>`);
    if (s.note) r.push(`    <Note>${esc(s.note)}</Note>`);
    if (immagini && s.logo) r.push(`    <Logo mime="image/jpeg">${await base64(s.logo)}</Logo>`);
    if (immagini && s.foto) r.push(`    <Foto mime="image/jpeg">${await base64(s.foto)}</Foto>`);
    r.push('  </Spesa>');
  }
  r.push('  <Riepilogo>');
  for (const [cat, v] of Object.entries(totali).sort()) {
    r.push(`    <Categoria nome="${esc(cat)}" numero="${v.n}" totale="${v.t.toFixed(2)}"/>`);
  }
  r.push(`    <Totale numero="${spese.length}">${totale.toFixed(2)}</Totale>`);
  r.push('  </Riepilogo>');
  r.push('</NotaSpese>');
  return r.join('\n');
}
