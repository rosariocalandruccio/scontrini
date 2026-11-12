# Scontrini – nota spese da foto, tutto in locale

PWA (web app installabile su Android, iPhone, PC) che da una foto di scontrino estrae
**data, esercente (nome + ritaglio del logo/testata), P.IVA e importo**, propone la
**categoria** (Vitto, Alloggio, Parcheggio, Taxi, Carburante, Pedaggi, Trasporti,
Noleggio auto, Altro) e salva tutto **solo sul dispositivo**. La tabella si esporta in **XML**.

## Privacy
- OCR eseguito nel browser con Tesseract.js (WebAssembly); motore e lingua italiana sono
  inclusi in `vendor/`, nessuna chiamata a servizi esterni.
- Dati e foto in IndexedDB del browser; nessun server, nessun account.
- Dopo il primo caricamento l'app funziona anche offline (service worker).
- Il server serve solo file statici: non riceve mai foto o dati.

## Avvio in locale
```bash
python3 -m http.server 8000
```
Apri http://localhost:8000. Per installarla sul telefono serve HTTPS: pubblica la cartella
su un hosting statico (GitHub Pages, Netlify, Cloudflare Pages…) e da browser
"Aggiungi a schermata Home" / "Installa app".

## Uso
1. "Fotografa scontrino" (o più foto dalla galleria).
2. Controlla i campi proposti, scegli la categoria (l'app ricorda la scelta per lo stesso esercente/P.IVA).
3. Filtra per periodo/categoria ed esporta in XML (opzionalmente con logo e foto in base64).

## Struttura
- `js/parser.js` – estrazione data/importo/esercente/P.IVA e regole di classificazione
- `js/ocr.js` – pre-elaborazione immagine, OCR, ritaglio logo
- `js/db.js` – archivio IndexedDB
- `js/xml.js` – export XML
- `test/parser.test.mjs` – test del parser (`node test/parser.test.mjs`)

## Formato XML
```xml
<NotaSpese generato="..." valuta="EUR" dal="..." al="...">
  <Spesa id="...">
    <Data>2026-11-11</Data><Esercente>OSTERIA IL GALLO</Esercente>
    <PartitaIVA>09876543210</PartitaIVA><Categoria>Vitto</Categoria>
    <Importo>49.00</Importo><Note>...</Note>
    <Logo mime="image/jpeg">base64…</Logo><Foto mime="image/jpeg">base64…</Foto>
  </Spesa>
  <Riepilogo><Categoria nome="Vitto" numero="1" totale="49.00"/><Totale numero="1">49.00</Totale></Riepilogo>
</NotaSpese>
```
