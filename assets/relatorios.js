(function(){
'use strict';
const columns={
 pedidos:['id','created_at','cliente_nome','status','cliente_telefone','endereco_entrega','forma_pagamento','valor_total','itens','observacoes','deletado'],
 movimentos:['id','criado_em','caixa_id','pedido_id','tipo','meio','centavos','motivo','operador','original_id'],
 fechamentos:['id','aberto_em','fechado_em','inicial','esperado','contado','diferenca','motivo','aberto_por','fechado_por']
};
function csv(tipo,rows){
 const fields=columns[tipo];
 const labels={id:'Identificador',created_at:'Criação',cliente_nome:'Cliente',status:'Situação',cliente_telefone:'Telefone',endereco_entrega:'Destino',forma_pagamento:'Pagamento informado',valor_total:'Valor do pedido (R$)',itens:'Itens',observacoes:'Observações',deletado:'Arquivado',criado_em:'Data do movimento',caixa_id:'Caixa',pedido_id:'Pedido',tipo:'Tipo',meio:'Meio de pagamento',centavos:'Valor (R$)',motivo:'Descrição / motivo',operador:'Operador (ID)',original_id:'Movimento original',aberto_em:'Abertura',fechado_em:'Fechamento',inicial:'Saldo inicial (R$)',esperado:'Esperado (R$)',contado:'Contado (R$)',diferenca:'Diferença (R$)',aberto_por:'Aberto por (ID)',fechado_por:'Fechado por (ID)'};
 const quote=v=>{
 let s=v==null?'':typeof v==='object'?JSON.stringify(v):String(v);
 if(/^\s*[=+@-]/.test(s))s="'"+s;
 return '"'+s.replace(/"/g,'""')+'"';
 };
 return '\uFEFF'+[fields.map(key=>quote(labels[key])).join(';'),...rows.map(row=>fields.map(key=>{
 let v=row[key];
 if(v!=null&&['centavos','inicial','esperado','contado','diferenca'].includes(key))v=(Number(v)/100).toFixed(2).replace('.',',');
 if(v!=null&&key==='valor_total')v=Number(v).toFixed(2).replace('.',',');
 if(v&&['created_at','criado_em','aberto_em','fechado_em'].includes(key))v=new Date(v).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});
 return quote(v);
 }).join(';'))].join('\r\n');
}
if(typeof module==='object'){module.exports={csv};return;}
const $=id=>document.getElementById(id),form=$('exportar');
let account,url;
const descriptions={pedidos:'Pedidos pela criação, com a situação atual. Valores de pedidos não representam recebimentos.',movimentos:'Movimentos pela data do registro. Recebimentos e suprimentos são entradas; estornos, retiradas e despesas são saídas.',fechamentos:'Caixas pela data de fechamento, com valores esperados, contados e diferenças.'};
function clear(){ $('arquivo').hidden=true;if(url){URL.revokeObjectURL(url);url=null;} }
form.onchange=()=>{clear();$('base').textContent=descriptions[form.elements.tipo.value];};
form.onchange();
const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
form.elements.inicio.value=today;form.elements.fim.value=today;
form.onsubmit=async e=>{
 e.preventDefault();clear();$('gerar').disabled=true;$('gerar').textContent='Gerando arquivo…';
 const dados={tipo:form.elements.tipo.value,inicio:form.elements.inicio.value,fim:form.elements.fim.value};
 for(const field of form.elements)field.disabled=true;
 try{
 const response=await fetch(ORBBOTIA_ADMIN.apiOrigin+'/webhook/admin-caixa',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({account_id:account,acao:'exportar',dados}),signal:AbortSignal.timeout(30000)});
 const data=await response.json();
 if(!response.ok||data.status!=='sucesso'||data.account_id!==account||!Array.isArray(data.linhas))throw Error('Não foi possível gerar o relatório. Confira o período e, se houver muitos registros, escolha um intervalo menor.');
 $('baixar').hidden=!data.linhas.length;
 $('resultado').textContent=data.linhas.length?data.linhas.length+' registros · '+dados.inicio+' a '+dados.fim:'Nenhum registro encontrado no período.';
 if(data.linhas.length){url=URL.createObjectURL(new Blob([csv(dados.tipo,data.linhas)],{type:'text/csv;charset=utf-8'}));$('baixar').href=url;$('baixar').download=dados.tipo+'_'+dados.inicio+'_'+dados.fim+'.csv';}
 $('arquivo').hidden=false;
 }catch(error){$('mensagem').textContent=error.message;$('erro').showModal();}
 finally{for(const field of form.elements)field.disabled=false;$('gerar').disabled=false;$('gerar').textContent='Gerar arquivo CSV';}
};
AdminSession.ready.then(()=>{account=AdminSession.navigation.accountId;$('gerar').disabled=false;}).catch(()=>{});
})();
