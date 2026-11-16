(function(){
"use strict";
var $=function(id){return document.getElementById(id);};
var eur=new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"});
var MES=["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
var COLORES=[["c1","Azul"],["c2","Naranja"],["c3","Aguamarina"],["c4","Amarillo"],["c5","Rosa"],["c6","Verde"],["c7","Violeta"],["c8","Rojo"]];
var K="mis-sobres-app-v1",KT="mis-sobres-tema";
var S={sobres:[],movs:[],cfg:{inicio:null,cobro:425,rapidos:[]},cola:[],url:"",sinc:0,
       tipo:"gasto",ultimo:null,ciclo:null,confirm:null,subiendo:false,fallo:false,
       imp:{mov:"",tr:"",sal:""},editando:null,fijosHechos:[],fijEdit:[],parteTocada:false,salPersona:"",trModo:"mover",trSobre:null,rapEdit:[]};

/* ---------- fechas: el mes empieza el antepenúltimo día ---------- */
function pad(n){return n<10?"0"+n:""+n;}
function hoyStr(){var d=new Date();return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());}
function diaCobro(y,m){return new Date(y,m+1,0).getDate()-2;}
function idxDe(str){var p=str.split("-"),y=+p[0],m=+p[1]-1,d=+p[2];return y*12+m-(d>=diaCobro(y,m)?0:1);}
function inicioDe(idx){var y=Math.floor(idx/12),m=idx%12;return y+"-"+pad(m+1)+"-"+pad(diaCobro(y,m));}
function corto(str){var p=str.split("-");return (+p[2])+" "+MES[+p[1]-1];}
function antes(str){var p=str.split("-"),d=new Date(+p[0],+p[1]-1,+p[2]-1);return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());}
function diasHasta(str){var p=str.split("-"),a=new Date(+p[0],+p[1]-1,+p[2]),h=new Date();h=new Date(h.getFullYear(),h.getMonth(),h.getDate());return Math.round((a-h)/864e5);}
function mesCorto(idx){var p=inicioDe(idx+1).split("-");return MES[+p[1]-1];}
function num(v){var n=parseFloat(String(v==null?"":v).replace(/\s|€/g,"").replace(",","."));return isFinite(n)?Math.round(n*100)/100:NaN;}
function r2(n){return Math.round(n*100)/100;}
function uid(p){return p+Date.now().toString(36)+Math.random().toString(36).slice(2,8);}
function ahora(){return idxDe(hoyStr());}
function color(s){return "var(--"+(s&&s.color?s.color:"c1")+")";}

/* ---------- limpieza de datos ---------- */
function limpiaSobres(l){
  var out=(Array.isArray(l)?l:[]).filter(function(x){return x&&x.id;}).map(function(x){return {
    id:String(x.id),nombre:String(x.nombre||"Sobre"),tipo:["ahorro","viaje","cerrado"].indexOf(x.tipo)>=0?x.tipo:"gasto",orden:+x.orden||0,
    cambios:(Array.isArray(x.cambios)?x.cambios:[]).filter(function(c){return c&&typeof c.c==="number"&&typeof c.m==="number";}).map(function(c){return {c:c.c,m:c.m};}),
    color:/^c[1-8]$/.test(x.color)?x.color:"",meta:+x.meta>0?+x.meta:0,metaNombre:String(x.metaNombre||""),
    etiquetas:(Array.isArray(x.etiquetas)?x.etiquetas:[]).map(String).filter(Boolean).slice(0,12)};}).sort(function(a,b){return a.orden-b.orden;});
  out.forEach(function(s,i){if(!s.color)s.color=COLORES[i%8][0];});
  return out;
}
function limpiaMovs(l){return (Array.isArray(l)?l:[]).filter(function(x){return x&&x.id;}).map(function(x){
  var t=["gasto","ingreso","traspaso","colchon","saldo"].indexOf(x.tipo)>=0?x.tipo:"gasto";
  return {id:String(x.id),tipo:t,importe:+x.importe||0,sobre:String(x.sobre||""),destino:String(x.destino||""),nota:String(x.nota||""),etiqueta:String(x.etiqueta||""),
    fecha:/^\d{4}-\d{2}-\d{2}$/.test(x.fecha)?x.fecha:hoyStr(),ts:+x.ts||0,extra:x.extra&&typeof x.extra==="object"&&!Array.isArray(x.extra)?x.extra:{}};});}
function limpiaRapidos(l){return (Array.isArray(l)?l:[]).filter(function(x){return x&&x.nombre&&+x.importe>0&&x.sobre;}).map(function(x){return {id:String(x.id||uid("r")),nombre:String(x.nombre),importe:r2(+x.importe),sobre:String(x.sobre),etiqueta:String(x.etiqueta||"")};}).slice(0,12);}
function limpiaFijos(l){return (Array.isArray(l)?l:[]).filter(function(x){return x&&x.nombre&&+x.importe>0&&x.sobre&&+x.dia>=1&&+x.dia<=31;}).map(function(x){return {id:String(x.id||uid("f")),nombre:String(x.nombre),importe:r2(+x.importe),sobre:String(x.sobre),dia:Math.round(+x.dia)};}).slice(0,20);}
function limpiaCfg(c,prev){prev=prev||S.cfg;c=c||{};return {inicio:typeof c.inicio==="number"?c.inicio:prev.inicio,cobro:typeof c.cobro==="number"?c.cobro:prev.cobro,
  rapidos:Array.isArray(c.rapidos)?limpiaRapidos(c.rapidos):(prev.rapidos||[]),fijos:Array.isArray(c.fijos)?limpiaFijos(c.fijos):(prev.fijos||[])};}

/* ---------- guardar en el dispositivo ---------- */
function grabar(){try{localStorage.setItem(K,JSON.stringify({sobres:S.sobres,movs:S.movs,cfg:S.cfg,cola:S.cola,url:S.url,sinc:S.sinc,ultimo:S.ultimo,fijosHechos:S.fijosHechos}));}catch(e){}}
function cargar(){
  var c=null;try{c=JSON.parse(localStorage.getItem(K)||"null");}catch(e){}
  if(c&&Array.isArray(c.sobres)){
    S.sobres=limpiaSobres(c.sobres);S.movs=limpiaMovs(c.movs);S.cola=Array.isArray(c.cola)?c.cola:[];
    S.url=typeof c.url==="string"?c.url:"";S.sinc=+c.sinc||0;S.ultimo=c.ultimo||null;
    S.cfg=limpiaCfg(c.cfg,{inicio:ahora(),cobro:425,rapidos:[],fijos:[]});S.fijosHechos=Array.isArray(c.fijosHechos)?c.fijosHechos.slice(-200):[];
  }else{
    var n=ahora();S.cfg={inicio:n,cobro:425,rapidos:[],fijos:[]};
    S.sobres=limpiaSobres([["comida","Comida","gasto",100],["transporte","Transporte","gasto",75],["para-mi","Para mí","gasto",100],["ahorro-intocable","Ahorro intocable","ahorro",100],["ahorro-material","Ahorro material","ahorro",50]]
      .map(function(x,i){return {id:x[0],nombre:x[1],tipo:x[2],orden:i+1,cambios:[{c:n,m:x[3]}]};}));
    grabar();
  }
}

/* ---------- cambios: se aplican aquí al instante y se ponen en cola para la hoja ---------- */
function aplicar(op){
  if(op.t==="add"){if(!S.movs.some(function(m){return m.id===op.mov.id;}))S.movs.push(limpiaMovs([op.mov])[0]);}
  else if(op.t==="del"){S.movs=S.movs.filter(function(m){return m.id!==op.id;});}
  else if(op.t==="sobres"){S.sobres=limpiaSobres(op.sobres);}
  else if(op.t==="cfg"){S.cfg=limpiaCfg(op.cfg);}
}
function hacer(op){hacerVarios([op]);}
function hacerVarios(ops){ops.forEach(function(op){op.oid=uid("o");aplicar(op);S.cola.push(op);});grabar();pintar();subir();}
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
      if(d.cfg&&typeof d.cfg.inicio==="number")S.cfg=limpiaCfg(d.cfg);
      S.cola.forEach(aplicar);
      S.sinc=Date.now();S.fallo=false;bien=true;grabar();pintar();aplicarFijos();
    })
    .catch(function(){S.fallo=true;})
    .then(function(){clearTimeout(t);S.subiendo=false;aviso();if(bien&&S.cola.length)subir();});
}
function aviso(){
  var n=S.cola.length,t="";
  if(!S.url)t="Guardando solo en este dispositivo. Para guardar también en Drive, pulsa «Ajustar sobres» y pega la dirección de tu hoja.";
  else if(S.subiendo)t=n?"Subiendo "+n+(n===1?" cambio":" cambios")+" a tu hoja…":"";
  else if(n)t="Sin conexión con la hoja. "+n+(n===1?" cambio guardado aquí; se subirá solo.":" cambios guardados aquí; se subirán solos.");
  else if(S.fallo)t="Sin conexión con la hoja. Ves lo último guardado en este dispositivo.";
  $("status").textContent=t;
}

