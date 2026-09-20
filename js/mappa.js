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
  ancora: 0.055,       // quanto il nodo scelto con un clic e' tirato al centro
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
    larghezza: 100, altezza: 30, raggio: 50,
    fermato: false,           // vero mentre il dito o il mouse lo tiene
    ancorato: false,          // vero per il nodo scelto: sta al centro
    trovato: false,           // vero se corrisponde alla ricerca
    salti: 0,                 // quanti collegamenti lo separano dal nodo scelto
    opacita: 1, opacitaObiettivo: 1
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

function misuraNodi(elenco) {
  elenco.forEach(function (nodo) {
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
let inMovimento = false;      // il ciclo di animazione sta girando
let fisicaAttiva = false;     // i nodi si stanno ancora sistemando
let frameCalmi = 0;

let nodoScelto = null;        // il nodo portato al centro con un clic
let nodoSottoIlMouse = null;  // il nodo che il mouse sta sfiorando
let ricercaAttiva = false;    // c'e' almeno un nodo che pulsa

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
    // Il nodo scelto con un clic viene tirato con decisione al centro della
    // mappa: sono gli altri a riorganizzarsi attorno a lui.
    const richiamo = nodo.ancorato ? FISICA.ancora : FISICA.gravita;
    nodo.vx -= nodo.x * richiamo;
    nodo.vy -= nodo.y * richiamo;

    nodo.vx *= FISICA.attrito;
    nodo.vy *= FISICA.attrito;

    const velocita = Math.sqrt(nodo.vx * nodo.vx + nodo.vy * nodo.vy);
    if (velocita > FISICA.velocitaMax) {
      nodo.vx = (nodo.vx / velocita) * FISICA.velocitaMax;
      nodo.vy = (nodo.vy / velocita) * FISICA.velocitaMax;
    }

    if (nodo.fermato) {            // lo sta tenendo il dito o il mouse
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
   5. Nodo scelto: chi resta in evidenza e chi sbiadisce
      Si contano i "salti" (i collegamenti da percorrere) fra il nodo
      scelto e tutti gli altri: piu' sono lontani, piu' sbiadiscono.
   --------------------------------------------------------------- */
function calcolaLontananze() {
  if (!nodoScelto) {
    nodi.forEach(function (nodo) {
      nodo.salti = 0;
      nodo.opacitaObiettivo = 1;
    });
    return;
  }

  nodi.forEach(function (nodo) { nodo.salti = -1; });

  const coda = [nodoScelto];
  nodoScelto.salti = 0;
  while (coda.length > 0) {
    const nodo = coda.shift();
    const vicini = nodo.figli.slice();
    if (nodo.padre) vicini.push(nodo.padre);
    vicini.forEach(function (vicino) {
      if (vicino.salti === -1) {
        vicino.salti = nodo.salti + 1;
        coda.push(vicino);
      }
    });
  }

  nodi.forEach(function (nodo) {
    if (nodo.salti <= 1) nodo.opacitaObiettivo = 1;
    else if (nodo.salti === 2) nodo.opacitaObiettivo = 0.5;
    else nodo.opacitaObiettivo = 0.18;

    // Un nodo trovato dalla ricerca resta sempre ben visibile.
    if (nodo.trovato) nodo.opacitaObiettivo = 1;
  });
}

function aggiornaTrasparenze() {
  nodi.forEach(function (nodo) {
    nodo.opacita += (nodo.opacitaObiettivo - nodo.opacita) * 0.12;
  });
}

function trasparenzeAssestate() {
  return nodi.every(function (nodo) {
    return Math.abs(nodo.opacitaObiettivo - nodo.opacita) < 0.01;
  });
}

function scegliNodo(nodo) {
  if (nodoScelto) nodoScelto.ancorato = false;
  nodoScelto = nodo;
  if (nodoScelto) nodoScelto.ancorato = true;

  inquadraturaAutomatica = true;   // l'inquadratura torna a seguire la mappa
  calcolaLontananze();
  fisicaAttiva = true;             // i nodi si risistemano attorno al nuovo centro
  riavviaMovimento();
}


/* ---------------------------------------------------------------
   6. Inquadratura: automatica finche' non ci si muove a mano
   --------------------------------------------------------------- */
let scala = 1, scalaObiettivo = 1;
let spostaX = 0, spostaY = 0, spostaXObiettivo = 0, spostaYObiettivo = 0;
let larghezzaVista = 0, altezzaVista = 0;
let inquadraturaAutomatica = true;

const SCALA_MINIMA = 0.25;
const SCALA_MASSIMA = 3;
// Su schermi piccoli la mappa intera non ci sta a una misura leggibile:
// meglio non rimpicciolire oltre e lasciare che ci si sposti col dito.
const SCALA_MINIMA_AUTOMATICA = 0.45;

function aggiornaInquadratura() {
  if (nodi.length === 0) return;

  if (inquadraturaAutomatica) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodi.forEach(function (nodo) {
      minX = Math.min(minX, nodo.x - nodo.larghezza / 2);
      maxX = Math.max(maxX, nodo.x + nodo.larghezza / 2);
      minY = Math.min(minY, nodo.y - nodo.altezza / 2);
      maxY = Math.max(maxY, nodo.y + nodo.altezza / 2);
    });

    const margine = 60;
    const bordoAlto = 90;   // spazio per il titolo e la ricerca in alto
    const larghezzaUtile = Math.max(larghezzaVista - margine * 2, 50);
    const altezzaUtile = Math.max(altezzaVista - margine - bordoAlto, 50);

    scalaObiettivo = Math.max(SCALA_MINIMA_AUTOMATICA,
      Math.min(1, larghezzaUtile / (maxX - minX), altezzaUtile / (maxY - minY)));

    // Senza un nodo scelto si inquadra tutta la mappa; con un nodo scelto
    // si punta dritti su di lui, che finisce in mezzo allo schermo.
    const centroX = nodoScelto ? nodoScelto.x : (minX + maxX) / 2;
    const centroY = nodoScelto ? nodoScelto.y : (minY + maxY) / 2;

    spostaXObiettivo = larghezzaVista / 2 - centroX * scalaObiettivo;
    spostaYObiettivo = bordoAlto + altezzaUtile / 2 - centroY * scalaObiettivo;
  }

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

// Usata da rotella e pizzico: cambia la scala tenendo fermo un punto dello schermo.
function ingrandisciAttorno(puntoX, puntoY, fattore) {
  const nuovaScala = Math.min(SCALA_MASSIMA, Math.max(SCALA_MINIMA, scala * fattore));
  const rapporto = nuovaScala / scala;

  spostaX = puntoX - (puntoX - spostaX) * rapporto;
  spostaY = puntoY - (puntoY - spostaY) * rapporto;
  scala = nuovaScala;

  fermaInquadratura();
}

// Da qui in poi comanda l'utente: l'inquadratura non si aggiusta piu' da sola.
function fermaInquadratura() {
  inquadraturaAutomatica = false;
  scalaObiettivo = scala;
  spostaXObiettivo = spostaX;
  spostaYObiettivo = spostaY;
}


/* ---------------------------------------------------------------
   7. Disegno della mappa
   --------------------------------------------------------------- */
function disegna(tempo) {
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, larghezzaVista, altezzaVista);

  ctx.setTransform(dpr * scala, 0, 0, dpr * scala, dpr * spostaX, dpr * spostaY);

  // --- collegamenti ---
  ctx.lineCap = 'round';
  legami.forEach(function (legame) {
    const acceso = nodoSottoIlMouse &&
                   (legame.da === nodoSottoIlMouse || legame.a === nodoSottoIlMouse);
    const visibilita = Math.min(legame.da.opacita, legame.a.opacita);

    ctx.beginPath();
    ctx.moveTo(legame.da.x, legame.da.y);
    ctx.lineTo(legame.a.x, legame.a.y);
    ctx.strokeStyle = acceso ? '#ffffff' : legame.a.colore;
    ctx.globalAlpha = acceso ? Math.max(visibilita, 0.9)
                             : visibilita * (legame.a.livello === 1 ? 0.75 : 0.45);
    ctx.lineWidth = acceso ? 3.5 : (legame.a.livello === 1 ? 2.5 : 1.6);
    ctx.stroke();
  });
  ctx.globalAlpha = 1;

  // --- nodi ---
  nodi.forEach(function (nodo) {
    ctx.globalAlpha = nodo.opacita;

    // Chi corrisponde alla ricerca pulsa: un alone che cresce e si spegne.
    if (nodo.trovato) {
      const battito = 0.5 + 0.5 * Math.sin(tempo / 260);
      const crescita = 6 + battito * 10;
      rettangoloArrotondato(nodo.x - nodo.larghezza / 2 - crescita,
                            nodo.y - nodo.altezza / 2 - crescita,
                            nodo.larghezza + crescita * 2,
                            nodo.altezza + crescita * 2,
                            nodo.altezza / 2 + crescita);
      ctx.strokeStyle = '#ffd479';
      ctx.globalAlpha = nodo.opacita * (0.75 - battito * 0.5);
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.globalAlpha = nodo.opacita;
    }

    const x = nodo.x - nodo.larghezza / 2;
    const y = nodo.y - nodo.altezza / 2;

    rettangoloArrotondato(x, y, nodo.larghezza, nodo.altezza, nodo.altezza / 2);
    ctx.fillStyle = nodo.colore;
    ctx.fill();

    if (nodo === nodoSottoIlMouse || nodo === nodoScelto) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = nodo === nodoScelto ? 2.5 : 2;
      ctx.stroke();
    } else if (nodo.livello > 1) {
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

  ctx.globalAlpha = 1;
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
   8. Il ciclo: calcola, disegna e si ferma quando non serve piu'
   --------------------------------------------------------------- */
function ciclo(tempo) {
  let velocita = 0;

  if (fisicaAttiva) {
    velocita = passoDiSimulazione();
    if (velocita < FISICA.quiete) frameCalmi++;
    else frameCalmi = 0;
    if (frameCalmi >= FISICA.frameDiQuiete) {
      fisicaAttiva = false;      // equilibrio raggiunto
      frameCalmi = 0;
    }
  }

  aggiornaInquadratura();
  aggiornaTrasparenze();
  disegna(tempo);

  // Si continua solo se c'e' ancora qualcosa da animare.
  if (fisicaAttiva || !inquadraturaAssestata() || !trasparenzeAssestate() || ricercaAttiva) {
    requestAnimationFrame(ciclo);
  } else {
    inMovimento = false;
  }
}

function riavviaMovimento() {
  if (!inMovimento) {
    inMovimento = true;
    requestAnimationFrame(ciclo);
  }
}

// Rimette in moto anche il calcolo delle posizioni (dopo un trascinamento,
// un clic su un nodo o un cambio di finestra).
function riavviaFisica() {
  fisicaAttiva = true;
  frameCalmi = 0;
  riavviaMovimento();
}


/* ---------------------------------------------------------------
   9. Finestra, mouse, rotella e dita
   --------------------------------------------------------------- */
function ridimensiona() {
  const dpr = window.devicePixelRatio || 1;
  larghezzaVista = window.innerWidth;
  altezzaVista = window.innerHeight;
  tela.width = Math.round(larghezzaVista * dpr);
  tela.height = Math.round(altezzaVista * dpr);
  misuraNodi(nodi);
  riavviaFisica();
}

function puntoNelMondo(schermoX, schermoY) {
  return { x: (schermoX - spostaX) / scala, y: (schermoY - spostaY) / scala };
}

function nodoNelPunto(schermoX, schermoY) {
  const punto = puntoNelMondo(schermoX, schermoY);
  for (let i = nodi.length - 1; i >= 0; i--) {
    const nodo = nodi[i];
    if (Math.abs(punto.x - nodo.x) <= nodo.larghezza / 2 &&
        Math.abs(punto.y - nodo.y) <= nodo.altezza / 2) {
      return nodo;
    }
  }
  return null;
}

const puntatori = new Map();      // i tocchi/mouse premuti in questo momento
let nodoTrascinato = null;
let spostamentoSfondo = false;    // stiamo trascinando lo sfondo
let ultimoX = 0, ultimoY = 0;
let distanzaPizzico = 0;
let quantoSiEMosso = 0;           // per capire se e' stato un clic o un trascinamento

tela.addEventListener('pointerdown', function (evento) {
  tela.setPointerCapture(evento.pointerId);
  puntatori.set(evento.pointerId, { x: evento.clientX, y: evento.clientY });

  if (puntatori.size === 2) {
    // Due dita: si smette di trascinare e si comincia il pizzico.
    if (nodoTrascinato) { nodoTrascinato.fermato = false; nodoTrascinato = null; }
    spostamentoSfondo = false;
    distanzaPizzico = distanzaFraPuntatori();
    return;
  }

  quantoSiEMosso = 0;
  ultimoX = evento.clientX;
  ultimoY = evento.clientY;

  const nodo = nodoNelPunto(evento.clientX, evento.clientY);
  nodoSottoIlMouse = nodo;     // l'evidenziazione segue subito il nodo premuto
  if (nodo) {
    nodoTrascinato = nodo;
    nodo.fermato = true;
    riavviaFisica();
  } else {
    spostamentoSfondo = true;
  }
  tela.classList.add('trascino');
});

tela.addEventListener('pointermove', function (evento) {
  if (puntatori.has(evento.pointerId)) {
    puntatori.set(evento.pointerId, { x: evento.clientX, y: evento.clientY });
  }

  // --- due dita: pizzico per ingrandire, e la mappa segue le dita ---
  if (puntatori.size === 2) {
    const nuova = distanzaFraPuntatori();
    const centro = centroFraPuntatori();
    if (distanzaPizzico > 0 && nuova > 0) {
      ingrandisciAttorno(centro.x, centro.y, nuova / distanzaPizzico);
    }
    distanzaPizzico = nuova;
    riavviaMovimento();
    return;
  }

  // --- un nodo trascinato segue il dito o il mouse ---
  if (nodoTrascinato) {
    const punto = puntoNelMondo(evento.clientX, evento.clientY);
    quantoSiEMosso += Math.abs(evento.clientX - ultimoX) + Math.abs(evento.clientY - ultimoY);
    ultimoX = evento.clientX;
    ultimoY = evento.clientY;
    nodoTrascinato.x = punto.x;
    nodoTrascinato.y = punto.y;
    fermaInquadratura();
    riavviaFisica();
    return;
  }

  // --- lo sfondo trascinato sposta tutta la mappa ---
  if (spostamentoSfondo) {
    spostaX += evento.clientX - ultimoX;
    spostaY += evento.clientY - ultimoY;
    quantoSiEMosso += Math.abs(evento.clientX - ultimoX) + Math.abs(evento.clientY - ultimoY);
    ultimoX = evento.clientX;
    ultimoY = evento.clientY;
    fermaInquadratura();
    riavviaMovimento();
    return;
  }

  // --- semplice passaggio del mouse: si accendono i collegamenti ---
  const sopra = nodoNelPunto(evento.clientX, evento.clientY);
  if (sopra !== nodoSottoIlMouse) {
    nodoSottoIlMouse = sopra;
    tela.classList.toggle('sopra-nodo', sopra !== null);
    riavviaMovimento();
  }
});

function terminaTocco(evento) {
  puntatori.delete(evento.pointerId);

  if (puntatori.size < 2) distanzaPizzico = 0;

  if (nodoTrascinato) {
    // Poco movimento: era un clic, quindi portiamo il nodo al centro.
    if (quantoSiEMosso < 6) {
      const nodo = nodoTrascinato;
      nodoTrascinato.fermato = false;
      nodoTrascinato = null;
      scegliNodo(nodo === nodoScelto ? null : nodo);   // un altro clic lo libera
    } else {
      nodoTrascinato.fermato = false;
      nodoTrascinato = null;
      riavviaFisica();
    }
  } else if (spostamentoSfondo && quantoSiEMosso < 6 && nodoScelto) {
    scegliNodo(null);          // clic sullo sfondo: si torna alla mappa intera
  }

  spostamentoSfondo = false;
  tela.classList.remove('trascino');
}

tela.addEventListener('pointerup', terminaTocco);
tela.addEventListener('pointercancel', terminaTocco);

function distanzaFraPuntatori() {
  const punti = Array.from(puntatori.values());
  if (punti.length < 2) return 0;
  const dx = punti[1].x - punti[0].x;
  const dy = punti[1].y - punti[0].y;
  return Math.sqrt(dx * dx + dy * dy);
}

function centroFraPuntatori() {
  const punti = Array.from(puntatori.values());
  return { x: (punti[0].x + punti[1].x) / 2, y: (punti[0].y + punti[1].y) / 2 };
}

// Rotella del mouse: ingrandisce e rimpicciolisce attorno al puntatore.
tela.addEventListener('wheel', function (evento) {
  evento.preventDefault();
  ingrandisciAttorno(evento.clientX, evento.clientY, Math.exp(-evento.deltaY * 0.0015));
  riavviaMovimento();
}, { passive: false });

window.addEventListener('resize', ridimensiona);

// Con il tasto Esc si toglie la scelta e si svuota la ricerca.
window.addEventListener('keydown', function (evento) {
  if (evento.key !== 'Escape') return;
  const casella = document.getElementById('cerca');
  if (casella.value !== '') {
    casella.value = '';
    aggiornaRicerca('');
  } else if (nodoScelto) {
    scegliNodo(null);
  }
});


/* ---------------------------------------------------------------
   10. Ricerca: i nodi che contengono la parola cercata pulsano
   --------------------------------------------------------------- */
function semplifica(testo) {
  // minuscole e senza accenti, cosi' "Perche'" trova anche "perche"
  return testo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function aggiornaRicerca(parola) {
  const cercata = semplifica(parola.trim());
  const esito = document.getElementById('esito');
  let quanti = 0;

  nodi.forEach(function (nodo) {
    nodo.trovato = cercata !== '' && semplifica(nodo.testo).indexOf(cercata) !== -1;
    if (nodo.trovato) quanti++;
  });

  ricercaAttiva = quanti > 0;

  if (cercata === '') {
    esito.textContent = '';
    esito.classList.remove('vuoto');
  } else if (quanti === 0) {
    esito.textContent = 'nessun nodo trovato';
    esito.classList.add('vuoto');
  } else {
    esito.textContent = quanti === 1 ? '1 nodo trovato' : quanti + ' nodi trovati';
    esito.classList.remove('vuoto');
  }

  calcolaLontananze();     // i nodi trovati restano visibili anche se lontani
  riavviaMovimento();
}

document.getElementById('cerca').addEventListener('input', function (evento) {
  aggiornaRicerca(evento.target.value);
});


/* ---------------------------------------------------------------
   11. Avvisi a schermo
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
   12. Avvio: leggiamo mappa.txt e partiamo
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

    riavviaFisica();
  })
  .catch(function (errore) {
    mostraAvvisi([
      'Non riesco a leggere mappa.txt: ' + errore.message + '.',
      'Se hai aperto il file index.html con un doppio clic, il browser per ' +
      'sicurezza non lo lascia leggere: la pagina va aperta tramite un ' +
      'indirizzo che inizia con http (il server locale, oppure GitHub Pages).'
    ]);
  });
