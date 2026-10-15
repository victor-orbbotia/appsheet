(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.DashboardCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const estados={em_aberto:'Em montagem',aguardando_pix:'Aguardando Pix',comprovante_enviado:'Conferir comprovante',pagamento_na_entrega:'Aguardando aprovação · entrega',retirada_balcao:'Aguardando aprovação · retirada',pedido_aprovado:'Aprovado',em_preparo:'Em preparo',pronto_para_entrega:'Pronto para entrega',pronto_para_retirada:'Pronto para retirada',saiu_para_entrega:'Saiu para entrega',entregue:'Entregue',retirado:'Retirado',concluido:'Concluído',finalizado:'Finalizado',resolvido:'Finalizado',cancelado:'Cancelado',cancelado_cliente:'Cancelado pelo cliente',cancelado_atendente:'Cancelado pelo atendente'};
 const aliases={confirmado:'pedido_aprovado',pagamento_entrega:'pagamento_na_entrega',aberto:'em_aberto',carrinho:'em_aberto',rascunho:'em_aberto',balcao:'retirada_balcao',retirada:'retirada_balcao',preparando:'em_preparo',enviado:'saiu_para_entrega'};
 const normalizarEstado=v=>{const s=String(v||'').trim().toLowerCase();return aliases[s]||s;};
 const origens={whatsapp:'WhatsApp',webapp:'Cardápio digital',desconhecida:'Outra / não informada'};
 const recortes={periodo:'Pedidos criados no período',valor:'Aprovados e concluídos do período',cancelados:'Cancelados criados no período',sem_produto:'Registros sem produto no período',com_produto:'Registros com produto no período',ativos:'Ativos agora · todos os dias',atencao:'Precisam de atenção agora · todos os dias'};
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const dinheiro=c=>c==null?'—':Number.isSafeInteger(c)?new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(c/100):'Valor a conferir';
 const numero=n=>new Intl.NumberFormat('pt-BR').format(n);
 function dia(value=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(value);}
 function somar(data,dias){const d=new Date(data+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+dias);return d.toISOString().slice(0,10);}
 function dataISO(s){return /^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;}
 function intervalo(inicio,fim,hoje=dia()){
  if(!dataISO(inicio)||!dataISO(fim))throw Error('Informe as duas datas corretamente.');
  const dias=Math.round((Date.parse(fim+'T12:00:00Z')-Date.parse(inicio+'T12:00:00Z'))/86400000)+1;
  if(dias<1||dias>90||fim>hoje)throw Error('Escolha até 90 dias, sem datas futuras.');return {inicio,fim};
 }
 function data(s){return dataISO(s)?s.slice(8,10)+'/'+s.slice(5,7)+'/'+s.slice(0,4):'Data a conferir';}
 function horario(s){const t=new Date(s);return Number.isFinite(t.getTime())?new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(t):'Data a conferir';}
 function validar(r,conta,segmento,detalheId){
  const fail=()=>{throw Error('Não foi possível conferir a resposta. Tente atualizar a página.');};
  if(r?.status!=='sucesso'||r.contrato!=='dashboard_operacional_v1'||String(r.account_id)!==String(conta)||r.segmento!==segmento||!Number.isFinite(Date.parse(r.consultado_em)))fail();
  const inteiro=n=>Number.isSafeInteger(n)&&n>=0;
  if(detalheId){if(r.detalhe?.id!==detalheId||!Array.isArray(r.detalhe.itens)||!Number.isSafeInteger(r.detalhe.valor_centavos))fail();return r;}
  if(!r.resumo||!Array.isArray(r.diario)||r.diario.length>90||!Array.isArray(r.estados)||!Array.isArray(r.origens)||!Array.isArray(r.lista?.registros)||r.lista.registros.length>20||!dataISO(r.periodo?.inicio)||!dataISO(r.periodo?.fim))fail();
  for(const p of [r.resumo.atual,r.resumo.anterior]){
   if(!p||!['pedidos','com_produto','sem_produto','cancelados','pedidos_valor'].every(k=>inteiro(p[k]))||!Number.isSafeInteger(p.valor_centavos)||(p.ticket_centavos!==null&&!Number.isSafeInteger(p.ticket_centavos)))fail();
   if(p.com_produto+p.sem_produto!==p.pedidos||p.cancelados>p.pedidos||p.pedidos_valor>p.com_produto)fail();
  }
  if(!inteiro(r.resumo.ativos_agora)||!inteiro(r.resumo.atencao_agora)||!inteiro(r.lista.total)||!inteiro(r.lista.pagina)||r.lista.pagina<1)fail();
  if(!r.diario.every(x=>dataISO(x.dia)&&inteiro(x.pedidos)&&inteiro(x.com_produto))||!r.estados.every(x=>typeof x.estado==='string'&&inteiro(x.quantidade))||!r.origens.every(x=>Object.hasOwn(origens,x.origem)&&inteiro(x.quantidade)))fail();
  if(r.estados.reduce((n,x)=>n+x.quantidade,0)!==r.resumo.atual.pedidos||r.origens.reduce((n,x)=>n+x.quantidade,0)!==r.resumo.atual.pedidos||r.diario.reduce((n,x)=>n+x.pedidos,0)!==r.resumo.atual.pedidos)fail();
  if(!r.lista.registros.every(x=>/^[0-9a-f-]{36}$/i.test(x.id)&&Number.isSafeInteger(x.valor_centavos)&&typeof x.estado==='string'&&typeof x.com_produto==='boolean'))fail();return r;
 }
 function conversa(value,conta){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&new RegExp('^/app/accounts/'+String(conta).replace(/[^0-9]/g,'')+'/conversations/[1-9][0-9]*$').test(u.pathname)?u.href:null;}catch{return null;}}
 function comparacao(atual,anterior){if(anterior===0)return atual===0?'Sem variação no intervalo anterior':'Sem base no intervalo anterior';const d=atual-anterior;return (d>0?'+':'')+numero(d)+' em relação ao intervalo anterior';}
 function grafico(linhas){
  if(!linhas.length)return '';const w=760,h=210,pad=32,max=Math.max(1,...linhas.map(x=>x.pedidos));
  const x=i=>pad+(linhas.length===1?(w-pad*2)/2:i/(linhas.length-1)*(w-pad*2));const y=n=>h-pad-n/max*(h-pad*2);
  const path=k=>linhas.map((v,i)=>(i?'L':'M')+x(i).toFixed(1)+','+y(v[k]).toFixed(1)).join(' ');
  const points=linhas.map((v,i)=>`<circle cx="${x(i).toFixed(1)}" cy="${y(v.pedidos).toFixed(1)}" r="3" class="dash-dot"><title>${esc(data(v.dia))}: ${v.pedidos} criados, ${v.com_produto} com produto</title></circle>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Pedidos por dia de criação. Valores na tabela abaixo."><line x1="${pad}" y1="${h-pad}" x2="${w-pad}" y2="${h-pad}" class="dash-gridline"/><line x1="${pad}" y1="${pad}" x2="${w-pad}" y2="${pad}" class="dash-gridline"/><text x="3" y="${pad+4}">${max}</text><text x="12" y="${h-pad+4}">0</text><path d="${path('pedidos')}" class="dash-line"/><path d="${path('com_produto')}" class="dash-line dash-line-alt"/>${points}<text x="${pad}" y="${h-7}">${esc(data(linhas[0].dia).slice(0,5))}</text><text x="${w-pad}" y="${h-7}" text-anchor="end">${esc(data(linhas.at(-1).dia).slice(0,5))}</text></svg>`;
 }
 return {estados,normalizarEstado,origens,recortes,esc,dinheiro,numero,dia,somar,intervalo,data,horario,validar,conversa,comparacao,grafico};
});