/* ---------- cálculo ---------- */
function primero(){var c=typeof S.cfg.inicio==="number"?S.cfg.inicio:ahora();return Math.min(c,ahora());}
function mensualEn(s,idx){var c=(s.cambios||[]).slice().sort(function(a,b){return a.c-b.c;});if(!c.length)return 0;var v=c[0].m;for(var i=0;i<c.length;i++){if(c[i].c<=idx)v=c[i].m;}return v;}
/* Datos de un sobre en el mes k: asignado, gastado, añadido, movido y colchón usado. */
function delMes(s,k){
  var r={asig:k>=primero()?mensualEn(s,k):0,g:0,i:0,tin:0,tout:0,c:0};
  S.movs.forEach(function(m){
    if(idxDe(m.fecha)!==k)return;
    if(m.tipo==="traspaso"){if(m.sobre===s.id)r.tout+=m.importe;if(m.destino===s.id)r.tin+=m.importe;return;}
    if(m.sobre!==s.id)return;
    if(m.tipo==="gasto")r.g+=m.importe;else if(m.tipo==="ingreso")r.i+=m.importe;else if(m.tipo==="colchon")r.c+=m.importe;
  });
  r.disp=r.asig+r.i+r.tin-r.tout+r.c;r.queda=r.disp-r.g;
  return r;
}
function calc(s){
  var now=ahora(),ini=primero(),total=0,cur=null;
  for(var k=ini;k<=now;k++){var d=delMes(s,k);total+=d.asig+d.i+d.tin-d.tout-d.g;if(k===now)cur=d;}
  return {mes:cur.asig,disp:cur.disp,gastado:cur.g,queda:cur.queda,total:total,colchon:total-cur.queda};
}
function porTipo(t){return S.sobres.filter(function(s){return s.tipo===t;});}
function sobrePorId(id){for(var i=0;i<S.sobres.length;i++)if(S.sobres[i].id===id)return S.sobres[i];return null;}
function nombreSobre(id){var s=sobrePorId(id);return s?s.nombre:"Sobre borrado";}
/* Cuentas con amigos: + te debe, − le debes. Solo tu parte cuenta como gasto en los sobres. */
function clavePersona(n){return String(n||"").trim().toLowerCase();}
function cuentas(){
  var map={};
  S.movs.forEach(function(m){
    var e=m.extra||{},p=null,d=0;
    var lista=[];
    if(m.tipo==="gasto"&&e.comp&&e.comp.persona){
      var ps=Array.isArray(e.comp.personas)&&e.comp.personas.length?e.comp.personas:[e.comp.persona];
      if(e.comp.pago==="yo"){d=((+e.comp.total||0)-m.importe)/ps.length;ps.forEach(function(x){lista.push([x,d]);});}
      else lista.push([e.comp.persona,-m.importe]);
    }
    else if(m.tipo==="saldo"&&e.persona)lista.push([e.persona,e.dir==="pago"?m.importe:-m.importe]);
    else return;
    lista.forEach(function(it){
      var k=clavePersona(it[0]);if(!k)return;
      if(!map[k])map[k]={nombre:String(it[0]).trim(),saldo:0};
      map[k].saldo+=it[1];
    });
  });
  return Object.keys(map).map(function(k){var x=map[k];x.saldo=r2(x.saldo);return x;}).sort(function(a,b){return Math.abs(b.saldo)-Math.abs(a.saldo);});
}
/* Gastos fijos: se apuntan solos en el mes actual cuando llega su día. */
function fechaFijo(k,dia){
  var p=inicioDe(k).split("-"),y=+p[0],m=+p[1]-1,d0=+p[2];
  if(dia<d0){m++;if(m>11){m=0;y++;}}
  var ult=new Date(y,m+1,0).getDate();
  return y+"-"+pad(m+1)+"-"+pad(Math.min(dia,ult));
}
function aplicarFijos(){
  var k=ahora(),hoy=hoyStr(),ops=[];
  if(k<primero())return;
  (S.cfg.fijos||[]).forEach(function(f){
    if(!sobrePorId(f.sobre))return;
    var fe=fechaFijo(k,f.dia),id="fijo-"+f.id+"-"+k;
    if(fe>hoy||S.fijosHechos.indexOf(id)>=0||S.movs.some(function(m){return m.id===id;}))return;
    S.fijosHechos.push(id);
    ops.push({t:"add",mov:{id:id,tipo:"gasto",importe:f.importe,sobre:f.sobre,sobreNombre:nombreSobre(f.sobre),nota:f.nombre,etiqueta:"",fecha:fe,ts:Date.now(),extra:{fijo:f.id}}});
  });
  if(ops.length){hacerVarios(ops);toast(ops.length===1?"Gasto fijo apuntado: "+ops[0].mov.nota:ops.length+" gastos fijos apuntados");}
}
function diasRestantes(){return Math.max(1,diasHasta(inicioDe(ahora()+1)));}

