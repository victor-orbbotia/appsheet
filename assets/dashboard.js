'use strict';
(() => {
 const C=DashboardCore,$=id=>document.getElementById(id);
 let contexto=null,ultima=null,sequencia=0,controle=null,detalheControle=null,detalheSequencia=0;
 let filtros={inicio:C.somar(C.dia(),-6),fim:C.dia(),pagina:1,recorte:'periodo',busca:'',estado:'',origem:'todas'};
 const texto=(id,v)=>{$(id).textContent=v;};
 const html=(id,v)=>{$(id).innerHTML=v;};
 const estado=v=>C.estados[C.normalizarEstado(v)]||'Estado a conferir';
 function erro(message){texto('dash-error-text',message);$('dash-error').hidden=false;}
 function fechar(){detalheSequencia++;detalheControle?.abort();if($('dash-dialog').open)$('dash-dialog').close();}
 function abrir(titulo,conteudo){texto('dash-dialog-title',titulo);html('dash-dialog-body',conteudo);if(!$('dash-dialog').open)$('dash-dialog').showModal();}
 async function consultar(dados,signal,id){
  const url=new URL(ORBBOTIA_ADMIN.apiOrigin+'/webhook/dashboard-dados');
  for(const [k,v] of Object.entries({account_id:contexto.accountId,segmento:contexto.segmento,...dados}))url.searchParams.set(k,v);
  const res=await fetch(url,{signal,cache:'no-store'});
  const content=await res.text();let data;try{data=JSON.parse(content);}catch{throw Error('Não foi possível consultar os pedidos. Tente novamente.');}
  if(!res.ok||data?.status!=='sucesso'){
   const e=Error(data?.codigo==='modulo_indisponivel'?'O resumo de pedidos não está habilitado para este estabelecimento.':data?.codigo==='intervalo_invalido'?'Escolha até 90 dias, sem datas futuras.':'Não foi possível consultar os pedidos. Tente novamente.');
   e.bloqueado=res.status===401||res.status===403||data?.codigo==='acesso_negado';throw e;
  }
  return C.validar(data,contexto.accountId,contexto.segmento,id);
 }
 function card(label,value,note,recorte,icon,comparison=''){
  return `<button type="button" class="dash-card" data-recorte="${recorte}"><span class="dash-card-icon" aria-hidden="true">${icon}</span><span class="dash-card-label">${label}</span><strong class="dash-card-value">${C.esc(value)}</strong>${comparison?`<span class="dash-comparison">${C.esc(comparison)}</span>`:''}<span class="dash-card-note">${C.esc(note)} · Ver pedidos →</span></button>`;
 }
 function barras(rows,total,label){
  if(!total)return '<p>Nenhum registro no período selecionado.</p>';
  return rows.map(x=>{const width=Math.max(0,Math.min(100,100*x.quantidade/total));return `<div><div class="dash-row-top"><span>${C.esc(label(x))}</span><strong>${C.numero(x.quantidade)} <small>· ${width.toLocaleString('pt-BR',{maximumFractionDigits:1})}%</small></strong></div><div class="dash-track" aria-hidden="true"><div class="dash-fill ${x.origem==='desconhecida'?'unknown':''}" style="width:${width.toFixed(2)}%"></div></div></div>`;}).join('');
 }
 function render(r){
  ultima=r;filtros.pagina=r.lista.pagina;
  const p=r.resumo.atual,old=r.resumo.anterior;
  texto('dash-range',C.data(r.periodo.inicio)+' a '+C.data(r.periodo.fim));
  texto('dash-freshness','Última leitura · '+C.horario(r.consultado_em));
  html('dash-cards',[
   card('Pedidos criados',C.numero(p.pedidos),'Inclui cancelados e montagens','periodo','▤',C.comparacao(p.pedidos,old.pedidos)),
   card('Valor atual aprovado / concluído',C.dinheiro(p.valor_centavos),`${C.numero(p.pedidos_valor)} pedidos com produto · inclui entrega`,'valor','↗'),
   card('Ticket desses pedidos',C.dinheiro(p.ticket_centavos),'Mesma seleção de aprovados e concluídos','valor','◈'),
   card('Cancelados do período',C.numero(p.cancelados),'Pela criação · situação atual','cancelados','×',C.comparacao(p.cancelados,old.cancelados)),
   card('Ativos agora',C.numero(r.resumo.ativos_agora),'Inclui pedidos de dias anteriores','ativos','◷'),
   card('Precisam de atenção agora',C.numero(r.resumo.atencao_agora),'Conferência, aprovação ou dados a revisar','atencao','!')].join(''));
  texto('dash-empty-note',`${C.numero(p.sem_produto)} registros sem produto e ${C.numero(p.com_produto)} com produto no período. A presença de itens não comprova envio ou venda.`);
  html('dash-chart',C.grafico(r.diario));
  html('dash-days',r.diario.map(x=>`<tr><td>${C.data(x.dia)}</td><td>${C.numero(x.pedidos)}</td><td>${C.numero(x.com_produto)}</td></tr>`).join(''));
  html('dash-origins',barras(r.origens,p.pedidos,x=>C.origens[x.origem]));
  html('dash-states',barras(r.estados,p.pedidos,x=>estado(x.estado)));
  const first=r.cobertura?.primeiro_pedido?C.dia(new Date(r.cobertura.primeiro_pedido)):null;
  const notes=[];
  if(first&&filtros.inicio<first)notes.push('O primeiro pedido visível foi criado em '+C.data(first)+'. Não há histórico completo comprovado antes dessa data.');
  if(r.cobertura?.excluidos_periodo)notes.push(C.numero(r.cobertura.excluidos_periodo)+' registros excluídos ficaram fora deste resumo.');
  if(r.periodo.comparacao_parcial)notes.push('Comparação com o intervalo anterior até o mesmo horário no último dia.');
  texto('dash-coverage',notes.join(' '));$('dash-coverage').hidden=!notes.length;
  texto('dash-list-title',C.recortes[r.lista.recorte]);
  texto('dash-list-caption',r.lista.recorte==='ativos'||r.lista.recorte==='atencao'?'Situação atual, independente do período. Os filtros alteram apenas esta lista.':'Pela data de criação. Os filtros alteram apenas esta lista.');
  html('dash-order-rows',r.lista.registros.map(x=>`<tr><td><strong>#${C.esc(x.id.slice(0,8))}</strong><small>${C.esc(x.cliente||'Cliente não informado')}</small></td><td>${C.esc(C.horario(x.criado_em))}</td><td><span class="dash-badge ${x.atencao?'warn':''}">${C.esc(estado(x.estado))}</span>${!x.com_produto?'<small>Sem produto</small>':''}</td><td>${C.esc(C.origens[x.origem]||C.origens.desconhecida)}</td><td>${C.dinheiro(x.valor_centavos)}</td><td><button type="button" class="dash-detail-button" data-pedido="${C.esc(x.id)}">Detalhar →</button></td></tr>`).join(''));
  $('dash-no-orders').hidden=r.lista.total!==0;
  const pages=Math.max(1,Math.ceil(r.lista.total/20));
  texto('dash-list-count',C.numero(r.lista.total)+' pedidos neste recorte');texto('dash-page',r.lista.pagina+' / '+pages);
  $('dash-prev').disabled=r.lista.pagina<=1;$('dash-next').disabled=r.lista.pagina>=pages;
  $('dash-data').hidden=false;$('dash-data').inert=false;$('dash-data').removeAttribute('inert');
 }
 async function carregar(rolar=false){
  if(!contexto)return;
  let request;try{request={...filtros,...C.intervalo(filtros.inicio,filtros.fim)};}catch(e){erro(e.message);return;}
  const seq=++sequencia;controle?.abort();fechar();controle=new AbortController();
  const controller=controle,timer=setTimeout(()=>controller.abort(),20000);
  $('dash-error').hidden=true;$('dash-data').inert=true;$('dash-data').setAttribute('inert','');$('dash-data').setAttribute('aria-busy','true');texto('dash-freshness','Consultando pedidos…');
  try{
   const r=await consultar(request,controle.signal);if(seq!==sequencia)return;
   render(r);if(rolar)$('dash-orders').scrollIntoView({block:'start',behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  }catch(e){
   if(seq!==sequencia)return;
   if(e.bloqueado){ultima=null;$('dash-data').hidden=true;}
   texto('dash-freshness',ultima?'Dados desatualizados · leitura de '+C.horario(ultima.consultado_em):'Consulta indisponível');
   erro(e.name==='AbortError'?'A consulta demorou mais que o esperado. Tente novamente.':e.message);
  }finally{clearTimeout(timer);if(seq===sequencia)$('dash-data').setAttribute('aria-busy','false');}
 }
 function filtrosLista(){filtros={...filtros,pagina:1,busca:$('dash-search').value.trim(),estado:$('dash-state').value,origem:$('dash-origin').value};}
 async function detalhar(id){
  if(!ultima||$('dash-data').inert)return;
  detalheControle?.abort();detalheControle=new AbortController();const seq=++detalheSequencia;
  const controller=detalheControle,timer=setTimeout(()=>controller.abort(),20000);
  abrir('Pedido #'+id.slice(0,8),'<p role="status">Consultando detalhes…</p>');
  try{
   const r=await consultar({pedido_id:id},controller.signal,id);if(seq!==detalheSequencia||!$('dash-dialog').open)return;
   const p=r.detalhe;
   const linhas=p.itens.map(i=>{
    const partes=(i.partes||[]).map(x=>`<li>${C.esc(x.nome||'Sabor')}${x.variacao?' · '+C.esc(x.variacao):''}${x.fracao?.numerador&&x.fracao?.denominador?' · '+C.esc(x.fracao.numerador)+'/'+C.esc(x.fracao.denominador):''}</li>`).join('');
    const extras=(i.modificadores||[]).map(x=>{const parte=x.escopo==='parte'?(i.partes||[]).find(v=>v.produto_id===x.produto_id)?.nome||'Parte a conferir':x.escopo==='inteira'?'Item inteiro':'';return `<li>${C.esc(x.quantidade??1)}× ${C.esc(x.nome||'Opção')}${parte?' · '+C.esc(parte):''}</li>`;}).join('');
    const price=typeof i.preco==='number'&&Number.isFinite(i.preco)?C.dinheiro(Math.round(i.preco*100)):'Preço a conferir';
    return `<div class="dash-item"><strong>${C.esc(i.quantidade??'Quantidade a conferir')}× ${C.esc(i.nome||'Item a conferir')}${i.variacao?' · '+C.esc(i.variacao):''}</strong><p>${price} por unidade</p>${partes||extras?'<ul>'+partes+extras+'</ul>':''}</div>`;
   }).join('');
   const url=C.conversa(p.conversa_url,contexto.accountId);
   html('dash-dialog-body',`<p>${C.esc(p.cliente||'Cliente não informado')} · ${C.esc(C.horario(p.criado_em))}</p><p><span class="dash-badge">${C.esc(estado(p.estado))}</span></p><h3>Valor atual · ${C.dinheiro(p.valor_centavos)}</h3>${linhas||'<p>Sem itens registrados.</p>'}<h3>Entrega e pagamento</h3><p>${C.esc(p.endereco||'Endereço/retirada não informado')}</p><p>Forma selecionada: ${C.esc(p.pagamento||'Não informada')}</p><p>Aprovação ou entrega não comprova pagamento recebido.</p>${p.observacoes?'<h3>Observações</h3><p>'+C.esc(p.observacoes)+'</p>':''}${url?'<a href="'+C.esc(url)+'" target="_blank" rel="noopener noreferrer">Abrir conversa no Chatwoot →</a>':'<p>Conversa não disponível neste registro.</p>'}<p>Leitura de ${C.esc(C.horario(r.consultado_em))}. Alterações operacionais continuam na fila de pedidos.</p>`);
  }catch(e){if(seq===detalheSequencia&&$('dash-dialog').open)html('dash-dialog-body','<p role="alert">Não foi possível conferir este pedido. Feche e atualize a lista para tentar novamente.</p>');}
  finally{clearTimeout(timer);}
 }
 function ajuda(){abrir('Como funciona?',`<p>Este painel usa os pedidos registrados no estabelecimento. Não muda o atendimento nem os pedidos.</p><h3>Período de criação</h3><p>Os cartões e gráficos acompanham quando o pedido foi criado e como ele está agora. Incluem registros de teste não separados.</p><h3>Valores e ticket</h3><p>Somente pedidos com produto em estados aprovados ou posteriores entram no valor e ticket. Usamos o valor atual, incluindo entrega. Isso não confirma recebimento e não reconstrói o valor original da venda.</p><h3>Ativos e atenção</h3><p>Incluem dias anteriores ao período. Atenção reúne conferência, aprovação, edições e dados ou situações que precisam ser revisados.</p><h3>Sem produto e origem</h3><p>Montagens vazias ou somente com taxa ficam separadas. A origem informada não prova quem concluiu o pedido.</p><h3>Comparação e filtros</h3><p>A comparação usa o intervalo anterior de mesma duração. Se termina hoje, usa o mesmo horário no último dia. Os filtros abaixo dos gráficos alteram só a lista. Clique em um cartão para ver seus registros.</p><h3>Próximas informações</h3><p>Conversão, participação humana e financeiro dependem de registros complementares. Não são estimados neste painel.</p>`);}
 $('dash-help').onclick=ajuda;$('dash-close').onclick=fechar;
 $('dash-dialog').addEventListener('cancel',()=>{detalheSequencia++;detalheControle?.abort();});
 $('dash-dialog').addEventListener('click',e=>{if(e.target===$('dash-dialog')){const r=$('dash-dialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)fechar();}});
 $('dash-retry').onclick=()=>carregar();
 $('dash-period-select').onchange=()=>{const v=$('dash-period-select').value;$('dash-custom').hidden=v!=='custom';if(v==='custom')return;filtros={...filtros,fim:C.dia(),inicio:C.somar(C.dia(),1-Number(v)),pagina:1};$('dash-start').value=filtros.inicio;$('dash-end').value=filtros.fim;carregar();};
 $('dash-period').onsubmit=e=>{e.preventDefault();filtros={...filtros,inicio:$('dash-start').value,fim:$('dash-end').value,pagina:1};carregar();};
 $('dash-filter-form').onsubmit=e=>{e.preventDefault();filtrosLista();carregar();};
 $('dash-clear').onclick=()=>{$('dash-search').value='';$('dash-state').value='';$('dash-origin').value='todas';filtrosLista();carregar();};
 $('dash-prev').onclick=()=>{filtros.pagina--;carregar();};$('dash-next').onclick=()=>{filtros.pagina++;carregar();};
  $('dash-data').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||$('dash-data').inert)return;if(b.dataset.recorte){$('dash-search').value='';$('dash-state').value='';$('dash-origin').value='todas';filtrosLista();filtros.recorte=b.dataset.recorte;carregar(true);}else if(b.dataset.pedido)detalhar(b.dataset.pedido);});
 for(const [value,label] of Object.entries(C.estados)){const option=document.createElement('option');option.value=value;option.textContent=label;$('dash-state').append(option);}
 $('dash-start').value=filtros.inicio;$('dash-end').value=filtros.fim;$('dash-start').max=C.dia();$('dash-end').max=C.dia();
 AdminSession.ready.then(()=>{
  contexto=AdminSession.navigation;if(!contexto?.accountId||!contexto.segmento)throw Error('Estabelecimento não confirmado.');
  texto('nome-empresa','Visão do estabelecimento '+contexto.accountId);$('seletor-segmento').value=contexto.segmento;
  $('area-loading').hidden=true;$('area-modulos').classList.remove('hidden');
  if(!contexto.modulos.pedidos){$('dash-period').hidden=true;erro('O resumo de pedidos não está habilitado para este estabelecimento. Use o menu para acessar os módulos disponíveis.');$('dash-retry').hidden=true;return;}
  carregar();
 }).catch(()=>{});
})();
