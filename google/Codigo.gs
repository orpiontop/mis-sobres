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


/* ======================================================================
 * PANEL «Resumen»: tarjetas, tablas y gráficos con los colores de la app.
 * crearResumen(): ejecútala una vez desde el editor (crea el panel y hace
 * que se actualice solo al abrir la hoja y cada hora).
 * ====================================================================== */
var TZ_ = 'Europe/Madrid';
var C_ = { verde: '#0f6b4f', fondo: '#f1f4f1', blanco: '#ffffff', tinta: '#14201c', gris: '#5d6b66', linea: '#dbe2dd',
           pista: '#e4eae6', rojo: '#b3261e', naranja: '#b26a00', claro: '#c9d6cf' };
var PALETA_ = { c1: '#2a78d6', c2: '#eb6834', c3: '#1baf7a', c4: '#eda100', c5: '#e87ba4', c6: '#008300', c7: '#6250d6', c8: '#e34948' };
var MESES_ = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
var DIAS_ = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
var EUR_ = '#,##0.00 €;[Red]-#,##0.00 €';

/* ---- fechas (igual que la app) ---- */
function pd_(n) { return n < 10 ? '0' + n : '' + n; }
function hoy_() { return Utilities.formatDate(new Date(), TZ_, 'yyyy-MM-dd'); }
function diaCobro_(y, m) { var d = new Date(y, m + 1, 0).getDate(), n = 0; for (; d > 0; d--) { var w = new Date(y, m, d).getDay(); if (w !== 0 && w !== 6 && ++n === 3) return d; } return 1; }
function idxAuto_(s) { var p = s.split('-'), y = +p[0], m = +p[1] - 1, d = +p[2]; return y * 12 + m - (d >= diaCobro_(y, m) ? 0 : 1); }
function inicioAuto_(k) { var y = Math.floor(k / 12), m = k % 12; return y + '-' + pd_(m + 1) + '-' + pd_(diaCobro_(y, m)); }
function addDias_(s, n) { var p = s.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2] + n); return d.getFullYear() + '-' + pd_(d.getMonth() + 1) + '-' + pd_(d.getDate()); }
function corto_(s) { var p = s.split('-'); return (+p[2]) + ' ' + MESES_[+p[1] - 1]; }
function diasHasta_(s, hoy) { var a = s.split('-'), b = hoy.split('-'); return Math.round((new Date(+a[0], +a[1] - 1, +a[2]) - new Date(+b[0], +b[1] - 1, +b[2])) / 864e5); }

