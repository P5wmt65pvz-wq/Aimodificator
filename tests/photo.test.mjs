/* Tests de Photo propre : parseur EXIF et nettoyage sans perte.
   Les JPEG sont fabriqués octet par octet ici, sans fichier externe. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const P = require('../outils/photo/photo.js');

/* ------------------------------------------------- fabrique de JPEG de test */

/* Construit un bloc TIFF petit-boutiste avec IFD0 et, si demandé, un IFD GPS. */
function buildTiff({ make, model, gps }) {
  const data = [];            // zone de données, après les IFD
  const pool = [];            // octets de la zone de données

  const addData = (bytes) => {
    const off = pool.length;
    pool.push(...bytes);
    while (pool.length % 2) pool.push(0);   // alignement pair
    return off;
  };
  const ascii = (s) => [...s].map((c) => c.charCodeAt(0)).concat([0]);
  const rational = (num, den) => {
    const b = [];
    for (const v of [num, den]) b.push(v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >> 24) & 255);
    return b;
  };

  const ifd0 = [];
  const makeOff = make ? addData(ascii(make)) : null;
  const modelOff = model ? addData(ascii(model)) : null;

  let gpsEntries = null, gpsLatOff = null, gpsLonOff = null;
  if (gps) {
    gpsLatOff = addData([...rational(gps.lat[0], 1), ...rational(gps.lat[1], 1), ...rational(gps.lat[2] * 100, 100)]);
    gpsLonOff = addData([...rational(gps.lon[0], 1), ...rational(gps.lon[1], 1), ...rational(gps.lon[2] * 100, 100)]);
  }

  /* Taille des IFD, pour savoir où commence la zone de données. */
  const n0 = (make ? 1 : 0) + (model ? 1 : 0) + (gps ? 1 : 0);
  const ifd0Size = 2 + n0 * 12 + 4;
  const gpsCount = gps ? 4 : 0;
  const gpsSize = gps ? 2 + gpsCount * 12 + 4 : 0;
  const ifd0At = 8;
  const gpsAt = ifd0At + ifd0Size;
  const dataAt = gpsAt + gpsSize;

  const entry = (tag, type, count, valueOrOffset, inline) => {
    const b = [tag & 255, tag >> 8, type & 255, type >> 8,
               count & 255, (count >> 8) & 255, (count >> 16) & 255, (count >> 24) & 255];
    const v = inline ? valueOrOffset : dataAt + valueOrOffset;
    b.push(v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >> 24) & 255);
    return b;
  };

  const e0 = [];
  if (make) e0.push(entry(0x010f, 2, make.length + 1, makeOff, false));
  if (model) e0.push(entry(0x0110, 2, model.length + 1, modelOff, false));
  if (gps) e0.push(entry(0x8825, 4, 1, gpsAt, true));

  const tiff = [0x49, 0x49, 42, 0, 8, 0, 0, 0];           // "II", 42, offset IFD0 = 8
  tiff.push(n0 & 255, n0 >> 8);
  for (const e of e0) tiff.push(...e);
  tiff.push(0, 0, 0, 0);                                   // pas d'IFD suivant

  if (gps) {
    tiff.push(gpsCount & 255, gpsCount >> 8);
    tiff.push(...entry(1, 2, 2, (gps.latRef.charCodeAt(0)), true));   // GPSLatitudeRef inline
    tiff.push(...entry(2, 5, 3, gpsLatOff, false));
    tiff.push(...entry(3, 2, 2, (gps.lonRef.charCodeAt(0)), true));
    tiff.push(...entry(4, 5, 3, gpsLonOff, false));
    tiff.push(0, 0, 0, 0);
  }

  tiff.push(...pool);
  return tiff;
}

function buildJpeg(opts = {}) {
  const bytes = [0xff, 0xd8];                              // SOI
  if (opts.exif !== false) {
    const tiff = buildTiff(opts);
    const payload = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];   // "Exif\0\0" + TIFF
    const len = payload.length + 2;
    bytes.push(0xff, 0xe1, len >> 8, len & 255, ...payload);
  }
  if (opts.comment) {
    const c = [...opts.comment].map((ch) => ch.charCodeAt(0));
    const len = c.length + 2;
    bytes.push(0xff, 0xfe, len >> 8, len & 255, ...c);
  }
  bytes.push(0xff, 0xdb, 0, 4, 0, 0);                      // table de quantification bidon
  bytes.push(0xff, 0xda, 0, 3, 0);                         // SOS
  bytes.push(1, 2, 3, 4, 5);                               // « données d'image »
  bytes.push(0xff, 0xd9);                                  // EOI
  return new Uint8Array(bytes);
}

/* ----------------------------------------------------------------- tests */

test('un fichier qui n\'est pas un JPEG est signalé sans planter', () => {
  for (const bad of [new Uint8Array([]), new Uint8Array([1, 2, 3]),
                     new Uint8Array([0x89, 0x50, 0x4e, 0x47])]) {
    const r = P.analyse(bad);
    assert.equal(r.jpeg, false);
    assert.deepEqual(r.findings, []);
    assert.equal(P.segments(bad), null);
  }
});

test('les segments d\'un JPEG sont correctement délimités', () => {
  const segs = P.segments(buildJpeg({ make: 'Canon' }));
  /* L'analyse s'arrête au marqueur SOS : ce qui suit sont les données d'image,
     qui ne sont pas découpées en segments. On attend donc APP1, DQT et SOS. */
  assert.equal(segs.length, 3);
  assert.deepEqual(segs.map((s) => s.marker), [0xe1, 0xdb, 0xda]);
  for (const s of segs) {
    assert.ok(s.end > s.start, 'segment vide');
    assert.ok(s.dataStart <= s.dataEnd, 'zone de données incohérente');
  }
});

