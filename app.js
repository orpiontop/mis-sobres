(function(){
"use strict";
var $=function(id){return document.getElementById(id);};
var eur=new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"});
var MES=["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
var K="mis-sobres-app-v1";
var S={sobres:[],movs:[],cfg:{inicio:null,cobro:425},cola:[],url:"",sinc:0,
       tipo:"gasto",ultimo:null,ciclo:null,confirm:null,subiendo:false,fallo:false};

/* ---------- fechas: el mes empieza el antepenúltimo día ---------- */
function pad(n){return n<10?"0"+n:""+n;}
function hoyStr(){var d=new Date();return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());}
function diaCobro(y,m){return new Date(y,m+1,0).getDate()-2;}
function idxDe(str){var p=str.split("-"),y=+p[0],m=+p[1]-1,d=+p[2];return y*12+m-(d>=diaCobro(y,m)?0:1);}
function inicioDe(idx){var y=Math.floor(idx/12),m=idx%12;return y+"-"+pad(m+1)+"-"+pad(diaCobro(y,m));}
function corto(str){var p=str.split("-");return (+p[2])+" "+MES[+p[1]-1];}
function antes(str){var p=str.split("-"),d=new Date(+p[0],+p[1]-1,+p[2]-1);return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());}
function diasHasta(str){var p=str.split("-"),a=new Date(+p[0],+p[1]-1,+p[2]),h=new Date();h=new Date(h.getFullYear(),h.getMonth(),h.getDate());return Math.round((a-h)/864e5);}
function num(v){var n=parseFloat(String(v==null?"":v).replace(/\s|€/g,"").replace(",","."));return isFinite(n)?Math.round(n*100)/100:NaN;}
function uid(p){return p+Date.now().toString(36)+Math.random().toString(36).slice(2,8);}
function ahora(){return idxDe(hoyStr());}

/* ---------- guardar en el dispositivo ---------- */
function limpiaSobres(l){return (Array.isArray(l)?l:[]).filter(function(x){return x&&x.id;}).map(function(x){return {id:String(x.id),nombre:String(x.nombre||"Sobre"),tipo:x.tipo==="ahorro"?"ahorro":"gasto",orden:+x.orden||0,
  cambios:(Array.isArray(x.cambios)?x.cambios:[]).filter(function(c){return c&&typeof c.c==="number"&&typeof c.m==="number";}).map(function(c){return {c:c.c,m:c.m};})};}).sort(function(a,b){return a.orden-b.orden;});}
function limpiaMovs(l){return (Array.isArray(l)?l:[]).filter(function(x){return x&&x.id;}).map(function(x){return {id:String(x.id),tipo:x.tipo==="ingreso"?"ingreso":"gasto",importe:+x.importe||0,sobre:String(x.sobre||""),nota:String(x.nota||""),fecha:/^\d{4}-\d{2}-\d{2}$/.test(x.fecha)?x.fecha:hoyStr(),ts:+x.ts||0};});}
function grabar(){try{localStorage.setItem(K,JSON.stringify({sobres:S.sobres,movs:S.movs,cfg:S.cfg,cola:S.cola,url:S.url,sinc:S.sinc}));}catch(e){}}
function cargar(){
  var c=null;try{c=JSON.parse(localStorage.getItem(K)||"null");}catch(e){}
  if(c&&Array.isArray(c.sobres)){
    S.sobres=limpiaSobres(c.sobres);S.movs=limpiaMovs(c.movs);S.cola=Array.isArray(c.cola)?c.cola:[];
    S.url=typeof c.url==="string"?c.url:"";S.sinc=+c.sinc||0;
    if(c.cfg)S.cfg={inicio:typeof c.cfg.inicio==="number"?c.cfg.inicio:ahora(),cobro:typeof c.cfg.cobro==="number"?c.cfg.cobro:425};
  }else{
    var n=ahora();S.cfg={inicio:n,cobro:425};
    S.sobres=[["comida","Comida","gasto",100],["transporte","Transporte","gasto",75],["para-mi","Para mí","gasto",100],["ahorro-intocable","Ahorro intocable","ahorro",100],["ahorro-material","Ahorro material","ahorro",50]]
      .map(function(x,i){return {id:x[0],nombre:x[1],tipo:x[2],orden:i+1,cambios:[{c:n,m:x[3]}]};});
    grabar();
  }
}

/* ---------- cambios: se aplican aquí al instante y se ponen en cola para la hoja ---------- */
function aplicar(op){
  if(op.t==="add"){if(!S.movs.some(function(m){return m.id===op.mov.id;}))S.movs.push(op.mov);}
  else if(op.t==="del"){S.movs=S.movs.filter(function(m){return m.id!==op.id;});}
  else if(op.t==="sobres"){S.sobres=limpiaSobres(op.sobres);}
  else if(op.t==="cfg"){S.cfg={inicio:op.cfg.inicio,cobro:op.cfg.cobro};}
}
function hacer(op){op.oid=uid("o");aplicar(op);S.cola.push(op);grabar();pintar();subir();}
function subir(){
  if(!S.url||S.subiendo)return;
  if(navigator.onLine===false){aviso();return;}
  S.subiendo=true;aviso();
  var envio=S.cola.slice(),cuerpo={ops:envio,init:S.sinc?null:{sobres:S.sobres,cfg:S.cfg}};
  var ctl=typeof AbortController==="function"?new AbortController():null,t=setTimeout(function(){if(ctl)ctl.abort();},20000),bien=false;
  fetch(S.url,{method:"POST",body:JSON.stringify(cuerpo),redirect:"follow",signal:ctl?ctl.signal:undefined})
    .then(function(r){return r.json();})
    .then(function(d){
      if(!d||!d.ok)throw new Error("respuesta");
      var ids={};envio.forEach(function(o){ids[o.oid]=1;});
      S.cola=S.cola.filter(function(o){return !ids[o.oid];});
      var ss=limpiaSobres(d.sobres);if(ss.length)S.sobres=ss;
      S.movs=limpiaMovs(d.movs);
      if(d.cfg&&typeof d.cfg.inicio==="number")S.cfg={inicio:d.cfg.inicio,cobro:typeof d.cfg.cobro==="number"?d.cfg.cobro:S.cfg.cobro};
      S.cola.forEach(aplicar);
      S.sinc=Date.now();S.fallo=false;bien=true;grabar();pintar();
    })
    .catch(function(){S.fallo=true;})
    .then(function(){clearTimeout(t);S.subiendo=false;aviso();if(bien&&S.cola.length)subir();});
}
function aviso(){
  var n=S.cola.length,t="";
  if(!S.url)t="Guardando solo en este dispositivo. Para guardar también en Drive, pulsa «Ajustar sobres» y pega la dirección de tu hoja.";
  else if(S.subiendo)t=n?"Subiendo "+n+(n===1?" cambio":" cambios")+" a tu hoja…":"Actualizando…";
  else if(n)t="Sin conexión con la hoja. "+n+(n===1?" cambio guardado aquí; se subirá solo.":" cambios guardados aquí; se subirán solos.");
  else if(S.fallo)t="Sin conexión con la hoja. Ves lo último guardado en este dispositivo.";
  $("status").textContent=t;
}

/* ---------- cálculo ---------- */
function primero(){var c=typeof S.cfg.inicio==="number"?S.cfg.inicio:ahora();return Math.min(c,ahora());}
function mensualEn(s,idx){var c=(s.cambios||[]).slice().sort(function(a,b){return a.c-b.c;});if(!c.length)return 0;var v=c[0].m;for(var i=0;i<c.length;i++){if(c[i].c<=idx)v=c[i].m;}return v;}
function calc(s){
  var now=ahora(),ini=primero(),asig=0,i;
  for(i=ini;i<=now;i++)asig+=mensualEn(s,i);
  var gC=0,iC=0,gT=0,iT=0;
  S.movs.forEach(function(m){if(m.sobre!==s.id)return;var k=idxDe(m.fecha);if(k<ini)return;
    if(m.tipo==="ingreso"){iT+=m.importe;if(k===now)iC+=m.importe;}else{gT+=m.importe;if(k===now)gC+=m.importe;}});
  var mes=mensualEn(s,now),disp=mes+iC,queda=disp-gC,total=asig+iT-gT;
  return {mes:mes,disp:disp,gastado:gC,queda:queda,total:total,colchon:total-queda};
}
function porTipo(t){return S.sobres.filter(function(s){return s.tipo===t;});}
function nombreSobre(id){for(var i=0;i<S.sobres.length;i++)if(S.sobres[i].id===id)return S.sobres[i].nombre;return "Sobre borrado";}

/* ---------- pintar ---------- */
function el(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e;}
function pintar(){
  var gasto=porTipo("gasto"),ahorro=porTipo("ahorro"),tot=0,tAh=0;
  var lg=$("lGasto");lg.textContent="";
  if(!S.sobres.length)lg.appendChild(el("div","card","Todavía no hay sobres. Pulsa «Ajustar sobres» para crear el primero."));
  gasto.forEach(function(s){
    var c=calc(s);tot+=c.queda;
    var card=el("div","card"),r=el("div","row");
    r.appendChild(el("span","name",s.nombre));
    r.appendChild(el("span","amt num"+(c.queda<0?" neg":""),eur.format(c.queda)));card.appendChild(r);
    var frac=c.disp>0?Math.max(0,Math.min(1,c.queda/c.disp)):0;
    var st=c.queda<0?"over":(frac<0.25?"low":"");
    var bar=el("div","bar "+st),fill=el("i");fill.style.width=(c.queda<0?100:frac*100)+"%";bar.appendChild(fill);card.appendChild(bar);
    var meta=el("div","meta");
    meta.appendChild(el("span","num","Gastado "+eur.format(c.gastado)+" de "+eur.format(c.disp)));
    var right=el("span","num");
    if(st==="over")right.appendChild(el("span","pill over","Te pasaste "+eur.format(-c.queda)));
    else if(st==="low")right.appendChild(el("span","pill low","Queda poco"));
    meta.appendChild(right);card.appendChild(meta);
    var m2=el("div","meta");m2.appendChild(el("span","num"+(c.colchon<0?" neg":""),"Colchón de meses anteriores: "+eur.format(c.colchon)));card.appendChild(m2);
    lg.appendChild(card);
  });
  var la=$("lAhorro");la.textContent="";
  ahorro.forEach(function(s){
    var c=calc(s);tAh+=c.total;
    var card=el("div","card");card.appendChild(el("span","name",s.nombre));
    card.appendChild(el("span","amt num"+(c.total<0?" neg":""),eur.format(c.total)));
    card.appendChild(el("span","meta num","+"+eur.format(c.mes)+" al mes"));
    la.appendChild(card);
  });
  $("tTotal").textContent=eur.format(tot);
  var prox=inicioDe(ahora()+1),d=diasHasta(prox);
  $("tCobro").textContent="Cobras el "+corto(prox)+(d===0?" (hoy)":d===1?" (mañana)":" (en "+d+" días)");
  $("tAhorro").textContent="Ahorrado: "+eur.format(tAh);
  pintarFiltros();pintarMovs();aviso();
}
function pintarFiltros(){
  var fc=$("fCiclo"),now=ahora(),ini=primero(),prev=S.ciclo==null?now:S.ciclo;
  fc.textContent="";
  for(var i=now;i>=ini;i--){var o=el("option",null,(i===now?"Este mes · ":"")+corto(inicioDe(i))+" – "+corto(antes(inicioDe(i+1))));o.value=i;fc.appendChild(o);}
  var all=el("option",null,"Todo");all.value="todo";fc.appendChild(all);
  fc.value=String(prev);if(fc.value!==String(prev))fc.value=String(now);
  var fs=$("fSobre"),ps=fs.value;fs.textContent="";
  var t=el("option",null,"Todos los sobres");t.value="";fs.appendChild(t);
  S.sobres.forEach(function(s){var o=el("option",null,s.nombre);o.value=s.id;fs.appendChild(o);});
  fs.value=ps;if(fs.value!==ps)fs.value="";
}
function pintarMovs(){
  var fc=$("fCiclo").value,fs=$("fSobre").value,box=$("lMovs");box.textContent="";
  var lista=S.movs.filter(function(m){return (fc==="todo"||idxDe(m.fecha)===+fc)&&(!fs||m.sobre===fs);});
  lista.sort(function(a,b){return a.fecha===b.fecha?(b.ts||0)-(a.ts||0):(a.fecha<b.fecha?1:-1);});
  var g=0,i=0;lista.forEach(function(m){if(m.tipo==="ingreso")i+=m.importe;else g+=m.importe;});
  var r=$("resumen");r.textContent="";
  r.appendChild(el("span","num","Gastado: "+eur.format(g)));r.appendChild(el("span","num","Dinero añadido: "+eur.format(i)));
  if(!lista.length){box.appendChild(el("div","empty","No hay movimientos aquí. Pulsa «Apuntar gasto» cuando gastes algo."));return;}
  lista.forEach(function(m){
    var row=el("div","mov"),w=el("div","what");
    w.appendChild(el("b",null,m.nota||(m.tipo==="ingreso"?"Dinero añadido":"Gasto")));
    w.appendChild(el("span",null,corto(m.fecha)+" · "+nombreSobre(m.sobre)));
    row.appendChild(w);
    row.appendChild(el("span","q num "+(m.tipo==="ingreso"?"pos":""),(m.tipo==="ingreso"?"+":"−")+eur.format(m.importe)));
    var b=el("button","btn small"+(S.confirm===m.id?" danger":""),S.confirm===m.id?"¿Seguro?":"Borrar");b.type="button";
    b.addEventListener("click",function(){borrar(m.id);});
    row.appendChild(b);box.appendChild(row);
  });
}
function toast(t){var x=$("toast");x.textContent=t;x.classList.add("on");clearTimeout(toast.t);toast.t=setTimeout(function(){x.classList.remove("on");},2200);}
function cerrar(id){$(id).classList.remove("on");}

/* ---------- apuntar ---------- */
function abrirMov(tipo){
  if(!S.sobres.length){abrirAj();return;}
  S.tipo=tipo;
  $("movTitulo").textContent=tipo==="gasto"?"Apuntar gasto":"Añadir dinero";
  $("movSobreLab").textContent=tipo==="gasto"?"¿De qué sobre?":"¿A qué sobre va?";
  $("fImporte").value="";$("fNota").value="";$("fFecha").value=hoyStr();$("movErr").textContent="";
  var ch=$("fChips");ch.textContent="";
  var orden=porTipo("gasto").concat(porTipo("ahorro"));
  var marcado=S.ultimo&&orden.some(function(s){return s.id===S.ultimo;})?S.ultimo:null;
  orden.forEach(function(s,i){
    var l=el("label"),inp=el("input");inp.type="radio";inp.name="sobre";inp.value=s.id;inp.id="chip"+i;
    if(s.id===marcado)inp.checked=true;
    l.appendChild(inp);l.appendChild(el("span",null,s.nombre));ch.appendChild(l);
  });
  $("vMov").classList.add("on");setTimeout(function(){$("fImporte").focus();},50);
}
function guardarMov(ev){
  ev.preventDefault();
  var imp=num($("fImporte").value),sel=document.querySelector('input[name="sobre"]:checked'),f=$("fFecha").value||hoyStr();
  if(!(imp>0)){$("movErr").textContent="Escribe un importe mayor que 0.";return;}
  if(!sel){$("movErr").textContent="Elige un sobre.";return;}
  S.ultimo=sel.value;cerrar("vMov");
  hacer({t:"add",mov:{id:uid("m"),tipo:S.tipo,importe:imp,sobre:sel.value,sobreNombre:nombreSobre(sel.value),nota:$("fNota").value.trim(),fecha:f,ts:Date.now()}});
  toast(S.tipo==="gasto"?"Gasto apuntado":"Dinero añadido");
}
function borrar(id){
  if(S.confirm!==id){S.confirm=id;pintarMovs();setTimeout(function(){if(S.confirm===id){S.confirm=null;pintarMovs();}},4000);return;}
  S.confirm=null;
  var pend=S.cola.filter(function(o){return o.t==="add"&&o.mov.id===id;}).length>0;
  if(pend&&!S.subiendo){S.cola=S.cola.filter(function(o){return !(o.t==="add"&&o.mov.id===id);});S.movs=S.movs.filter(function(m){return m.id!==id;});grabar();pintar();}
  else hacer({t:"del",id:id});
  toast("Movimiento borrado");
}

/* ---------- ajustes ---------- */
function abrirAj(){
  $("ajErr").textContent="";$("nNombre").value="";$("nMensual").value="";
  $("aCobro").value=String(S.cfg.cobro).replace(".",",");
  $("aUrl").value=S.url;
  $("aUrlEstado").textContent=S.url?(S.sinc?"Conectada. Última subida: "+new Date(S.sinc).toLocaleString("es-ES"):"Aún no se ha podido conectar."):"Sin conectar: los datos solo están en este dispositivo.";
  var box=$("aLista");box.textContent="";
  porTipo("gasto").concat(porTipo("ahorro")).forEach(function(s,i){
    var r=el("div","srow"),n=el("input"),m=el("input");
    n.type="text";n.value=s.nombre;n.maxLength=30;n.id="an"+i;n.setAttribute("aria-label","Nombre");n.dataset.id=s.id;n.className="an";
    m.type="text";m.inputMode="decimal";m.value=String(mensualEn(s,ahora())).replace(".",",");m.id="am"+i;m.setAttribute("aria-label","Euros al mes de "+s.nombre);m.dataset.id=s.id;m.className="am";
    m.addEventListener("input",suma);
    r.appendChild(n);r.appendChild(m);box.appendChild(r);
  });
  suma();$("vAj").classList.add("on");
}
function suma(){
  var t=0;Array.prototype.forEach.call(document.querySelectorAll(".am"),function(i){var v=num(i.value);if(v>0)t+=v;});
  var n=num($("nMensual").value);if(n>0)t+=n;
  var c=num($("aCobro").value),txt="Repartido: "+eur.format(t);
  if(c>0){var d=Math.round((c-t)*100)/100;txt+=d===0?" · cuadra con lo que cobras":d>0?" · te quedan "+eur.format(d)+" sin repartir":" · te pasas "+eur.format(-d);}
  $("aSuma").textContent=txt;
}
function guardarAj(ev){
  ev.preventDefault();
  var now=ahora(),err="",cambio=false;
  var nuevos=S.sobres.map(function(s){
    var n=document.querySelector('.an[data-id="'+s.id+'"]'),m=document.querySelector('.am[data-id="'+s.id+'"]');
    var c={id:s.id,nombre:s.nombre,tipo:s.tipo,orden:s.orden,cambios:s.cambios.map(function(x){return {c:x.c,m:x.m};})};
    if(!n||!m)return c;
    var nombre=n.value.trim(),v=num(m.value);
    if(!nombre||!(v>=0)){err="Revisa el nombre y los euros de cada sobre.";return c;}
    if(nombre!==s.nombre){c.nombre=nombre;cambio=true;}
    if(v!==mensualEn(s,now)){c.cambios=c.cambios.filter(function(x){return x.c!==now;});c.cambios.push({c:now,m:v});cambio=true;}
    return c;
  });
  var nn=$("nNombre").value.trim(),nm=num($("nMensual").value);
  if(nn){if(!(nm>=0))err="Pon los euros al mes del sobre nuevo.";else{nuevos.push({id:uid("s"),nombre:nn,tipo:$("nTipo").value,orden:Date.now(),cambios:[{c:now,m:nm}]});cambio=true;}}
  var cobro=num($("aCobro").value);
  if(!(cobro>=0))err="Revisa lo que cobras al mes.";
  var url=$("aUrl").value.trim();
  if(url&&!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url))err="La dirección de la hoja debe empezar por https://script.google.com/macros/s/ y terminar en /exec.";
  if(err){$("ajErr").textContent=err;return;}
  cerrar("vAj");
  if(url!==S.url){S.url=url;S.sinc=0;S.fallo=false;grabar();}
  if(cambio)hacer({t:"sobres",sobres:nuevos});
  if(cobro!==S.cfg.cobro)hacer({t:"cfg",cfg:{inicio:primero(),cobro:cobro}});
  toast("Guardado");pintar();subir();
}