function modelo_() {
  var e = estado_(), cfg = e.cfg || {}, cob = cfg.cobros || {};
  function inicioDe(k) { return cob[k] || inicioAuto_(k); }
  function idxDe(s) { var k = idxAuto_(s); if (cob[k] && s < cob[k]) return k - 1; if (cob[k + 1] && s >= cob[k + 1]) return k + 1; return k; }
  var hoy = hoy_(), now = idxDe(hoy), ini = Math.min(typeof cfg.inicio === 'number' ? cfg.inicio : now, now);
  var movs = e.movs.filter(function (m) { return /^\d{4}-\d{2}-\d{2}$/.test(m.fecha); });
  movs.forEach(function (m) { m.k = idxDe(m.fecha); });
  var sobres = e.sobres.slice().sort(function (a, b) { return a.orden - b.orden; });
  sobres.forEach(function (s, i) { if (!PALETA_[s.color]) s.color = 'c' + (i % 8 + 1); s.hex = PALETA_[s.color]; });
  function mensualEn(s, k) { var c = (s.cambios || []).slice().sort(function (a, b) { return a.c - b.c; }); if (!c.length) return 0; var v = c[0].m; c.forEach(function (x) { if (x.c <= k) v = x.m; }); return v; }
  function delMes(s, k) {
    var r = { asig: k >= ini ? mensualEn(s, k) : 0, g: 0, i: 0, tin: 0, tout: 0, c: 0, aj: 0 };
    movs.forEach(function (m) {
      if (m.k !== k) return;
      if (m.tipo === 'traspaso') { if (m.sobre === s.id) r.tout += m.importe; if (m.destino === s.id) r.tin += m.importe; return; }
      if (m.sobre !== s.id) return;
      if (m.tipo === 'gasto') r.g += m.importe; else if (m.tipo === 'ingreso') r.i += m.importe;
      else if (m.tipo === 'colchon') r.c += m.importe; else if (m.tipo === 'ajuste') r.aj += m.importe;
    });
    r.disp = r.asig + r.i + r.aj + r.tin - r.tout + r.c; r.queda = r.disp - r.g; r.neto = r.asig + r.i + r.aj + r.tin - r.tout - r.g;
    return r;
  }
  function totalHasta(s, k) { var t = 0; for (var j = ini; j <= k; j++) t += delMes(s, j).neto; return t; }
  function calc(s) { var cur = delMes(s, now), tot = totalHasta(s, now); return { mes: cur.asig, disp: cur.disp, gastado: cur.g, queda: cur.queda, total: tot, colchon: tot - cur.queda }; }
  function cuentas() {
    var map = {};
    movs.forEach(function (m) {
      var x = m.extra || {}, l = [];
      if (m.tipo === 'gasto' && x.comp && x.comp.persona) {
        var ps = x.comp.personas && x.comp.personas.length ? x.comp.personas : [x.comp.persona];
        if (x.comp.pago === 'yo') { var d = ((+x.comp.total || 0) - m.importe) / ps.length; ps.forEach(function (p) { l.push([p, d]); }); }
        else l.push([x.comp.persona, -m.importe]);
      } else if (m.tipo === 'saldo' && x.persona) l.push([x.persona, x.dir === 'pago' ? m.importe : -m.importe]);
      l.forEach(function (it) { var k = String(it[0]).trim().toLowerCase(); if (!k) return; if (!map[k]) map[k] = { nombre: String(it[0]).trim(), saldo: 0 }; map[k].saldo += it[1]; });
    });
    return Object.keys(map).map(function (k) { var c = map[k]; c.saldo = Math.round(c.saldo * 100) / 100; return c; }).filter(function (c) { return c.saldo !== 0; });
  }
  var tipo = function (t) { return sobres.filter(function (s) { return s.tipo === t; }); };
  return { hoy: hoy, now: now, ini: ini, movs: movs, sobres: sobres, gasto: tipo('gasto'), ahorro: tipo('ahorro'), viajes: tipo('viaje'),
           cfg: cfg, inicioDe: inicioDe, delMes: delMes, calc: calc, totalHasta: totalHasta, cuentas: cuentas, nombre: function (id) {
             for (var i = 0; i < sobres.length; i++) if (sobres[i].id === id) return sobres[i].nombre; return 'Otro'; },
           color: function (id) { for (var i = 0; i < sobres.length; i++) if (sobres[i].id === id) return sobres[i].hex; return C_.gris; } };
}

