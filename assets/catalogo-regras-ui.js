'use strict';
window.CatalogoRegrasUI=(()=>{
 function capabilities(modelo,regras){
  const base={pizza:modelo==='pizzaria',personalizacao:['pizzaria','hamburgueria','acaiteria'].includes(modelo)};
  return regras?.recursos?{pizza:regras.recursos.pizza===true,personalizacao:regras.recursos.personalizacao===true}:base;
 }
 function defaults(modelo,anterior={}){
  anterior=anterior||{};const cap=capabilities(modelo,anterior);
  const kind=(key,max)=>({ativo:key==='bordas'?cap.pizza&&cap.personalizacao:cap.personalizacao,inteira:true,por_parte:false,obrigatoria_padrao:false,max_por_opcao:max,cobranca_inteira:'maior',cobranca_parte:'integral',...anterior[key]});
  const r={nome:anterior.nome||'Regras do catálogo',preset_id:anterior.preset_id||'personalizado',recursos:cap,recursos_personalizados:anterior.recursos_personalizados===true,pizza_combinada:cap.pizza&&(anterior.pizza_combinada??true),bordas:kind('bordas',1),adicionais:kind('adicionais',3)};
  if(!cap.pizza){r.bordas.ativo=false;r.bordas.por_parte=false;r.adicionais.por_parte=false;r.adicionais.inteira=true;}
  if(!cap.personalizacao){r.adicionais.ativo=false;r.bordas.ativo=false;}
  return r;
 }
 function presets(modelo,recursos){
  const cap=capabilities(modelo,{recursos});
  const make=(id,nome,dividir,bordas,adicionais,partes)=>{const r=defaults(modelo,{recursos:cap,nome,preset_id:id});r.pizza_combinada=dividir;r.bordas.ativo=bordas;r.adicionais.ativo=adicionais;if(id==='complementos')r.adicionais.max_por_opcao=1;r.bordas.por_parte=bordas&&partes;r.adicionais.por_parte=adicionais&&partes;return r;};
  if(cap.pizza)return[make('pizza_inteira','Pizza inteira, sem complementos',false,false,false,false),make('pizza_combinada','Pizza inteira e combinada, com borda inteira',true,cap.personalizacao,false,false),make('pizza_completa','Pizza com bordas e adicionais na inteira ou por parte',true,cap.personalizacao,cap.personalizacao,true)];
  if(cap.personalizacao)return[make('adicionais_opcionais','Adicionais opcionais por item',false,false,true,false),make('complementos','Complementos por item',false,false,true,false)];
  return[make('sem_personalizacao','Catálogo sem personalizações',false,false,false,false)];
 }
 const el=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
 function input(parent,label,value,type='text'){const l=el('label',label);l.className=type==='checkbox'?'ob-field ob-toggle':'ob-field';const i=el('input');i.type=type;if(type==='checkbox')i.checked=value;else i.value=value;if(type==='number'){i.min='1';i.max='999';i.step='1';}l.append(i);parent.append(l);return i;}
 function select(parent,label,values,value){const l=el('label',label);l.className='ob-field';const s=el('select');for(const [id,name] of values){const o=el('option',name);o.value=id;s.append(o);}s.value=value;l.append(s);parent.append(l);return s;}
 function render(parent,modelo,stored,options={}){
  const editor=el('section');parent.append(editor);let readCurrent;
  function build(value){
   editor.replaceChildren();const r=defaults(modelo,value),cap=capabilities(modelo,r),readers={};
   const starter=el('div'),starterFields=el('div');starter.className='ob-preset';starterFields.className='ob-field-grid';starter.append(starterFields);editor.append(starter);
   const choices=presets(modelo,r.recursos),preset=select(starterFields,'Começar com este conjunto',[['personalizado','Personalizado'],...choices.map(x=>[x.preset_id,x.nome])],choices.some(x=>x.preset_id===r.preset_id)?r.preset_id:'personalizado');
   const name=input(starterFields,'Nome do conjunto de regras',r.nome);name.required=true;name.maxLength=80;
   starter.append(el('p','Escolha um ponto de partida e ajuste as regras abaixo para o seu negócio.'));
   let resourcePizza,resourceExtras;
   if(options.avancado&&options.permitirRecursos!==false){const resources=el('fieldset');resources.append(el('legend','Recursos disponíveis no catálogo'));editor.append(resources);resourcePizza=input(resources,'Usar o cadastro especializado de pizzas',cap.pizza,'checkbox');resourceExtras=input(resources,'Usar personalizações e adicionais',cap.personalizacao,'checkbox');resources.append(el('p','Estes recursos podem mudar independentemente do modelo inicial. Os dados existentes não são apagados.'));}
   let split=null;if(cap.pizza){const splitPanel=el('div');splitPanel.className='ob-split';editor.append(splitPanel);split=input(splitPanel,'Oferecer pizza combinada (meio a meio e demais divisões dos tamanhos)',r.pizza_combinada,'checkbox');}
   for(const key of cap.personalizacao?(cap.pizza?['bordas','adicionais']:['adicionais']):[]){
    const fieldset=el('fieldset');fieldset.className='ob-rule-card';fieldset.append(el('legend',key==='bordas'?'Bordas':'Adicionais'));editor.append(fieldset);
    const g=r[key],active=input(fieldset,'Trabalho com '+key,g.ativo,'checkbox'),fields=el('div');fields.className='ob-rule-fields';fieldset.append(fields);
    const locations=el('div');locations.className='ob-toggle-stack';fields.append(locations);
    const whole=cap.pizza?input(locations,'Permitir na pizza inteira',g.inteira,'checkbox'):null;
    const part=cap.pizza?input(locations,key==='bordas'?'Permitir borda por parte da pizza':'Permitir adicional por parte da pizza',g.por_parte,'checkbox'):null;
    const limits=el('div');limits.className='ob-field-grid';fields.append(limits);
    const required=input(limits,'Novas opções obrigatórias por padrão',g.obrigatoria_padrao,'checkbox');if(!options.avancado)required.parentElement.hidden=true;const max=input(limits,'Limite individual inicial para cada nova opção',g.max_por_opcao,'number');
    fields.append(el('p','Cada opção terá seu próprio limite e obrigatoriedade no cadastro. Não há limite total de escolhas.'));
    const charges=el('div');charges.className='ob-field-grid';fields.append(charges);
    const charge=cap.pizza?select(charges,'Cobrança na pizza inteira',[['maior','Maior preço dos sabores'],['media','Média dos preços'],['proporcional','Proporcional às partes']],g.cobranca_inteira):null;
    const partial=cap.pizza?select(charges,'Cobrança por parte',[['integral','Valor integral em cada parte'],['proporcional','Proporcional ao tamanho da parte']],g.cobranca_parte):null;
    const toggle=()=>{fields.hidden=!active.checked;max.required=active.checked;if(charge)charge.closest('label').hidden=!whole.checked;if(partial)partial.closest('label').hidden=!part.checked;};active.onchange=toggle;if(part)part.onchange=toggle;if(whole)whole.onchange=toggle;toggle();
    readers[key]=()=>({ativo:active.checked,inteira:whole?whole.checked:true,por_parte:part?part.checked:false,obrigatoria_padrao:required.checked,max_por_opcao:Number(max.value),cobranca_inteira:charge?.value||'maior',cobranca_parte:partial?.value||'integral'});
   }
   readCurrent=()=>({...r,nome:name.value.trim(),preset_id:preset.value,recursos_personalizados:options.avancado||r.recursos_personalizados,pizza_combinada:split?.checked||false,...Object.fromEntries(Object.entries(readers).map(([k,read])=>[k,read()]))});
   preset.onchange=()=>{const selected=choices.find(x=>x.preset_id===preset.value);if(selected)build({...selected,recursos_personalizados:r.recursos_personalizados});};
   if(resourcePizza&&resourceExtras){const resourcesChanged=()=>{const current=readCurrent();current.recursos={pizza:resourcePizza.checked,personalizacao:resourceExtras.checked};current.preset_id='personalizado';current.recursos_personalizados=true;build(current);};resourcePizza.onchange=resourcesChanged;resourceExtras.onchange=resourcesChanged;}
  }
  build(stored);return()=>readCurrent();
 }
 return{capabilities,defaults,presets,render};
})();