/* ---------- eventos ---------- */
$("bGasto").addEventListener("click",function(){abrirMov("gasto");});
$("bIngreso").addEventListener("click",function(){abrirMov("ingreso");});
$("bAjustes").addEventListener("click",abrirAj);
$("movCancel").addEventListener("click",function(){cerrar("vMov");});
$("ajCancel").addEventListener("click",function(){cerrar("vAj");});
$("formMov").addEventListener("submit",guardarMov);
$("formAj").addEventListener("submit",guardarAj);
$("aCobro").addEventListener("input",suma);$("nMensual").addEventListener("input",suma);
$("fCiclo").addEventListener("change",function(){S.ciclo=this.value==="todo"?"todo":+this.value;pintarMovs();});
$("fSobre").addEventListener("change",pintarMovs);
["vMov","vAj"].forEach(function(id){$(id).addEventListener("click",function(e){if(e.target===this)cerrar(id);});});
document.addEventListener("keydown",function(e){if(e.key==="Escape"){cerrar("vMov");cerrar("vAj");}});
window.addEventListener("online",subir);
document.addEventListener("visibilitychange",function(){if(!document.hidden){pintar();subir();}});
setInterval(function(){if(S.cola.length)subir();},30000);

/* ---------- arranque ---------- */
cargar();pintar();subir();
if("serviceWorker" in navigator){window.addEventListener("load",function(){navigator.serviceWorker.register("sw.js").catch(function(){});});}
})();
