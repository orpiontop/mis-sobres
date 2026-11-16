(function(){
"use strict";
var $=function(id){return document.getElementById(id);};
var eur=new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"});
var MES=["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
var COLORES=[["c1","Azul"],["c2","Naranja"],["c3","Aguamarina"],["c4","Amarillo"],["c5","Rosa"],["c6","Verde"],["c7","Violeta"],["c8","Rojo"]];
var K="mis-sobres-app-v1",KT="mis-sobres-tema";
var S={sobres:[],movs:[],cfg:{inicio:null,cobro:425,rapidos:[]},cola:[],url:"",sinc:0,
       tipo:"gasto",ultimo:null,ciclo:null,confirm:null,subiendo:false,fallo:false,
       imp:{mov:"",tr:"",sal:""},parteTocada:false,salPersona:"",trModo:"mover",trSobre:null,rapEdit:[]};

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
    id:String(x.id),nombre:String(x.nombre||"Sobre"),tipo:x.tipo==="ahorro"?"ahorro":"gasto",orden:+x.orden||0,
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
function limpiaCfg(c,prev){prev=prev||S.cfg;c=c||{};return {inicio:typeof c.inicio==="number"?c.inicio:prev.inicio,cobro:typeof c.cobro==="number"?c.cobro:prev.cobro,rapidos:Array.isArray(c.rapidos)?limpiaRapidos(c.rapidos):prev.rapidos};}

/* ---------- guardar en el dispositivo ---------- */
function grabar(){try{localStorage.setItem(K,JSON.stringify({sobres:S.sobres,movs:S.movs,cfg:S.cfg,cola:S.cola,url:S.url,sinc:S.sinc,ultimo:S.ultimo}));}catch(e){}}
function cargar(){
  var c=null;try{c=JSON.parse(localStorage.getItem(K)||"null");}catch(e){}
  if(c&&Array.isArray(c.sobres)){
    S.sobres=limpiaSobres(c.sobres);S.movs=limpiaMovs(c.movs);S.cola=Array.isArray(c.cola)?c.cola:[];
    S.url=typeof c.url==="string"?c.url:"";S.sinc=+c.sinc||0;S.ultimo=c.ultimo||null;
    S.cfg=limpiaCfg(c.cfg,{inicio:ahora(),cobro:425,rapidos:[]});
  }else{
    var n=ahora();S.cfg={inicio:n,cobro:425,rapidos:[]};
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
      if(d.cfg&&typeof d.cfg.inicio==="number")S.cfg=limpiaCfg(d.cfg);
      S.cola.forEach(aplicar);
      S.sinc=Date.now();S.fallo=false;bien=true;grabar();pintar();
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
    if(m.tipo==="gasto"&&e.comp&&e.comp.persona){p=e.comp.persona;d=e.comp.pago==="yo"?(+e.comp.total||0)-m.importe:-m.importe;}
    else if(m.tipo==="saldo"&&e.persona){p=e.persona;d=e.dir==="pago"?m.importe:-m.importe;}
    else return;
    var k=clavePersona(p);if(!k)return;
    if(!map[k])map[k]={nombre:String(p).trim(),saldo:0};
    map[k].saldo+=d;
  });
  return Object.keys(map).map(function(k){var x=map[k];x.saldo=r2(x.saldo);return x;}).sort(function(a,b){return Math.abs(b.saldo)-Math.abs(a.saldo);});
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
    b.addEventListener("click",function(){apuntar({tipo:"gasto",importe:r.importe,sobre:r.sobre,nota:r.nombre,etiqueta:r.etiqueta,fecha:hoyStr()});});
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

/* ---------- resumen y gráficos ---------- */
function pintarResumen(){
  var ks=ciclosSel(),now=ahora(),fs=$("fSobre").value,todo=$("fCiclo").value==="todo";
  var gs=porTipo("gasto"),as=porTipo("ahorro");
  if(fs){var x=sobrePorId(fs);gs=gs.filter(function(s){return s.id===fs;});as=as.filter(function(s){return s.id===fs;});if(!x){gs=[];as=[];}}
  var gastado=0,anadido=0,ahorrado=0,sobra=0;
  ks.forEach(function(k){
    gs.forEach(function(s){var d=delMes(s,k);gastado+=d.g;anadido+=d.i;sobra+=d.queda;});
    as.forEach(function(s){var d=delMes(s,k);ahorrado+=d.asig+d.i+d.tin-d.tout-d.g;anadido+=d.i;});
  });
  var acabado=!todo&&ks[0]<now;
  $("resTitulo").textContent=todo?"Resumen de todo":acabado?"Resumen del mes":"Resumen de este mes";
  var box=$("resumen");box.textContent="";
  box.appendChild(tile("Gastado",eur.format(gastado)));
  box.appendChild(tile("Dinero añadido",eur.format(anadido)));
  box.appendChild(tile("Ahorrado",eur.format(ahorrado)));
  if(gs.length)box.appendChild(tile(todo||acabado?"Sobró (al colchón)":"Te sobra ahora",eur.format(sobra),sobra<0?"neg":""));
  pintarBarras(ks,gs,fs);
  pintarMeses(fs);
}
function hbFila(box,nombre,col,valor,max,detalle){
  var f=el("div","hb");
  var n=el("span",null);var dt=el("span","dot");dt.style.background=col;n.style.display="flex";n.style.alignItems="center";n.style.gap="6px";n.appendChild(dt);n.appendChild(el("span",null,nombre));f.appendChild(n);
  var tr=el("div","track"),bar=el("i");bar.style.width=(max>0?Math.max(0,valor)/max*100:0)+"%";bar.style.background=col;tr.appendChild(bar);f.appendChild(tr);
  f.appendChild(el("span","v",detalle));
  tip(f,nombre+": "+detalle);
  box.appendChild(f);
}
function pintarBarras(ks,gs,fs){
  var box=$("cSobres");box.textContent="";
  var s1=fs?sobrePorId(fs):null;
  if(s1&&s1.tipo==="gasto"&&s1.etiquetas.length){
    box.appendChild(el("h3",null,"En qué se fue · "+s1.nombre));
    var por={},sin=0;
    S.movs.forEach(function(m){if(m.tipo!=="gasto"||m.sobre!==s1.id||ks.indexOf(idxDe(m.fecha))<0)return;if(m.etiqueta)por[m.etiqueta]=(por[m.etiqueta]||0)+m.importe;else sin+=m.importe;});
    var filas=Object.keys(por).map(function(k){return [k,por[k]];});if(sin>0)filas.push(["Sin etiqueta",sin]);
    filas.sort(function(a,b){return b[1]-a[1];});
    if(!filas.length){box.appendChild(el("p","note","No hay gastos en este periodo."));return;}
    var mx=filas[0][1];filas.forEach(function(f){hbFila(box,f[0],color(s1),f[1],mx,eur.format(f[1]));});
    tabla(box,["Etiqueta","Gastado"],filas.map(function(f){return [f[0],eur.format(f[1])];}));
    return;
  }
  box.appendChild(el("h3",null,"Gastado por sobre"));
  var datos=gs.map(function(s){var g=0,d=0;ks.forEach(function(k){var x=delMes(s,k);g+=x.g;d+=x.disp;});return [s,g,d];});
  if(!datos.length){box.appendChild(el("p","note","Este sobre es de ahorro: mira su tarjeta a la izquierda."));return;}
  var mx=Math.max.apply(null,datos.map(function(x){return Math.max(x[1],x[2]);}).concat([1]));
  datos.forEach(function(x){hbFila(box,x[0].nombre,color(x[0]),x[1],mx,eur.format(x[1])+" de "+eur.format(x[2]));});
  tabla(box,["Sobre","Gastado","Disponible"],datos.map(function(x){return [x[0].nombre,eur.format(x[1]),eur.format(x[2])];}));
}
function pintarMeses(fs){
  var box=$("cMeses");box.textContent="";
  var now=ahora(),ini=Math.max(primero(),now-5),ks=[];for(var k=ini;k<=now;k++)ks.push(k);
  var gs=porTipo("gasto");if(fs)gs=gs.filter(function(s){return s.id===fs;});
  box.appendChild(el("h3",null,"Gastado por mes"));
  if(!gs.length){box.appendChild(el("p","note","Solo se muestran los sobres para gastar."));return;}
  var vals=ks.map(function(k){return gs.map(function(s){return delMes(s,k).g;});});
  var tots=vals.map(function(v){return v.reduce(function(a,b){return a+b;},0);});
  var mx=Math.max.apply(null,tots.concat([1]));
  var paso=mx<=50?10:mx<=150?25:mx<=300?50:100,top=Math.ceil(mx/paso)*paso;
  var W=560,H=200,L=44,B=24,T=10,cw=(W-L-8)/ks.length,bw=Math.min(48,cw*0.55);
  var ns="http://www.w3.org/2000/svg",svg=document.createElementNS(ns,"svg");
  svg.setAttribute("viewBox","0 0 "+W+" "+H);svg.setAttribute("width","100%");svg.setAttribute("role","img");
  svg.setAttribute("aria-label","Gastado por mes en los últimos "+ks.length+" meses");
  function y(v){return T+(H-T-B)*(1-v/top);}
  for(var g=0;g<=top;g+=paso){
    var ln=document.createElementNS(ns,"line");ln.setAttribute("x1",L);ln.setAttribute("x2",W-4);ln.setAttribute("y1",y(g));ln.setAttribute("y2",y(g));
    ln.setAttribute("stroke","var(--line)");ln.setAttribute("stroke-width","1");svg.appendChild(ln);
    var tx=document.createElementNS(ns,"text");tx.setAttribute("x",L-6);tx.setAttribute("y",y(g)+4);tx.setAttribute("text-anchor","end");tx.textContent=g+" €";svg.appendChild(tx);
  }
  ks.forEach(function(k,i){
    var x=L+cw*i+(cw-bw)/2,acc=0,segs=[];
    gs.forEach(function(s,j){var v=vals[i][j];if(v<=0)return;segs.push([s,v,acc]);acc+=v;});
    segs.forEach(function(sg,n){
      var y0=y(sg[2]),y1=y(sg[2]+sg[1]),h=Math.max(1,y0-y1-(n<segs.length-1?2:0));
      var last=n===segs.length-1,rc=document.createElementNS(ns,"path"),rr=last?Math.min(4,h):0,yt=y0-h;
      rc.setAttribute("d","M"+x+","+y0+" V"+(yt+rr)+" Q"+x+","+yt+" "+(x+rr)+","+yt+" H"+(x+bw-rr)+" Q"+(x+bw)+","+yt+" "+(x+bw)+","+(yt+rr)+" V"+y0+" Z");
      rc.setAttribute("fill",color(sg[0]));
      tip(rc,mesCorto(k)+" · "+sg[0].nombre+": "+eur.format(sg[1]));
      svg.appendChild(rc);
    });
    if(tots[i]>0){var lt=document.createElementNS(ns,"text");lt.setAttribute("x",x+bw/2);lt.setAttribute("y",y(tots[i])-5);lt.setAttribute("text-anchor","middle");lt.textContent=Math.round(tots[i])+" €";svg.appendChild(lt);}
    var lx=document.createElementNS(ns,"text");lx.setAttribute("x",x+bw/2);lx.setAttribute("y",H-6);lx.setAttribute("text-anchor","middle");lx.textContent=mesCorto(k)+(k===now?" (ahora)":"");svg.appendChild(lx);
  });
  box.appendChild(svg);
  if(gs.length>1){var lg=el("div","legend");gs.forEach(function(s){var sp=el("span"),dt=el("span","dot");dt.style.background=color(s);sp.appendChild(dt);sp.appendChild(document.createTextNode(s.nombre));lg.appendChild(sp);});box.appendChild(lg);}
  tabla(box,["Mes"].concat(gs.map(function(s){return s.nombre;})).concat(gs.length>1?["Total"]:[]),
    ks.map(function(k,i){return [mesCorto(k)].concat(vals[i].map(function(v){return eur.format(v);})).concat(gs.length>1?[eur.format(tots[i])]:[]);}));
}
function tabla(box,cab,filas){
  var d=el("details","tabla");d.appendChild(el("summary",null,"Ver como tabla"));
  var t=el("table"),tr=el("tr");cab.forEach(function(c,i){tr.appendChild(el("th",i?"r":null,c));});t.appendChild(tr);
  filas.forEach(function(f){var r=el("tr");f.forEach(function(c,i){r.appendChild(el("td",i?"r":null,c));});t.appendChild(r);});
  d.appendChild(t);box.appendChild(d);
}
function tip(nodo,txt){
  var tp=$("tip");
  nodo.addEventListener("mousemove",function(e){tp.textContent=txt;tp.style.display="block";tp.style.left=Math.min(e.clientX+12,window.innerWidth-230)+"px";tp.style.top=(e.clientY+12)+"px";});
  nodo.addEventListener("mouseleave",function(){tp.style.display="none";});
}

/* ---------- movimientos ---------- */
function pintarMovs(){
  var ks=ciclosSel(),fs=$("fSobre").value,box=$("lMovs");box.textContent="";
  var lista=S.movs.filter(function(m){return ks.indexOf(idxDe(m.fecha))>=0&&(!fs||m.sobre===fs||m.destino===fs);});
  lista.sort(function(a,b){return a.fecha===b.fecha?(b.ts||0)-(a.ts||0):(a.fecha<b.fecha?1:-1);});
  if(!lista.length){box.appendChild(el("div","empty","No hay movimientos aquí. Pulsa «− Gasto» cuando gastes algo."));return;}
  lista.forEach(function(m){
    var row=el("div","mov"),w=el("div","what"),tit,sub,q,cls="";
    var s=sobrePorId(m.sobre),dt=el("span","dot"),ex=m.extra||{},extraTxt="";dt.style.background=m.tipo==="saldo"?"var(--muted)":color(s);row.appendChild(dt);
    if(ex.comp&&ex.comp.persona)extraTxt=ex.comp.pago==="yo"?" · con "+ex.comp.persona+" (pagaste "+eur.format(+ex.comp.total||0)+")":" · pagó "+ex.comp.persona;
    if(m.tipo==="saldo"){tit=m.nota||(ex.dir==="pago"?"Pagado a "+ex.persona:ex.persona+" te pagó");sub="Cuentas con amigos";q="↔ "+eur.format(m.importe);}
    else if(m.tipo==="traspaso"){tit=m.nota||"Dinero movido";sub=nombreSobre(m.sobre)+" → "+nombreSobre(m.destino);q="⇄ "+eur.format(m.importe);}
    else if(m.tipo==="colchon"){tit=m.nota||"Del colchón";sub=nombreSobre(m.sobre);q="↑ "+eur.format(m.importe);}
    else if(m.tipo==="ingreso"){tit=m.nota||"Dinero añadido";sub=nombreSobre(m.sobre);q="+"+eur.format(m.importe);cls="pos";}
    else{tit=m.nota||"Gasto";sub=nombreSobre(m.sobre);q="−"+eur.format(m.importe);}
    w.appendChild(el("b",null,tit));
    w.appendChild(el("span",null,corto(m.fecha)+" · "+sub+(m.etiqueta?" · "+m.etiqueta:"")+extraTxt));
    row.appendChild(w);
    row.appendChild(el("span","q num "+cls,q));
    var b=el("button","btn small"+(S.confirm===m.id?" danger":""),S.confirm===m.id?"¿Seguro?":"Borrar");b.type="button";
    b.setAttribute("aria-label",(S.confirm===m.id?"Confirmar borrar ":"Borrar ")+tit);
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
function apuntar(mov){
  var s=sobrePorId(mov.sobre),antes=s&&s.tipo==="gasto"?calc(s):null;
  mov.id=uid("m");mov.ts=Date.now();
  mov.sobreNombre=mov.tipo==="traspaso"?nombreSobre(mov.sobre)+" → "+nombreSobre(mov.destino):nombreSobre(mov.sobre);
  if(mov.tipo==="saldo")mov.sobreNombre="Cuentas · "+mov.extra.persona;
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
  S.tipo=tipo;S.imp.mov="";pintarPantalla("mov");
  $("movTitulo").textContent=tipo==="gasto"?"Apuntar gasto":"Añadir dinero";
  $("movSobreLab").textContent=tipo==="gasto"?"¿De qué sobre?":"¿A qué sobre va?";
  $("fNota").value="";$("fFecha").value=hoyStr();$("movErr").textContent="";
  $("compWrap").hidden=tipo!=="gasto";$("fComp").checked=false;$("fPersona").value="";$("fParte").value="";S.parteTocada=false;
  document.querySelector('input[name="pago"][value="yo"]').checked=true;
  var pc=$("fPersChips");pc.textContent="";
  cuentas().slice(0,8).forEach(function(c){var b=el("button","btn small",c.nombre);b.type="button";b.addEventListener("click",function(){$("fPersona").value=c.nombre;pintarComp();});pc.appendChild(b);});
  pintarComp();
  var ch=$("fChips");ch.textContent="";
  var orden=porTipo("gasto").concat(porTipo("ahorro"));
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
    var per=$("fPersona").value.trim(),pago=document.querySelector('input[name="pago"]:checked').value;
    if(!per){$("movErr").textContent="Escribe con quién lo compartes.";return;}
    if(pago==="yo"){
      var parte=$("fParte").value.trim()===""?r2(imp/2):num($("fParte").value);
      if(!(parte>=0)||parte>imp){$("movErr").textContent="Tu parte tiene que estar entre 0 y "+eur.format(imp)+".";return;}
      mov.importe=parte;mov.extra={comp:{persona:per,pago:"yo",total:imp}};
    }else mov.extra={comp:{persona:per,pago:"otro",total:imp}};
  }
  cerrar("vMov");
  apuntar(mov);
}
function pintarComp(){
  var on=$("fComp").checked&&S.tipo==="gasto";$("compBox").hidden=!on;
  var pago=(document.querySelector('input[name="pago"]:checked')||{}).value||"yo",imp=num(S.imp.mov)||0,per=$("fPersona").value.trim()||"esa persona";
  $("parteWrap").hidden=pago!=="yo";
  $("movImpLab").textContent=on&&pago==="yo"?"Lo que pagaste en total (€)":on?"Tu parte, lo que le debes (€)":"Importe (€)";
  if(!on)return;
  if(pago==="yo"&&!S.parteTocada)$("fParte").value=imp?String(r2(imp/2)).replace(".",","):"";
  if(pago==="yo"){var pt=$("fParte").value.trim()===""?r2(imp/2):num($("fParte").value);
    $("compNota").textContent=pt>=0&&pt<=imp?"Se apunta "+eur.format(pt)+" como gasto tuyo y "+per+" te deberá "+eur.format(r2(imp-pt))+".":"";}
  else $("compNota").textContent="Se apunta "+eur.format(imp)+" como gasto tuyo y quedará que le debes "+eur.format(imp)+" a "+per+". Cuando le pagues, pulsa «Saldar».";
}
function abrirSal(c){
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
function abrirTr(modo,sobreId){
  if(S.sobres.length<1){abrirAj();return;}
  S.trModo=modo;S.trSobre=sobreId||null;S.imp.tr="";pintarPantalla("tr");$("trErr").textContent="";
  var de=$("trDe"),a=$("trA");de.textContent="";a.textContent="";
  var orden=porTipo("gasto").concat(porTipo("ahorro"));
  orden.forEach(function(s){var o1=el("option",null,s.nombre+" ("+eur.format(s.tipo==="gasto"?calc(s).queda:calc(s).total)+")");o1.value=s.id;de.appendChild(o1);var o2=el("option",null,s.nombre);o2.value=s.id;a.appendChild(o2);});
  if(modo==="colchon"){
    var s=sobrePorId(sobreId),c=calc(s);
    $("trTitulo").textContent="Usar colchón · "+s.nombre;
    $("trNota").textContent="Tienes "+eur.format(c.colchon)+" en el colchón de "+s.nombre+". Lo que uses se suma a lo que te queda este mes.";
    $("trSel").hidden=true;
  }else{
    $("trTitulo").textContent="Mover dinero";
    $("trNota").textContent="Pasa dinero de un sobre a otro este mes.";
    $("trSel").hidden=false;
    if(orden.length>1)a.value=orden[1].id;
  }
  $("vTr").classList.add("on");setTimeout(function(){$("trPantalla").focus();},50);
}
function guardarTr(ev){
  ev.preventDefault();
  var imp=num(S.imp.tr);
  if(!(imp>0)){$("trErr").textContent="Escribe un importe mayor que 0.";return;}
  if(S.trModo==="colchon"){
    var s=sobrePorId(S.trSobre),c=calc(s);
    if(imp>r2(c.colchon)){$("trErr").textContent="En el colchón solo hay "+eur.format(c.colchon)+".";return;}
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
  pintarRapEdit();suma();$("vAj").classList.add("on");
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
function suma(){
  var t=0;Array.prototype.forEach.call(document.querySelectorAll(".am"),function(i){var v=num(i.value);if(v>0)t+=v;});
  var n=num($("nMensual").value);if(n>0)t+=n;
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
  if(nn){if(!(nm>=0))err="Pon los euros al mes del sobre nuevo.";else nuevos.push({id:uid("s"),nombre:nn,tipo:$("nTipo").value,orden:Date.now(),cambios:[{c:now,m:nm}],color:COLORES[S.sobres.length%8][0],meta:0,metaNombre:"",etiquetas:[]});}
  var cobro=num($("aCobro").value);
  if(!(cobro>=0))err="Revisa lo que cobras al mes.";
  var rap=[];
  S.rapEdit.forEach(function(r){var nom=String(r.nombre||"").trim(),im=num(r.importe);if(!nom&&!(im>0))return;if(!nom||!(im>0)||!r.sobre){err="Revisa los gastos rápidos: cada uno necesita nombre, importe y sobre.";return;}rap.push({id:r.id||uid("r"),nombre:nom,importe:im,sobre:r.sobre,etiqueta:r.etiqueta||""});});
  var url=$("aUrl").value.trim();
  if(url&&!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url))err="La dirección de la hoja debe empezar por https://script.google.com/macros/s/ y terminar en /exec.";
  if(err){$("ajErr").textContent=err;return;}
  cerrar("vAj");aplicarTema($("aTema").value);
  if(url!==S.url){S.url=url;S.sinc=0;S.fallo=false;grabar();}
  if(JSON.stringify(limpiaSobres(nuevos))!==JSON.stringify(S.sobres))hacer({t:"sobres",sobres:nuevos});
  var cfg={inicio:primero(),cobro:cobro,rapidos:rap};
  if(JSON.stringify(limpiaCfg(cfg))!==JSON.stringify(S.cfg))hacer({t:"cfg",cfg:cfg});
  toast("Guardado");pintar();subir();
}

/* ---------- eventos ---------- */
montarTeclado("mov");montarTeclado("tr");montarTeclado("sal");
$("fComp").addEventListener("change",pintarComp);
Array.prototype.forEach.call(document.querySelectorAll('input[name="pago"]'),function(r){r.addEventListener("change",pintarComp);});
$("fPersona").addEventListener("input",pintarComp);
$("fParte").addEventListener("input",function(){S.parteTocada=true;pintarComp();});
Array.prototype.forEach.call(document.querySelectorAll("[data-parte]"),function(b){b.addEventListener("click",function(){
  var imp=num(S.imp.mov)||0,v=b.dataset.parte==="mitad"?r2(imp/2):b.dataset.parte==="nada"?0:imp;
  $("fParte").value=String(v).replace(".",",");S.parteTocada=true;pintarComp();});});
$("formSal").addEventListener("submit",guardarSal);
$("salCancel").addEventListener("click",function(){cerrar("vSal");});
$("bGasto").addEventListener("click",function(){abrirMov("gasto");});
$("bIngreso").addEventListener("click",function(){abrirMov("ingreso");});
$("bMover").addEventListener("click",function(){abrirTr("mover");});
$("bAjustes").addEventListener("click",abrirAj);
$("movCancel").addEventListener("click",function(){cerrar("vMov");});
$("trCancel").addEventListener("click",function(){cerrar("vTr");});
$("ajCancel").addEventListener("click",function(){cerrar("vAj");});
$("formMov").addEventListener("submit",guardarMov);
$("formTr").addEventListener("submit",guardarTr);
$("formAj").addEventListener("submit",guardarAj);
$("aRapAdd").addEventListener("click",function(){var g=porTipo("gasto");S.rapEdit.push({id:uid("r"),nombre:"",importe:"",sobre:g.length?g[0].id:"",etiqueta:""});pintarRapEdit();});
$("aCobro").addEventListener("input",suma);$("nMensual").addEventListener("input",suma);
$("fCiclo").addEventListener("change",function(){S.ciclo=this.value==="todo"?"todo":+this.value;pintarResumen();pintarMovs();});
$("fSobre").addEventListener("change",function(){pintarResumen();pintarMovs();});
["vMov","vTr","vAj","vSal"].forEach(function(id){$(id).addEventListener("click",function(e){if(e.target===this)cerrar(id);});});
document.addEventListener("keydown",function(e){if(e.key==="Escape")cerrar("vAj");});
window.addEventListener("online",subir);
document.addEventListener("visibilitychange",function(){if(!document.hidden){pintar();subir();}});
setInterval(function(){if(S.cola.length)subir();},30000);

/* ---------- arranque ---------- */
cargar();pintar();subir();
if("serviceWorker" in navigator){
  var habia=!!navigator.serviceWorker.controller,recargado=false;
  navigator.serviceWorker.addEventListener("controllerchange",function(){if(habia&&!recargado){recargado=true;location.reload();}});
  window.addEventListener("load",function(){navigator.serviceWorker.register("sw.js").catch(function(){});});
}
})();
