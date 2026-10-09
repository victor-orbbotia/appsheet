'use strict';
// Cadastro especializado integrado à página Produtos. A chave permanece em memória.
window.pizzasCadastro = (() => {
 const endpoint='https://n8n.orbbotia.com/webhook/meia-pizza-admin';
 let data=null, account='', segment='restaurante', key='', busy=false, dirty=false, pendingProduct=null, currentType='common', addonDirty=false, editor=null, restoring=false, activeSection='sizes', pizzaSource=[], pizzaGroupFilter='Todas';
 const $=id=>document.getElementById(id);
 const node=(tag,text,cls)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;if(cls)x.className=cls;return x;};
 const money=n=>Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 const meta=p=>{try{return typeof p.metadata==='string'?JSON.parse(p.metadata):p.metadata||{};}catch{return {};}};
 const isPizza=p=>meta(p).tipo_cadastro==='pizza';
 const errors={linha_com_sabores:'Este agrupamento ainda tem sabores vinculados. Mova os sabores antes de excluir.',linha_com_vinculos:'Este agrupamento ainda possui conjuntos exclusivos. Revise o alcance dos conjuntos antes de excluir.',linha_indisponivel:'Selecione um agrupamento disponível neste estabelecimento.',limite_bordas_incompativel:'O limite total de bordas é menor que as escolhas obrigatórias. Revise os limites dos conjuntos.',versao_catalogo_divergente:'O cadastro mudou em outra sessão. Recarregue e confira antes de salvar.',categoria_padrao_protegida:'Pizzas é uma categoria padrão. Seu nome e sua existência são protegidos.',categoria_com_vinculos:'Esta categoria ainda tem produtos ou configurações vinculadas. Remova ou transfira esses vínculos antes de excluir.',tamanho_com_sabores:'Este tamanho ainda está disponível em sabores. Edite os sabores e retire a disponibilidade antes de excluir.',tamanho_duplicado:'Já existe um tamanho com esse nome.',precos_obrigatorios:'Informe ao menos um tamanho disponível e seu preço.',vinculo_explicito_necessario:'Há uma variação antiga com esse nome. Confira os vínculos existentes antes de criar outra.',grupo_obrigatorio_impossivel:'A escolha obrigatória precisa de opções suficientes. Cadastre as opções com mínimo zero e depois ajuste a obrigatoriedade.',acesso_negado:'Confira o acesso administrativo deste estabelecimento.'};
 function notice(text,error=false){CadastroUI.notify(text,error);$('pc-status').textContent=text;}
 function button(text,fn,cls=''){const b=node('button',text,cls);b.type='button';b.onclick=fn;return b;}
 function field(parent,label,value='',type='text'){const l=node('label',label),i=node('input');i.type=type;i.value=value??'';if(type==='number'){i.min='0';i.step='0.01';}l.append(i);parent.append(l);return i;}
 function checkbox(parent,label,value=false){const l=node('label'),i=node('input');i.type='checkbox';i.checked=value;l.append(i,document.createTextNode(label));parent.append(l);return i;}
 function select(parent,label,choices,value){const l=node('label',label),s=node('select');for(const [v,t] of choices)s.add(new Option(t,v));if(value!==undefined)s.value=value;l.append(s);parent.append(l);return s;}
 function setSection(section){activeSection=section;for(const b of document.querySelectorAll('[data-pc-section]'))b.setAttribute('aria-selected',String(b.dataset.pcSection===section));for(const id of ['sizes','lines','flavors','borders','extras','items'])$('pc-'+id).hidden=id!==section;}
 function formSlot(id){const section={ 'pc-size-form':'sizes','pc-line-form':'lines','pc-flavor-form':'flavors','pc-borda-form':'borders','pc-adicional-form':'extras'}[id];setSection(section);const x=$(id);x.replaceChildren();x.hidden=false;x.className='pc-edit';x.oninput=()=>{dirty=true;};if(!restoring)requestAnimationFrame(()=>{x.scrollIntoView({behavior:'smooth',block:'start'});x.classList.remove('pc-edit-focus');void x.offsetWidth;x.classList.add('pc-edit-focus');x.querySelector('input:not([type=hidden]),select')?.focus({preventScroll:true});});return x;}
 const catalog=()=>data?.catalogo;
 const flavors=()=>catalog()?.produtos.filter(p=>isPizza(p)&&!p.deletado)||[];
 const sizes=()=>data?.tamanhos||[];
 const lines=()=>data?.linhas||[];
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
   data=await request(action,payload);dirty=false;
   const savedId=data.id||payload.id;
   render();
   restoring=true;
   if(action==='salvar_tamanho')editorSize(sizes().find(x=>x.id===savedId)||payload);
   else if(action==='salvar_sabor')editorFlavor(flavors().find(x=>x.id===savedId)||payload);
   else if(action==='salvar_grupo')editorGroup(payload.uso_pizza,catalog().personalizacao_grupos.find(x=>x.id===savedId)||payload);
   else if(action==='salvar_linha')editorLine(lines().find(x=>x.id===savedId)||payload);
   else if(action==='salvar_opcao'||action==='salvar_opcao_guiada'){const option=catalog().personalizacao_opcoes.find(x=>x.id===savedId);const g=catalog().personalizacao_grupos.find(x=>x.id===(option?.grupo_id||payload.grupo_id));editorOption(g.uso_pizza,g,catalog().personalizacao_opcoes.find(x=>x.id===savedId)||payload);}
   else if(editor&&!action.startsWith('excluir'))editor();
   restoring=false;
   if(typeof carregarLista==='function')await carregarLista();
   CadastroUI.restore(view);
   notice(action.startsWith('excluir')?'Exclusão concluída.':'Alteração salva.');
 });}
 function discard(){if(!dirty)return true;if(!confirm('Há alterações não salvas. Deseja descartá-las?'))return false;dirty=false;if(data)render();return true;}
 function editorSize(t={}){
   if(!discard())return;dirty=false;editor=()=>editorSize(t);const f=formSlot('pc-size-form');f.append(node('h3',t.id?'Editar tamanho':'Novo tamanho'));
   const grid=node('div',undefined,'pc-grid');f.append(grid);
   const name=field(grid,'Nome do tamanho',t.nome||'');name.placeholder='Pequena, Média, Grande…';name.maxLength=60;
   const slices=field(grid,'Quantidade de fatias (opcional)',t.fatias||'','number');slices.step='1';slices.max='100';
   const diameter=field(grid,'Diâmetro em cm (opcional)',t.diametro||'','number');diameter.max='200';
   const active=checkbox(f,'Disponível para venda',t.ativo!==false);active.closest('label').classList.add('pc-availability');const divide=checkbox(f,'Permitir combinar sabores neste tamanho',t.permite_dividir||false);
   f.append(node('p','O mesmo tamanho vale para inteira e dividida. Fatias não determinam a quantidade de sabores.'));
   const rules=node('div',undefined,'pc-grid');f.append(rules);
   const min=select(rules,'Mínimo ao combinar',[[2,'2 sabores'],[3,'3 sabores'],[4,'4 sabores']],t.minimo||2);
   const max=select(rules,'Máximo de sabores',[[2,'2 sabores'],[3,'3 sabores'],[4,'4 sabores']],t.maximo||2);
   const formula=select(rules,'Como cobrar a combinação?',[['maior','Sabor mais caro'],['media','Média dos sabores'],['proporcional','Proporcional às partes']],t.formula||'maior');
   const division=select(rules,'Como dividir?',[['iguais','Partes iguais'],['personalizada','Cliente escolhe proporções de 5% em 5%']],t.divisao||'iguais');
   const example=node('p');rules.append(example);function explain(){example.textContent=formula.value==='maior'?'Ex.: sabores de R$30 e R$50 → R$50.':formula.value==='media'?'Ex.: sabores de R$30 e R$50 → R$40.':'Ex.: 25% de R$30 + 75% de R$50 → R$45.';}formula.onchange=explain;explain();
   rules.hidden=!divide.checked;divide.onchange=()=>{rules.hidden=!divide.checked;};
   f.append(button('Salvar tamanho',()=>{if(!name.value.trim())return notice('Informe o nome do tamanho.',true);if(Number(max.value)<Number(min.value))return notice('O máximo precisa ser igual ou maior que o mínimo.',true);save('salvar_tamanho',{id:t.id,max_bordas:null,nome:name.value.trim(),fatias:slices.value||null,diametro:diameter.value||null,ativo:active.checked,permite_dividir:divide.checked,minimo:Number(min.value),maximo:Number(max.value),formula:formula.value,divisao:division.value});},'primary'));
 }
 function editorFlavor(p={}){
   if(!discard())return;dirty=false;editor=()=>editorFlavor(p);const f=formSlot('pc-flavor-form');f.append(node('h3',p.id?'Editar sabor':'Novo sabor'));
   const name=field(f,'Nome do sabor',p.nome||''),desc=field(f,'Descrição',p.descricao||''),image=field(f,'Endereço da imagem (opcional)',meta(p).imagem||'','url');
   const line=lines().length?select(f,'Agrupamento de pizzas',lines().filter(l=>l.ativo||l.id===p.pizza_linha_id).map(l=>[l.id,l.nome]),p.pizza_linha_id||lines().find(l=>l.padrao)?.id):null;
   const active=checkbox(f,'Disponível para venda',p.ativo!==false);active.closest('label').classList.add('pc-availability');const grid=node('div',undefined,'pc-grid');f.append(grid);
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
     save('salvar_sabor',{id:p.id,linha_id:line?.value,nome:name.value.trim(),descricao:desc.value.trim(),imagem:image.value.trim(),ativo:active.checked,precos:entries.map(e=>({tamanho_id:e.t.id,indisponivel:!e.available.checked,preco:e.price.value}))});
   },'primary'));
 }
 function editorLine(line={}){
   if(!discard())return;editor=()=>editorLine(line);const f=formSlot('pc-line-form');
   f.append(node('h3',line.id?'Editar agrupamento':'Novo agrupamento'));const name=field(f,'Nome do agrupamento',line.nome||'');
   f.append(node('p','Sabores do mesmo agrupamento podem combinar entre si.'));
   f.append(button('Salvar agrupamento',()=>{if(!name.value.trim())return notice('Informe o nome do agrupamento.',true);save('salvar_linha',{id:line.id,nome:name.value.trim(),ativo:true});},'primary'));
 }
 function renderLines(){
   const mount=$('pc-line-list');mount.replaceChildren();
   if(!data.linhas){mount.append(node('p','A configuração de agrupamentos ainda não está disponível neste cadastro.'));$('pc-new-line').disabled=true;return;}
   $('pc-new-line').disabled=false;
   for(const line of lines()){
    const d=node('details');d.dataset.uiKey='linha-'+line.id;const count=flavors().filter(p=>p.pizza_linha_id===line.id).length;
    d.append(node('summary',line.nome+' · '+count+' sabores'),button('Editar agrupamento',()=>editorLine(line)));
    if(!line.padrao)d.append(button('Excluir agrupamento',()=>{if(confirm('Excluir o agrupamento '+line.nome+'? Somente agrupamentos sem vínculos podem ser excluídos.'))save('excluir_linha',{id:line.id});},'danger'));
    for(const size of sizes()){
     const rule=(data.linha_tamanhos||[]).find(x=>x.linha_id===line.id&&x.tamanho_id===size.id),box=node('details');box.dataset.uiKey='regra-'+line.id+'-'+size.id;box.append(node('summary',size.nome+' · '+(rule?'Regra própria':'Regra do tamanho')));
     const formula=select(box,'Preço da combinação',[['maior','Sabor mais caro'],['media','Média dos sabores'],['proporcional','Proporcional às partes']],rule?.formula||size.formula);
     const division=select(box,'Divisão',[['iguais','Partes iguais'],['personalizada','Proporções de 5% em 5%']],rule?.divisao||size.divisao);
     const min=select(box,'Mínimo de sabores',[[2,'2'],[3,'3'],[4,'4']],rule?.minimo||size.minimo),max=select(box,'Máximo de sabores',[[2,'2'],[3,'3'],[4,'4']],rule?.maximo||size.maximo);
     box.oninput=()=>dirty=true;
     box.append(button('Salvar regra deste agrupamento',()=>save('regra_linha_tamanho',{linha_id:line.id,tamanho_id:size.id,formula:formula.value,divisao:division.value,minimo:Number(min.value),maximo:Number(max.value)})),button('Usar regra do tamanho',()=>save('regra_linha_tamanho',{linha_id:line.id,tamanho_id:size.id,herdar:true})));d.append(box);
    }
    mount.append(d);
   }
 }
 function newOption(kind){
   const groups=catalog().personalizacao_grupos.filter(g=>g.uso_pizza===kind&&g.ativo);
   if(groups.length<2)return editorOption(kind,groups[0]||{nome:kind==='borda'?'Bordas':'Adicionais'});
   if(!discard())return;const f=formSlot('pc-'+kind+'-form');f.append(node('h3','Em qual conjunto cadastrar?'));
   const group=select(f,'Conjunto',groups.map(g=>[g.id,g.nome]));f.append(button('Continuar',()=>editorOption(kind,groups.find(g=>g.id===group.value))));
 }
 function editorGroup(kind,g={}){
   if(!discard())return;dirty=false;const f=formSlot('pc-'+kind+'-form');f.append(node('h3',g.id?'Editar conjunto':'Novo conjunto de opções'));
   const name=field(f,kind==='borda'?'Nome do conjunto (ex.: Bordas recheadas)':'Nome do conjunto (ex.: Molhos)',g.nome||(kind==='borda'?'Borda':'Adicionais'));
   const scope=select(f,'Aplicar em',[['inteira','Pizza inteira'],['parte','Cada sabor/parte']],g.escopo_pizza||'inteira');
   const charge=select(f,'Como cobrar?',[],undefined);
   function update(){charge.replaceChildren();(scope.value==='inteira'?[['maior','Maior preço entre os sabores'],['media','Média dos preços'],['proporcional','Proporcional às partes']]:[['integral','Valor integral por parte'],['proporcional','Proporcional à parte']]).forEach(([v,t])=>charge.add(new Option(t,v)));}scope.onchange=update;update();charge.value=g.cobranca_pizza||charge.value;
   f.append(node('p','Cada opção conserva seu próprio limite de quantidade. Neste cadastro não há mínimo ou máximo total de escolhas.'));
   if(g.id)f.append(node('p','Editar esta escolha também altera os produtos que já a utilizam. Confira suas associações antes de salvar.'));
   const scopeLines=node('fieldset');scopeLines.append(node('legend','Onde oferecer este conjunto?'));
   const lineChecks=lines().map(l=>({id:l.id,input:checkbox(scopeLines,l.nome,!g.id||(data.linha_grupos||[]).some(x=>x.grupo_id===g.id&&x.linha_id===l.id))}));
   scopeLines.append(node('p','Todos começam marcados em um conjunto novo. Se desmarcar todos, este conjunto não aparecerá em nenhum agrupamento.'));f.append(scopeLines);
   f.append(button('Salvar conjunto',()=>save('salvar_grupo',{id:g.id,linhas_ids:lineChecks.filter(x=>x.input.checked).map(x=>x.id),nome:name.value.trim(),min_selecoes:0,max_selecoes:2147483647,ativo:true,uso_pizza:kind,escopo_pizza:scope.value,cobranca_pizza:charge.value}),'primary'));
 }
 function editorOption(kind,g,o={}){
   if(!discard())return;dirty=false;const f=formSlot('pc-'+kind+'-form');f.append(node('h3',(o.id?'Editar opção de ':'Nova opção de ')+g.nome));
   const name=field(f,'Nome',o.nome||''),price=field(f,'Acréscimo padrão (R$)',o.preco_padrao??0,'number');
   const repeat=kind==='borda'?null:checkbox(f,'Permitir repetir esta opção',o.permite_quantidade||false),max=field(f,kind==='borda'?'Máximo desta borda por pizza':'Quantidade máxima',kind==='borda'?Math.max(2,Number(o.max_quantidade)||2):o.max_quantidade||1,'number');max.step='1';max.min=kind==='borda'?'2':'1';
   const active=checkbox(f,'Opção disponível',o.ativo!==false);active.closest('label').classList.add('pc-availability');f.append(node('p','Preço vazio usa o padrão; zero é gratuito.'));
   const grid=node('div',undefined,'pc-grid');f.append(grid);
   const exceptionChecks=[];
   const prices=sizes().map(t=>{const saved=data.precos_tamanhos.find(x=>x.tamanho_id===t.id&&x.opcao_id===o.id);const box=node('div');grid.append(box);const available=checkbox(box,'Disponível em '+t.nome,!(data.bloqueios_tamanhos||[]).some(x=>x.tamanho_id===t.id&&x.opcao_id===o.id));return {t,available,original:saved?.preco??'',input:field(box,'Acréscimo em '+t.nome,saved?.preco??'','number')};});
   f.append(button('Salvar opção',()=>{if(!name.value.trim())return notice('Informe o nome da opção.',true);if(kind==='borda'&&(!Number.isInteger(Number(max.value))||Number(max.value)<2))return notice('Informe quantas unidades desta borda podem ser escolhidas (mínimo 2).',true);save(g.id?'salvar_opcao':'salvar_opcao_guiada',{uso_pizza:kind,id:o.id,grupo_id:g.id,nome:name.value.trim(),preco_padrao:price.value,permite_quantidade:kind==='borda'?true:repeat.checked,max_quantidade:kind==='borda'?Number(max.value):repeat.checked?Number(max.value):1,ativo:active.checked,excecoes_sabores:exceptionChecks.filter(x=>x.check.checked!==x.original).map(x=>({produto_id:x.id,remover:x.check.checked})),disponibilidade_tamanhos:prices.map(x=>({tamanho_id:x.t.id,disponivel:x.available.checked})),precos_tamanhos:prices.filter(x=>(x.input.value===''?null:Number(x.input.value))!==(x.original===''?null:Number(x.original))).map(x=>({tamanho_id:x.t.id,preco:x.input.value}))});},'primary'));

 }
 function renderGroups(kind){
   const mount=$('pc-'+kind+'-list');mount.replaceChildren();
   for(const g of catalog().personalizacao_grupos.filter(g=>g.uso_pizza===kind)){
     const d=node('details');d.dataset.uiKey='grupo-'+g.id;d.append(node('summary',g.nome+' · escolha por opção'));
     d.append(button('Editar regras',()=>editorGroup(kind,g)),button('Adicionar opção',()=>editorOption(kind,g)),button('Excluir conjunto',()=>{if(confirm('Excluir esta escolha e seus vínculos? Produtos que também usam esta escolha serão afetados.'))save('excluir_grupo',{id:g.id});},'danger'));
     for(const o of catalog().personalizacao_opcoes.filter(o=>o.grupo_id===g.id)){const row=node('div',undefined,'pc-row');row.append(node('p',o.nome+' · '+money(o.preco_padrao)+(o.ativo?'':' · Indisponível')),button('Editar',()=>editorOption(kind,g,o)),button('Excluir',()=>{if(confirm('Excluir a opção '+o.nome+' e seus preços?'))save('excluir_opcao',{id:o.id});},'danger'));d.append(row);}
     if(!catalog().categoria_personalizacao_grupos.some(x=>x.grupo_id===g.id&&x.categoria_id===data.categoria_padrao))d.append(node('p','Esta escolha ainda não foi aplicada à categoria padrão. Cadastre ao menos uma opção disponível.'));
     mount.append(d);
   }
 }
 const stockChoices=[['disponivel','Disponível'],['em_falta','Em falta'],['esgotado','Esgotado']];
 function stockControl(p){const s=node('select');s.setAttribute('aria-label','Estoque de '+p.nome);s.className='pc-stock';s.append(...stockChoices.map(([value,label])=>new Option(label,value)));s.value=meta(p).status_estoque||((meta(p).esgotado)?'esgotado':'disponivel');s.onchange=()=>changeStock(p,s);return s;}
 async function changeStock(p,control){const previous=meta(p).status_estoque||'disponivel';if(!discard()){control.value=previous;return;}control.disabled=true;
   try{const response=await fetch('https://n8n.orbbotia.com/webhook/produtos-acao',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'editar',account_id:account,id:p.id,nome:p.nome,metadata:{status_estoque:control.value,esgotado:control.value!=='disponivel'}})});const result=await response.json();if(!response.ok||['erro','error','pendencia'].includes(result.status||result.resultado?.status))throw Error(result.mensagem||'Não foi possível alterar o estoque.');if(data){data=await request('consultar');render();}if(typeof carregarLista==='function')await carregarLista();notice('Estoque de '+p.nome+' atualizado.');}
   catch(error){control.value=previous;notice(error.message,true);}finally{control.disabled=false;}
 }
 function renderList(source=null){
   if(source!==null)pizzaSource=source;
   const mount=$('pc-pizza-list'),filters=$('pc-pizza-filters');if(!mount||!filters)return;mount.replaceChildren();filters.replaceChildren();
   const items=pizzaSource.filter(p=>!p.deletado);
   const groupName=p=>lines().find(l=>l.id===(p.pizza_linha_id||catalog()?.produtos.find(x=>x.id===p.id)?.pizza_linha_id))?.nome||'Padrão';
   const groups=[...new Set(items.map(groupName))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
   if(pizzaGroupFilter!=='Todas'&&!groups.includes(pizzaGroupFilter))pizzaGroupFilter='Todas';
   for(const group of ['Todas',...groups]){const filter=button(group,()=>{pizzaGroupFilter=group;renderList();});filter.setAttribute('aria-pressed',String(group===pizzaGroupFilter));filters.append(filter);}
   const showInactive=$('pc-show-inactive').checked;
   const visible=items.filter(p=>(showInactive||(p.ativo!==false&&p.ativo!=='false'))&&(pizzaGroupFilter==='Todas'||groupName(p)===pizzaGroupFilter));
   if(!visible.length){mount.append(node('p',items.length?'Nenhum item nesta visão.':'Nenhuma pizza cadastrada. Cadastre um sabor para começar.'));return;}
   const wrap=node('div',undefined,'pc-list-scroll'),table=node('table',undefined,'pc-list-table'),head=node('thead'),headRow=node('tr');
   for(const label of ['Status','Produto','Categoria / Agrupamento','Opções e preços','Estoque','Ação'])headRow.append(node('th',label));head.append(headRow);table.append(head);
   const body=node('tbody');table.append(body);
   for(const p of visible){
     const active=p.ativo!==false&&p.ativo!=='false',row=node('tr');row.dataset.active=String(active);
     const status=node('td'),dot=node('span',undefined,'pc-status-dot');dot.dataset.active=String(active);dot.title=active?'Ativo':'Desativado';status.append(dot);row.append(status);
     const product=node('td'),name=node('strong',p.nome);product.append(name);if(p.descricao)product.append(node('small',p.descricao));row.append(product);
     const category=node('td');category.append(node('span',p.categoria||'Pizzas','pc-category-tag'),node('small','Agrupamento: '+groupName(p)));row.append(category);
     const prices=node('td');for(const v of meta(p).variacoes||meta(p).tamanhos||[])prices.append(node('span',v.nome+': '+(v.ativo===false?'Indisponível':money(v.preco)),'pc-price-tag'));if(!prices.childNodes.length)prices.append(node('small','Sem tamanho disponível'));row.append(prices);
     const stock=node('td');stock.append(stockControl(p));row.append(stock);
     const actions=node('td'),actionRow=node('div',undefined,'pc-list-actions');actionRow.append(button('Editar',()=>open(p.id)),button('Excluir',()=>removeFlavor(p),'danger'));actions.append(actionRow);row.append(actions);body.append(row);
   }
   wrap.append(table);mount.append(wrap);
 }
 function removeFlavor(p){if(!data)return open(p.id);if(confirm('Excluir o sabor '+p.nome+'? Os pedidos anteriores serão preservados.'))save('excluir_sabor',{id:p.id});}
 function render(){
   for(const id of ['pc-size-form','pc-flavor-form','pc-borda-form','pc-adicional-form','pc-line-form'])$(id).hidden=true;
   const list=$('pc-size-list');list.replaceChildren();
   for(const t of sizes()){const d=node('details');d.dataset.uiKey='tamanho-'+t.id;d.append(node('summary',t.nome+' · '+(t.ativo?'Disponível':'Indisponível')+' · '+(t.permite_dividir?'Inteira ou até '+t.maximo+' sabores':'Inteira')));d.append(button('Editar tamanho',()=>editorSize(t)),button('Excluir tamanho',()=>{if(confirm('Excluir o tamanho '+t.nome+'?'))save('excluir_tamanho',{id:t.id});},'danger'));list.append(d);}
   renderLines();renderList(flavors());renderGroups('borda');renderGroups('adicional');
   const categories=$('pc-categories');categories.replaceChildren();for(const c of catalog().categorias){const row=node('div',undefined,'pc-row');row.append(node('p',c.nome));if(c.tipo_padrao)row.append(node('span','Categoria padrão — protegida','pc-badge'));else row.append(button('Excluir categoria',()=>{if(confirm('Excluir a categoria '+c.nome+' se estiver vazia?'))save('excluir_categoria',{id:c.id});},'danger'));categories.append(row);}
 }
 function choose(type){
   if(!discard())return;if(currentType==='addons'&&addonDirty&&type!=='addons'){if(!confirm('Há alterações não salvas nos adicionais. Deseja descartá-las?'))return;$('pc-addons-frame').contentWindow.location.reload();addonDirty=false;}dirty=false;currentType=type;
   $('pc-editor').hidden=type!=='pizza';$('pc-common-tabs').hidden=type!=='common';
   if(type==='common')switchCommonTab(document.querySelector('[data-common-tab][aria-selected="true"]')?.dataset.commonTab||'new');
   else {$('pc-common').hidden=true;$('pc-common-list').hidden=true;}
   $('pc-addons').hidden=type!=='addons';
   if(type==='pizza')setSection(activeSection);
   for(const name of ['common','pizza','addons'])$('pc-type-'+name).setAttribute('aria-pressed',String(name===type));
   if(type==='addons'&&!$('pc-addons-frame').getAttribute('src'))$('pc-addons-frame').src='./personalizacoes.html?modo=adicionais&embedded=1&account_id='+encodeURIComponent(account)+'&segmento='+encodeURIComponent(segment);
   if(type==='addons')window.switchAddonTab?.(document.querySelector('[data-addon-tab][aria-selected="true"]')?.dataset.addonTab||'new');
 }
 function open(id){choose('pizza');if($('pc-editor').hidden)return;setSection('flavors');pendingProduct=id||null;if(!data){notice('Carregue o cadastro para continuar.');$('pc-load').focus();return;}if(id){const p=flavors().find(p=>p.id===id);if(p)editorFlavor(p);else notice('Recarregue: este sabor não está disponível.',true);}else editorFlavor();}
 function init(a,s='restaurante'){
   if(account&&(account!==String(a)||segment!==s)){
     $('pc-addons-frame').removeAttribute('src');$('pc-rules-frame').removeAttribute('src');addonDirty=false;dirty=false;editor=null;pendingProduct=null;
     for(const id of ['pc-size-form','pc-flavor-form','pc-borda-form','pc-adicional-form','pc-line-form']){$(id).replaceChildren();$(id).hidden=true;}data=null;key='';$('pc-key').value='';$('pc-load').hidden=false;if(!window.AdminSession?.enabled){$('pc-key').closest('label').hidden=false;$('pc-key-help').hidden=false;}$('pc-content').disabled=true;renderList([]);}
   account=String(a);segment=s;
   $('pc-type-addons').onclick=()=>choose('addons');$('pc-type-common').onclick=()=>choose('common');$('pc-type-pizza').onclick=()=>choose('pizza');
   $('pc-load').onclick=()=>{if(!discard())return;run(async()=>{key=$('pc-key').value.trim();if(!key&&!window.AdminSession?.enabled)throw Error('Informe a chave administrativa de pizzas.');data=await request('consultar');dirty=false;render();$('pc-load').hidden=true;$('pc-key').closest('label').hidden=true;$('pc-key-help').hidden=true;$('pc-status').textContent='Cadastro carregado.';if(pendingProduct){const id=pendingProduct;pendingProduct=null;open(id);}});};
   $('pc-new-line').onclick=()=>editorLine();
   $('pc-new-size').onclick=()=>editorSize();$('pc-new-flavor').onclick=()=>editorFlavor();
   for(const kind of ['borda','adicional']){ $('pc-new-'+kind).onclick=()=>newOption(kind);$('pc-new-group-'+kind).onclick=()=>editorGroup(kind);}
   $('pc-show-inactive').onchange=()=>renderList();
   for(const b of document.querySelectorAll('[data-pc-section]'))b.onclick=()=>setSection(b.dataset.pcSection);
   $('pc-help-toggle').onclick=()=>CadastroUI.abrirAjuda('pc-help','Cadastro de pizzas',$('pc-help-toggle'));
   if(window.AdminSession?.enabled){$('pc-key').closest('label').hidden=true;$('pc-key-help').hidden=true;$('pc-load').textContent='Carregar cadastro';AdminSession.ready.then(()=>{if(!data&&!busy)$('pc-load').click();}).catch(()=>{});}
   choose(new URLSearchParams(location.search).get('tipo')==='pizza'?'pizza':'common');
 }
 window.addEventListener('message',async e=>{
   const rulesFrame=e.source===$('pc-rules-frame')?.contentWindow;
   if(!rulesFrame&&e.source!==$('pc-addons-frame')?.contentWindow||e.origin!==location.origin)return;
   if(e.data?.type==='cadastro-aviso')CadastroUI.notify(String(e.data.message),Boolean(e.data.error));
   if(e.data?.type==='cadastro-dirty')addonDirty=Boolean(e.data.dirty);
   if(e.data?.type==='cadastro-pronto'&&String(e.data.accountId)===account)window.switchAddonTab?.(document.querySelector('[data-addon-tab][aria-selected="true"]')?.dataset.addonTab||'new');
   if(e.data?.type==='cadastro-altura')(rulesFrame?$('pc-rules-frame'):$('pc-addons-frame')).style.height=Math.min(30000,Math.max(600,Number(e.data.height)||600))+'px';
   if(e.data?.type==='cadastro-atualizado'&&String(e.data.accountId)===account&&data){
     const outra=rulesFrame?$('pc-addons-frame'):$('pc-rules-frame');
     if(!addonDirty&&outra.getAttribute('src'))outra.contentWindow?.location.reload();
     if(dirty)return notice('Adicionais atualizados. Salve ou descarte sua edição e recarregue o cadastro de pizzas.',true);
     await run(async()=>{const view=CadastroUI.capture();data=await request('consultar');render();CadastroUI.restore(view);});
   }
 });
 window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
 function canReload(){
   if(dirty&&!confirm('Há alterações não salvas na pizza. Deseja atualizar e descartá-las?'))return false;
   if(addonDirty&&!confirm('Há alterações não salvas nos adicionais. Deseja atualizar e descartá-las?'))return false;
   dirty=false;addonDirty=false;
   try{$('pc-addons-frame').contentWindow?.CadastroAdicionais?.descartarParaAtualizar();}catch{}
   try{$('pc-rules-frame').contentWindow?.CadastroAdicionais?.descartarParaAtualizar();}catch{}
   return true;
 }
 return {init,open,isPizza,renderList,canReload};
})();
