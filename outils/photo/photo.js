/*!
 * Photo nue — lit les métadonnées cachées d'une photo, puis les retire.
 *
 * Tout se passe dans le navigateur : la photo n'est jamais envoyée nulle part.
 * Le nettoyage est SANS PERTE — on retire les segments de métadonnées du
 * fichier JPEG au lieu de ré-encoder l'image, donc la qualité est intacte.
 *
 * L'analyse est en fonctions pures (Uint8Array -> objet), testables sous Node.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PhotoNue = api;
  if (typeof document !== 'undefined') api.boot();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ------------------------------------------------------- lecture binaire */

  function Reader(bytes, littleEndian) {
    this.b = bytes;
    this.le = !!littleEndian;
  }
  Reader.prototype.u8 = function (o) { return this.b[o]; };
  Reader.prototype.u16 = function (o) {
    return this.le ? (this.b[o] | (this.b[o + 1] << 8))
                   : ((this.b[o] << 8) | this.b[o + 1]);
  };
  Reader.prototype.u32 = function (o) {
    var v = this.le
      ? (this.b[o] | (this.b[o + 1] << 8) | (this.b[o + 2] << 16) | (this.b[o + 3] << 24))
      : ((this.b[o] << 24) | (this.b[o + 1] << 16) | (this.b[o + 2] << 8) | this.b[o + 3]);
    return v >>> 0;
  };
  Reader.prototype.i32 = function (o) {
    var v = this.u32(o);
    return v > 0x7fffffff ? v - 0x100000000 : v;
  };
  Reader.prototype.ascii = function (o, len) {
    var s = '';
    for (var i = 0; i < len; i++) {
      var c = this.b[o + i];
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s.trim();
  };

  /* ----------------------------------------------------- segments JPEG */

  var SOI = 0xd8, EOI = 0xd9, SOS = 0xda;

  /* Découpe un JPEG en segments. Renvoie null si ce n'est pas un JPEG. */
  function segments(bytes) {
    if (!bytes || bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== SOI) return null;
    var out = [];
    var i = 2;
    while (i < bytes.length - 1) {
      if (bytes[i] !== 0xff) { i++; continue; }
      var marker = bytes[i + 1];
      if (marker === 0xff) { i++; continue; }              /* octets de bourrage */
      if (marker === SOI || marker === EOI || (marker >= 0xd0 && marker <= 0xd7)) {
        out.push({ marker: marker, start: i, end: i + 2, dataStart: i + 2, dataEnd: i + 2 });
        i += 2;
        continue;
      }
      if (i + 3 >= bytes.length) break;
      var len = (bytes[i + 2] << 8) | bytes[i + 3];
      if (len < 2) break;
      var end = i + 2 + len;
      if (end > bytes.length) break;
      out.push({ marker: marker, start: i, end: end, dataStart: i + 4, dataEnd: end });
      if (marker === SOS) break;                            /* données d'image ensuite */
      i = end;
    }
    return out;
  }

  function isExifSegment(bytes, seg) {
    return seg.marker === 0xe1 &&
      seg.dataStart + 6 <= bytes.length &&
      bytes[seg.dataStart] === 0x45 && bytes[seg.dataStart + 1] === 0x78 &&
      bytes[seg.dataStart + 2] === 0x69 && bytes[seg.dataStart + 3] === 0x66 &&
      bytes[seg.dataStart + 4] === 0x00;
  }

  function isXmpSegment(bytes, seg) {
    if (seg.marker !== 0xe1) return false;
    var s = '';
    for (var i = seg.dataStart; i < Math.min(seg.dataStart + 28, bytes.length); i++) {
      s += String.fromCharCode(bytes[i]);
    }
    return s.indexOf('http://ns.adobe.com/xap') === 0;
  }

  /* Segments porteurs de métadonnées, à retirer au nettoyage. */
  function isMetadata(bytes, seg) {
    if (isExifSegment(bytes, seg) || isXmpSegment(bytes, seg)) return true;
    if (seg.marker === 0xed) return true;   /* APP13 — IPTC / Photoshop */
    if (seg.marker === 0xee) return true;   /* APP14 — Adobe */
    if (seg.marker === 0xfe) return true;   /* COM — commentaire libre */
    return false;
  }

  /* ------------------------------------------------------------ TIFF/EXIF */

  var TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };

  function readValue(r, base, entryOff) {
    var type = r.u16(entryOff + 2);
    var count = r.u32(entryOff + 4);
    var size = TYPE_SIZE[type];
    if (!size) return null;
    var total = size * count;
    if (total > 0x7fffffff) return null;
    var off = total <= 4 ? entryOff + 8 : base + r.u32(entryOff + 8);
    if (off < 0 || off + total > r.b.length) return null;

    if (type === 2) return r.ascii(off, count);
    var vals = [];
    for (var i = 0; i < count && i < 64; i++) {
      var o = off + i * size;
      if (type === 1 || type === 6 || type === 7) vals.push(r.u8(o));
      else if (type === 3) vals.push(r.u16(o));
      else if (type === 4) vals.push(r.u32(o));
      else if (type === 9) vals.push(r.i32(o));
      else if (type === 5) { var d = r.u32(o + 4); vals.push(d ? r.u32(o) / d : 0); }
      else if (type === 10) { var d2 = r.i32(o + 4); vals.push(d2 ? r.i32(o) / d2 : 0); }
    }
    return count === 1 ? vals[0] : vals;
  }

  function readIfd(r, base, offset, into) {
    if (offset < 0 || base + offset + 2 > r.b.length) return null;
    var p = base + offset;
    var n = r.u16(p);
    if (n > 512) return null;                       /* fichier incohérent */
    p += 2;
    for (var i = 0; i < n; i++, p += 12) {
      if (p + 12 > r.b.length) break;
      into[r.u16(p)] = readValue(r, base, p);
    }
    return p + 4 <= r.b.length ? r.u32(p) : 0;
  }

  function dms(v, ref) {
    if (!Array.isArray(v) || v.length < 3) return null;
    var d = v[0] + v[1] / 60 + v[2] / 3600;
    if (ref === 'S' || ref === 'W') d = -d;
    return Math.round(d * 1000000) / 1000000;
  }

  /* Analyse complète. Renvoie toujours un objet, même sans métadonnées. */
  function analyse(bytes) {
    var segs = segments(bytes);
    if (!segs) return { jpeg: false, tags: {}, findings: [], gps: null, bytesMeta: 0 };

    var exifSeg = null;
    var bytesMeta = 0;
    var comments = [];
    var xmp = false;
    segs.forEach(function (s) {
      if (isMetadata(bytes, s)) bytesMeta += (s.end - s.start);
      if (!exifSeg && isExifSegment(bytes, s)) exifSeg = s;
      if (isXmpSegment(bytes, s)) xmp = true;
      if (s.marker === 0xfe) {                       /* COM — commentaire libre */
        var txt = '';
        for (var i = s.dataStart; i < s.dataEnd; i++) {
          var c = bytes[i];
          if (c >= 32 || c === 10) txt += String.fromCharCode(c);
        }
        txt = txt.trim();
        if (txt) comments.push(txt);
      }
    });

    var tags = {}, gps = null;
    if (exifSeg) {
      var base = exifSeg.dataStart + 6;                  /* après "Exif\0\0" */
      if (base + 8 <= bytes.length) {
        var order = (bytes[base] << 8) | bytes[base + 1];
        var le = order === 0x4949;                       /* "II" */
        if (le || order === 0x4d4d) {
          var r = new Reader(bytes, le);
          if (r.u16(base + 2) === 42) {
            var ifd0 = {};
            var next = readIfd(r, base, r.u32(base + 4), ifd0);
            Object.keys(ifd0).forEach(function (k) { tags['ifd0:' + k] = ifd0[k]; });

            if (ifd0[0x8769] !== undefined) {
              var exif = {};
              readIfd(r, base, ifd0[0x8769], exif);
              Object.keys(exif).forEach(function (k) { tags['exif:' + k] = exif[k]; });
            }
            if (ifd0[0x8825] !== undefined) {
              var g = {};
              readIfd(r, base, ifd0[0x8825], g);
              Object.keys(g).forEach(function (k) { tags['gps:' + k] = g[k]; });
              var lat = dms(g[2], g[1]), lon = dms(g[4], g[3]);
              if (lat !== null && lon !== null) {
                gps = { lat: lat, lon: lon, alt: typeof g[6] === 'number' ? g[6] : null };
              }
            }
            if (next) { var ifd1 = {}; readIfd(r, base, next, ifd1);
                        if (Object.keys(ifd1).length) tags['thumbnail'] = true; }
          }
        }
      }
    }

    return { jpeg: true, tags: tags, gps: gps, bytesMeta: bytesMeta,
             comments: comments, xmp: xmp,
             findings: describe(tags, gps, { comments: comments, xmp: xmp }) };
  }

  /* -------------------------------------------------------- interprétation */

  function describe(t, gps, extra) {
    var out = [];
    extra = extra || {};
    var push = function (level, title, value, note) {
      out.push({ level: level, title: title, value: value, note: note });
    };

    if (gps) {
      push('critical', 'Position GPS exacte',
        gps.lat + ', ' + gps.lon + (gps.alt !== null ? ' — altitude ' + Math.round(gps.alt) + ' m' : ''),
        'C\'est l\'endroit précis où la photo a été prise, à quelques mètres près. ' +
        'Si c\'est chez vous, votre adresse est dans le fichier. Beaucoup de gens partagent ça sans le savoir.');
    }

    var make = t['ifd0:271'], model = t['ifd0:272'];
    if (make || model) {
      push('mid', 'Appareil utilisé', [make, model].filter(Boolean).join(' '),
        'Le modèle exact de l\'appareil ou du téléphone. Recoupé avec d\'autres photos, ' +
        'cela permet de relier plusieurs publications à la même personne.');
    }

    var serial = t['exif:42033'] || t['exif:42032'];
    if (serial) {
      push('critical', 'Numéro de série ou propriétaire', String(serial),
        'Identifiant unique de votre appareil, ou votre nom enregistré dedans. ' +
        'C\'est le lien le plus direct entre une photo anonyme et vous.');
    }

    var date = t['exif:36867'] || t['ifd0:306'];
    if (date) {
      push('mid', 'Date et heure de prise de vue', String(date),
        'À la seconde près. Révèle vos habitudes et permet de reconstituer un emploi du temps ' +
        'à partir de plusieurs photos.');
    }

    var soft = t['ifd0:305'];
    if (soft) {
      push('low', 'Logiciel de retouche', String(soft),
        'Indique avec quoi la photo a été traitée, et donc souvent le système utilisé.');
    }

    var lens = t['exif:42036'];
    if (lens) push('low', 'Objectif', String(lens), 'Le matériel employé, utile pour recouper du matériel rare.');

    var comment = t['exif:37510'];
    if (comment && String(comment).length > 2) {
      push('mid', 'Commentaire intégré', String(comment).slice(0, 160),
        'Un texte libre stocké dans le fichier, souvent ajouté automatiquement par un logiciel.');
    }

    (extra.comments || []).forEach(function (c) {
      push('mid', 'Commentaire libre dans le fichier', c.slice(0, 200),
        'Un texte écrit en clair dans le fichier, en dehors de l\'image. Il est invisible à l\'affichage ' +
        'mais lisible par n\'importe qui ouvre le fichier avec un éditeur.');
    });

    if (extra.xmp) {
      push('mid', 'Bloc de métadonnées XMP', 'Présent',
        'Un second jeu de métadonnées, ajouté par les logiciels de retouche. Il contient souvent ' +
        'l\'auteur, l\'historique des modifications et parfois les coordonnées, en double de l\'EXIF.');
    }

    if (t['thumbnail']) {
      push('mid', 'Miniature intégrée', 'Présente',
        'Une copie réduite de l\'image d\'origine est stockée à part. Sur certaines photos recadrées ' +
        'ou floutées, la miniature garde encore la version d\'avant.');
    }

    return out;
  }

  /* ------------------------------------------------------------ nettoyage */

  /* Retire les segments de métadonnées sans toucher aux données d'image :
     aucune ré-encodage, donc aucune perte de qualité. */
  function strip(bytes) {
    var segs = segments(bytes);
    if (!segs) return { bytes: bytes, removed: 0, changed: false };

    var drop = segs.filter(function (s) { return isMetadata(bytes, s); });
    if (!drop.length) return { bytes: bytes, removed: 0, changed: false };

    var removed = drop.reduce(function (a, s) { return a + (s.end - s.start); }, 0);
    var out = new Uint8Array(bytes.length - removed);
    var w = 0, read = 0;
    drop.forEach(function (s) {
      out.set(bytes.subarray(read, s.start), w);
      w += s.start - read;
      read = s.end;
    });
    out.set(bytes.subarray(read), w);
    return { bytes: out, removed: removed, changed: true };
  }

  /* ---------------------------------------------------------------- rendu */

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  var LEVEL_LABEL = { critical: 'très sensible', mid: 'identifiant', low: 'mineur' };

  function humanSize(n) {
    if (n < 1024) return n + ' o';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1).replace('.', ',') + ' Ko';
    return (n / 1048576).toFixed(2).replace('.', ',') + ' Mo';
  }

  var current = null;

  function show(name, bytes) {
    var res = analyse(bytes);
    var out = document.getElementById('resultat');
    out.hidden = false;
    document.getElementById('depose').classList.add('is-done');

    var head = document.getElementById('res-head');
    head.innerHTML = '';
    head.appendChild(el('h2', null, name));
    head.appendChild(el('p', 'muted',
      humanSize(bytes.length) + (res.bytesMeta ? ' · dont ' + humanSize(res.bytesMeta) + ' de métadonnées' : '')));

    var verdict = document.getElementById('verdict');
    verdict.className = 'verdict';
    if (!res.jpeg) {
      verdict.classList.add('is-neutral');
      verdict.textContent = 'Ce fichier n\'est pas un JPEG. L\'analyse des métadonnées ne s\'applique qu\'aux JPEG ' +
        '(les PNG et les captures d\'écran en contiennent rarement).';
    } else if (res.gps) {
      verdict.classList.add('is-critical');
      verdict.textContent = 'Cette photo contient votre position GPS exacte. Publiée telle quelle, elle révèle où elle a été prise.';
    } else if (res.findings.length) {
      verdict.classList.add('is-warning');
      verdict.textContent = 'Pas de position GPS, mais ' + res.findings.length +
        ' élément' + (res.findings.length > 1 ? 's' : '') + ' identifiant' +
        (res.findings.length > 1 ? 's' : '') + ' dans le fichier.';
    } else {
      verdict.classList.add('is-good');
      verdict.textContent = 'Aucune métadonnée identifiante trouvée. Cette photo est déjà propre.';
    }

    var list = document.getElementById('liste');
    list.innerHTML = '';
    res.findings.forEach(function (f) {
      var card = el('article', 'card');
      var top = el('div', 'card-top');
      top.appendChild(el('h3', null, f.title));
      top.appendChild(el('span', 'tag ' + f.level, LEVEL_LABEL[f.level]));
      card.appendChild(top);
      card.appendChild(el('div', 'value', f.value));
      card.appendChild(el('p', null, f.note));
      list.appendChild(card);
    });

    var map = document.getElementById('carte');
    map.hidden = !res.gps;
    if (res.gps) {
      document.getElementById('coord').textContent = res.gps.lat + ', ' + res.gps.lon;
    }

    var cleaned = strip(bytes);
    current = { name: name, cleaned: cleaned };
    var dl = document.getElementById('telecharger');
    dl.hidden = false;
    dl.querySelector('.dl-note').textContent = cleaned.changed
      ? 'Version nettoyée : ' + humanSize(cleaned.removed) + ' de métadonnées retirées, image inchangée (aucune ré-compression).'
      : 'Rien à retirer : le fichier ne contient aucun segment de métadonnées.';
    dl.querySelector('button').disabled = !cleaned.changed;
  }

  function download() {
    if (!current || !current.cleaned.changed) return;
    var blob = new Blob([current.cleaned.bytes], { type: 'image/jpeg' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = current.name.replace(/(\.jpe?g)?$/i, '') + '-nettoyee.jpg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  function handleFile(file) {
    if (!file) return;
    var fr = new FileReader();
    fr.onload = function () { show(file.name, new Uint8Array(fr.result)); };
    fr.readAsArrayBuffer(file);
  }

  function bindTheme() {
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;
    var saved = null;
    try { saved = localStorage.getItem('photo.theme'); } catch (e) {}
    if (saved) document.documentElement.setAttribute('data-theme', saved);
    btn.addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme');
      if (!cur) {
        cur = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
      }
      var next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('photo.theme', next); } catch (e) {}
    });
  }

  function boot() {
    var start = function () {
      bindTheme();
      var zone = document.getElementById('depose');
      var input = document.getElementById('fichier');
      if (!zone || !input) return;

      input.addEventListener('change', function () { handleFile(input.files[0]); });
      zone.addEventListener('click', function (e) {
        if (e.target !== input) input.click();
      });
      zone.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
      });
      ['dragenter', 'dragover'].forEach(function (ev) {
        zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.add('is-over'); });
      });
      ['dragleave', 'drop'].forEach(function (ev) {
        zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.remove('is-over'); });
      });
      zone.addEventListener('drop', function (e) {
        if (e.dataTransfer && e.dataTransfer.files) handleFile(e.dataTransfer.files[0]);
      });
      var btn = document.querySelector('#telecharger button');
      if (btn) btn.addEventListener('click', download);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
  }

  return {
    segments: segments, analyse: analyse, strip: strip, describe: describe,
    isMetadata: isMetadata, humanSize: humanSize, boot: boot
  };
});