test('la marque et le modèle de l\'appareil sont extraits', () => {
  const r = P.analyse(buildJpeg({ make: 'Canon', model: 'EOS 5D' }));
  assert.equal(r.jpeg, true);
  const appareil = r.findings.find((f) => f.title.includes('Appareil'));
  assert.ok(appareil, 'appareil non détecté');
  assert.match(appareil.value, /Canon/);
  assert.match(appareil.value, /EOS 5D/);
});

test('la position GPS est décodée en degrés décimaux signés', () => {
  const r = P.analyse(buildJpeg({
    make: 'Nikon',
    gps: { lat: [48, 51, 30], latRef: 'N', lon: [2, 17, 40], lonRef: 'E' }
  }));
  assert.ok(r.gps, 'GPS non décodé');
  assert.ok(Math.abs(r.gps.lat - 48.858333) < 0.001, `latitude ${r.gps.lat}`);
  assert.ok(Math.abs(r.gps.lon - 2.294444) < 0.001, `longitude ${r.gps.lon}`);
  assert.equal(r.findings[0].level, 'critical', 'le GPS doit passer en tête');
});

test('les références Sud et Ouest donnent des coordonnées négatives', () => {
  const r = P.analyse(buildJpeg({
    gps: { lat: [33, 51, 30], latRef: 'S', lon: [151, 12, 40], lonRef: 'W' }
  }));
  assert.ok(r.gps.lat < 0, 'latitude Sud doit être négative');
  assert.ok(r.gps.lon < 0, 'longitude Ouest doit être négative');
});

test('une photo sans métadonnées ne déclenche aucune alerte', () => {
  const r = P.analyse(buildJpeg({ exif: false }));
  assert.equal(r.jpeg, true);
  assert.equal(r.gps, null);
  assert.deepEqual(r.findings, []);
  assert.equal(r.bytesMeta, 0);
});

test('le nettoyage retire les métadonnées sans toucher aux données d\'image', () => {
  const src = buildJpeg({ make: 'Canon', model: 'EOS 5D', comment: 'pris a la maison',
                          gps: { lat: [48, 51, 30], latRef: 'N', lon: [2, 17, 40], lonRef: 'E' } });
  const out = P.strip(src);
  assert.equal(out.changed, true);
  assert.ok(out.removed > 0);
  assert.ok(out.bytes.length < src.length);

  /* plus aucune métadonnée lisible */
  const apres = P.analyse(out.bytes);
  assert.equal(apres.jpeg, true, 'le fichier doit rester un JPEG valide');
  assert.equal(apres.gps, null, 'le GPS doit avoir disparu');
  assert.deepEqual(apres.findings, []);

  /* les données d'image sont intactes : SOS et tout ce qui suit */
  const sos = P.segments(out.bytes).find((s) => s.marker === 0xda);
  assert.ok(sos, 'SOS perdu au nettoyage');
  /* la queue du fichier — SOS, données d'image, EOI — doit être bit à bit identique */
  const queue = (b) => [...b.slice(b.length - 12)];
  assert.deepEqual(queue(out.bytes), queue(src), 'les données d\'image ont été altérées');
});

test('nettoyer un fichier déjà propre ne le modifie pas', () => {
  const src = buildJpeg({ exif: false });
  const out = P.strip(src);
  assert.equal(out.changed, false);
  assert.equal(out.removed, 0);
  assert.deepEqual([...out.bytes], [...src]);
});

test('nettoyer deux fois de suite est stable', () => {
  const src = buildJpeg({ make: 'Canon', comment: 'test' });
  const une = P.strip(src);
  const deux = P.strip(une.bytes);
  assert.equal(deux.changed, false, 'le second passage ne doit rien trouver');
  assert.deepEqual([...deux.bytes], [...une.bytes]);
});

test('un EXIF tronqué ou incohérent ne fait pas planter l\'analyse', () => {
  const src = buildJpeg({ make: 'Canon', gps: { lat: [48, 51, 30], latRef: 'N', lon: [2, 17, 40], lonRef: 'E' } });
  for (let coupe = 4; coupe < src.length; coupe += 3) {
    const tronque = src.slice(0, coupe);
    assert.doesNotThrow(() => P.analyse(tronque), `plantage à ${coupe} octets`);
  }
  const bruit = new Uint8Array(src);
  for (let i = 10; i < Math.min(60, bruit.length); i++) bruit[i] = 0xff;
  assert.doesNotThrow(() => P.analyse(bruit), 'plantage sur EXIF corrompu');
});

test('les tailles sont formatées lisiblement en français', () => {
  assert.equal(P.humanSize(512), '512 o');
  assert.match(P.humanSize(2048), /^2,0 Ko$/);
  assert.match(P.humanSize(5 * 1048576), /^5,00 Mo$/);
});

test('un commentaire libre est signalé, pas seulement retiré', () => {
  const r = P.analyse(buildJpeg({ make: 'Canon', comment: 'pris dans le jardin' }));
  assert.deepEqual(r.comments, ['pris dans le jardin']);
  const f = r.findings.find((x) => x.title.includes('Commentaire'));
  assert.ok(f, 'commentaire non signalé');
  assert.match(f.value, /jardin/);
  /* et il disparaît bien au nettoyage */
  assert.deepEqual(P.analyse(P.strip(buildJpeg({ comment: 'secret' })).bytes).comments, []);
});

test('un commentaire vide ou fait d\'octets de contrôle n\'est pas signalé', () => {
  assert.deepEqual(P.analyse(buildJpeg({ comment: '   ' })).comments, []);
  assert.deepEqual(P.analyse(buildJpeg({ comment: '\u0000\u0001\u0002' })).comments, []);
});