/* ---------- pintar ---------- */
function el(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e;}
function pintar(){
  var gasto=porTipo("gasto"),ahorro=porTipo("ahorro"),tot=0,tAh=0,dias=diasRestantes();
  var lg=$("lGasto");lg.textContent="";
  if(!S.sobres.length)lg.appendChild(el("div","card","Todavía no hay sobres. Pulsa «Ajustar sobres» para crear el primero."));
  gasto.forEach(function(s){
    var c=calc(s);tot+=c.queda;
    var card=el("div","card sobre");card.style.borderLeftColor=color(s);
    var r=el("div","row");
    r.appendChild(el("span","name",s.nombre));
    r.appendChild(el("span","amt num"+(c.queda<0?" neg":""),eur.format(c.queda)));card.appendChild(r);
    var frac=c.disp>0?Math.max(0,Math.min(1,c.queda/c.disp)):0;
    var st=c.queda<0?"over":(frac<0.25?"low":"");
    var bar=el("div","bar "+st),fill=el("i");fill.style.width=(c.queda<0?100:frac*100)+"%";bar.appendChild(fill);card.appendChild(bar);
    var meta=el("div","meta");
    meta.appendChild(el("span","num","Gastado "+eur.format(c.gastado)+" de "+eur.format(c.disp)));
    if(st==="over")meta.appendChild(el("span","pill over","Te pasaste "+eur.format(-c.queda)));
    else if(st==="low")meta.appendChild(el("span","pill low","Queda poco"));
    card.appendChild(meta);
    if(c.queda>0)card.appendChild(el("div","meta num","Puedes gastar ≈ "+eur.format(r2(c.queda/dias))+" al día"));
    var m2=el("div","meta");
    m2.appendChild(el("span","num"+(c.colchon<0?" neg":""),"Colchón: "+eur.format(c.colchon)));
    if(c.colchon>=0.01){
      var bc=el("button","btn small","Usar colchón");bc.type="button";
      bc.addEventListener("click",function(){abrirTr("colchon",s.id);});m2.appendChild(bc);
    }
    card.appendChild(m2);
    lg.appendChild(card);
  });
  pintarViajes();
  var la=$("lAhorro");la.textContent="";
  ahorro.forEach(function(s){
    var c=calc(s);tAh+=c.total;
    var card=el("div","card sobre");card.style.borderLeftColor=color(s);
    card.appendChild(el("span","name",s.nombre));
    card.appendChild(el("span","amt num"+(c.total<0?" neg":""),eur.format(c.total)));
    if(s.meta>0){
      var f=Math.max(0,Math.min(1,c.total/s.meta));
      var bar=el("div","bar meta"),fill=el("i");fill.style.width=(f*100)+"%";bar.appendChild(fill);card.appendChild(bar);
      card.appendChild(el("span","meta num",(s.metaNombre?s.metaNombre+": ":"Meta: ")+Math.round(f*100)+" % de "+eur.format(s.meta)));
    }
    card.appendChild(el("span","meta num","+"+eur.format(c.mes)+" al mes"));
    la.appendChild(card);
  });
  $("tTotal").textContent=eur.format(tot);
  var prox=inicioDe(ahora()+1),d=diasHasta(prox);
  $("tCobro").textContent="Cobras el "+corto(prox)+(d===0?" (hoy)":d===1?" (mañana)":" (en "+d+" días)");
  $("tDia").textContent=tot>0?"≈ "+eur.format(r2(tot/dias))+" al día":"";
  $("tAhorro").textContent="Ahorrado: "+eur.format(tAh);
  var cs=cuentas(),neto=r2(cs.reduce(function(a,c){return a+c.saldo;},0));
  $("tDeuda").textContent=neto<0?"Debes a amigos: "+eur.format(-neto):neto>0?"Te deben: "+eur.format(neto):"";
  pintarCuentas(cs,neto);
  pintarRapidos();pintarFiltros();pintarResumen();pintarMovs();aviso();
}
function pintarViajes(){
  var vs=porTipo("viaje"),box=$("lViajes");box.textContent="";$("secViajes").hidden=!vs.length;
  vs.forEach(function(s){
    var c=calc(s),gast=0;S.movs.forEach(function(m){if(m.tipo==="gasto"&&m.sobre===s.id)gast+=m.importe;});
    var card=el("div","card sobre viaje");card.style.borderLeftColor=color(s);
    var r=el("div","row");r.appendChild(el("span","name",s.nombre));r.appendChild(el("span","amt num"+(c.total<0?" neg":""),eur.format(c.total)));card.appendChild(r);
    if(s.meta>0){
      var f=Math.max(0,Math.min(1,gast/s.meta)),st=gast>s.meta?"over":f>0.75?"low":"";
      var bar=el("div","bar "+st),fill=el("i");fill.style.width=(f*100)+"%";bar.appendChild(fill);card.appendChild(bar);
      card.appendChild(el("div","meta num","Gastado "+eur.format(gast)+" de "+eur.format(s.meta)+" de presupuesto"));
    }else card.appendChild(el("div","meta num","Gastado "+eur.format(gast)));
    if(/^\d{4}-\d{2}-\d{2}$/.test(s.metaNombre)){var dd=diasHasta(s.metaNombre);card.appendChild(el("div","meta",dd>=0?"Hasta el "+corto(s.metaNombre)+(dd===0?" (hoy)":" (en "+dd+" días)"):"Terminó el "+corto(s.metaNombre)+": ciérralo para devolver lo que sobre"));}
    var acts=el("div","meta"),b1=el("button","btn small","Meter dinero"),b2=el("button","btn small","Cerrar viaje");
    b1.type="button";b2.type="button";
    b1.addEventListener("click",function(){abrirTr("mover",null,s.id);});
    b2.addEventListener("click",function(){abrirTr("cerrar",s.id);});
    acts.appendChild(b1);acts.appendChild(b2);card.appendChild(acts);
    box.appendChild(card);
  });
}
function pintarCuentas(cs,neto){
  var sec=$("secCuentas"),box=$("lCuentas");box.textContent="";
  cs=cs.filter(function(c){return c.saldo!==0;});
  sec.hidden=!cs.length;
  $("cuentasTotal").textContent=neto<0?"En total debes "+eur.format(-neto):neto>0?"En total te deben "+eur.format(neto):"Todo cuadrado";
  cs.forEach(function(c){
    var card=el("div","card"),r=el("div","persona"),izq=el("div");
    izq.appendChild(el("div","quien",c.nombre));
    izq.appendChild(el("div","note",c.saldo<0?"Le debes":c.saldo>0?"Te debe":"Estáis en paz"));
    r.appendChild(izq);
    var der=el("div","persona");
    der.appendChild(el("span","cuanto num"+(c.saldo<0?" neg":c.saldo>0?" pos":""),eur.format(Math.abs(c.saldo))));
    if(c.saldo!==0){var b=el("button","btn small","Saldar");b.type="button";b.setAttribute("aria-label","Saldar cuentas con "+c.nombre);b.addEventListener("click",function(){abrirSal(c);});der.appendChild(b);}
    r.appendChild(der);card.appendChild(r);box.appendChild(card);
  });
}
function pintarRapidos(){
  var box=$("lRapidos");box.textContent="";
  S.cfg.rapidos.forEach(function(r){
    var s=sobrePorId(r.sobre);if(!s)return;
    var b=el("button","rap");b.type="button";
    var dt=el("span","dot");dt.style.background=color(s);b.appendChild(dt);
    b.appendChild(el("span",null,r.nombre));b.appendChild(el("b","num",eur.format(r.importe)));
    b.setAttribute("aria-label","Apuntar "+r.nombre+", "+eur.format(r.importe)+", sobre "+s.nombre);
    b.addEventListener("click",function(){S.editando=null;apuntar({tipo:"gasto",importe:r.importe,sobre:r.sobre,nota:r.nombre,etiqueta:r.etiqueta,fecha:hoyStr()});});
    box.appendChild(b);
  });
  box.hidden=!box.childNodes.length;
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
function ciclosSel(){var v=$("fCiclo").value,now=ahora();if(v==="todo"){var a=[];for(var k=primero();k<=now;k++)a.push(k);return a;}return [+v];}
function tile(lbl,val,cls){var t=el("div","tile");t.appendChild(el("span",null,lbl));t.appendChild(el("b","num"+(cls?" "+cls:""),val));return t;}

/* ---------- resumen ---------- */
function datosResumen(){
  var ks=ciclosSel(),now=ahora(),fs=$("fSobre").value,todo=$("fCiclo").value==="todo";
  var gs=porTipo("gasto"),as=porTipo("ahorro");
  if(fs){gs=gs.filter(function(s){return s.id===fs;});as=as.filter(function(s){return s.id===fs;});}
  var r={ks:ks,todo:todo,acabado:!todo&&ks[0]<now,gs:gs,as:as,gastado:0,anadido:0,ahorrado:0,sobra:0,porSobre:[]};
  gs.forEach(function(s){var g=0,d=0,q=0;ks.forEach(function(k){var x=delMes(s,k);g+=x.g;d+=x.disp;q+=x.queda;r.anadido+=x.i;});r.gastado+=g;r.sobra+=q;r.porSobre.push([s,g,d,q]);});
  as.forEach(function(s){ks.forEach(function(k){var x=delMes(s,k);r.ahorrado+=x.asig+x.i+x.tin-x.tout-x.g;r.anadido+=x.i;});});
  return r;
}
function pintarResumen(){
  var r=datosResumen();
  $("resTitulo").textContent=r.todo?"Resumen de todo":r.acabado?"Resumen del mes":"Resumen de este mes";
  var box=$("resumen");box.textContent="";
  box.appendChild(tile("Gastado",eur.format(r.gastado)));
  box.appendChild(tile("Dinero añadido",eur.format(r.anadido)));
  box.appendChild(tile("Ahorrado",eur.format(r.ahorrado)));
  if(r.gs.length)box.appendChild(tile(r.todo||r.acabado?"Sobró (al colchón)":"Te sobra ahora",eur.format(r.sobra),r.sobra<0?"neg":""));
}
function periodoTxt(r){if(r.todo)return "Todo";var k=r.ks[0];return corto(inicioDe(k))+" – "+corto(antes(inicioDe(k+1)));}
function abrirExp(){
  var r=datosResumen(),L=[],fs=$("fSobre").value;
  L.push("MIS SOBRES · "+periodoTxt(r)+(fs?" · "+nombreSobre(fs):""));
  L.push("");
  L.push("Gastado: "+eur.format(r.gastado));
  L.push("Dinero añadido: "+eur.format(r.anadido));
  L.push("Ahorrado: "+eur.format(r.ahorrado));
  if(r.gs.length)L.push((r.todo||r.acabado?"Sobró (al colchón): ":"Te sobra ahora: ")+eur.format(r.sobra));
  if(r.porSobre.length){L.push("");L.push("POR SOBRE");r.porSobre.forEach(function(x){L.push("· "+x[0].nombre+": gastado "+eur.format(x[1])+" de "+eur.format(x[2])+" (queda "+eur.format(x[3])+")");});}
  if(r.as.length){L.push("");L.push("AHORRO (TOTAL)");r.as.forEach(function(s){L.push("· "+s.nombre+": "+eur.format(calc(s).total));});}
  var vs=porTipo("viaje");if(vs.length&&!fs){L.push("");L.push("VIAJES Y PLANES");vs.forEach(function(s){L.push("· "+s.nombre+": quedan "+eur.format(calc(s).total));});}
  var cs=cuentas().filter(function(c){return c.saldo!==0;});
  if(cs.length&&!fs){L.push("");L.push("CUENTAS CON AMIGOS");cs.forEach(function(c){L.push("· "+c.nombre+": "+(c.saldo<0?"le debes ":"te debe ")+eur.format(Math.abs(c.saldo)));});}
  var ms=movsFiltrados();
  if(ms.length){L.push("");L.push("MOVIMIENTOS");ms.forEach(function(m){var d=descMov(m);L.push(corto(m.fecha)+" · "+d.tit+" · "+d.sub+" · "+d.q);});}
  $("expTitulo").textContent="Resumen · "+periodoTxt(r);
  $("expTexto").textContent=L.join("\n");
  $("vExp").classList.add("on");
}

/* ---------- movimientos ---------- */
function personasTxt(c){return (Array.isArray(c.personas)&&c.personas.length?c.personas:[c.persona]).join(", ");}
function descMov(m){
  var ex=m.extra||{},tit,sub,q,cls="",extraTxt="";
  if(ex.comp&&ex.comp.persona)extraTxt=ex.comp.pago==="yo"?" · con "+personasTxt(ex.comp)+" (pagaste "+eur.format(+ex.comp.total||0)+")":" · pagó "+ex.comp.persona;
  if(ex.fijo)extraTxt+=" · fijo";
  if(m.tipo==="saldo"){tit=m.nota||(ex.dir==="pago"?"Pagado a "+ex.persona:ex.persona+" te pagó");sub="Cuentas con amigos";q="↔ "+eur.format(m.importe);}
  else if(m.tipo==="traspaso"){tit=m.nota||"Dinero movido";sub=nombreSobre(m.sobre)+" → "+nombreSobre(m.destino);q="⇄ "+eur.format(m.importe);}
  else if(m.tipo==="colchon"){tit=m.nota||"Del colchón";sub=nombreSobre(m.sobre);q="↑ "+eur.format(m.importe);}
  else if(m.tipo==="ingreso"){tit=m.nota||"Dinero añadido";sub=nombreSobre(m.sobre);q="+"+eur.format(m.importe);cls="pos";}
  else{tit=m.nota||"Gasto";sub=nombreSobre(m.sobre);q="−"+eur.format(m.importe);}
  return {tit:tit,sub:sub+(m.etiqueta?" · "+m.etiqueta:"")+extraTxt,q:q,cls:cls};
}
function sinTildes(t){return String(t).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");}
function movsFiltrados(){
  var q=sinTildes($("fBuscar").value.trim()),ks=q?null:ciclosSel(),fs=$("fSobre").value;
  var lista=S.movs.filter(function(m){
    if(ks&&ks.indexOf(idxDe(m.fecha))<0)return false;
    if(fs&&m.sobre!==fs&&m.destino!==fs)return false;
    if(!q)return true;
    var d=descMov(m);
    return sinTildes(d.tit+" "+d.sub+" "+String(m.importe).replace(".",",")).indexOf(q)>=0;
  });
  lista.sort(function(a,b){return a.fecha===b.fecha?(b.ts||0)-(a.ts||0):(a.fecha<b.fecha?1:-1);});
  return lista;
}
function pintarMovs(){
  var box=$("lMovs");box.textContent="";
  var lista=movsFiltrados(),q=$("fBuscar").value.trim();
  if(!lista.length){box.appendChild(el("div","empty",q?"No hay nada que coincida con «"+q+"».":"No hay movimientos aquí. Pulsa «− Gasto» cuando gastes algo."));return;}
  lista.forEach(function(m){
    var row=el("div","mov"),w=el("div","what"),d=descMov(m);
    var s=sobrePorId(m.sobre),dt=el("span","dot");dt.style.background=m.tipo==="saldo"?"var(--muted)":color(s);row.appendChild(dt);
    w.appendChild(el("b",null,d.tit));
    w.appendChild(el("span",null,corto(m.fecha)+" · "+d.sub));
    w.setAttribute("role","button");w.tabIndex=0;w.setAttribute("aria-label","Modificar: "+d.tit+", "+d.q);
    w.addEventListener("click",function(){editar(m);});
    w.addEventListener("keydown",function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();editar(m);}});
    row.appendChild(w);
    row.appendChild(el("span","q num "+d.cls,d.q));
    var b=el("button","btn small"+(S.confirm===m.id?" danger":""),S.confirm===m.id?"¿Seguro?":"Borrar");b.type="button";
    b.setAttribute("aria-label",(S.confirm===m.id?"Confirmar borrar ":"Borrar ")+d.tit);
    b.addEventListener("click",function(){borrar(m.id);});
    row.appendChild(b);box.appendChild(row);
  });
}
var toastT=null,toastAccion=null;
function toast(t,accion){
  var x=$("toast");$("toastTxt").textContent=t;toastAccion=accion||null;
  $("toastBtn").hidden=!accion;x.classList.toggle("solo",!accion);x.classList.add("on");
  clearTimeout(toastT);toastT=setTimeout(function(){x.classList.remove("on");toastAccion=null;},accion?6000:2200);
}
$("toastBtn").addEventListener("click",function(){var a=toastAccion;$("toast").classList.remove("on");toastAccion=null;if(a)a();});
function cerrar(id){$(id).classList.remove("on");}
/* ---------- modificar un movimiento ---------- */
function editar(m){
  var ex=m.extra||{};
  if(m.tipo==="gasto"||m.tipo==="ingreso"){
    abrirMov(m.tipo);
    $("movTitulo").textContent=m.tipo==="gasto"?"Modificar gasto":"Modificar entrada";$("movOk").textContent="Guardar cambios";
    var r=document.querySelector('input[name="sobre"][value="'+m.sobre+'"]');if(r){r.checked=true;pintarEtiq();}
    if(m.etiqueta){var e=document.querySelector('input[name="etiq"][value="'+m.etiqueta.replace(/"/g,'')+'"]');if(e){e.checked=true;e.dataset.on="1";}}
    $("fNota").value=m.nota;$("fFecha").value=m.fecha;
    var imp=m.importe;
    if(ex.comp&&ex.comp.persona){
      $("fComp").checked=true;
      document.querySelector('input[name="pago"][value="'+(ex.comp.pago==="yo"?"yo":"otro")+'"]').checked=true;
      $("fPersona").value=(Array.isArray(ex.comp.personas)&&ex.comp.personas.length?ex.comp.personas:[ex.comp.persona]).join(", ");
      if(ex.comp.pago==="yo"){imp=+ex.comp.total||m.importe;$("fParte").value=fmtImp(m.importe);S.parteTocada=true;}
    }
    S.imp.mov=fmtImp(imp);pintarPantalla("mov");
  }else if(m.tipo==="traspaso"){
    abrirTr("mover");$("trTitulo").textContent="Modificar movimiento de dinero";
    $("trDe").value=m.sobre;$("trA").value=m.destino;S.imp.tr=fmtImp(m.importe);pintarPantalla("tr");
  }else if(m.tipo==="colchon"){
    if(!sobrePorId(m.sobre)){toast("Ese sobre ya no existe: bórralo y apúntalo de nuevo");return;}
    abrirTr("colchon",m.sobre);$("trTitulo").textContent="Modificar uso del colchón";S.imp.tr=fmtImp(m.importe);pintarPantalla("tr");
  }else if(m.tipo==="saldo"){
    var c=cuentas().filter(function(x){return clavePersona(x.nombre)===clavePersona(ex.persona);})[0]||{nombre:ex.persona,saldo:0};
    abrirSal(c);$("salTitulo").textContent="Modificar pago con "+ex.persona;
    document.querySelector('input[name="dir"][value="'+(ex.dir==="pago"?"pago":"cobro")+'"]').checked=true;
    S.imp.sal=fmtImp(m.importe);pintarPantalla("sal");
  }else return;
  S.editando=m;
}

/* ---------- teclado numérico ---------- */
function montarTeclado(cual){
  var box=$(cual+"Teclado");
  ["1","2","3","4","5","6","7","8","9",",","0","⌫"].forEach(function(k){
    var b=el("button",null,k);b.type="button";
    b.setAttribute("aria-label",k==="⌫"?"Borrar cifra":k===","?"Coma":k);
    b.addEventListener("click",function(){tecla(cual,k);});box.appendChild(b);
  });
}
function tecla(cual,k){
  var v=S.imp[cual];
  if(k==="⌫")v=v.slice(0,-1);
  else if(k===","){if(v.indexOf(",")<0)v=(v||"0")+",";}
  else{if(v.indexOf(",")>=0&&v.split(",")[1].length>=2)return;if(v.replace(",","").length>=7)return;v=(v==="0"?"":v)+k;}
  S.imp[cual]=v;pintarPantalla(cual);
}
function pintarPantalla(cual){var p=$(cual+"Pantalla"),v=S.imp[cual];p.textContent=(v||"0")+" €";p.classList.toggle("vacia",!v);if(cual==="mov")pintarComp();}
document.addEventListener("keydown",function(e){
  var cual=$("vMov").classList.contains("on")?"mov":$("vTr").classList.contains("on")?"tr":$("vSal").classList.contains("on")?"sal":null;
  if(!cual)return;
  if(e.key==="Escape"){cerrar("vMov");cerrar("vTr");cerrar("vSal");return;}
  var t=e.target;if(t&&(t.tagName==="INPUT"||t.tagName==="SELECT"))return;
  if(/^[0-9]$/.test(e.key)){tecla(cual,e.key);e.preventDefault();}
  else if(e.key===","||e.key==="."){tecla(cual,",");e.preventDefault();}
  else if(e.key==="Backspace"){tecla(cual,"⌫");e.preventDefault();}
});

/* ---------- apuntar ---------- */
function fmtImp(n){return String(r2(n)).replace(".",",");}
function nombreMov(mov){return mov.tipo==="saldo"?"Cuentas · "+mov.extra.persona:mov.tipo==="traspaso"?nombreSobre(mov.sobre)+" → "+nombreSobre(mov.destino):nombreSobre(mov.sobre);}
function reemplazar(viejo,mov){
  if(["traspaso","colchon","saldo"].indexOf(mov.tipo)>=0)mov.fecha=viejo.fecha;
  var ex=viejo.extra||{};if(ex.fijo){mov.extra=mov.extra||{};mov.extra.fijo=ex.fijo;}
  mov.id=uid("m");mov.ts=viejo.ts||Date.now();mov.sobreNombre=nombreMov(mov);
  var pend=!S.subiendo&&S.cola.some(function(o){return o.t==="add"&&o.mov.id===viejo.id;});
  if(pend){S.cola=S.cola.filter(function(o){return !(o.t==="add"&&o.mov.id===viejo.id);});S.movs=S.movs.filter(function(m){return m.id!==viejo.id;});hacerVarios([{t:"add",mov:mov}]);}
  else hacerVarios([{t:"del",id:viejo.id},{t:"add",mov:mov}]);
  toast("Cambios guardados");
}
function apuntar(mov){
  if(S.editando){var v=S.editando;S.editando=null;reemplazar(v,mov);return;}
  var s=sobrePorId(mov.sobre),antes=s&&s.tipo==="gasto"?calc(s):null;
  mov.id=uid("m");mov.ts=Date.now();
  mov.sobreNombre=nombreMov(mov);
  if(mov.sobre)S.ultimo=mov.sobre;
  hacer({t:"add",mov:mov});
  var txt=mov.tipo==="gasto"?"Gasto apuntado":mov.tipo==="ingreso"?"Dinero añadido":mov.tipo==="colchon"?"Colchón usado":mov.tipo==="saldo"?"Cuentas actualizadas":"Dinero movido";
  if(antes&&mov.tipo==="gasto"){
    var des=calc(s),fa=antes.disp>0?antes.queda/antes.disp:0,fd=des.disp>0?des.queda/des.disp:0;
    if(des.queda<0&&antes.queda>=0)txt+=" · Te has pasado en "+s.nombre;
    else if(fd<0.25&&fa>=0.25)txt+=" · A "+s.nombre+" le queda menos del 25 %";
  }
  var id=mov.id;
  toast(txt,function(){quitar(id);toast("Deshecho");});
}
function abrirMov(tipo){
  if(!S.sobres.length){abrirAj();return;}
  S.editando=null;$("movOk").textContent="Guardar";
  S.tipo=tipo;S.imp.mov="";pintarPantalla("mov");
  $("movTitulo").textContent=tipo==="gasto"?"Apuntar gasto":"Añadir dinero";
  $("movSobreLab").textContent=tipo==="gasto"?"¿De qué sobre?":"¿A qué sobre va?";
  $("fNota").value="";$("fFecha").value=hoyStr();$("movErr").textContent="";
  $("compWrap").hidden=tipo!=="gasto";$("fComp").checked=false;$("fPersona").value="";$("fParte").value="";S.parteTocada=false;
  document.querySelector('input[name="pago"][value="yo"]').checked=true;
  var pc=$("fPersChips");pc.textContent="";
  cuentas().slice(0,8).forEach(function(c){var b=el("button","btn small",c.nombre);b.type="button";b.addEventListener("click",function(){var v=$("fPersona").value.trim(),ya=v.split(",").map(clavePersona);if(ya.indexOf(clavePersona(c.nombre))<0)$("fPersona").value=v?v+", "+c.nombre:c.nombre;pintarComp();});pc.appendChild(b);});
  pintarComp();
  var ch=$("fChips");ch.textContent="";
  var orden=porTipo("gasto").concat(porTipo("viaje")).concat(porTipo("ahorro"));
  var marcado=S.ultimo&&orden.some(function(s){return s.id===S.ultimo;})?S.ultimo:null;
  orden.forEach(function(s,i){
    var l=el("label"),inp=el("input");inp.type="radio";inp.name="sobre";inp.value=s.id;inp.id="chip"+i;
    if(s.id===marcado)inp.checked=true;
    inp.addEventListener("change",pintarEtiq);
    var sp=el("span"),dt=el("span","dot");dt.style.background=color(s);sp.appendChild(dt);sp.appendChild(document.createTextNode(s.nombre));
    l.appendChild(inp);l.appendChild(sp);ch.appendChild(l);
  });
  pintarEtiq();
  $("vMov").classList.add("on");setTimeout(function(){$("movPantalla").focus();},50);
}
function pintarEtiq(){
  var sel=document.querySelector('input[name="sobre"]:checked'),s=sel?sobrePorId(sel.value):null,box=$("fEtiq");box.textContent="";
  var tags=s&&S.tipo==="gasto"?s.etiquetas:[];
  $("fEtiqWrap").hidden=!tags.length;
  tags.forEach(function(t,i){
    var l=el("label"),inp=el("input");inp.type="radio";inp.name="etiq";inp.value=t;inp.id="etq"+i;
    inp.addEventListener("click",function(){if(this.dataset.on==="1"){this.checked=false;this.dataset.on="";}else{Array.prototype.forEach.call(document.querySelectorAll('input[name="etiq"]'),function(x){x.dataset.on="";});this.dataset.on="1";}});
    l.appendChild(inp);l.appendChild(el("span",null,t));box.appendChild(l);
  });
}
function guardarMov(ev){
  ev.preventDefault();
  var imp=num(S.imp.mov),sel=document.querySelector('input[name="sobre"]:checked'),et=document.querySelector('input[name="etiq"]:checked'),f=$("fFecha").value||hoyStr();
  if(!(imp>0)){$("movErr").textContent="Escribe un importe mayor que 0.";return;}
  if(!sel){$("movErr").textContent="Elige un sobre.";return;}
  var mov={tipo:S.tipo,importe:imp,sobre:sel.value,nota:$("fNota").value.trim(),etiqueta:et?et.value:"",fecha:f};
  if(S.tipo==="gasto"&&$("fComp").checked){
    var pers=personasCampo(),pago=document.querySelector('input[name="pago"]:checked').value;
    if(!pers.length){$("movErr").textContent="Escribe con quién lo compartes.";return;}
    if(pago==="yo"){
      var parte=$("fParte").value.trim()===""?r2(imp/(pers.length+1)):num($("fParte").value);
      if(!(parte>=0)||parte>imp){$("movErr").textContent="Tu parte tiene que estar entre 0 y "+eur.format(imp)+".";return;}
      mov.importe=parte;mov.extra={comp:{persona:pers[0],personas:pers,pago:"yo",total:imp}};
    }else{
      if(pers.length>1){$("movErr").textContent="Si pagó otra persona, pon solo su nombre.";return;}
      mov.extra={comp:{persona:pers[0],pago:"otro",total:imp}};
    }
  }
  cerrar("vMov");
  apuntar(mov);
}
function pintarComp(){
  var on=$("fComp").checked&&S.tipo==="gasto";$("compBox").hidden=!on;
  var pago=(document.querySelector('input[name="pago"]:checked')||{}).value||"yo",imp=num(S.imp.mov)||0,pers=personasCampo(),n=Math.max(1,pers.length),per=pers.length?pers.join(", "):"esa persona";
  $("parteWrap").hidden=pago!=="yo";
  $("movImpLab").textContent=on&&pago==="yo"?"Lo que pagaste en total (€)":on?"Tu parte, lo que le debes (€)":"Importe (€)";
  if(!on)return;
  if(pago==="yo"&&!S.parteTocada)$("fParte").value=imp?String(r2(imp/(n+1))).replace(".",","):"";
  if(pago==="yo"){var pt=$("fParte").value.trim()===""?r2(imp/(n+1)):num($("fParte").value);
    $("compNota").textContent=pt>=0&&pt<=imp?"Se apunta "+eur.format(pt)+" como gasto tuyo y "+(n>1?"cada uno ("+per+") te deberá ":per+" te deberá ")+eur.format(r2((imp-pt)/n))+".":"";}
  else $("compNota").textContent="Se apunta "+eur.format(imp)+" como gasto tuyo y quedará que le debes "+eur.format(imp)+" a "+per+". Cuando le pagues, pulsa «Saldar».";
}
function personasCampo(){var vistos={};return $("fPersona").value.split(",").map(function(x){return x.trim();}).filter(function(x){var k=clavePersona(x);if(!k||vistos[k])return false;vistos[k]=1;return true;}).slice(0,10);}
function abrirSal(c){
  S.editando=null;
  S.salPersona=c.nombre;S.imp.sal=String(Math.abs(c.saldo)).replace(".",",");pintarPantalla("sal");$("salErr").textContent="";
  $("salTitulo").textContent="Saldar con "+c.nombre;
  $("salNota").textContent=(c.saldo<0?"Le debes "+eur.format(-c.saldo)+".":"Te debe "+eur.format(c.saldo)+".")+" Esto no cuenta como gasto: ya lo apuntaste en su día.";
  $("salPago").textContent="Le he pagado yo";$("salCobro").textContent="Me ha pagado "+c.nombre;
  document.querySelector('input[name="dir"][value="'+(c.saldo<0?"pago":"cobro")+'"]').checked=true;
  $("vSal").classList.add("on");setTimeout(function(){$("salPantalla").focus();},50);
}
function guardarSal(ev){
  ev.preventDefault();
  var imp=num(S.imp.sal),dir=(document.querySelector('input[name="dir"]:checked')||{}).value;
  if(!(imp>0)){$("salErr").textContent="Escribe un importe mayor que 0.";return;}
  if(!dir){$("salErr").textContent="Elige quién ha pagado.";return;}
  cerrar("vSal");
  apuntar({tipo:"saldo",importe:imp,sobre:"",nota:"",fecha:hoyStr(),extra:{persona:S.salPersona,dir:dir}});
}
function quitar(id){
  var pend=S.cola.filter(function(o){return o.t==="add"&&o.mov.id===id;}).length>0;
  if(pend&&!S.subiendo){S.cola=S.cola.filter(function(o){return !(o.t==="add"&&o.mov.id===id);});S.movs=S.movs.filter(function(m){return m.id!==id;});grabar();pintar();}
  else hacer({t:"del",id:id});
}
function borrar(id){
  if(S.confirm!==id){S.confirm=id;pintarMovs();setTimeout(function(){if(S.confirm===id){S.confirm=null;pintarMovs();}},5000);return;}
  S.confirm=null;quitar(id);toast("Movimiento borrado");
}

/* ---------- mover dinero y usar colchón ---------- */
function abrirTr(modo,sobreId,destinoId){
  if(S.sobres.length<1){abrirAj();return;}
  S.editando=null;
  S.trModo=modo;S.trSobre=sobreId||null;S.imp.tr="";pintarPantalla("tr");$("trErr").textContent="";
  var de=$("trDe"),a=$("trA");de.textContent="";a.textContent="";
  var orden=porTipo("gasto").concat(porTipo("ahorro")).concat(porTipo("viaje"));
  orden.forEach(function(s){var o1=el("option",null,s.nombre+" ("+eur.format(s.tipo==="gasto"?calc(s).queda:calc(s).total)+")");o1.value=s.id;de.appendChild(o1);
    if(modo==="cerrar"&&s.id===sobreId)return;var o2=el("option",null,s.nombre);o2.value=s.id;a.appendChild(o2);});
  $("trDeWrap").hidden=modo==="cerrar";
  if(modo==="colchon"){
    var s=sobrePorId(sobreId),c=calc(s);
    $("trTitulo").textContent="Usar colchón · "+s.nombre;
    $("trNota").textContent="Tienes "+eur.format(c.colchon)+" en el colchón de "+s.nombre+". Lo que uses se suma a lo que te queda este mes.";
    $("trSel").hidden=true;
  }else if(modo==="cerrar"){
    var v=sobrePorId(sobreId),cv=calc(v);
    $("trTitulo").textContent="Cerrar · "+v.nombre;
    $("trNota").textContent=cv.total>0?"Te sobran "+eur.format(cv.total)+". Elige a qué sobre vuelven.":"No sobra nada. Al cerrarlo desaparece de la pantalla (sus gastos se quedan guardados).";
    $("trSel").hidden=false;
    S.imp.tr=cv.total>0?String(r2(cv.total)).replace(".",","):"";pintarPantalla("tr");
    var ah=porTipo("ahorro");if(ah.length)a.value=ah[0].id;
  }else{
    $("trTitulo").textContent="Mover dinero";
    $("trNota").textContent="Pasa dinero de un sobre a otro este mes.";
    $("trSel").hidden=false;
    if(destinoId){a.value=destinoId;var g=porTipo("ahorro");if(g.length)de.value=g[0].id;}
    else if(orden.length>1)a.value=orden[1].id;
  }
  $("vTr").classList.add("on");setTimeout(function(){$("trPantalla").focus();},50);
}
function guardarTr(ev){
  ev.preventDefault();
  var imp=num(S.imp.tr);
  if(S.trModo==="cerrar"){
    var v=sobrePorId(S.trSobre),cv=calc(v),ops=[];
    if(imp>0){
      if(imp>r2(cv.total)){$("trErr").textContent="Solo sobran "+eur.format(cv.total)+".";return;}
      ops.push({t:"add",mov:{id:uid("m"),tipo:"traspaso",importe:imp,sobre:v.id,destino:$("trA").value,sobreNombre:v.nombre+" → "+nombreSobre($("trA").value),nota:"Cierre de "+v.nombre,etiqueta:"",fecha:hoyStr(),ts:Date.now()}});
    }
    var nuevos=S.sobres.map(function(s){var c=JSON.parse(JSON.stringify(s));if(c.id===v.id)c.tipo="cerrado";return c;});
    ops.push({t:"sobres",sobres:nuevos});
    cerrar("vTr");hacerVarios(ops);toast(v.nombre+" cerrado");return;
  }
  if(!(imp>0)){$("trErr").textContent="Escribe un importe mayor que 0.";return;}
  if(S.trModo==="colchon"){
    var s=sobrePorId(S.trSobre),c=calc(s);
    var lim=r2(c.colchon+(S.editando&&S.editando.tipo==="colchon"&&S.editando.sobre===s.id?S.editando.importe:0));
    if(imp>lim){$("trErr").textContent="En el colchón solo hay "+eur.format(lim)+".";return;}
    cerrar("vTr");apuntar({tipo:"colchon",importe:imp,sobre:s.id,nota:"Del colchón",fecha:hoyStr()});return;
  }
  var de=$("trDe").value,a=$("trA").value;
  if(de===a){$("trErr").textContent="Elige dos sobres distintos.";return;}
  cerrar("vTr");apuntar({tipo:"traspaso",importe:imp,sobre:de,destino:a,nota:"",fecha:hoyStr()});
}

/* ---------- ajustes ---------- */
function selColor(val,label){
  var s=el("select");s.setAttribute("aria-label",label);
  COLORES.forEach(function(c){var o=el("option",null,c[1]);o.value=c[0];s.appendChild(o);});s.value=val;return s;
}
function abrirAj(){
  $("ajErr").textContent="";$("nNombre").value="";$("nMensual").value="";
  $("aCobro").value=String(S.cfg.cobro).replace(".",",");
  $("aUrl").value=S.url;
  try{$("aTema").value=JSON.parse(localStorage.getItem(KT)||'"auto"');}catch(e){$("aTema").value="auto";}
  $("aUrlEstado").textContent=S.url?(S.sinc?"Conectada. Última subida: "+new Date(S.sinc).toLocaleString("es-ES"):"Aún no se ha podido conectar."):"Sin conectar: los datos solo están en este dispositivo.";
  var box=$("aLista");box.textContent="";
  porTipo("gasto").concat(porTipo("ahorro")).forEach(function(s){
    var b=el("div","ajsobre");b.dataset.id=s.id;b.style.borderLeftColor=color(s);
    var r=el("div","two"),n=el("input"),m=el("input");
    n.type="text";n.value=s.nombre;n.maxLength=30;n.setAttribute("aria-label","Nombre del sobre");n.className="an";
    m.type="text";m.inputMode="decimal";m.value=String(mensualEn(s,ahora())).replace(".",",");m.setAttribute("aria-label","Euros al mes de "+s.nombre);m.className="am";
    m.addEventListener("input",suma);r.appendChild(n);r.appendChild(m);b.appendChild(r);
    var cs=selColor(s.color,"Color de "+s.nombre);cs.className="ac";cs.addEventListener("change",function(){b.style.borderLeftColor="var(--"+cs.value+")";});
    b.appendChild(cs);
    if(s.tipo==="gasto"){
      var et=el("input");et.type="text";et.className="aet";et.value=s.etiquetas.join(", ");et.placeholder="Etiquetas: ropa, salidas, juegos";et.setAttribute("aria-label","Etiquetas de "+s.nombre+", separadas por comas");b.appendChild(et);
    }else{
      var r2_=el("div","two"),mt=el("input"),mn=el("input");
      mt.type="text";mt.inputMode="decimal";mt.className="amt2";mt.value=s.meta?String(s.meta).replace(".",","):"";mt.placeholder="Meta (€)";mt.setAttribute("aria-label","Meta de ahorro de "+s.nombre);
      mn.type="text";mn.className="amn";mn.maxLength=30;mn.value=s.metaNombre;mn.placeholder="Para qué";mn.setAttribute("aria-label","Para qué es la meta de "+s.nombre);
      r2_.appendChild(mt);r2_.appendChild(mn);b.appendChild(r2_);
    }
    box.appendChild(b);
  });
  S.rapEdit=S.cfg.rapidos.map(function(r){return {id:r.id,nombre:r.nombre,importe:r.importe,sobre:r.sobre,etiqueta:r.etiqueta};});
  S.fijEdit=(S.cfg.fijos||[]).map(function(f){return {id:f.id,nombre:f.nombre,importe:f.importe,sobre:f.sobre,dia:f.dia};});
  $("nTipo").value="gasto";tipoNuevo();
  pintarRapEdit();pintarFijEdit();suma();$("vAj").classList.add("on");
}
function pintarRapEdit(){
  var box=$("aRapidos");box.textContent="";
  if(!S.rapEdit.length)box.appendChild(el("p","note","Aún no tienes gastos rápidos."));
  S.rapEdit.forEach(function(r,i){
    var f=el("div","three"),n=el("input"),m=el("input"),s=el("select"),x=el("button","btn small","✕");
    n.type="text";n.value=r.nombre;n.placeholder="Café";n.maxLength=24;n.setAttribute("aria-label","Nombre del gasto rápido");
    m.type="text";m.inputMode="decimal";m.value=r.importe?String(r.importe).replace(".",","):"";m.placeholder="€";m.setAttribute("aria-label","Importe del gasto rápido");
    porTipo("gasto").forEach(function(sb){var o=el("option",null,sb.nombre);o.value=sb.id;s.appendChild(o);});
    s.value=r.sobre;if(s.value!==r.sobre&&s.options.length){s.selectedIndex=0;r.sobre=s.value;}s.setAttribute("aria-label","Sobre del gasto rápido");
    n.addEventListener("input",function(){r.nombre=n.value;});m.addEventListener("input",function(){r.importe=m.value;});s.addEventListener("change",function(){r.sobre=s.value;});
    x.type="button";x.setAttribute("aria-label","Quitar gasto rápido");x.addEventListener("click",function(){S.rapEdit.splice(i,1);pintarRapEdit();});
    f.appendChild(n);f.appendChild(m);f.appendChild(s);f.appendChild(x);box.appendChild(f);
  });
}
function pintarFijEdit(){
  var box=$("aFijos");box.textContent="";
  if(!S.fijEdit.length)box.appendChild(el("p","note","Aún no tienes gastos fijos."));
  S.fijEdit.forEach(function(r,i){
    var f=el("div","four"),n=el("input"),m=el("input"),s=el("select"),d=el("input"),x=el("button","btn small","✕");
    n.type="text";n.value=r.nombre;n.placeholder="Netflix";n.maxLength=24;n.setAttribute("aria-label","Nombre del gasto fijo");
    m.type="text";m.inputMode="decimal";m.value=r.importe?String(r.importe).replace(".",","):"";m.placeholder="€";m.setAttribute("aria-label","Importe del gasto fijo");
    porTipo("gasto").forEach(function(sb){var o=el("option",null,sb.nombre);o.value=sb.id;s.appendChild(o);});
    s.value=r.sobre;if(s.value!==r.sobre&&s.options.length){s.selectedIndex=0;r.sobre=s.value;}s.setAttribute("aria-label","Sobre del gasto fijo");
    d.type="text";d.inputMode="numeric";d.value=r.dia||"";d.placeholder="Día";d.setAttribute("aria-label","Día del mes en que se cobra");
    n.addEventListener("input",function(){r.nombre=n.value;});m.addEventListener("input",function(){r.importe=m.value;});s.addEventListener("change",function(){r.sobre=s.value;});d.addEventListener("input",function(){r.dia=d.value;});
    x.type="button";x.setAttribute("aria-label","Quitar gasto fijo");x.addEventListener("click",function(){S.fijEdit.splice(i,1);pintarFijEdit();});
    f.appendChild(n);f.appendChild(m);f.appendChild(s);f.appendChild(d);f.appendChild(x);box.appendChild(f);
  });
}
function tipoNuevo(){var v=$("nTipo").value==="viaje";$("nFinWrap").hidden=!v;$("nViajeNota").hidden=!v;$("nMensual").placeholder=v?"Presupuesto (€)":"€/mes";suma();}
function suma(){
  var t=0;Array.prototype.forEach.call(document.querySelectorAll(".am"),function(i){var v=num(i.value);if(v>0)t+=v;});
  var n=num($("nMensual").value);if(n>0&&$("nTipo").value!=="viaje")t+=n;
  var c=num($("aCobro").value),txt="Repartido: "+eur.format(t);
  if(c>0){var d=r2(c-t);txt+=d===0?" · cuadra con lo que cobras":d>0?" · te quedan "+eur.format(d)+" sin repartir":" · te pasas "+eur.format(-d);}
  $("aSuma").textContent=txt;
}
function aplicarTema(t){
  try{localStorage.setItem(KT,JSON.stringify(t));}catch(e){}
  var r=document.documentElement;
  if(t==="claro")r.setAttribute("data-theme","light");else if(t==="oscuro")r.setAttribute("data-theme","dark");else r.removeAttribute("data-theme");
}
function guardarAj(ev){
  ev.preventDefault();
  var now=ahora(),err="";
  var nuevos=S.sobres.map(function(s){
    var b=document.querySelector('.ajsobre[data-id="'+s.id+'"]');
    var c={id:s.id,nombre:s.nombre,tipo:s.tipo,orden:s.orden,cambios:s.cambios.map(function(x){return {c:x.c,m:x.m};}),color:s.color,meta:s.meta,metaNombre:s.metaNombre,etiquetas:s.etiquetas.slice()};
    if(!b)return c;
    var nombre=b.querySelector(".an").value.trim(),v=num(b.querySelector(".am").value);
    if(!nombre||!(v>=0)){err="Revisa el nombre y los euros de cada sobre.";return c;}
    c.nombre=nombre;c.color=b.querySelector(".ac").value;
    if(v!==mensualEn(s,now)){c.cambios=c.cambios.filter(function(x){return x.c!==now;});c.cambios.push({c:now,m:v});}
    var et=b.querySelector(".aet");
    if(et)c.etiquetas=et.value.split(",").map(function(x){return x.trim();}).filter(function(x,i,a){return x&&a.indexOf(x)===i;}).slice(0,12);
    var mt=b.querySelector(".amt2");
    if(mt){var mv=mt.value.trim()?num(mt.value):0;if(!(mv>=0)){err="Revisa la meta de "+nombre+".";return c;}c.meta=mv||0;c.metaNombre=b.querySelector(".amn").value.trim();}
    return c;
  });
  var nn=$("nNombre").value.trim(),nm=num($("nMensual").value);
  if(nn){
    var tv=$("nTipo").value,col=COLORES[S.sobres.length%8][0];
    if(tv==="viaje"){var pres=$("nMensual").value.trim()?num($("nMensual").value):0;if(!(pres>=0))err="Revisa el presupuesto del viaje.";
      else nuevos.push({id:uid("s"),nombre:nn,tipo:"viaje",orden:Date.now(),cambios:[{c:now,m:0}],color:col,meta:pres,metaNombre:$("nFin").value||"",etiquetas:[]});}
    else if(!(nm>=0))err="Pon los euros al mes del sobre nuevo.";
    else nuevos.push({id:uid("s"),nombre:nn,tipo:tv,orden:Date.now(),cambios:[{c:now,m:nm}],color:col,meta:0,metaNombre:"",etiquetas:[]});
  }
  var cobro=num($("aCobro").value);
  if(!(cobro>=0))err="Revisa lo que cobras al mes.";
  var rap=[];
  S.rapEdit.forEach(function(r){var nom=String(r.nombre||"").trim(),im=num(r.importe);if(!nom&&!(im>0))return;if(!nom||!(im>0)||!r.sobre){err="Revisa los gastos rápidos: cada uno necesita nombre, importe y sobre.";return;}rap.push({id:r.id||uid("r"),nombre:nom,importe:im,sobre:r.sobre,etiqueta:r.etiqueta||""});});
  var fij=[];
  S.fijEdit.forEach(function(r){var nom=String(r.nombre||"").trim(),im=num(r.importe),dia=Math.round(num(r.dia));if(!nom&&!(im>0))return;if(!nom||!(im>0)||!r.sobre||!(dia>=1&&dia<=31)){err="Revisa los gastos fijos: cada uno necesita nombre, importe, sobre y un día entre 1 y 31.";return;}fij.push({id:r.id||uid("f"),nombre:nom,importe:im,sobre:r.sobre,dia:dia});});
  var url=$("aUrl").value.trim();
  if(url&&!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url))err="La dirección de la hoja debe empezar por https://script.google.com/macros/s/ y terminar en /exec.";
  if(err){$("ajErr").textContent=err;return;}
  cerrar("vAj");aplicarTema($("aTema").value);
  if(url!==S.url){S.url=url;S.sinc=0;S.fallo=false;grabar();}
  if(JSON.stringify(limpiaSobres(nuevos))!==JSON.stringify(S.sobres))hacer({t:"sobres",sobres:nuevos});
  var cfg={inicio:primero(),cobro:cobro,rapidos:rap,fijos:fij};
  if(JSON.stringify(limpiaCfg(cfg))!==JSON.stringify(S.cfg))hacer({t:"cfg",cfg:cfg});
  toast("Guardado");pintar();subir();aplicarFijos();
}
/* ---------- copia de seguridad ---------- */
function descargarCopia(){
  var datos=JSON.stringify({app:"mis-sobres",version:1,fecha:new Date().toISOString(),sobres:S.sobres,movs:S.movs,cfg:S.cfg},null,1);
  var nombre="mis-sobres-copia-"+hoyStr()+".json",blob=new Blob([datos],{type:"application/json"});
  try{var f=new File([blob],nombre,{type:"application/json"});if(navigator.canShare&&navigator.canShare({files:[f]})){navigator.share({files:[f],title:"Copia de Mis sobres"}).catch(function(){});return;}}catch(e){}
  var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=nombre;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},1000);
  toast("Copia descargada");
}
function restaurarCopia(file){
  var lec=new FileReader();
  lec.onload=function(){
    var d=null;try{d=JSON.parse(lec.result);}catch(e){}
    if(!d||d.app!=="mis-sobres"){toast("Ese archivo no es una copia de Mis sobres");return;}
    var ops=[],ids={};S.movs.forEach(function(m){ids[m.id]=1;});
    var bs=limpiaSobres(d.sobres),faltan=bs.filter(function(s){return !sobrePorId(s.id);});
    if(faltan.length)ops.push({t:"sobres",sobres:S.sobres.concat(faltan)});
    limpiaMovs(d.movs).forEach(function(m){if(ids[m.id])return;m.sobreNombre=nombreSobre(m.sobre);ops.push({t:"add",mov:m});});
    if(!ops.length){toast("No faltaba nada: ya lo tienes todo");return;}
    cerrar("vAj");hacerVarios(ops);
    toast("Restaurado: "+(ops.length-(faltan.length?1:0))+" movimientos"+(faltan.length?" y "+faltan.length+" sobres":""));
  };
  lec.readAsText(file);
}

