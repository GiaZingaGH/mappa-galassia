'use strict';

/* =====================================================================
   Mappa concettuale che si dispone da sola.
   Legge mappa.txt, costruisce l'albero dei nodi e li lascia sistemare
   a un piccolo motore fisico scritto qui sotto (nessuna libreria).
   ===================================================================== */


/* ---------------------------------------------------------------
   1. Manopole del motore fisico: cambiando questi numeri cambia
      il modo in cui la mappa si allarga e si assesta.
   --------------------------------------------------------------- */
const FISICA = {
  repulsione: 7000,    // quanto i nodi si respingono quando sono vicini
  separazione: 0.10,   // spinta in piu' quando due etichette si toccano
  aria: 14,            // spazio vuoto da lasciare attorno a ogni etichetta
  molla: 0.010,        // quanto i collegamenti tirano padre e figlio
  riposo: 76,         // distanza "comoda" di un collegamento, in pixel
  gravita: 0.0034,     // richiamo verso il centro, tiene insieme il tutto
  attrito: 0.85,       // frena il movimento: 1 = nessun freno
  velocitaMax: 14,     // evita scatti troppo bruschi
  quiete: 0.05,        // sotto questa velocita' consideriamo tutto fermo
  frameDiQuiete: 25    // quanti frame di calma prima di spegnere il moto
};

// Un colore per ogni ramo principale (i figli ereditano quello del ramo).
const COLORI_RAMI = [
  '#2f6fd0', '#c0392b', '#1a7a5e', '#8e44ad',
  '#a35c00', '#b0306e', '#2a7d9b', '#6b4fbb'
];
const COLORE_RADICE = '#e3e9f5';


/* ---------------------------------------------------------------
   2. Lettura di mappa.txt
      Ogni riga e' un nodo; gli spazi iniziali dicono il livello.
      Se una riga e' indentata male non ci fermiamo: la sistemiamo
      dove ha piu' senso e ne prendiamo nota per avvisare l'utente.
   --------------------------------------------------------------- */
function analizzaMappa(testo) {
  const nodi = [];
  const avvisi = [];
  const pila = [];   // il percorso dalla radice fino all'ultimo nodo letto

  const righe = testo.split(/\r?\n/);

  righe.forEach(function (rigaOriginale, indice) {
    const numeroRiga = indice + 1;

    // Un tabulatore vale come 2 spazi, cosi' chi lo usa non resta fuori.
    const riga = rigaOriginale.replace(/\t/g, '  ');
    const testoNodo = riga.trim();

    if (testoNodo === '' || testoNodo.charAt(0) === '#') return;  // vuota o commento

    let rientro = riga.length - riga.replace(/^ +/, '').length;

    // --- il primo nodo utile diventa la radice ---
    if (nodi.length === 0) {
      if (rientro > 0) {
        avvisi.push('Riga ' + numeroRiga + ' ("' + testoNodo + '"): la prima riga ' +
                    'non deve avere spazi davanti. La uso come titolo della mappa.');
        rientro = 0;
      }
      const radice = creaNodo(nodi.length, testoNodo, 0, null, numeroRiga);
      nodi.push(radice);
      pila.push({ rientro: 0, nodo: radice, rientroFigli: null });
      return;
    }

    // --- risaliamo finche' non troviamo un nodo meno rientrato di questo ---
    while (pila.length > 1 && rientro <= pila[pila.length - 1].rientro) {
      pila.pop();
    }

    // Una seconda riga senza spazi: c'e' gia' un titolo, la appendiamo a lui.
    if (pila.length === 1 && rientro <= pila[0].rientro) {
      avvisi.push('Riga ' + numeroRiga + ' ("' + testoNodo + '"): non ha spazi davanti, ' +
                  'ma il titolo della mappa c\'e\' gia\'. La attacco al titolo: ' +
                  'se e\' un ramo principale mettile 2 spazi davanti.');
      rientro = 2;
    }

    const genitore = pila[pila.length - 1];

    // --- rientro irregolare: lo riportiamo a quello dei fratelli ---
    if (genitore.rientroFigli === null) {
      genitore.rientroFigli = rientro;
    } else if (rientro !== genitore.rientroFigli) {
      avvisi.push('Riga ' + numeroRiga + ' ("' + testoNodo + '"): gli spazi davanti ' +
                  'non tornano (' + rientro + ' invece di ' + genitore.rientroFigli + '). ' +
                  'La metto insieme alle righe vicine, sotto "' + genitore.nodo.testo + '".');
      rientro = genitore.rientroFigli;
    }

    const nodo = creaNodo(nodi.length, testoNodo, genitore.nodo.livello + 1,
                          genitore.nodo, numeroRiga);
    nodi.push(nodo);
    genitore.nodo.figli.push(nodo);
    pila.push({ rientro: rientro, nodo: nodo, rientroFigli: null });
  });

  // --- assegniamo a ogni nodo il colore del suo ramo principale ---
  let contaRami = 0;
  nodi.forEach(function (nodo) {
    if (nodo.livello === 0) {
      nodo.colore = COLORE_RADICE;
    } else if (nodo.livello === 1) {
      nodo.colore = COLORI_RAMI[contaRami % COLORI_RAMI.length];
      contaRami++;
    } else {
      nodo.colore = nodo.padre.colore;
    }
  });

  return { nodi: nodi, avvisi: avvisi };
}

