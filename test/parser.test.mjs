import assert from 'node:assert/strict';
import { analizza } from '../js/parser.js';
const oggi = new Date('2026-11-12');
const casi = [
 [`TRATTORIA DA MARIO
Via Roma 12 - 00100 Roma
P.IVA 01234567890
DOCUMENTO COMMERCIALE
di vendita o prestazione
COPERTO x2        4,00
PRIMO            12,50
ACQUA             2,50
SUBTOTALE        19,00
TOTALE COMPLESSIVO 19,00
di cui IVA        1,73
PAGAMENTO CONTANTE 20,00
RESTO              1,00
10-11-2026 13:45
DOCUMENTO N. 0042-0013`, {esercente:'TRATTORIA DA MARIO', data:'2026-11-10', importo:19, categoria:'Vitto', piva:'01234567890'}],
 [`APCOA PARKING ITALIA
Parcheggio Stazione Centrale
Entrata 08/11/26 08:12
Uscita  08/11/26 18:40
Permanenza 10h28m
TOTALE EURO 24.00`, {data:'2026-11-08', importo:24, categoria:'Parcheggio'}],
 [`RADIOTAXI 3570
Licenza n. 1234
Corsa del 05 NOV 2026
Importo
EUR 18,40`, {data:'2026-11-05', importo:18.4, categoria:'Taxi'}],
 [`HOTEL BELVEDERE ***
Corso Italia 4, Milano
Pernottamento 2 notti   1.240,00
Tassa di soggiorno         10,00
TOTALE                  1.250,00
Data 03.11.2026`, {data:'2026-11-03', importo:1250, categoria:'Alloggio'}],
];
for (const [t, atteso] of casi) {
  const r = analizza(t, {}, oggi);
  for (const k of Object.keys(atteso)) assert.equal(r[k], atteso[k], `${k} in: ${t.split('\n')[0]} -> ${JSON.stringify(r)}`);
  console.log('ok', JSON.stringify(r));
}
// memoria vince
assert.equal(analizza(casi[0][0], {'piva:01234567890':'Alloggio'}, oggi).categoria, 'Alloggio');
console.log('tutti i test passati');