/* ---------- eventos ---------- */
montarTeclado("mov");montarTeclado("tr");montarTeclado("sal");
$("fComp").addEventListener("change",pintarComp);
Array.prototype.forEach.call(document.querySelectorAll('input[name="pago"]'),function(r){r.addEventListener("change",pintarComp);});
$("fPersona").addEventListener("input",pintarComp);
$("fParte").addEventListener("input",function(){S.parteTocada=true;pintarComp();});
Array.prototype.forEach.call(document.querySelectorAll("[data-parte]"),function(b){b.addEventListener("click",function(){
  var imp=num(S.imp.mov)||0,v=b.dataset.parte==="mitad"?r2(imp/(Math.max(1,personasCampo().length)+1)):b.dataset.parte==="nada"?0:imp;
  $("fParte").value=String(v).replace(".",",");S.parteTocada=true;pintarComp();});});
$("formSal").addEventListener("submit",guardarSal);
$("fBuscar").addEventListener("input",pintarMovs);
$("bExportar").addEventListener("click",abrirExp);
$("expCerrar").addEventListener("click",function(){cerrar("vExp");});
$("expPdf").addEventListener("click",function(){try{window.print();}catch(e){toast("No se puede imprimir desde aquí");}});
$("expCopiar").addEventListener("click",function(){
  var t=$("expTexto").textContent;
  if(navigator.share){navigator.share({title:$("expTitulo").textContent,text:t}).catch(function(){});return;}
  if(navigator.clipboard)navigator.clipboard.writeText(t).then(function(){toast("Copiado");},function(){toast("No se pudo copiar");});
});
$("nTipo").addEventListener("change",tipoNuevo);
$("aFijoAdd").addEventListener("click",function(){var g=porTipo("gasto");S.fijEdit.push({id:uid("f"),nombre:"",importe:"",sobre:g.length?g[0].id:"",dia:""});pintarFijEdit();});
$("aBackup").addEventListener("click",descargarCopia);
$("aRestore").addEventListener("change",function(){if(this.files&&this.files[0])restaurarCopia(this.files[0]);this.value="";});
$("salCancel").addEventListener("click",function(){S.editando=null;cerrar("vSal");});
$("bGasto").addEventListener("click",function(){abrirMov("gasto");});
$("bIngreso").addEventListener("click",function(){abrirMov("ingreso");});
$("bMover").addEventListener("click",function(){abrirTr("mover");});
$("bAjustes").addEventListener("click",abrirAj);
$("movCancel").addEventListener("click",function(){S.editando=null;cerrar("vMov");});
$("trCancel").addEventListener("click",function(){S.editando=null;cerrar("vTr");});
$("ajCancel").addEventListener("click",function(){cerrar("vAj");});
$("formMov").addEventListener("submit",guardarMov);
$("formTr").addEventListener("submit",guardarTr);
$("formAj").addEventListener("submit",guardarAj);
$("aRapAdd").addEventListener("click",function(){var g=porTipo("gasto");S.rapEdit.push({id:uid("r"),nombre:"",importe:"",sobre:g.length?g[0].id:"",etiqueta:""});pintarRapEdit();});
$("aCobro").addEventListener("input",suma);$("nMensual").addEventListener("input",suma);
$("fCiclo").addEventListener("change",function(){S.ciclo=this.value==="todo"?"todo":+this.value;pintarResumen();pintarMovs();});
$("fSobre").addEventListener("change",function(){pintarResumen();pintarMovs();});
["vMov","vTr","vAj","vSal","vExp"].forEach(function(id){$(id).addEventListener("click",function(e){if(e.target===this)cerrar(id);});});
document.addEventListener("keydown",function(e){if(e.key==="Escape")cerrar("vAj");});
window.addEventListener("online",subir);
document.addEventListener("visibilitychange",function(){if(!document.hidden){pintar();subir();aplicarFijos();}});
setInterval(function(){if(S.cola.length)subir();},30000);

/* ---------- arranque ---------- */
cargar();pintar();subir();aplicarFijos();
if("serviceWorker" in navigator){
  var habia=!!navigator.serviceWorker.controller,recargado=false;
  navigator.serviceWorker.addEventListener("controllerchange",function(){if(habia&&!recargado){recargado=true;location.reload();}});
  window.addEventListener("load",function(){navigator.serviceWorker.register("sw.js").catch(function(){});});
}
})();
