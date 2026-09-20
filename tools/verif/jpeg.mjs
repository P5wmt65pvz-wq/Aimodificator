/* Fabrique de vrais JPEG avec des métadonnées EXIF réelles, pour éprouver
   l'outil Photo sur autre chose que des octets au hasard. La structure suit
   la spécification : SOI, APP1 « Exif\0\0 », en-tête TIFF, IFD0, IFD GPS. */

function u16(v, le) { const b = Buffer.alloc(2); le ? b.writeUInt16LE(v) : b.writeUInt16BE(v); return b; }
function u32(v, le) { const b = Buffer.alloc(4); le ? b.writeUInt32LE(v) : b.writeUInt32BE(v); return b; }

/* Une entrée d'IFD fait douze octets : tag, type, nombre, puis la valeur
   elle-même si elle tient sur quatre octets, sinon un décalage vers elle. */
function entree(tag, type, nb, valeurOuOffset, le) {
  return Buffer.concat([u16(tag, le), u16(type, le), u32(nb, le),
    Buffer.isBuffer(valeurOuOffset) ? valeurOuOffset : u32(valeurOuOffset, le)]);
}
const ASCII = 2, LONG = 4, RATIONNEL = 5;

function rationnel(num, den, le) { return Buffer.concat([u32(num, le), u32(den, le)]); }

export function construitExif({ le = true, marque = 'Canon', modele = 'EOS 80D',
  date = '2024:07:14 15:32:01', logiciel = 'Adobe Photoshop 25.0',
  gps = { lat: [48, 51, 30], latRef: 'N', lon: [2, 17, 40], lonRef: 'E' } } = {}) {

  /* Les valeurs trop longues pour quatre octets vivent après les IFD ; on
     les accumule ici et on note leur décalage. */
  const zone = [];
  let curseur = 0;
  const HEAD = 8;                       /* en-tête TIFF */

  const champs = [];
  if (marque)   champs.push(['make', 0x010F, marque + '\0']);
  if (modele)   champs.push(['model', 0x0110, modele + '\0']);
  if (logiciel) champs.push(['software', 0x0131, logiciel + '\0']);
  if (date)     champs.push(['datetime', 0x0132, date + '\0']);

  const nbEntrees = champs.length + (gps ? 1 : 0);
  /* IFD0 : 2 octets de compte + 12 par entrée + 4 pour « IFD suivant ». */
  const tailleIfd0 = 2 + 12 * nbEntrees + 4;
  let offsetDonnees = HEAD + tailleIfd0;

  const entrees = [];
  for (const [, tag, texte] of champs) {
    const b = Buffer.from(texte, 'latin1');
    if (b.length <= 4) {
      const pad = Buffer.alloc(4); b.copy(pad);
      entrees.push(entree(tag, ASCII, b.length, pad, le));
    } else {
      entrees.push(entree(tag, ASCII, b.length, offsetDonnees + curseur, le));
      zone.push(b); curseur += b.length + (b.length % 2);
      if (b.length % 2) zone.push(Buffer.alloc(1));
    }
  }

  let gpsIfd = Buffer.alloc(0);
  if (gps) {
    const offsetGpsIfd = offsetDonnees + curseur;
    /* IFD GPS : 4 entrées + compte + terminateur. */
    const tailleGpsIfd = 2 + 12 * 4 + 4;
    let curGps = 0;
    const zoneGps = [];
    const offGpsDonnees = offsetGpsIfd + tailleGpsIfd;

    const latRef = Buffer.alloc(4); latRef.write(gps.latRef, 'latin1');
    const lonRef = Buffer.alloc(4); lonRef.write(gps.lonRef, 'latin1');

    const latBuf = Buffer.concat(gps.lat.map(v => rationnel(Math.round(v * 100), 100, le)));
    const lonBuf = Buffer.concat(gps.lon.map(v => rationnel(Math.round(v * 100), 100, le)));

    const gpsEntrees = [
      entree(0x0001, ASCII, 2, latRef, le),
      entree(0x0002, RATIONNEL, 3, offGpsDonnees + 0, le),
      entree(0x0003, ASCII, 2, lonRef, le),
      entree(0x0004, RATIONNEL, 3, offGpsDonnees + latBuf.length, le)
    ];
    zoneGps.push(latBuf, lonBuf); curGps = latBuf.length + lonBuf.length;

    gpsIfd = Buffer.concat([u16(4, le), ...gpsEntrees, u32(0, le), ...zoneGps]);
    entrees.push(entree(0x8825, LONG, 1, offsetGpsIfd, le));
    curseur += gpsIfd.length;
  }

  const tiff = Buffer.concat([
    Buffer.from(le ? 'II' : 'MM', 'latin1'), u16(0x002A, le), u32(HEAD, le),
    u16(nbEntrees, le), ...entrees, u32(0, le),
    ...zone, gpsIfd
  ]);

  const charge = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
  const app1 = Buffer.concat([Buffer.from([0xFF, 0xE1]), u16(charge.length + 2, false), charge]);
  return app1;
}

/* Un JPEG minimal mais structurellement correct : en-tête, quantification,
   trame, Huffman, début de balayage, données, fin. */
export function construitJpeg({ exif = true, commentaire = null, extra = [] } = {}) {
  const SOI = Buffer.from([0xFF, 0xD8]);
  const DQT = Buffer.concat([Buffer.from([0xFF, 0xDB]), u16(67, false), Buffer.from([0x00]), Buffer.alloc(64, 0x10)]);
  const SOF0 = Buffer.concat([Buffer.from([0xFF, 0xC0]), u16(11, false),
    Buffer.from([0x08]), u16(8, false), u16(8, false), Buffer.from([0x01, 0x01, 0x11, 0x00])]);
  const DHT = Buffer.concat([Buffer.from([0xFF, 0xC4]), u16(2 + 1 + 16 + 1, false),
    Buffer.from([0x00]), Buffer.alloc(16, 0), Buffer.from([0x00])]);
  const SOS = Buffer.concat([Buffer.from([0xFF, 0xDA]), u16(8, false),
    Buffer.from([0x01, 0x01, 0x00, 0x00, 0x3F, 0x00])]);
  const DONNEES = Buffer.alloc(200, 0x55);
  const EOI = Buffer.from([0xFF, 0xD9]);

  const morceaux = [SOI];
  if (exif) morceaux.push(construitExif(typeof exif === 'object' ? exif : {}));
  if (commentaire) {
    const c = Buffer.from(commentaire, 'latin1');
    morceaux.push(Buffer.concat([Buffer.from([0xFF, 0xFE]), u16(c.length + 2, false), c]));
  }
  for (const e of extra) morceaux.push(e);
  morceaux.push(DQT, SOF0, DHT, SOS, DONNEES, EOI);
  return Buffer.concat(morceaux);
}
