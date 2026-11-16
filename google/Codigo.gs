/**
 * Mis sobres: guarda en esta hoja lo que apuntas en la app.
 * Se pega en un proyecto de Apps Script (script.new) y se implementa como "Aplicación web".
 */
/* Identificador de tu hoja de Google (está en su dirección, entre /d/ y /edit). */
var HOJA_ID = 'PEGA_AQUI_EL_ID_DE_TU_HOJA';

var HOJAS = { m: 'Movimientos', s: 'Sobres', c: 'Config' };
var CAB = {
  m: ['id', 'fecha', 'tipo', 'importe', 'sobre', 'nota', 'sobreId', 'ts'],
  s: ['id', 'nombre', 'tipo', 'orden', 'cambios'],
  c: ['clave', 'valor']
};

function hoja_(k) {
  var ss = SpreadsheetApp.openById(HOJA_ID);
  var h = ss.getSheetByName(HOJAS[k]);
  if (!h) {
    h = ss.insertSheet(HOJAS[k]);
    h.getRange(1, 1, 1, CAB[k].length).setValues([CAB[k]]).setFontWeight('bold');
    h.setFrozenRows(1);
    if (k === 'm') {
      h.getRange('A:C').setNumberFormat('@');
      h.getRange('D:D').setNumberFormat('#,##0.00 €');
      h.getRange('E:G').setNumberFormat('@');
    } else if (k === 's') {
      h.getRange('A:C').setNumberFormat('@');
      h.getRange('E:E').setNumberFormat('@');
    }
  }
  return h;
}

function filas_(k) {
  var h = hoja_(k), n = h.getLastRow();
  if (n < 2) return [];
  return h.getRange(2, 1, n - 1, CAB[k].length).getValues();
}

function fecha_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(v);
}

function estado_() {
  var movs = filas_('m').filter(function (r) { return r[0] !== ''; }).map(function (r) {
    return { id: String(r[0]), fecha: fecha_(r[1]), tipo: String(r[2]), importe: Number(r[3]) || 0,
             nota: String(r[5]), sobre: String(r[6]), ts: Number(r[7]) || 0 };
  });
  var sobres = filas_('s').filter(function (r) { return r[0] !== ''; }).map(function (r) {
    var c = [];
    try { c = JSON.parse(r[4] || '[]'); } catch (e) {}
    return { id: String(r[0]), nombre: String(r[1]), tipo: String(r[2]), orden: Number(r[3]) || 0, cambios: c };
  });
  var cfg = {};
  filas_('c').forEach(function (r) { if (r[0] !== '') cfg[String(r[0])] = Number(r[1]); });
  return { ok: true, movs: movs, sobres: sobres, cfg: cfg };
}

function escribirSobres_(lista) {
  var h = hoja_('s'), n = h.getLastRow();
  if (n > 1) h.getRange(2, 1, n - 1, CAB.s.length).clearContent();
  if (lista && lista.length) {
    h.getRange(2, 1, lista.length, CAB.s.length).setValues(lista.map(function (s) {
      return [String(s.id), String(s.nombre), String(s.tipo), Number(s.orden) || 0, JSON.stringify(s.cambios || [])];
    }));
  }
}

function escribirCfg_(cfg) {
  var h = hoja_('c'), n = h.getLastRow();
  if (n > 1) h.getRange(2, 1, n - 1, 2).clearContent();
  var ks = Object.keys(cfg || {});
  if (ks.length) h.getRange(2, 1, ks.length, 2).setValues(ks.map(function (k) { return [k, cfg[k]]; }));
}

function salida_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return salida_(estado_());
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var ops = Array.isArray(body.ops) ? body.ops : [];
    var hm = hoja_('m');
    hoja_('s'); hoja_('c');

    if (body.init && filas_('s').length === 0) {
      escribirSobres_(body.init.sobres || []);
      escribirCfg_(body.init.cfg || {});
    }

    ops.forEach(function (op) {
      if (op.t === 'add' && op.mov && op.mov.id) {
        var ids = filas_('m').map(function (r) { return String(r[0]); });
        if (ids.indexOf(String(op.mov.id)) < 0) {
          var m = op.mov;
          hm.appendRow([String(m.id), String(m.fecha), String(m.tipo), Number(m.importe) || 0,
                        String(m.sobreNombre || ''), String(m.nota || ''), String(m.sobre), Number(m.ts) || 0]);
        }
      } else if (op.t === 'del' && op.id) {
        var filas = filas_('m');
        for (var i = filas.length - 1; i >= 0; i--) {
          if (String(filas[i][0]) === String(op.id)) hm.deleteRow(i + 2);
        }
      } else if (op.t === 'sobres' && Array.isArray(op.sobres)) {
        escribirSobres_(op.sobres);
      } else if (op.t === 'cfg' && op.cfg) {
        escribirCfg_(op.cfg);
      }
    });
    SpreadsheetApp.flush();
    return salida_(estado_());
  } catch (err) {
    return salida_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}