function creaNodo(id, testo, livello, padre, numeroRiga) {
  return {
    id: id, testo: testo, livello: livello, padre: padre, riga: numeroRiga,
    figli: [], colore: COLORE_RADICE,
    x: 0, y: 0, vx: 0, vy: 0,
    larghezza: 100, altezza: 30,
    fermato: false            // vero mentre il mouse lo tiene
  };
}


/* ---------------------------------------------------------------
   3. Disegno: caratteri, misure e colore del testo
   --------------------------------------------------------------- */
const tela = document.getElementById('tela');
const ctx = tela.getContext('2d');

function carattere(livello) {
  if (livello === 0) return '600 19px -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';
  if (livello === 1) return '600 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';
  return '400 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';
}

// Bianco su colori scuri, quasi nero su colori chiari: il testo resta leggibile.
function coloreTesto(sfondo) {
  const r = parseInt(sfondo.substr(1, 2), 16);
  const v = parseInt(sfondo.substr(3, 2), 16);
  const b = parseInt(sfondo.substr(5, 2), 16);
  const luminosita = (0.299 * r + 0.587 * v + 0.114 * b) / 255;
  return luminosita > 0.62 ? '#10131c' : '#ffffff';
}

function misuraNodi(nodi) {
  nodi.forEach(function (nodo) {
    ctx.font = carattere(nodo.livello);
    const larghezzaTesto = ctx.measureText(nodo.testo).width;
    const margine = nodo.livello === 0 ? 22 : 16;
    nodo.larghezza = Math.ceil(larghezzaTesto + margine * 2);
    nodo.altezza = nodo.livello === 0 ? 44 : (nodo.livello === 1 ? 36 : 30);
    nodo.raggio = Math.max(nodo.larghezza, nodo.altezza) / 2;
  });
}


/* ---------------------------------------------------------------
   4. Il motore fisico: attrazione lungo i collegamenti,
      repulsione fra nodi vicini, attrito, richiamo al centro.
   --------------------------------------------------------------- */
let nodi = [];
let legami = [];
let inMovimento = false;
let frameCalmi = 0;

function disponiAllInizio() {
  // Partenza a raggiera: ogni figlio si stacca dal padre in una direzione.
  nodi.forEach(function (nodo, i) {
    if (nodo.padre === null) {
      nodo.x = 0;
      nodo.y = 0;
    } else {
      const quanti = Math.max(nodo.padre.figli.length, 1);
      const posizione = nodo.padre.figli.indexOf(nodo);
      const angolo = (posizione / quanti) * Math.PI * 2 + nodo.livello * 0.7 + i * 0.05;
      const distanza = FISICA.riposo * (nodo.livello === 1 ? 1.6 : 1);
      nodo.x = nodo.padre.x + Math.cos(angolo) * distanza;
      nodo.y = nodo.padre.y + Math.sin(angolo) * distanza;
    }
    nodo.vx = 0;
    nodo.vy = 0;
  });
}

