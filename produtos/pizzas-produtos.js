'use strict';
// Cadastro especializado integrado à página Produtos. A chave permanece em memória.
window.pizzasCadastro = (() => {
 const endpoint='https://n8n.orbbotia.com/webhook/meia-pizza-admin';
 let data=null, account='', segment='restaurante', key='', busy=false, dirty=false, pendingProduct=null, pendingCategories=false, currentType='common', addonDirty=false, editor=null, restoring=false;
 const $=id=>document.getElementById(id);
 const node=(tag,text,cls)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;if(cls)x.className=cls;return x;};
 const money=n=>Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 const meta=p=>{try{return typeof p.metadata==='string'?JSON.parse(p.metadata):p.metadata||{};}catch{return {};}};
 const isPizza=p=>meta(p).tipo_cadastro==='pizza';
 const errors={versao_catalogo_divergente:'O cadastro mudou em outra sessão. Recarregue e confira antes de salvar.',categoria_padrao_protegida:'Pizzas é uma categoria padrão. Seu nome e sua existência são protegidos.',categoria_com_vinculos:'Esta categoria ainda tem produtos ou configurações vinculadas. Remova ou transfira esses vínculos antes de excluir.',tamanho_com_sabores:'Este tamanho ainda está disponível em sabores. Edite os sabores e retire a disponibilidade antes de excluir.',tamanho_duplicado:'Já existe um tamanho com esse nome.',precos_obrigatorios:'Informe ao menos um tamanho disponível e seu preço.',vinculo_explicito_necessario:'Há uma variação antiga com esse nome. Confira os vínculos existentes antes de criar outra.',grupo_obrigatorio_impossivel:'A escolha obrigatória precisa de opções suficientes. Cadastre as opções com mínimo zero e depois ajuste a obrigatoriedade.',acesso_negado:'Confira a chave administrativa deste estabelecimento.'};
 function notice(text,error=false){CadastroUI.notify(text,error);$('pc-status').textContent=text;$('pc-status').className='pc-notice'+(error?' pc-error':'');}
 function button(text,fn,cls=''){const b=node('button',text,cls);b.type='button';b.onclick=fn;return b;}
 function field(parent,label,value='',type='text'){const l=node('label',label),i=node('input');i.type=type;i.value=value??'';if(type==='number'){i.min='0';i.step='0.01';}l.append(i);parent.append(l);return i;}
 function checkbox(parent,label,value=false){const l=node('label'),i=node('input');i.type='checkbox';i.checked=value;l.append(i,document.createTextNode(label));parent.append(l);return i;}
 function select(parent,label,choices,value){const l=node('label',label),s=node('select');for(const [v,t] of choices)s.add(new Option(t,v));if(value!==undefined)s.value=value;l.append(s);parent.append(l);return s;}
 function formSlot(id){const x=$(id);x.replaceChildren();x.hidden=false;x.className='pc-edit';x.oninput=()=>{dirty=true;
     let draft=$('pc-draft');if(!draft){draft=node('p',undefined,'pc-notice');draft.id='pc-draft';(id==='pc-size-form'?$('pc-size-list'):id==='pc-flavor-form'?$('pc-pizza-list'):$(id.replace('-form','-list'))).prepend(draft);}
     draft.textContent='Alterações não salvas: '+[...x.querySelectorAll('input:not([type=checkbox]),select')].filter(i=>i.value!==''&&i.checkValidity()).map(i=>i.closest('label')?.firstChild?.textContent+': '+i.value).join(' · ');
   };return x;}
 const catalog=()=>data?.catalogo;
 const flavors=()=>catalog()?.produtos.filter(p=>isPizza(p)&&!p.deletado)||[];
 const sizes=()=>data?.tamanhos||[];
 const variations=p=>catalog()?.produto_variacoes.filter(v=>v.produto_id===p.id)||[];
 async function request(action,body={}){
   const requestAccount=account, requestSegment=segment;
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','x-pizza-admin-key':key},body:JSON.stringify({account_id:requestAccount,segmento:requestSegment,acao:'cadastro_'+action,dados:body,versao_esperada:action==='consultar'?null:data.versao_catalogo}),signal:AbortSignal.timeout(25000)});
   let r;try{r=await response.json();}catch{throw Error('O servidor não retornou JSON. Confira a publicação do workflow de pizzas.');}
   if(account!==requestAccount||segment!==requestSegment)throw Error('O estabelecimento mudou. Recarregue o cadastro da conta atual.');
   if(!response.ok||r.status==='erro'||r.status==='pendencia')throw Error(errors[r.codigo]||r.mensagem||'Não foi possível salvar.');
   if(!Array.isArray(r.tamanhos))throw Error('Publique a atualização do cadastro por tipo no banco e no workflow.');
   return r;
 }
 async function run(fn){if(busy)return;busy=true;$('pc-content').disabled=true;$('pc-load').disabled=true;try{await fn();}catch(e){notice(e.message,true);}finally{busy=false;$('pc-content').disabled=!data;$('pc-load').disabled=false;}}
 async function save(action,payload){await run(async()=>{
   const view=CadastroUI.capture();
   data=await request(action,payload);dirty=false;$('pc-draft')?.remove();
   const savedId=data.id||payload.id;
   render();
   restoring=true;
   if(action==='salvar_tamanho')editorSize(sizes().find(x=>x.id===savedId)||payload);
   else if(action==='salvar_sabor')editorFlavor(flavors().find(x=>x.id===savedId)||payload);
   else if(action==='salvar_grupo')editorGroup(payload.uso_pizza,catalog().personalizacao_grupos.find(x=>x.id===savedId)||payload);
   else if(action==='salvar_opcao'){const g=catalog().personalizacao_grupos.find(x=>x.id===payload.grupo_id);editorOption(g.uso_pizza,g,catalog().personalizacao_opcoes.find(x=>x.id===savedId)||payload);}
   else if(editor&&!action.startsWith('excluir'))editor();
   restoring=false;
   if(typeof carregarLista==='function')await carregarLista();
   CadastroUI.restore(view);
   notice(action.startsWith('excluir')?'Exclusão concluída.':'Alteração salva.');
 });}
 function discard(){if(!dirty)return true;if(!confirm('Há alterações não salvas. Deseja descartá-las?'))return false;dirty=false;if(data)render();document.getElementById('pc-draft')?.remove();return true;}
 function editorSize(t={}){
   if(!discard())return;dirty=false;editor=()=>editorSize(t);const f=formSlot('pc-size-form');f.append(node('h3',t.id?'Editar tamanho':'Novo tamanho'));
   const grid=node('div',undefined,'pc-grid');f.append(grid);
   const name=field(grid,'Nome do tamanho',t.nome||'');name.placeholder='Pequena, Média, Grande…';name.maxLength=60;
   const slices=field(grid,'Quantidade de fatias (opcional)',t.fatias||'','number');slices.step='1';slices.max='100';
   const diameter=field(grid,'Diâmetro em cm (opcional)',t.diametro||'','number');diameter.max='200';
   const active=checkbox(f,'Disponível para venda',t.ativo!==false),divide=checkbox(f,'Permitir combinar sabores neste tamanho',t.permite_dividir||false);
   f.append(node('p','O mesmo tamanho vale para inteira e dividida. Fatias não determinam a quantidade de sabores.'));
   const rules=node('div',undefined,'pc-grid');f.append(rules);
   const min=select(rules,'Mínimo ao combinar',[[2,'2 sabores'],[3,'3 sabores'],[4,'4 sabores']],t.minimo||2);
   const max=select(rules,'Máximo de sabores',[[2,'2 sabores'],[3,'3 sabores'],[4,'4 sabores']],t.maximo||2);
   const formula=select(rules,'Como cobrar a combinação?',[['maior','Sabor mais caro'],['media','Média dos sabores'],['proporcional','Proporcional às partes']],t.formula||'maior');
   const division=select(rules,'Como dividir?',[['iguais','Partes iguais'],['personalizada','Cliente escolhe proporções de 5% em 5%']],t.divisao||'iguais');
   const example=node('p');rules.append(example);function explain(){example.textContent=formula.value==='maior'?'Ex.: sabores de R$30 e R$50 → R$50.':formula.value==='media'?'Ex.: sabores de R$30 e R$50 → R$40.':'Ex.: 25% de R$30 + 75% de R$50 → R$45.';}formula.onchange=explain;explain();
   rules.hidden=!divide.checked;divide.onchange=()=>{rules.hidden=!divide.checked;};
   f.append(button('Salvar tamanho',()=>{if(!name.value.trim())return notice('Informe o nome do tamanho.',true);if(Number(max.value)<Number(min.value))return notice('O máximo precisa ser igual ou maior que o mínimo.',true);save('salvar_tamanho',{id:t.id,nome:name.value.trim(),fatias:slices.value||null,diametro:diameter.value||null,ativo:active.checked,permite_dividir:divide.checked,minimo:Number(min.value),maximo:Number(max.value),formula:formula.value,divisao:division.value});},'primary'));
   if(!restoring)f.scrollIntoView({behavior:'smooth',block:'start'});
 }
 function editorFlavor(p={}){
   if(!discard())return;dirty=false;editor=()=>editorFlavor(p);const f=formSlot('pc-flavor-form');f.append(node('h3',p.id?'Editar sabor':'Novo sabor'));
   const name=field(f,'Nome do sabor',p.nome||''),desc=field(f,'Descrição',p.descricao||''),image=field(f,'Endereço da imagem (opcional)',meta(p).imagem||'','url');
   const active=checkbox(f,'Sabor disponível',p.ativo!==false),grid=node('div',undefined,'pc-grid');f.append(grid);
   const allowed=sizes().filter(t=>t.categoria_id===(p.categoria_id||data.categoria_padrao));
   const entries=allowed.map(t=>{
     const box=node('div',undefined,'pc-card');grid.append(box);const v=variations(p).find(v=>v.pizza_tamanho_id===t.id);
     const available=checkbox(box,t.nome,Boolean(v?.ativo));const price=field(box,'Preço da pizza inteira (R$)',v?.preco??'','number');
     price.disabled=!available.checked;available.onchange=()=>{price.disabled=!available.checked;};return {t,available,price};
   });
   if(!allowed.length)f.append(node('p','Cadastre primeiro um tamanho na seção acima.'));
   const unmatched=variations(p).filter(v=>v.ativo&&!v.pizza_tamanho_id);
   if(unmatched.length)f.append(node('p','Variações antigas preservadas: '+unmatched.map(v=>v.nome).join(', ')+'. Confira o cadastro anterior ou a limpeza de testes antes de substituí-las.'));
   f.append(button('Salvar sabor e preços',()=>{
     if(!name.value.trim())return notice('Informe o nome do sabor.',true);
     if(!entries.some(e=>e.available.checked))return notice('Selecione ao menos um tamanho e informe o preço.',true);
     if(entries.some(e=>e.available.checked&&!/^\d+(\.\d{1,2})?$/.test(e.price.value)))return notice('Preencha o preço de cada tamanho disponível com até duas casas decimais.',true);
     save('salvar_sabor',{id:p.id,nome:name.value.trim(),descricao:desc.value.trim(),imagem:image.value.trim(),ativo:active.checked,precos:entries.map(e=>({tamanho_id:e.t.id,indisponivel:!e.available.checked,preco:e.price.value}))});
   },'primary'));if(!restoring)f.scrollIntoView({behavior:'smooth',block:'start'});
 }
 function editorGroup(kind,g={}){
   if(!discard())return;dirty=false;const f=formSlot('pc-'+kind+'-form');f.append(node('h3',g.id?'Editar escolha':'Nova escolha'));
   const name=field(f,'Nome apresentado ao cliente',g.nome||(kind==='borda'?'Borda':'Adicionais'));
   const required=checkbox(f,'Escolha obrigatória',Number(g.min_selecoes)>0),limit=field(f,'Máximo de escolhas',g.max_selecoes||(kind==='borda'?1:3),'number');limit.step='1';limit.min='1';
   const minimum=field(f,'Mínimo de escolhas quando obrigatório',g.min_selecoes||1,'number');minimum.min='1';minimum.step='1';minimum.disabled=!required.checked;required.onchange=()=>{minimum.disabled=!required.checked;};
   const scope=select(f,'Aplicar em',[['inteira','Pizza inteira'],['parte','Cada sabor/parte']],g.escopo_pizza||'inteira');
   const charge=select(f,'Como cobrar?',[],undefined);
   function update(){charge.replaceChildren();(scope.value==='inteira'?[['maior','Maior preço entre os sabores'],['media','Média dos preços'],['proporcional','Proporcional às partes']]:[['integral','Valor integral por parte'],['proporcional','Proporcional à parte']]).forEach(([v,t])=>charge.add(new Option(t,v)));}scope.onchange=update;update();charge.value=g.cobranca_pizza||charge.value;
   f.append(node('p','As opções são aplicadas à categoria padrão Pizzas, incluindo novos sabores. Uma escolha obrigatória só fica disponível quando tiver opções suficientes.'));
   if(g.id)f.append(node('p','Editar esta escolha também altera os produtos que já a utilizam. Confira suas associações antes de salvar.'));
   f.append(button('Salvar escolha',()=>save('salvar_grupo',{id:g.id,nome:name.value.trim(),min_selecoes:required.checked?Number(minimum.value):0,max_selecoes:Number(limit.value),ativo:true,uso_pizza:kind,escopo_pizza:scope.value,cobranca_pizza:charge.value}),'primary'));
 }
 function editorOption(kind,g,o={}){
   if(!discard())return;dirty=false;const f=formSlot('pc-'+kind+'-form');f.append(node('h3',(o.id?'Editar opção de ':'Nova opção de ')+g.nome));
   const name=field(f,'Nome',o.nome||''),price=field(f,'Acréscimo padrão (R$)',o.preco_padrao??0,'number');
   const repeat=checkbox(f,'Permitir repetir esta opção',o.permite_quantidade||false),max=field(f,'Quantidade máxima',o.max_quantidade||1,'number');max.step='1';max.min='1';
   const active=checkbox(f,'Opção disponível',o.ativo!==false);f.append(node('p','Preço por tamanho: em branco usa o preço padrão; zero significa gratuito. Alterar um preço por tamanho substitui os preços específicos dos sabores nesse tamanho. Campos que você não alterar preservam as exceções existentes.'));
   const grid=node('div',undefined,'pc-grid');f.append(grid);
   const exceptionChecks=[];
   const prices=sizes().map(t=>{const saved=data.precos_tamanhos.find(x=>x.tamanho_id===t.id&&x.opcao_id===o.id);const box=node('div');grid.append(box);const available=checkbox(box,'Disponível em '+t.nome,!(data.bloqueios_tamanhos||[]).some(x=>x.tamanho_id===t.id&&x.opcao_id===o.id));return {t,available,original:saved?.preco??'',input:field(box,'Acréscimo em '+t.nome,saved?.preco??'','number')};});
   f.append(button('Salvar opção',()=>{if(!name.value.trim())return notice('Informe o nome da opção.',true);save('salvar_opcao',{id:o.id,grupo_id:g.id,nome:name.value.trim(),preco_padrao:price.value,permite_quantidade:repeat.checked,max_quantidade:repeat.checked?Number(max.value):1,ativo:active.checked,excecoes_sabores:exceptionChecks.filter(x=>x.check.checked!==x.original).map(x=>({produto_id:x.id,remover:x.check.checked})),disponibilidade_tamanhos:prices.map(x=>({tamanho_id:x.t.id,disponivel:x.available.checked})),precos_tamanhos:prices.filter(x=>(x.input.value===''?null:Number(x.input.value))!==(x.original===''?null:Number(x.original))).map(x=>({tamanho_id:x.t.id,preco:x.input.value}))});},'primary'));
   if(o.id){const exceptions=node('details');exceptions.dataset.uiKey='excecoes-'+o.id;exceptions.append(node('summary','Escolher sabores em que esta opção está disponível'));
     exceptions.append(node('p','As alterações serão gravadas junto com Salvar opção. Os demais sabores continuam herdando a regra da categoria.'));
     for(const p of flavors()){const excluded=catalog().produto_personalizacao_opcoes.some(x=>x.produto_id===p.id&&x.opcao_id===o.id&&x.excluida);const check=checkbox(exceptions,p.nome,!excluded);exceptionChecks.push({id:p.id,check,original:!excluded});}f.append(exceptions);
   }
 }
 function renderGroups(kind){
   const mount=$('pc-'+kind+'-list');mount.replaceChildren();
   for(const g of catalog().personalizacao_grupos.filter(g=>g.uso_pizza===kind)){
     const d=node('details');d.dataset.uiKey='grupo-'+g.id;d.append(node('summary',g.nome+' · '+(g.min_selecoes?'Obrigatória':'Opcional')+' · até '+g.max_selecoes));
     d.append(button('Editar regras',()=>editorGroup(kind,g)),button('Adicionar opção',()=>editorOption(kind,g)),button('Excluir escolha',()=>{if(confirm('Excluir esta escolha e seus vínculos? Produtos que também usam esta escolha serão afetados.'))save('excluir_grupo',{id:g.id});},'danger'));
     for(const o of catalog().personalizacao_opcoes.filter(o=>o.grupo_id===g.id)){const row=node('div',undefined,'pc-row');row.append(node('p',o.nome+' · '+money(o.preco_padrao)+(o.ativo?'':' · Indisponível')),button('Editar',()=>editorOption(kind,g,o)),button('Excluir',()=>{if(confirm('Excluir a opção '+o.nome+' e seus preços?'))save('excluir_opcao',{id:o.id});},'danger'));d.append(row);}
     if(!catalog().categoria_personalizacao_grupos.some(x=>x.grupo_id===g.id&&x.categoria_id===data.categoria_padrao))d.append(node('p','Esta escolha ainda não foi aplicada à categoria padrão. Cadastre opções suficientes para atender ao mínimo.'));
     mount.append(d);
   }
 }
 function renderList(source=null){
   const mount=$('pc-pizza-list');if(!mount)return;const opened=new Set([...mount.querySelectorAll('details[open]')].map(x=>x.dataset.uiKey));mount.replaceChildren();
   const items=(source||flavors());if(!items.length){mount.append(node('p','Nenhuma pizza cadastrada. Escolha o card Pizza para começar.'));return;}
   const categories=[...new Set(items.map(p=>p.categoria||'Pizzas'))];
   for(const category of categories){const rows=items.filter(p=>p.categoria===category);const d=node('details');d.dataset.uiKey='categoria-'+category;d.open=opened.has(d.dataset.uiKey);d.append(node('summary',category+' · '+rows.length+' sabores'));
     const tableWrap=node('div',undefined,'pc-table-wrap'),table=node('table',undefined,'pc-table'),head=node('tr');
     const labels=[...new Set(rows.flatMap(p=>(meta(p).variacoes||meta(p).tamanhos||[]).map(v=>v.nome)))];
     d.querySelector('summary').textContent += ' · '+labels.length+' tamanhos';
     head.append(node('th','Sabor'),...labels.map(x=>node('th',x)),node('th','Ações'));table.append(head);
     const mobile=node('div',undefined,'pc-mobile');
     for(const p of rows){const vs=meta(p).variacoes||meta(p).tamanhos||[],tr=node('tr');tr.append(node('td',p.nome+(p.ativo===false?' · Indisponível':'')));
       labels.forEach(label=>{const v=vs.find(x=>x.nome===label&&x.ativo!==false);tr.append(node('td',v?money(v.preco):'Não disponível'));});
       const acts=node('td');acts.append(button('Editar',()=>open(p.id)),button('Excluir',()=>removeFlavor(p),'danger'));tr.append(acts);table.append(tr);
       const card=node('div',undefined,'pc-card');card.append(node('h3',p.nome));const ps=node('div',undefined,'pc-prices');labels.forEach(label=>{const v=vs.find(x=>x.nome===label);ps.append(node('span',label+': '+(v?money(v.preco):'Não disponível'),'pc-price'));});card.append(ps,button('Editar',()=>open(p.id)),button('Excluir',()=>removeFlavor(p),'danger'));mobile.append(card);
     }
     tableWrap.append(table);d.append(tableWrap,mobile);mount.append(d);
   }
 }
 function removeFlavor(p){if(!data)return open(p.id);if(confirm('Excluir o sabor '+p.nome+'? Os pedidos anteriores serão preservados.'))save('excluir_sabor',{id:p.id});}
 function render(){
   for(const id of ['pc-size-form','pc-flavor-form','pc-borda-form','pc-adicional-form'])$(id).hidden=true;
   const list=$('pc-size-list');list.replaceChildren();
   for(const t of sizes()){const d=node('details');d.dataset.uiKey='tamanho-'+t.id;d.append(node('summary',t.nome+' · '+(t.ativo?'Disponível':'Indisponível')+' · '+(t.permite_dividir?'Inteira ou até '+t.maximo+' sabores':'Inteira')));d.append(button('Editar tamanho',()=>editorSize(t)),button('Excluir tamanho',()=>{if(confirm('Excluir o tamanho '+t.nome+'?'))save('excluir_tamanho',{id:t.id});},'danger'));list.append(d);}
   renderList();renderGroups('borda');renderGroups('adicional');
   const categories=$('pc-categories');categories.replaceChildren();for(const c of catalog().categorias){const row=node('div',undefined,'pc-row');row.append(node('p',c.nome));if(c.tipo_padrao)row.append(node('span','Categoria padrão — protegida','pc-badge'));else row.append(button('Excluir categoria',()=>{if(confirm('Excluir a categoria '+c.nome+' se estiver vazia?'))save('excluir_categoria',{id:c.id});},'danger'));categories.append(row);}
   const reuse=$('pc-existing-group');reuse.replaceChildren(new Option('Selecione uma escolha existente',''));catalog().personalizacao_grupos.filter(g=>!g.uso_pizza).forEach(g=>reuse.add(new Option(g.nome,g.id)));
 }
 function choose(type){
   if(!discard())return;if(currentType==='addons'&&addonDirty&&type!=='addons'){if(!confirm('Há alterações não salvas nos adicionais. Deseja descartá-las?'))return;$('pc-addons-frame').contentWindow.location.reload();addonDirty=false;}dirty=false;currentType=type;
   $('pc-editor').hidden=type!=='pizza';$('pc-common').hidden=type!=='common';
   $('pc-common-list').hidden=type!=='common';$('pc-pizza-list-section').hidden=type!=='pizza';
   $('pc-addons').hidden=type!=='addons';
   for(const name of ['common','pizza','addons'])$('pc-type-'+name).setAttribute('aria-pressed',String(name===type));
   if(type==='addons'&&!$('pc-addons-frame').getAttribute('src'))$('pc-addons-frame').src='./personalizacoes.html?modo=adicionais&embedded=1&account_id='+encodeURIComponent(account)+'&segmento='+encodeURIComponent(segment);
 }
 function open(id){choose('pizza');if($('pc-editor').hidden)return;pendingProduct=id||null;if(!data){notice('Informe a chave do cadastro de pizzas e clique em Carregar.');$('pc-key').focus();return;}if(id){const p=flavors().find(p=>p.id===id);if(p)editorFlavor(p);else notice('Recarregue: este sabor não está disponível.',true);}else editorFlavor();}
 function init(a,s='restaurante'){
   if(account&&account!==String(a)){data=null;key='';$('pc-key').value='';$('pc-content').disabled=true;renderList([]);}
   account=String(a);segment=s;
   $('pc-type-addons').onclick=()=>choose('addons');$('pc-type-common').onclick=()=>choose('common');$('pc-type-pizza').onclick=()=>choose('pizza');
   $('pc-load').onclick=()=>{if(!discard())return;run(async()=>{key=$('pc-key').value.trim();if(!key)throw Error('Informe a chave administrativa de pizzas.');data=await request('consultar');dirty=false;render();notice('Cadastro carregado. Pizzas é a categoria padrão protegida.');if(pendingProduct){const id=pendingProduct;pendingProduct=null;open(id);}if(pendingCategories){pendingCategories=false, currentType='common', addonDirty=false, editor=null, restoring=false;$('pc-category-section').scrollIntoView({behavior:'smooth'});}});};
   $('pc-manage-categories').onclick=()=>{choose('pizza');if(data)$('pc-category-section').scrollIntoView({behavior:'smooth'});else {pendingCategories=true;notice('Carregue com sua chave administrativa para gerenciar as categorias.');$('pc-key').focus();}};
   $('pc-new-size').onclick=()=>editorSize();$('pc-new-flavor').onclick=()=>editorFlavor();
   for(const kind of ['borda','adicional'])$('pc-new-'+kind).onclick=()=>editorGroup(kind);
   $('pc-reuse').onclick=()=>{const g=catalog().personalizacao_grupos.find(g=>g.id===$('pc-existing-group').value);if(g)editorGroup($('pc-existing-kind').value,g);};
   $('pc-expand').onclick=()=>$('pc-pizza-list').querySelectorAll('details').forEach(d=>d.open=true);$('pc-collapse').onclick=()=>$('pc-pizza-list').querySelectorAll('details').forEach(d=>d.open=false);
   for(const b of document.querySelectorAll('[data-pc-section]'))b.onclick=()=>$('pc-'+b.dataset.pcSection).scrollIntoView({behavior:'smooth',block:'start'});
   choose(new URLSearchParams(location.search).get('tipo')==='pizza'?'pizza':'common');
 }
 window.addEventListener('message',async e=>{
   if(e.source!==$('pc-addons-frame')?.contentWindow||e.origin!==location.origin)return;
   if(e.data?.type==='cadastro-aviso')CadastroUI.notify(String(e.data.message),Boolean(e.data.error));
   if(e.data?.type==='cadastro-dirty')addonDirty=Boolean(e.data.dirty);
   if(e.data?.type==='cadastro-altura')$('pc-addons-frame').style.height=Math.min(30000,Math.max(600,Number(e.data.height)||600))+'px';
   if(e.data?.type==='cadastro-atualizado'&&String(e.data.accountId)===account&&data){
     if(dirty)return notice('Adicionais atualizados. Salve ou descarte sua edição e recarregue o cadastro de pizzas.',true);
     await run(async()=>{const view=CadastroUI.capture();data=await request('consultar');render();CadastroUI.restore(view);});
   }
 });
 window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
 return {init,open,isPizza,renderList};
})();
