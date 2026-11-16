/**
 * Mis sobres: guarda en esta hoja lo que apuntas en la app.
 * Se pega en un proyecto de Apps Script (script.new) y se implementa como "Aplicación web".
 */
/* Identificador de tu hoja de Google (está en su dirección, entre /d/ y /edit). */
var HOJA_ID = 'PEGA_AQUI_EL_ID_DE_TU_HOJA';

var HOJAS = { m: 'Movimientos', s: 'Sobres', c: 'Config' };
var CAB = {
  m: ['id', 'fecha', 'tipo', 'importe', 'sobre', 'nota', 'sobreId', 'ts', 'etiqueta', 'destinoId', 'extra'],
  s: ['id', 'nombre', 'tipo', 'orden', 'cambios', 'color', 'meta', 'metaNombre', 'etiquetas'],
  c: ['clave', 'valor']
};

var LISTAS_ = {};

function hoja_(k) {
  var ss = SpreadsheetApp.openById(HOJA_ID);
  var h = ss.getSheetByName(HOJAS[k]);
  if (h && !LISTAS_[k]) {
    var w = CAB[k].length, cab = h.getRange(1, 1, 1, w).getValues()[0];
    if (cab.join('|') !== CAB[k].join('|')) h.getRange(1, 1, 1, w).setValues([CAB[k]]).setFontWeight('bold');
    if (k === 'm') h.getRange('I:K').setNumberFormat('@');
    if (k === 's') { h.getRange('F:F').setNumberFormat('@'); h.getRange('H:I').setNumberFormat('@'); }
    if (k === 'c') h.getRange('B:B').setNumberFormat('@');
    LISTAS_[k] = true;
  }
  if (!h) {
    h = ss.insertSheet(HOJAS[k]);
    h.getRange(1, 1, 1, CAB[k].length).setValues([CAB[k]]).setFontWeight('bold');
    h.setFrozenRows(1);
    if (k === 'm') {
      h.getRange('A:C').setNumberFormat('@');
      h.getRange('D:D').setNumberFormat('#,##0.00 €');
      h.getRange('E:G').setNumberFormat('@');
      h.getRange('I:K').setNumberFormat('@');
    } else if (k === 's') {
      h.getRange('A:C').setNumberFormat('@');
      h.getRange('E:F').setNumberFormat('@');
      h.getRange('H:I').setNumberFormat('@');
    } else if (k === 'c') {
      h.getRange('B:B').setNumberFormat('@');
    }
    LISTAS_[k] = true;
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

function json_(v, def) {
  if (v === '' || v === null || v === undefined) return def;
  try { return JSON.parse(String(v)); } catch (e) { return def; }
}

function estado_() {
  var movs = filas_('m').filter(function (r) { return r[0] !== ''; }).map(function (r) {
    return { id: String(r[0]), fecha: fecha_(r[1]), tipo: String(r[2]), importe: Number(r[3]) || 0,
             nota: String(r[5]), sobre: String(r[6]), ts: Number(r[7]) || 0,
             etiqueta: String(r[8] || ''), destino: String(r[9] || ''), extra: json_(r[10], {}) };
  });
  var sobres = filas_('s').filter(function (r) { return r[0] !== ''; }).map(function (r) {
    var c = [], et = [];
    try { c = JSON.parse(r[4] || '[]'); } catch (e) {}
    try { et = JSON.parse(r[8] || '[]'); } catch (e) {}
    return { id: String(r[0]), nombre: String(r[1]), tipo: String(r[2]), orden: Number(r[3]) || 0, cambios: c,
             color: String(r[5] || ''), meta: Number(r[6]) || 0, metaNombre: String(r[7] || ''), etiquetas: et };
  });
  var cfg = {};
  filas_('c').forEach(function (r) {
    if (r[0] === '') return;
    var v = r[1];
    if (typeof v !== 'number') { try { v = JSON.parse(String(v)); } catch (e) { v = String(v); } }
    cfg[String(r[0])] = v;
  });
  return { ok: true, movs: movs, sobres: sobres, cfg: cfg };
}

function escribirSobres_(lista) {
  var h = hoja_('s'), n = h.getLastRow();
  if (n > 1) h.getRange(2, 1, n - 1, CAB.s.length).clearContent();
  if (lista && lista.length) {
    h.getRange(2, 1, lista.length, CAB.s.length).setValues(lista.map(function (s) {
      return [String(s.id), String(s.nombre), String(s.tipo), Number(s.orden) || 0, JSON.stringify(s.cambios || []),
              String(s.color || ''), Number(s.meta) || 0, String(s.metaNombre || ''), JSON.stringify(s.etiquetas || [])];
    }));
  }
}

function escribirCfg_(cfg) {
  var h = hoja_('c'), n = h.getLastRow();
  if (n > 1) h.getRange(2, 1, n - 1, 2).clearContent();
  var ks = Object.keys(cfg || {});
  if (ks.length) h.getRange(2, 1, ks.length, 2).setValues(ks.map(function (k) { return [k, JSON.stringify(cfg[k])]; }));
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
                        String(m.sobreNombre || ''), String(m.nota || ''), String(m.sobre), Number(m.ts) || 0,
                        String(m.etiqueta || ''), String(m.destino || ''), JSON.stringify(m.extra || {})]);
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

/**
 * Crea (o rehace) la pestaña «Resumen» con tablas y gráficos que se actualizan solos.
 * Ejecútala una vez desde el editor: elige «crearResumen» arriba y pulsa «Ejecutar».
 */
function crearResumen() {
  var ss = SpreadsheetApp.openById(HOJA_ID);
  hoja_('m');
  var h = ss.getSheetByName('Resumen');
  if (h) { h.getCharts().forEach(function (c) { h.removeChart(c); }); h.clear(); }
  else h = ss.insertSheet('Resumen', 0);

  var mes = 'IF(Movimientos!B2:B="","",YEAR(IF(DATEVALUE(Movimientos!B2:B)>=EOMONTH(DATEVALUE(Movimientos!B2:B),0)-2,EOMONTH(DATEVALUE(Movimientos!B2:B),0)+1,DATEVALUE(Movimientos!B2:B)))*100+MONTH(IF(DATEVALUE(Movimientos!B2:B)>=EOMONTH(DATEVALUE(Movimientos!B2:B),0)-2,EOMONTH(DATEVALUE(Movimientos!B2:B),0)+1,DATEVALUE(Movimientos!B2:B))))';
  var datos = '{Movimientos!C2:C,Movimientos!E2:E,Movimientos!D2:D,' + mes + ',Movimientos!I2:I}';

  h.getRange('A1').setValue('Gastado por mes y sobre').setFontWeight('bold').setFontSize(13);
  h.getRange('A2').setValue('Mes = año y mes en que acaba el periodo (cobras el antepenúltimo día).').setFontColor('#5d6b66');
  h.getRange('A3').setFormula('=IFERROR(ARRAYFORMULA(QUERY(' + datos + ',"select Col4, sum(Col3) where Col1=\'gasto\' group by Col4 pivot Col2 label Col4 \'Mes\'",0)),"Aún no hay gastos")');

  h.getRange('A22').setValue('Gastado por etiqueta (todo)').setFontWeight('bold').setFontSize(13);
  h.getRange('A23').setFormula('=IFERROR(ARRAYFORMULA(QUERY(' + datos + ',"select Col5, sum(Col3) where Col1=\'gasto\' and Col5<>\'\' group by Col5 order by sum(Col3) desc label Col5 \'Etiqueta\', sum(Col3) \'Gastado\'",0)),"Aún no hay gastos con etiqueta")');

  h.getRange('A42').setValue('Gastado por sobre (todo)').setFontWeight('bold').setFontSize(13);
  h.getRange('A43').setFormula('=IFERROR(ARRAYFORMULA(QUERY(' + datos + ',"select Col2, sum(Col3) where Col1=\'gasto\' group by Col2 order by sum(Col3) desc label Col2 \'Sobre\', sum(Col3) \'Gastado\'",0)),"Aún no hay gastos")');

  h.getRange('B3:K20').setNumberFormat('#,##0.00 €');
  h.getRange('B23:B40').setNumberFormat('#,##0.00 €');
  h.getRange('B43:B60').setNumberFormat('#,##0.00 €');
  h.setColumnWidth(1, 150);
  SpreadsheetApp.flush();

  h.insertChart(h.newChart().setChartType(Charts.ChartType.COLUMN).addRange(h.getRange('A3:K20'))
    .setNumHeaders(1).setOption('isStacked', true).setOption('title', 'Gastado por mes')
    .setOption('legend', { position: 'bottom' }).setPosition(1, 8, 0, 0).build());
  h.insertChart(h.newChart().setChartType(Charts.ChartType.BAR).addRange(h.getRange('A23:B40'))
    .setNumHeaders(1).setOption('title', 'Por etiqueta').setOption('legend', { position: 'none' })
    .setPosition(22, 8, 0, 0).build());
  h.insertChart(h.newChart().setChartType(Charts.ChartType.PIE).addRange(h.getRange('A43:B60'))
    .setNumHeaders(1).setOption('title', 'Por sobre').setOption('pieHole', 0.5)
    .setPosition(42, 8, 0, 0).build());
}