function passoDiSimulazione() {
  let velocitaMassima = 0;

  // --- repulsione: ogni coppia di nodi si spinge via ---
  for (let i = 0; i < nodi.length; i++) {
    for (let j = i + 1; j < nodi.length; j++) {
      const a = nodi[i], b = nodi[j];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let distanza = Math.sqrt(dx * dx + dy * dy);

      if (distanza < 0.01) {           // due nodi sovrapposti: separiamoli a caso
        dx = Math.random() - 0.5;
        dy = Math.random() - 0.5;
        distanza = 0.01;
      }

      // I nodi larghi hanno bisogno di piu' spazio attorno.
      const ingombro = (a.raggio + b.raggio) / 55;
      const forza = (FISICA.repulsione * ingombro) / (distanza * distanza);
      let fx = (dx / distanza) * forza;
      let fy = (dy / distanza) * forza;

      // Se le due etichette arrivano a toccarsi, una spinta decisa le separa
      // dal lato in cui si sovrappongono di meno: cosi' nessuna scritta
      // finisce sopra un'altra.
      const sovrappostoX = (a.larghezza + b.larghezza) / 2 + FISICA.aria - Math.abs(dx);
      const sovrappostoY = (a.altezza + b.altezza) / 2 + FISICA.aria - Math.abs(dy);
      if (sovrappostoX > 0 && sovrappostoY > 0) {
        if (sovrappostoX < sovrappostoY) {
          fx += (dx >= 0 ? 1 : -1) * sovrappostoX * FISICA.separazione;
        } else {
          fy += (dy >= 0 ? 1 : -1) * sovrappostoY * FISICA.separazione;
        }
      }

      a.vx -= fx; a.vy -= fy;
      b.vx += fx; b.vy += fy;
    }
  }

  // --- attrazione: ogni collegamento si comporta come una molla ---
  legami.forEach(function (legame) {
    const a = legame.da, b = legame.a;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const distanza = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01);
    const riposo = FISICA.riposo + (a.larghezza + b.larghezza) / 4;
    const forza = FISICA.molla * (distanza - riposo);
    const fx = (dx / distanza) * forza;
    const fy = (dy / distanza) * forza;

    a.vx += fx; a.vy += fy;
    b.vx -= fx; b.vy -= fy;
  });

  // --- richiamo al centro, attrito e spostamento ---
  nodi.forEach(function (nodo) {
    nodo.vx -= nodo.x * FISICA.gravita;
    nodo.vy -= nodo.y * FISICA.gravita;

    nodo.vx *= FISICA.attrito;
    nodo.vy *= FISICA.attrito;

    const velocita = Math.sqrt(nodo.vx * nodo.vx + nodo.vy * nodo.vy);
    if (velocita > FISICA.velocitaMax) {
      nodo.vx = (nodo.vx / velocita) * FISICA.velocitaMax;
      nodo.vy = (nodo.vy / velocita) * FISICA.velocitaMax;
    }

    if (nodo.fermato) {            // lo sta tenendo il mouse: non si muove da solo
      nodo.vx = 0;
      nodo.vy = 0;
    } else {
      nodo.x += nodo.vx;
      nodo.y += nodo.vy;
    }

    if (velocita > velocitaMassima) velocitaMassima = velocita;
  });

  return velocitaMassima;
}


/* ---------------------------------------------------------------
   5. Inquadratura: la mappa viene sempre riportata dentro lo schermo
   --------------------------------------------------------------- */
let scala = 1, scalaObiettivo = 1;
let spostaX = 0, spostaY = 0, spostaXObiettivo = 0, spostaYObiettivo = 0;
let larghezzaVista = 0, altezzaVista = 0;