/* ---- ayudas de formato ---- */
function titulo_(h, a1, txt) { h.getRange(a1).setValue(txt).setFontSize(13).setFontWeight('bold').setFontColor(C_.verde); }
function tabla_(h, fila, col, cab, filas, formatos, ancho) {
  ancho = ancho || cab.length;
  var hd = h.getRange(fila, col, 1, ancho);
  hd.setValues([cab]).setFontWeight('bold').setFontColor(C_.gris).setFontSize(9).setBackground(C_.blanco)
    .setBorder(false, false, true, false, false, false, C_.linea, SpreadsheetApp.BorderStyle.SOLID);
  if (!filas.length) { h.getRange(fila + 1, col).setValue('Todavía no hay datos').setFontColor(C_.gris).setFontStyle('italic'); h.getRange(fila + 1, col, 1, ancho).setBackground(C_.blanco); return 1; }
  var r = h.getRange(fila + 1, col, filas.length, ancho);
  var vals = filas.map(function (f) { return f.map(function (v) { return v && typeof v === 'object' ? v.bar : v; }); });
  r.setValues(vals).setBackground(C_.blanco).setFontColor(C_.tinta).setFontSize(10)
    .setBorder(false, false, true, false, false, true, C_.pista, SpreadsheetApp.BorderStyle.SOLID);
  filas.forEach(function (f, i) { f.forEach(function (v, j) { if (v && typeof v === 'object') h.getRange(fila + 1 + i, col + j).setFontColor(v.color).setFontFamily('Roboto Mono').setFontSize(9); }); });
  (formatos || []).forEach(function (fm, j) { if (fm) h.getRange(fila + 1, col + j, filas.length, 1).setNumberFormat(fm).setHorizontalAlignment('right'); });
  return filas.length;
}
function barra_(f, color) { var n = Math.round(Math.max(0, Math.min(1, f)) * 10); return { bar: new Array(n + 1).join('█') + new Array(11 - n).join('░') + '  ' + Math.round(f * 100) + ' %', color: color }; }
function tarjeta_(h, rango, etiqueta, valor, nota, colorValor) {
  var r = h.getRange(rango), f = r.getRow(), c = r.getColumn(), w = r.getNumColumns();
  r.setBackground(C_.blanco);
  h.getRange(f, c, 1, w).merge().setValue(etiqueta).setFontSize(9).setFontColor(C_.gris).setVerticalAlignment('bottom');
  h.getRange(f + 1, c, 1, w).merge().setValue(valor).setFontSize(20).setFontWeight('bold').setFontColor(colorValor || C_.tinta).setNumberFormat(EUR_).setHorizontalAlignment('left');
  h.getRange(f + 2, c, 1, w).merge().setValue(nota || '').setFontSize(9).setFontColor(C_.gris).setVerticalAlignment('top');
}
function grafico_(h, tipo, rango, fila, col, op) {
  var b = h.newChart().setChartType(tipo).addRange(rango).setNumHeaders(1).setPosition(fila, col, 0, 0)
    .setOption('width', 600).setOption('height', 300).setOption('backgroundColor', C_.blanco)
    .setOption('titleTextStyle', { color: C_.tinta, fontSize: 13, bold: true }).setOption('legend', { position: 'bottom', textStyle: { color: C_.gris } })
    .setOption('fontName', 'Roboto');
  Object.keys(op || {}).forEach(function (k) { b = b.setOption(k, op[k]); });
  h.insertChart(b.build());
}

function crearResumen() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'actualizarResumen') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('actualizarResumen').forSpreadsheet(HOJA_ID).onOpen().create();
  ScriptApp.newTrigger('actualizarResumen').timeBased().everyHours(1).create();
  actualizarResumen();
}

