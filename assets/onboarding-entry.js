'use strict';
// Convite para contas atuais; redirecionamento apenas no ponto de entrada.
AdminSession.ready.then(async()=>{
 const account=AdminSession.navigation.accountId;
 const url=new URL('onboarding.html',location.href);url.searchParams.set('account_id',account);
 const response=await fetch(ORBBOTIA_ADMIN.apiOrigin+'/webhook/admin-onboarding',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account_id:account,acao:'consultar'})});
 const data=await response.json();if(!response.ok||data.status!=='sucesso')throw Error('Configuração inicial indisponível. Tente atualizar a página.');
 if(data.onboarding.novo&&data.onboarding.estado==='pendente'&&data.pode_editar&&new URLSearchParams(location.search).get('configuracao')!=='pausada'){location.replace(url.href);return;}
 const box=document.createElement('section');box.className='home-intro';
 const title=document.createElement('h2');title.textContent=data.onboarding.estado==='pendente'?'Continue a configuração inicial':'Configuração do estabelecimento';
 const p=document.createElement('p');p.textContent='Revise o modelo, a identidade e os cadastros do seu estabelecimento.';
 const a=document.createElement('a');a.href=url.href;a.textContent=data.onboarding.estado==='pendente'?'Continuar configuração':'Revisar configuração inicial';
 box.append(title,p,a);const area=document.querySelector('.home-preview');if(area)area.prepend(box);
}).catch(()=>{const area=document.querySelector('.home-preview');if(!area)return;const p=document.createElement('p');p.setAttribute('role','alert');p.textContent='Não foi possível consultar a configuração inicial. Atualize a página para tentar novamente.';area.prepend(p);});