function aggiornaInquadratura() {
  if (nodi.length === 0) return;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  nodi.forEach(function (nodo) {
    minX = Math.min(minX, nodo.x - nodo.larghezza / 2);
    maxX = Math.max(maxX, nodo.x + nodo.larghezza / 2);
    minY = Math.min(minY, nodo.y - nodo.altezza / 2);
    maxY = Math.max(maxY, nodo.y + nodo.altezza / 2);
  });

  const margine = 60;
  const bordoAlto = 80;   // spazio per il titolo in alto
  const larghezzaUtile = Math.max(larghezzaVista - margine * 2, 50);
  const altezzaUtile = Math.max(altezzaVista - margine - bordoAlto, 50);

  scalaObiettivo = Math.min(1, larghezzaUtile / (maxX - minX), altezzaUtile / (maxY - minY));
  spostaXObiettivo = larghezzaVista / 2 - ((minX + maxX) / 2) * scalaObiettivo;
  spostaYObiettivo = bordoAlto + altezzaUtile / 2
                     - ((minY + maxY) / 2) * scalaObiettivo;

  // Avvicinamento morbido, cosi' l'inquadratura non salta.
  scala += (scalaObiettivo - scala) * 0.08;
  spostaX += (spostaXObiettivo - spostaX) * 0.08;
  spostaY += (spostaYObiettivo - spostaY) * 0.08;
}

function inquadraturaAssestata() {
  return Math.abs(scalaObiettivo - scala) < 0.001 &&
         Math.abs(spostaXObiettivo - spostaX) < 0.5 &&
         Math.abs(spostaYObiettivo - spostaY) < 0.5;
}


/* ---------------------------------------------------------------
   6. Disegno della mappa
   --------------------------------------------------------------- */
function disegna() {
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, larghezzaVista, altezzaVista);

  ctx.setTransform(dpr * scala, 0, 0, dpr * scala, dpr * spostaX, dpr * spostaY);

  // collegamenti
  ctx.lineCap = 'round';
  legami.forEach(function (legame) {
    ctx.beginPath();
    ctx.moveTo(legame.da.x, legame.da.y);
    ctx.lineTo(legame.a.x, legame.a.y);
    ctx.strokeStyle = legame.a.colore;
    ctx.globalAlpha = legame.a.livello === 1 ? 0.75 : 0.45;
    ctx.lineWidth = legame.a.livello === 1 ? 2.5 : 1.6;
    ctx.stroke();
  });
  ctx.globalAlpha = 1;

  // nodi
  nodi.forEach(function (nodo) {
    const x = nodo.x - nodo.larghezza / 2;
    const y = nodo.y - nodo.altezza / 2;
    const raggio = nodo.altezza / 2;

    rettangoloArrotondato(x, y, nodo.larghezza, nodo.altezza, raggio);
    ctx.fillStyle = nodo.colore;
    ctx.fill();

    if (nodo.livello > 1) {           // i dettagli hanno un bordo piu' marcato
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.fillStyle = coloreTesto(nodo.colore);
    ctx.font = carattere(nodo.livello);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(nodo.testo, nodo.x, nodo.y + 1);
  });
}

function rettangoloArrotondato(x, y, larghezza, altezza, raggio) {
  ctx.beginPath();
  ctx.moveTo(x + raggio, y);
  ctx.lineTo(x + larghezza - raggio, y);
  ctx.quadraticCurveTo(x + larghezza, y, x + larghezza, y + raggio);
  ctx.lineTo(x + larghezza, y + altezza - raggio);
  ctx.quadraticCurveTo(x + larghezza, y + altezza, x + larghezza - raggio, y + altezza);
  ctx.lineTo(x + raggio, y + altezza);
  ctx.quadraticCurveTo(x, y + altezza, x, y + altezza - raggio);
  ctx.lineTo(x, y + raggio);
  ctx.quadraticCurveTo(x, y, x + raggio, y);
  ctx.closePath();
}


/* ---------------------------------------------------------------
   7. Il ciclo: calcola, disegna e si ferma quando c'e' equilibrio
   --------------------------------------------------------------- */
function ciclo() {
  const velocita = passoDiSimulazione();
  aggiornaInquadratura();
  disegna();

  if (velocita < FISICA.quiete && inquadraturaAssestata()) {
    frameCalmi++;
  } else {
    frameCalmi = 0;
  }

  if (frameCalmi >= FISICA.frameDiQuiete) {
    inMovimento = false;        // equilibrio raggiunto: il motore si spegne
    return;
  }

  requestAnimationFrame(ciclo);
}

function riavviaMovimento() {
  frameCalmi = 0;
  if (!inMovimento) {
    inMovimento = true;
    requestAnimationFrame(ciclo);
  }
}


/* ---------------------------------------------------------------
   8. Finestra e trascinamento con il mouse
   --------------------------------------------------------------- */