function actualizarResumen() {
  var ss = SpreadsheetApp.openById(HOJA_ID), M = modelo_();
  var h = ss.getSheetByName('Resumen'); if (!h) h = ss.insertSheet('Resumen', 0);
  var dt = ss.getSheetByName('Datos'); if (!dt) dt = ss.insertSheet('Datos');
  h.getCharts().forEach(function (c) { h.removeChart(c); });
  h.getRange(1, 1, h.getMaxRows(), h.getMaxColumns()).breakApart();
  h.clear(); dt.clear();
  ['A:A', 'T:T', 'W:W', 'Z:Z', 'AC:AC', 'AG:AG'].forEach(function (c) { dt.getRange(c).setNumberFormat('@'); });
  if (h.getMaxRows() < 110) h.insertRowsAfter(h.getMaxRows(), 110 - h.getMaxRows());
  if (h.getMaxColumns() < 14) h.insertColumnsAfter(h.getMaxColumns(), 14 - h.getMaxColumns());
  h.setHiddenGridlines(true);
  h.getRange(1, 1, h.getMaxRows(), h.getMaxColumns()).setBackground(C_.fondo).setFontFamily('Roboto').setFontColor(C_.tinta).setVerticalAlignment('middle');
  h.setColumnWidth(1, 18); for (var c = 2; c <= 13; c++) h.setColumnWidth(c, 100); h.setColumnWidth(14, 18);
  h.setRowHeights(1, 110, 22);

  var now = M.now, hoy = M.hoy, ini = M.ini, inicio = M.inicioDe(now), fin = addDias_(M.inicioDe(now + 1), -1), prox = M.inicioDe(now + 1);
  var dias = Math.max(1, diasHasta_(prox, hoy));

  /* cabecera */
  h.setRowHeight(2, 40); h.setRowHeight(3, 22);
  h.getRange('B2:M3').setBackground(C_.verde);
  h.getRange('B2:H2').merge().setValue('Mis sobres').setFontSize(22).setFontWeight('bold').setFontColor(C_.blanco);
  h.getRange('B3:H3').merge().setValue('Mes: ' + corto_(inicio) + ' – ' + corto_(fin) + '   ·   Cobras el ' + corto_(prox) + ' (en ' + diasHasta_(prox, hoy) + ' días)').setFontColor('#d7ebe3').setFontSize(10);
  h.getRange('I2:M3').merge().setValue('Actualizado: ' + Utilities.formatDate(new Date(), TZ_, 'd MMM, HH:mm')).setFontColor('#d7ebe3').setFontSize(9).setHorizontalAlignment('right').setVerticalAlignment('bottom');

  /* tarjetas */
  var queda = 0, gastadoMes = 0, ahorro = 0, sobr = 0;
  M.gasto.forEach(function (s) { var c = M.calc(s); queda += c.queda; sobr += c.colchon; });
  M.ahorro.forEach(function (s) { ahorro += M.calc(s).total; });
  M.movs.forEach(function (m) { if (m.tipo === 'gasto' && m.k === now) gastadoMes += m.importe; });
  var cs = M.cuentas(), neto = cs.reduce(function (a, c) { return a + c.saldo; }, 0);
  h.setRowHeight(6, 34);
  tarjeta_(h, 'B5:D7', 'TE QUEDA ESTE MES', queda, '≈ ' + (Math.round(queda / dias * 100) / 100).toFixed(2).replace('.', ',') + ' € al día', queda < 0 ? C_.rojo : C_.verde);
  tarjeta_(h, 'E5:G7', 'GASTADO ESTE MES', gastadoMes, 'Desde el ' + corto_(inicio));
  tarjeta_(h, 'H5:J7', 'AHORRO TOTAL', ahorro + sobr, 'Carpetas ' + ahorro.toFixed(2).replace('.', ',') + ' € · Sobrantes ' + sobr.toFixed(2).replace('.', ',') + ' €');
  tarjeta_(h, 'K5:M7', neto < 0 ? 'DEBES A AMIGOS' : 'TE DEBEN AMIGOS', Math.abs(neto), cs.length ? cs.length + (cs.length === 1 ? ' persona' : ' personas') : 'Todo cuadrado', neto < 0 ? C_.rojo : C_.tinta);

  /* sobres este mes */
  titulo_(h, 'B9', 'Sobres este mes');
  var fs = M.gasto.map(function (s) { var c = M.calc(s), f = c.disp > 0 ? c.gastado / c.disp : 0; return [s.nombre, c.disp, c.gastado, c.queda, barra_(f, f > 1 ? C_.rojo : f > 0.75 ? C_.naranja : s.hex), c.colchon]; });
  tabla_(h, 10, 2, ['Sobre', 'Tenías', 'Gastado', 'Queda', 'Usado', 'Sobrante'], fs, [null, EUR_, EUR_, EUR_, null, EUR_]);

  /* ahorro */
  titulo_(h, 'B21', 'Ahorro');
  var fa = M.ahorro.map(function (s) { var c = M.calc(s), f = s.meta > 0 ? c.total / s.meta : 0; return [s.nombre, c.total, c.mes, s.meta || '', s.meta > 0 ? barra_(f, C_.verde) : '', s.meta > 0 ? (s.metaNombre || 'Meta') + ': ' + Math.round(f * 100) + ' %' : '']; });
  fa.push(['Sobrantes', sobr, '', '', '', 'Lo que no gastaste']);
  tabla_(h, 22, 2, ['Carpeta', 'Total', 'Cada mes', 'Meta', 'Progreso', ''], fa, [null, EUR_, EUR_, EUR_, null, null]);

  /* datos para gráficos (pestaña Datos) */
  var desde = Math.max(ini, now - 11), ks = []; for (var k = desde; k <= now; k++) ks.push(k);
  var etiq = function (k) { var p = M.inicioDe(k + 1).split('-'); return MESES_[+p[1] - 1] + ' ' + p[0].slice(2); };
  var cols = M.gasto.slice(), tieneOtros = M.movs.some(function (m) { return m.tipo === 'gasto' && !M.gasto.some(function (s) { return s.id === m.sobre; }); });
  var t1 = [['Mes'].concat(cols.map(function (s) { return s.nombre; })).concat(tieneOtros ? ['Viajes y otros'] : [])];
  ks.forEach(function (k) {
    var fila = [etiq(k)].concat(cols.map(function (s) { return M.delMes(s, k).g; }));
    if (tieneOtros) { var o = 0; M.movs.forEach(function (m) { if (m.tipo === 'gasto' && m.k === k && !M.gasto.some(function (s) { return s.id === m.sobre; })) o += m.importe; }); fila.push(o); }
    t1.push(fila);
  });
  dt.getRange(1, 1, t1.length, t1[0].length).setValues(t1);
  var t2 = [['Mes', 'Ahorro total']];
  ks.forEach(function (k) {
    var a = 0; M.ahorro.forEach(function (s) { a += M.totalHasta(s, k); });
    M.gasto.forEach(function (s) { var t = M.totalHasta(s, k); a += k < now ? t : t - M.delMes(s, k).queda; });
    t2.push([etiq(k), Math.round(a * 100) / 100]);
  });
  dt.getRange(1, 20, t2.length, 2).setValues(t2);
  var porSobre = {}; M.movs.forEach(function (m) { if (m.tipo === 'gasto' && m.k === now) porSobre[m.sobre] = (porSobre[m.sobre] || 0) + m.importe; });
  var t3 = [['Sobre', 'Gastado']], col3 = [];
  Object.keys(porSobre).sort(function (a, b) { return porSobre[b] - porSobre[a]; }).forEach(function (id) { t3.push([M.nombre(id), porSobre[id]]); col3.push(M.color(id)); });
  if (t3.length === 1) { t3.push(['Sin gastos', 0.0001]); col3.push(C_.pista); }
  dt.getRange(1, 23, t3.length, 2).setValues(t3);
  var porEt = {}; M.movs.forEach(function (m) { if (m.tipo === 'gasto' && m.etiqueta) porEt[m.etiqueta] = (porEt[m.etiqueta] || 0) + m.importe; });
  var et = Object.keys(porEt).sort(function (a, b) { return porEt[b] - porEt[a]; }), t4 = [['Etiqueta', 'Gastado']];
  et.slice(0, 7).forEach(function (e) { t4.push([e, porEt[e]]); });
  if (et.length > 7) t4.push(['Otras', et.slice(7).reduce(function (a, e) { return a + porEt[e]; }, 0)]);
  if (t4.length === 1) t4.push(['Sin etiquetas aún', 0.0001]);
  dt.getRange(1, 26, t4.length, 2).setValues(t4);
  var t5 = [['Sobre', 'Tenías', 'Gastado']]; M.gasto.forEach(function (s) { var c = M.calc(s); t5.push([s.nombre, c.disp, c.gastado]); });
  if (t5.length === 1) t5.push(['—', 0, 0]);
  dt.getRange(1, 29, t5.length, 3).setValues(t5);
  var sem = [0, 0, 0, 0, 0, 0, 0], lim = addDias_(hoy, -90);
  M.movs.forEach(function (m) { if (m.tipo === 'gasto' && m.fecha >= lim && m.fecha <= hoy) { var p = m.fecha.split('-'), w = (new Date(+p[0], +p[1] - 1, +p[2]).getDay() + 6) % 7; sem[w] += m.importe; } });
  var primera = M.movs.reduce(function (a, m) { return m.tipo === 'gasto' && m.fecha >= lim && m.fecha < a ? m.fecha : a; }, hoy);
  var semanas = Math.max(1, diasHasta_(hoy, primera) / 7);
  var t6 = [['Día', 'Media por semana']].concat(DIAS_.map(function (d, i) { return [d, Math.round(sem[i] / semanas * 100) / 100]; }));
  dt.getRange(1, 33, t6.length, 2).setValues(t6);
  dt.hideSheet();

  /* gráficos */
  var cS = cols.map(function (s) { return s.hex; }).concat(tieneOtros ? [C_.gris] : []);
  var vA = { format: '#,##0 €', textStyle: { color: C_.gris }, gridlines: { color: C_.pista }, baselineColor: C_.linea };
  var hA = { textStyle: { color: C_.gris } };
  grafico_(h, Charts.ChartType.BAR, dt.getRange(1, 29, t5.length, 3), 9, 9, { title: 'Lo que tenías y lo que has gastado', colors: [C_.claro, C_.verde], hAxis: vA, vAxis: hA, bar: { groupWidth: '65%' }, width: 500, height: 290 });
  titulo_(h, 'B32', 'Cómo va tu dinero');
  grafico_(h, Charts.ChartType.COLUMN, dt.getRange(1, 1, t1.length, t1[0].length), 33, 2, { title: 'Gastado por mes', isStacked: true, colors: cS, vAxis: vA, hAxis: hA, bar: { groupWidth: '55%' } });
  grafico_(h, Charts.ChartType.LINE, dt.getRange(1, 20, t2.length, 2), 33, 8, { title: 'Cómo crece tu ahorro', colors: [C_.verde], vAxis: vA, hAxis: hA, curveType: 'function', pointSize: 6, lineWidth: 3, legend: { position: 'none' }, width: 500 });
  titulo_(h, 'B48', 'En qué se va el dinero');
  grafico_(h, Charts.ChartType.PIE, dt.getRange(1, 23, t3.length, 2), 49, 2, { title: 'Por sobre (este mes)', pieHole: 0.55, colors: col3, pieSliceText: 'none', legend: { position: 'right', textStyle: { color: C_.tinta } } });
  grafico_(h, Charts.ChartType.PIE, dt.getRange(1, 26, t4.length, 2), 49, 8, { title: 'Por etiqueta (todo)', pieHole: 0.55, colors: et.length ? ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'] : [C_.pista], pieSliceText: 'none', legend: { position: 'right', textStyle: { color: C_.tinta } }, width: 500 });

  /* top 10 y gastos fijos */
  titulo_(h, 'B64', 'Los 10 gastos más grandes del mes');
  var top = M.movs.filter(function (m) { return m.tipo === 'gasto' && m.k === now; }).sort(function (a, b) { return b.importe - a.importe; }).slice(0, 10)
    .map(function (m) { return [corto_(m.fecha), m.nota || 'Gasto', M.nombre(m.sobre), m.importe]; });
  tabla_(h, 65, 2, ['Fecha', 'Qué', 'Sobre', 'Importe'], top, [null, null, null, EUR_]);
  titulo_(h, 'H64', 'Gastos fijos');
  var fj = (M.cfg.fijos || []).map(function (f) { return [f.nombre, M.nombre(f.sobre), 'Día ' + f.dia, +f.importe, +f.importe * 12]; });
  if (fj.length) fj.push(['Total', '', '', fj.reduce(function (a, f) { return a + f[3]; }, 0), fj.reduce(function (a, f) { return a + f[4]; }, 0)]);
  var nf = tabla_(h, 65, 8, ['Gasto', 'Sobre', 'Cuándo', 'Al mes', 'Al año'], fj, [null, null, null, EUR_, EUR_]);
  if (fj.length) h.getRange(65 + nf, 8, 1, 5).setFontWeight('bold');

  /* día de la semana, viajes y cuentas */
  titulo_(h, 'B78', 'Cuándo gastas más');
  grafico_(h, Charts.ChartType.COLUMN, dt.getRange(1, 33, 8, 2), 79, 2, { title: 'Media por semana (últimos 3 meses)', colors: [C_.verde], vAxis: vA, hAxis: hA, legend: { position: 'none' }, bar: { groupWidth: '60%' }, width: 560, height: 260 });
  titulo_(h, 'H78', 'Viajes y planes');
  var fv = M.viajes.map(function (s) { var c = M.calc(s), g = 0; M.movs.forEach(function (m) { if (m.tipo === 'gasto' && m.sobre === s.id) g += m.importe; });
    var f = s.meta > 0 ? g / s.meta : 0; return [s.nombre, s.meta || '', g, c.total, s.meta > 0 ? barra_(f, f > 1 ? C_.rojo : C_.verde) : '']; });
  var nv = tabla_(h, 79, 8, ['Plan', 'Presupuesto', 'Gastado', 'Queda', 'Usado'], fv, [null, EUR_, EUR_, EUR_, null]);
  var fc = 79 + nv + 3;
  titulo_(h, 'H' + fc, 'Cuentas con amigos');
  tabla_(h, fc + 1, 8, ['Persona', 'Estado', 'Importe'], cs.map(function (c) { return [c.nombre, c.saldo < 0 ? 'Le debes' : 'Te debe', Math.abs(c.saldo)]; }), [null, null, EUR_]);
  if (cs.length) cs.forEach(function (c, i) { h.getRange(fc + 2 + i, 10).setFontColor(c.saldo < 0 ? C_.rojo : C_.verde).setFontWeight('bold'); });

  h.setFrozenRows(0);
  ss.setActiveSheet(h);
}
