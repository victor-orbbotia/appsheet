'use strict';
(async()=>{
 await AdminSession.ready;
 const $=id=>document.getElementById(id),account=AdminSession.navigation.accountId;
 const endpoint=window.ORBBOTIA_ADMIN.apiOrigin+'/webhook/admin-onboarding';
 const labels=['Modelo','Negócio','Personalizações','Catálogo','Revisão'];
 const models={restaurante:'Restaurante',lanchonete:'Lanchonete',pizzaria:'Pizzaria',hamburgueria:'Hamburgueria',acaiteria:'Açaíteria'};
 const advanced=new URLSearchParams(location.search).get('avancado')==='1';
 let data,step=1,busy=false,readRules=null;
 const hasRules=()=>{const c=CatalogoRegrasUI.capabilities(data?.onboarding.modelo,data?.onboarding.regras_catalogo);return c.pizza||c.personalizacao;};
 const nextStep=()=>step===2&&!hasRules()?4:Math.min(5,step+1);
 function url(path){const u=new URL(path,location.href);u.searchParams.set('account_id',account);if(data?.segmento)u.searchParams.set('segmento',data.segmento);if(path.startsWith('produtos/')){u.searchParams.set('onboarding','1');if(data?.onboarding.modelo==='pizzaria')u.searchParams.set('tipo','pizza');}return u.href;}
 function el(tag,text){const e=document.createElement(tag);if(text)e.textContent=text;return e;}
 function link(text,path){const a=el('a',text);a.href=url(path);return a;}
 async function request(acao,dados={}){const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account_id:account,acao,dados,versao_esperada:data?.onboarding.versao??null})});let j;try{j=await r.json();}catch{throw Error('Não foi possível confirmar a configuração. Atualize e tente novamente.');}if(!r.ok||j.status!=='sucesso')throw Error(j.mensagem||'Não foi possível carregar a configuração.');data=j;}
 function render(){
  if(advanced){renderAdvanced();return;}
  $('ob-status').textContent='';$('ob-steps').replaceChildren();
  labels.forEach((name,i)=>{if(i===2&&!hasRules())return;const b=el('button',`${i+1}. ${name}`);b.type='button';b.disabled=busy||i+1>data.onboarding.etapa;b.setAttribute('aria-current',step===i+1?'step':'false');b.onclick=()=>{if(busy)return;if($('ob-form').dataset.dirty==='true'&&!confirm('Há alterações não salvas. Deseja sair desta etapa?'))return;step=i+1;render();};$('ob-steps').append(b);});
  const done=data.onboarding.estado==='concluido';$('ob-form').hidden=done||!data.pode_editar;$('ob-complete').hidden=!done;
  $('ob-catalog').href=url('produtos/novo.html');$('ob-settings').href=url('configuracoes/index.html');$('ob-review').hidden=!data.pode_editar;
  if(!data.pode_editar&&!done){$('ob-status').textContent='O proprietário precisa concluir a configuração inicial.';return;}
  if(done)return;
  $('ob-form').dataset.dirty='false';$('ob-content').replaceChildren();const panel=$('ob-content');panel.append(el('h2',labels[step-1]));
  if(step===1){panel.append(el('p','Escolha um ponto de partida. Você poderá ajustar os recursos no catálogo.'));const grid=el('div');grid.className='ob-models';for(const [value,name] of Object.entries(models)){const label=el('label'),radio=el('input');radio.type='radio';radio.name='modelo';radio.value=value;radio.required=true;radio.checked=data.onboarding.modelo===value;label.append(radio,document.createTextNode(' '+name));grid.append(label);}panel.append(grid);}
  if(step===2){const name=el('input');name.id='ob-name';name.value=data.nome||'';name.required=true;name.minLength=2;name.maxLength=120;const label=el('label','Nome do estabelecimento');label.className='ob-field';label.append(name);panel.append(label);const logo=el('input');logo.id='ob-logo';logo.type='file';logo.accept='image/png,image/jpeg,image/webp';const ll=el('label','Logo opcional · PNG, JPG ou WebP até 2 MB');ll.className='ob-field';ll.append(logo);panel.append(ll,el('p','A logo é uma imagem pública. Não envie documentos ou informações privadas.'));if(data.onboarding.logo_path){const img=el('img');img.className='ob-logo';img.alt='Logo do estabelecimento';img.src=AdminSession.client.storage.from('logos-negocios').getPublicUrl(data.onboarding.logo_path).data.publicUrl;panel.append(img);}}
  if(step===3){panel.append(el('p','Estas regras orientam os novos cadastros. Os existentes só mudam após sua revisão e aplicação.'));readRules=CatalogoRegrasUI.render(panel,data.onboarding.modelo,data.onboarding.regras_catalogo);panel.append(el('p','Uma opção obrigatória precisa ser escolhida. Na pizza combinada, a escolha na inteira atende todas as partes; escolhas por parte precisam atender cada parte em que a opção é oferecida.'));}
  if(step===4){panel.append(el('p',`${data.produtos} item(ns) cadastrado(s). Use o cadastro atual para criar produtos, tamanhos e sabores.`));if(data.onboarding.novo)panel.append(el('p','Enquanto a configuração estiver pendente, os produtos ficam indisponíveis e o agente permanece desligado. Depois de concluir, revise e ative os itens no catálogo.'));const links=el('div');links.className='ob-links';links.append(link('Abrir catálogo','produtos/novo.html'));panel.append(links);}
  if(step===5){panel.append(el('p',`Estabelecimento: ${data.nome}`),el('p',`Modelo: ${models[data.onboarding.modelo]||'Não definido'}`),el('p',`${data.produtos} item(ns) cadastrado(s).`),el('p','Concluir não libera vendas nem liga o agente. Depois, revise disponibilidade, entrega, pagamento e atendimento nas telas existentes.'));}
  if(step===5&&data.onboarding.regras_catalogo)renderApplication(panel);
  $('ob-back').disabled=step===1;$('ob-save').textContent=step===5?'Concluir configuração':'Salvar e continuar';
 }
 function renderAdvanced(){
  document.querySelector('.ob-shell > header h1').textContent='Regras do negócio';
  document.querySelector('.ob-shell > header p').textContent='Ajuste os conjuntos e as regras do catálogo.';
  $('ob-status').textContent='';$('ob-steps').hidden=true;$('ob-complete').hidden=true;$('ob-form').hidden=!data.pode_editar;
  if(!data.pode_editar){$('ob-status').textContent='Somente o proprietário pode alterar estas regras.';return;}
  $('ob-form').dataset.dirty='false';$('ob-back').hidden=true;$('ob-pause').textContent='Voltar ao sistema';$('ob-save').textContent='Salvar conjunto de regras';
  const panel=$('ob-content');panel.replaceChildren();panel.append(el('h2','Configurações avançadas do catálogo'),el('p','Reveja o conjunto escolhido no início e ajuste os padrões. Salvar prepara os novos cadastros. Os atuais só mudam com aplicação revisada abaixo.'));
  readRules=CatalogoRegrasUI.render(panel,data.onboarding.modelo||'restaurante',data.onboarding.regras_catalogo,{avancado:true,permitirRecursos:false});renderApplication(panel);
 }
 function renderApplication(panel){
  const box=el('section');box.className='ob-panel';box.append(el('h3','Aplicar regras aos cadastros existentes'),el('p','Confira quais conjuntos serão alterados. Preços, produtos e vínculos serão preservados. A aplicação pode mudar a oferta de combinações e personalizações nos canais. Os tamanhos de pizza seguirão a oferta de pizza combinada escolhida.'));panel.append(box);
  const load=el('button','Gerar prévia das alterações');load.type='button';box.append(load);
  const items=el('div');box.append(items);let preview=null,draft={regras_catalogo:advanced?readRules():data.onboarding.regras_catalogo};
  const confirm=el('button','Aplicar alterações revisadas');confirm.type='button';confirm.hidden=true;box.append(confirm);
  load.onclick=async()=>{if(busy)return;busy=true;load.disabled=true;confirm.disabled=true;try{draft={...draft,regras_catalogo:advanced?readRules():data.onboarding.regras_catalogo};await request('prever_regras',draft);preview=data.previa;items.replaceChildren();const groupChecks=[],optionInputs=[];
   items.append(el('p',preview.tamanhos.length+' tamanho(s) de pizza serão revisados.'));
   for(const group of preview.grupos){const policy=preview.regras_catalogo[group.tipo==='borda'?'bordas':'adicionais'];const scope=policy.inteira&&policy.por_parte?'inteira e partes':policy.por_parte?'por parte':'inteira';const label=el('label',group.nome+' · '+((group.ativo?'Ativo':'Inativo')+' → '+(policy.ativo?'ativo':'inativo'))+' · '+scope+(group.pizza?' · cobrança na inteira: '+policy.cobranca_inteira+' / por parte: '+policy.cobranca_parte:''));label.className='ob-field';const check=el('input');check.type='checkbox';check.checked=true;label.prepend(check);items.append(label);groupChecks.push({id:group.id,check});}
   for(const option of preview.opcoes){const label=el('label',option.nome+' · limite atual: '+option.max_atual+' · '+(option.obrigatoria_atual?'obrigatória atualmente':'opcional atualmente'));label.className='ob-field';const required=el('input');required.type='checkbox';required.checked=option.obrigatoria;const max=el('input');max.type='number';max.min='1';max.max='999';max.step='1';max.value=option.max_quantidade;label.append(el('span','Obrigatória'),required,el('span','Máximo desta opção'),max);items.append(label);optionInputs.push({id:option.id,required,max});}
   items.oninput=()=>{draft={regras_catalogo:advanced?readRules():data.onboarding.regras_catalogo,grupo_ids:groupChecks.filter(x=>x.check.checked).map(x=>x.id),opcoes:Object.fromEntries(optionInputs.map(x=>[x.id,{obrigatoria:x.required.checked,max_quantidade:Number(x.max.value)}]))};confirm.disabled=true;load.textContent='Conferir nova prévia';};
   confirm.hidden=false;confirm.disabled=false;load.textContent='Recarregar prévia';
  }catch(e){CadastroUI.notify(e.message,true);}finally{busy=false;load.disabled=false;}};
  confirm.onclick=()=>execute(async()=>{await request('aplicar_regras',{...draft,regras_catalogo:advanced?readRules():draft.regras_catalogo,assinatura:preview.assinatura});});
 }
 async function execute(fn){if(busy)return;busy=true;document.querySelectorAll('#ob-form button,#ob-review').forEach(b=>b.disabled=true);try{await fn();busy=false;CadastroUI.notify('Configuração salva.');render();}catch(e){CadastroUI.notify(e.message,true);$('ob-status').textContent=e.message;}finally{busy=false;document.querySelectorAll('#ob-form button,#ob-review').forEach(b=>b.disabled=false);$('ob-back').disabled=step===1;}}
 $('ob-form').oninput=()=>{$('ob-form').dataset.dirty='true';};
 $('ob-form').onsubmit=e=>{e.preventDefault();execute(async()=>{if(advanced){await request('salvar_regras',{regras_catalogo:readRules()});return;}const d={etapa:nextStep()};if(step===1){d.modelo=document.querySelector('input[name=modelo]:checked').value;const previous=data.onboarding.regras_catalogo||{};d.regras_catalogo=CatalogoRegrasUI.defaults(d.modelo,d.modelo!==data.onboarding.modelo&&!previous.recursos_personalizados?{}:previous);}if(step===3)d.regras_catalogo=readRules();if(step===2){d.nome=$('ob-name').value.trim();const f=$('ob-logo').files[0];if(f){if(f.size>2097152||!['image/png','image/jpeg','image/webp'].includes(f.type))throw Error('Escolha PNG, JPG ou WebP de até 2 MB.');const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[f.type];const path=account+'/'+crypto.randomUUID()+'.'+ext;const result=await AdminSession.client.storage.from('logos-negocios').upload(path,f,{contentType:f.type,upsert:false});if(result.error)throw Error('Não foi possível enviar a logo. Tente novamente ou continue sem imagem.');d.logo_path=path;}}await request(step===5?'concluir':'salvar',d);step=d.etapa;});};
 $('ob-back').onclick=()=>{if($('ob-form').dataset.dirty==='true'&&!confirm('Há alterações não salvas. Deseja voltar mesmo assim?'))return;step=step===4&&!hasRules()?2:Math.max(1,step-1);render();};
 $('ob-pause').onclick=()=>{if($('ob-form').dataset.dirty==='true'&&!confirm('As alterações desta etapa ainda não foram salvas. Deseja pausar mesmo assim?'))return;const u=new URL(url('index.html'));u.searchParams.set('configuracao','pausada');$('ob-form').dataset.dirty='false';location.href=u.href;};
 $('ob-review').onclick=()=>execute(async()=>{await request('revisar');step=1;});
 window.addEventListener('beforeunload',e=>{if($('ob-form').dataset.dirty==='true'){e.preventDefault();e.returnValue='';}});
 try{await request('consultar');step=data.onboarding.etapa;if(step===3&&!hasRules())step=4;render();}catch(e){$('ob-status').textContent=e.message;CadastroUI.notify(e.message,true);}
})().catch(()=>{});