function ridimensiona() {
  const dpr = window.devicePixelRatio || 1;
  larghezzaVista = window.innerWidth;
  altezzaVista = window.innerHeight;
  tela.width = Math.round(larghezzaVista * dpr);
  tela.height = Math.round(altezzaVista * dpr);
  misuraNodi(nodi);
  riavviaMovimento();
}

function puntoNelMondo(evento) {
  return {
    x: (evento.clientX - spostaX) / scala,
    y: (evento.clientY - spostaY) / scala
  };
}

let nodoTrascinato = null;

tela.addEventListener('pointerdown', function (evento) {
  const punto = puntoNelMondo(evento);
  for (let i = nodi.length - 1; i >= 0; i--) {
    const nodo = nodi[i];
    if (Math.abs(punto.x - nodo.x) <= nodo.larghezza / 2 &&
        Math.abs(punto.y - nodo.y) <= nodo.altezza / 2) {
      nodoTrascinato = nodo;
      nodo.fermato = true;
      tela.classList.add('trascino');
      tela.setPointerCapture(evento.pointerId);
      riavviaMovimento();
      break;
    }
  }
});

tela.addEventListener('pointermove', function (evento) {
  if (!nodoTrascinato) return;
  const punto = puntoNelMondo(evento);
  nodoTrascinato.x = punto.x;
  nodoTrascinato.y = punto.y;
  riavviaMovimento();
});

function lasciaNodo() {
  if (!nodoTrascinato) return;
  nodoTrascinato.fermato = false;
  nodoTrascinato = null;
  tela.classList.remove('trascino');
  riavviaMovimento();
}

tela.addEventListener('pointerup', lasciaNodo);
tela.addEventListener('pointercancel', lasciaNodo);
window.addEventListener('resize', ridimensiona);


/* ---------------------------------------------------------------
   9. Avvisi a schermo
   --------------------------------------------------------------- */
function mostraAvvisi(messaggi) {
  const riquadro = document.getElementById('avvisi');
  if (messaggi.length === 0) {
    riquadro.hidden = true;
    return;
  }
  riquadro.hidden = false;
  riquadro.innerHTML = '';

  const intestazione = document.createElement('p');
  intestazione.innerHTML = '<strong>Da controllare in mappa.txt:</strong>';
  riquadro.appendChild(intestazione);

  messaggi.forEach(function (messaggio) {
    const paragrafo = document.createElement('p');
    paragrafo.textContent = '• ' + messaggio;
    riquadro.appendChild(paragrafo);
  });
}


/* ---------------------------------------------------------------
   10. Avvio: leggiamo mappa.txt e partiamo
   --------------------------------------------------------------- */
fetch('mappa.txt', { cache: 'no-store' })
  .then(function (risposta) {
    if (!risposta.ok) throw new Error('mappa.txt non trovato (errore ' + risposta.status + ')');
    return risposta.text();
  })
  .then(function (testo) {
    const risultato = analizzaMappa(testo);
    nodi = risultato.nodi;

    if (nodi.length === 0) {
      mostraAvvisi(['Il file mappa.txt non contiene nessuna riga di mappa: ' +
                    'ci sono solo commenti o righe vuote.']);
      return;
    }

    legami = [];
    nodi.forEach(function (nodo) {
      if (nodo.padre) legami.push({ da: nodo.padre, a: nodo });
    });

    document.getElementById('titolo').textContent = nodi[0].testo;
    document.title = nodi[0].testo + ' — mappa';

    mostraAvvisi(risultato.avvisi);
    ridimensiona();
    disponiAllInizio();

    // La mappa parte gia' al centro dello schermo: niente scivolata iniziale.
    spostaX = spostaXObiettivo = larghezzaVista / 2;
    spostaY = spostaYObiettivo = altezzaVista / 2;
    riavviaMovimento();
  })
  .catch(function (errore) {
    mostraAvvisi([
      'Non riesco a leggere mappa.txt: ' + errore.message + '.',
      'Se hai aperto il file index.html con un doppio clic, il browser per ' +
      'sicurezza non lo lascia leggere: la pagina va aperta tramite un ' +
      'indirizzo che inizia con http (il server locale, oppure GitHub Pages).'
    ]);
  });
