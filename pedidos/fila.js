(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FilaPedidos=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const terminais=new Set(['cancelado','cancelado_cliente','cancelado_atendente','entregue','retirado','concluido','finalizado','resolvido']);
 const aliases={confirmado:'pedido_aprovado',pagamento_entrega:'pagamento_na_entrega',aberto:'em_aberto',carrinho:'em_aberto',rascunho:'em_aberto',balcao:'retirada_balcao',retirada:'retirada_balcao',preparando:'em_preparo',enviado:'saiu_para_entrega'};
 const etapas={em_aberto:'Em montagem',aguardando_pix:'Aguardando Pix',comprovante_enviado:'Conferir comprovante',pagamento_na_entrega:'Aguardando aprovação',retirada_balcao:'Aguardando aprovação',pedido_aprovado:'Aprovado',em_preparo:'Em preparo',pronto_para_entrega:'Pronto para entrega',pronto_para_retirada:'Pronto para retirada',saiu_para_entrega:'Saiu para entrega',entregue:'Entregue',retirado:'Retirado',concluido:'Concluído',finalizado:'Finalizado',resolvido:'Finalizado',cancelado:'Cancelado',cancelado_cliente:'Cancelado pelo cliente',cancelado_atendente:'Cancelado pelo atendente'};
 const texto=v=>String(v??'');
 const normalizar=v=>texto(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const escapar=v=>texto(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function projetar(p){
  const bruto=normalizar(p.status),status=aliases[bruto]||bruto;
  const conhecido=Object.hasOwn(etapas,status),terminal=terminais.has(bruto)||terminais.has(status);
  const endereco=normalizar(p.endereco_entrega),modalidadeExplicita=normalizar(p.modalidade_entrega);
  const modalidade=modalidadeExplicita==='retirada'||/^(retirada|retirar|balc)/.test(endereco)||normalizar(p.forma_pagamento)==='retirada'?'retirada':modalidadeExplicita==='entrega'||endereco?'entrega':'conferir';
  const forma=normalizar(p.forma_pagamento);
  const pagamento=status==='comprovante_enviado'?'conferencia':status==='aguardando_pix'||['pagamento_na_entrega','retirada_balcao'].includes(status)?'pendente':'conferir';
  const situacao=pagamento==='conferencia'?'Comprovante em conferência':status==='aguardando_pix'?'Aguardando Pix':pagamento==='pendente'?'Pagamento a receber':'Recebimento a conferir';
  return {p,status,conhecido,terminal,etapa:etapas[status]||'Estado a conferir',modalidade,pagamento,
   modalidadeTexto:modalidade==='retirada'?'Retirada':modalidade==='entrega'?'Entrega':'Modalidade a conferir',
   pagamentoTexto:forma&&forma!=='retirada'?`${forma==='pix'?'Pix':forma==='cartao'?'Cartão':forma==='dinheiro'?'Dinheiro':texto(p.forma_pagamento)} · ${situacao}`:situacao,
   atencao:!terminal&&(!conhecido||p.editado===true||modalidade==='conferir'||['comprovante_enviado','pagamento_na_entrega','retirada_balcao'].includes(status)),
   alertas:[p.editado===true?'Pedido editado — confira os itens':'',p.observacoes?texto(p.observacoes):'',!conhecido?'Estado não reconhecido: confira na conversa':''].filter(Boolean)};
 }
 function dia(value){const date=new Date(value);return Number.isFinite(date.getTime())?date.toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'}):null;}
 function filtrar(pedidos,f){return pedidos.map(x=>x.json||x).filter(p=>p&&p.id&&!p.deletado).map(projetar).filter(m=>{
  const q=normalizar(f.busca);return (f.recorte==='historico'?m.terminal:f.recorte==='atencao'?m.atencao:!m.terminal)&&
   (f.recorte==='historico'||!f.periodo||(f.periodo==='hoje'?dia(m.p.created_at)===dia(f.agora??Date.now()):dia(m.p.created_at)!==dia(f.agora??Date.now())))&&
   (!q||normalizar([m.p.id,m.p.cliente_nome,m.p.cliente_telefone,m.p.conversa_id].join(' ')).includes(q))&&
   (!f.etapa||m.status===f.etapa)&&(!f.modalidade||m.modalidade===f.modalidade)&&(!f.pagamento||m.pagamento===f.pagamento);
 }).sort((a,b)=>data(b.p)-data(a.p)||texto(a.p.id).localeCompare(texto(b.p.id)));}
 function data(p){const t=Date.parse(p.created_at);return Number.isFinite(t)?t:0;}
 function idade(p,agora=Date.now()){const t=data(p);if(!t||t>agora)return 'Criação a conferir';const minutos=Math.floor((agora-t)/60000);return minutos<60?`${minutos} min desde criação`:minutos<1440?`${Math.floor(minutos/60)} h desde criação`:`${Math.floor(minutos/1440)} d desde criação`;}
 function itens(p){return (Array.isArray(p.itens)?p.itens:[]).map(i=>{
  const partes=i.meia_pizza?.partes||i.partes||[];const mods=i.meia_pizza?.modificadores||i.modificadores||[];
  const linhas=partes.map(s=>`${s.fracao?`${s.fracao.numerador}/${s.fracao.denominador}`:s.percentual?`${s.percentual}%`:''} ${s.nome||'Sabor'}${s.variacao?' · '+s.variacao:''}`.trim());
  for(const m of mods){const destino=m.escopo==='parte'?partes.find(s=>s.produto_id===m.produto_id)?.nome||'parte a conferir':m.escopo==='inteira'?'pizza inteira':'';linhas.push(`${m.quantidade||1}× ${m.nome||'Opção'}${m.grupo_nome?' · '+m.grupo_nome:''}${destino?' · '+destino:''}`);}
  return {titulo:`${i.quantidade??1}× ${i.nome||'Item'}${i.variacao?' · '+i.variacao:''}`,linhas};
 });}
 return {projetar,filtrar,idade,itens,escapar,dia};
});
