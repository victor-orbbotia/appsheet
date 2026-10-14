'use strict';
// Identidade compartilhada entre as abas. A autorização real ocorre no servidor.
window.AdminSession = (() => {
 const config=window.ORBBOTIA_ADMIN||{},enabled=config.enabled!==false;
 const scriptUrl=new URL(document.currentScript.src),root=new URL('../',scriptUrl);
 const loginUrl=new URL('acesso.html',root),loginPage=location.pathname===loginUrl.pathname;
 const embeddedPage=new URLSearchParams(location.search).get('embedded')==='1'&&window.parent!==window;
 const routes=new Set(['admin-onboarding','admin-contas','empresa-config','empresa-config-salvar','conhecimento-dados','conhecimento-acao','profissionais-dados','profissionais-acao','pedidos-dados','pedidos-acao','produtos-dados','produtos-acao','cardapio-obter','cardapio-salvar','gerador-pdf-impresso','meia-pizza-admin','simulador-chatwoot']);
 const originalFetch=window.fetch.bind(window);
 let client=null,session=null,redirecting=false,navigation=null;
 const domReady=document.readyState==='loading'?new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true})):Promise.resolve();
 function goLogin(){if(redirecting)return;redirecting=true;loginUrl.searchParams.set('retorno',location.pathname+location.search);location.replace(loginUrl.href);}
 function safeReturn(value){try{const u=new URL(value||'index.html',root);if(u.origin===root.origin&&u.pathname.startsWith(root.pathname)&&u.pathname!==loginUrl.pathname)return u.href;}catch{}return new URL('index.html',root).href;}
 function banner(message){let bar=document.getElementById('admin-session-bar');if(!bar){bar=document.createElement('aside');bar.id='admin-session-bar';bar.setAttribute('aria-label','Sua sessão');bar.style.cssText='display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:10px 16px;background:#eef2ff;color:#312e81;font:14px system-ui;border-radius:12px;margin:8px;';document.body.prepend(bar);}bar.replaceChildren();const text=document.createElement('span');text.textContent=message;bar.append(text);return bar;}
 function showSession(){if(embeddedPage)return;const account=new URLSearchParams(location.search).get('account_id');const bar=banner(`${session.user.email||'Sessão ativa'}${account?' · Estabelecimento '+account:''}`);const button=document.createElement('button');button.type='button';button.textContent='Sair';button.style.cssText='min-height:44px;padding:8px 16px;margin-left:auto;border:1px solid #c7d2fe;border-radius:8px;background:white;color:#312e81;cursor:pointer';button.onclick=async()=>{button.disabled=true;await client.auth.signOut({scope:'local'});goLogin();};bar.append(button);}
 async function validarConta(account){
  const response=await originalFetch(config.apiOrigin+'/webhook/admin-contas',{headers:{Authorization:'Bearer '+session.access_token},redirect:'error'});
  if(!response.ok)throw Error('conta_nao_confirmada');
  const data=await response.json();
  if(!Array.isArray(data.contas)||!data.contas.some(a=>String(a.account_id)===account))throw Error('conta_nao_autorizada');
  const empresaResponse=await originalFetch(config.apiOrigin+'/webhook/empresa-config?account_id='+encodeURIComponent(account),{headers:{Authorization:'Bearer '+session.access_token},redirect:'error'});
  if(!empresaResponse.ok)throw Error('conta_nao_confirmada');
  const raw=await empresaResponse.json();const empresa=Array.isArray(raw)?raw[0]:raw;
  if(!empresa||String(empresa.account_id)!==account)throw Error('conta_inexistente');
  let modulos=empresa.modulos;
  if(typeof modulos==='string'){try{modulos=JSON.parse(modulos);}catch{modulos={};}}
  // Projeção exclusiva de navegação: nunca expor a configuração completa/credenciais.
  navigation=Object.freeze({accountId:account,segmento:String(empresa.segmento||''),modulos:Object.freeze(Object.fromEntries(['pedidos','produtos','conhecimento','profissionais','configuracoes'].map(key=>[key,modulos?.[key]===true])))});
 }

 if(enabled&&!loginPage){const style=document.createElement('style');style.textContent='html.admin-pending body{visibility:hidden}';document.head.append(style);document.documentElement.classList.add('admin-pending');}
 const ready=(async()=>{
  const account=loginPage?null:await window.ContextoConta.pronta;
  if(!enabled){if(!loginPage)throw Error('conta_nao_confirmada');return null;}
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.supabaseUrl||'')||!config.publishableKey||config.publishableKey.startsWith('sb_secret_'))throw Error('Acesso administrativo ainda não configurado. Solicite a configuração à equipe responsável.');
  // Reject legacy service_role JWTs accidentally pasted as the public key.
  try{if(JSON.parse(atob(config.publishableKey.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role==='service_role')throw Error('chave_privada');}catch(e){if(e.message==='chave_privada')throw Error('Use somente a chave pública do projeto para configurar o acesso.');}
  client=window.supabase.createClient(config.supabaseUrl,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  const result=await client.auth.getSession();if(result.error)throw result.error;session=result.data.session;
  client.auth.onAuthStateChange((event,next)=>{session=next;if(event==='SIGNED_OUT'&&!loginPage)goLogin();});
  if(!loginPage){if(!session){goLogin();throw Error('Entre para continuar.');}await validarConta(account);await domReady;showSession();document.documentElement.classList.remove('admin-pending');window.ContextoConta.aprovar(account);window.dispatchEvent(new Event('admin-pronto'));}
  return client;
 })();
 ready.catch(async error=>{await domReady;if(loginPage)return;window.ContextoConta.bloquear();if(error.message.startsWith('conta_'))return;document.documentElement.classList.remove('admin-pending');const box=document.createElement('main');box.style.cssText='max-width:640px;margin:40px auto;padding:24px;font:16px system-ui';const h=document.createElement('h1');h.textContent='Acesso administrativo';const p=document.createElement('p');p.textContent=error.message;box.append(h,p);document.body.replaceChildren(box);});
 window.fetch=async(input,init)=>{
  const url=new URL(input instanceof Request?input.url:String(input),location.href);
  const administrative=/^\/webhook(?:-test)?\//.test(url.pathname)&&routes.has(url.pathname.split('/').pop());
  if(!administrative)return originalFetch(input,init);
  if(url.origin!==config.apiOrigin)throw Error('destino_administrativo_invalido');
  await ready;
  const identidade=window.ContextoConta.conta;
  const requestAccount=url.searchParams.get('account_id')||(()=>{try{return JSON.parse(init?.body||'{}').account_id;}catch{return null;}})();
  if(requestAccount!=null&&String(requestAccount)!==identidade)throw Error('conta_divergente');
  const result=await client.auth.getSession();const current=result.data.session;
  if(result.error||!current){goLogin();throw Error('Sua sessão terminou. Entre novamente.');}
  const request=new Request(input,init),headers=new Headers(request.headers);
  headers.set('Authorization','Bearer '+current.access_token);headers.delete('x-pizza-admin-key');
  const response=await originalFetch(new Request(request,{headers,redirect:'error'}));
  if(response.status===403){await domReady;const bar=banner('Você não tem acesso a esta operação neste estabelecimento. Confira a conta e sua permissão.');const b=document.createElement('button');b.textContent='Trocar usuário';b.onclick=async()=>{await client.auth.signOut({scope:'local'});goLogin();};bar.append(b);}
  return response;
 };
 return {enabled,ready,safeReturn,get client(){return client;},get navigation(){return navigation;}};
})();
