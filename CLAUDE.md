# Regole del progetto "mappa-galassia"

Queste regole valgono sempre, in ogni sessione di lavoro su questa cartella.

## Il sito

- È un **sito statico**: solo HTML, CSS e JavaScript scritti a mano.
- **Nessuna libreria esterna** (niente React, jQuery, Bootstrap, CDN...).
- **Nessun passaggio di build**: i file che stanno nella cartella sono
  esattamente quelli che vengono pubblicati.
- `index.html` sta nella **cartella principale**.
- Si usano **solo percorsi relativi** (per esempio `css/stile.css`,
  mai `/css/stile.css`), così il sito funziona su GitHub Pages.

## I contenuti

- I testi e i dati stanno in **file di testo semplici**, separati dal codice.
- Devono essere modificabili da una persona che non sa programmare:
  formato chiaro, commenti di spiegazione, niente sintassi complicata.
- Quando si aggiunge un contenuto nuovo, si spiega a voce dove si modifica.

## Il lavoro con git

- **Commit piccoli e frequenti**, uno per ogni cambiamento sensato.
- **Messaggi di commit in italiano**, che spiegano *cosa è cambiato*
  (esempio: "Aggiunto il titolo e i colori di sfondo").
- Si usa **sempre `git` da riga di comando**, **mai `gh`**
  (la GitHub CLI non è installata).
- **Prima di ogni `git push` si chiede conferma** all'utente.

## Come comunicare

- Spiegare ogni cosa **con parole semplici**: l'utente non è programmatore.
- Niente gergo tecnico senza spiegazione.

## Privacy

- Il repository è **pubblico**.
- **Mai dati personali reali di studenti** (nomi, cognomi, foto, classi
  riconoscibili, email). Si usano nomi di fantasia.
