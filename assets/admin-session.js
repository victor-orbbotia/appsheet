'use strict';
// Identidade compartilhada entre as abas. A autorização real ocorre no servidor.
window.AdminSession = (() => {
 const config=window.ORBBOTIA_ADMIN||{},enabled=config.enabled!==false;
 const scriptUrl=new URL(document.currentScript.src),root=new URL('../',scriptUrl);
 const route=(value,base=root)=>window.OrbbotiaRoutes?OrbbotiaRoutes.url(value,base):new URL(value,base);
 const loginUrl=route('acesso.html'),loginPage=location.pathname===loginUrl.pathname||window.OrbbotiaRoutes?.source==='acesso.html';
 const embeddedPage=new URLSearchParams(location.search).get('embedded')==='1'&&window.parent!==window;
 const routes=new Set(['dashboard-dados','admin-onboarding','admin-contas','empresa-config','empresa-config-salvar','conhecimento-dados','conhecimento-acao','profissionais-dados','profissionais-acao','pedidos-dados','pedidos-acao','produtos-dados','produtos-acao','cardapio-obter','cardapio-salvar','gerador-pdf-impresso','meia-pizza-admin','simulador-chatwoot','webapp-publico-admin']);
 const originalFetch=window.fetch.bind(window);
 let client=null,session=null,redirecting=false,navigation=null,identity=null,sessionChanged=false,trocarUsuarioNaSaida=false;
 const domReady=document.readyState==='loading'?new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true})):Promise.resolve();
 function goLogin(){if(redirecting)return;redirecting=true;loginUrl.searchParams.set('retorno',trocarUsuarioNaSaida?safeReturn(location.pathname+location.search,{trocarUsuario:true}):location.pathname+location.search);location.replace(loginUrl.href);}
 function safeReturn(value,{trocarUsuario=false}={}){try{const u=route(value||'index.html');if(u.origin===root.origin&&u.pathname.startsWith(root.pathname)&&u.pathname!==loginUrl.pathname){if(trocarUsuario){const start=route('index.html');start.searchParams.set('retomar_configuracao','1');return start.href;}return u.href;}}catch{}return route('index.html').href;}
 function userIdentity(value){return value?.user?.id||value?.user?.email||null;}
 function invalidarIdentidade(){
  if(loginPage||sessionChanged||redirecting)return;
  sessionChanged=true;redirecting=true;navigation=null;window.ContextoConta.bloquear();document.documentElement.classList.add('admin-pending');
  const next=window.parent===window?new URL(safeReturn(null,{trocarUsuario:true})):new URL(location.href);
  location.replace(next.href);
 }
 function conferirIdentidade(current=session){
  if(!loginPage&&(sessionChanged||userIdentity(current)!==identity)){
   invalidarIdentidade();const error=Error('A sessão mudou. Validando o novo acesso.');error.acessoTratado=true;throw error;
  }
 }
 function banner(message){let bar=document.getElementById('admin-session-bar');if(!bar){bar=document.createElement('aside');bar.id='admin-session-bar';bar.setAttribute('aria-label','Sua sessão');bar.style.cssText='display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:10px 16px;background:#eef2ff;color:#312e81;font:14px system-ui;border-radius:12px;margin:8px;';document.body.prepend(bar);}bar.replaceChildren();const text=document.createElement('span');text.textContent=message;bar.append(text);return bar;}
 function showSession(){if(embeddedPage)return;const bar=banner(`${session.user.email||'Sessão ativa'}${navigation?.nome?' · '+navigation.nome:''}`);const button=document.createElement('button');button.type='button';button.textContent='Sair';button.style.cssText='min-height:44px;padding:8px 16px;margin-left:auto;border:1px solid #c7d2fe;border-radius:8px;background:white;color:#312e81;cursor:pointer';button.onclick=async()=>{button.disabled=true;trocarUsuarioNaSaida=true;await client.auth.signOut({scope:'local'});goLogin();};bar.append(button);}
 function avisoAcesso(tipo){
  let box=document.getElementById('admin-access-notice');
  if(!box){box=document.createElement('section');box.id='admin-access-notice';box.setAttribute('role','alert');document.body.append(box);}
  box.replaceChildren();const title=document.createElement('strong'),p=document.createElement('p'),button=document.createElement('button');button.type='button';
  const denied=tipo==='permissao';title.textContent=denied?'Acesso não permitido':'Não foi possível verificar o acesso';
  p.textContent=denied?'Seu usuário não tem permissão para esta operação neste estabelecimento.':'O serviço está demorando ou indisponível. Sua sessão foi mantida. Tente novamente.';
  button.textContent=denied?'Entrar com outro usuário':'Tentar novamente';button.onclick=denied?async()=>{trocarUsuarioNaSaida=true;if(client)await client.auth.signOut({scope:'local'});goLogin();}:()=>location.reload();
  box.append(title,p,button);
 }
 async function conferirResposta(response){
  if(response.status===401){goLogin();const e=Error('Entre novamente para continuar.');e.acessoTratado=true;throw e;}
  if(response.status===403||response.status===503){await domReady;avisoAcesso(response.status===403?'permissao':'indisponivel');const e=Error('Não foi possível concluir a consulta.');e.acessoTratado=true;e.tipoAcesso=response.status===403?'permissao':'indisponivel';throw e;}
  return response;
 }
 async function lerAcesso(url){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  try{conferirIdentidade();const response=await originalFetch(url,{headers:{Authorization:'Bearer '+session.access_token},redirect:'error',signal:controller.signal});
   conferirIdentidade();await conferirResposta(response);
   if(!response.ok)throw Error('acesso_indisponivel');
   const data=await response.json();conferirIdentidade();return data;
  }catch(error){if(error.acessoTratado)throw error;throw Error('Não foi possível verificar seu acesso agora. Tente novamente.');}
  finally{clearTimeout(timer);}
 }
 async function escolherEmpresa(contas){
  await domReady;
  const box=document.createElement('main');box.id='admin-company-picker';box.style.cssText='max-width:640px;margin:40px auto;padding:24px;font:16px system-ui';
  const h=document.createElement('h1');h.textContent='Escolha o estabelecimento';const p=document.createElement('p');p.textContent='Seu usuário tem acesso aos estabelecimentos abaixo.';box.append(h,p);
  for(const empresa of contas){const a=document.createElement('a');const u=route('index.html');u.searchParams.set('retomar_configuracao','1');u.searchParams.set('empresa',empresa.empresa);a.href=u.href;a.textContent=empresa.nome||'Estabelecimento';a.style.cssText='display:block;margin:12px 0;padding:16px;border:1px solid #7898bb;border-radius:10px;background:#203346;color:#eef3fc;text-decoration:none';box.append(a);}
  const logout=document.createElement('button');logout.type='button';logout.textContent='Entrar com outro usuário';logout.onclick=async()=>{trocarUsuarioNaSaida=true;await client.auth.signOut({scope:'local'});goLogin();};box.append(logout);const style=document.createElement('style');style.textContent='body.admin-escolhendo > :not(#admin-company-picker){display:none!important}';document.head.append(style);document.body.append(box);document.body.classList.add('admin-escolhendo');document.documentElement.classList.remove('admin-pending');document.documentElement.classList.remove('conta-pendente');
  // A escolha navega e inicia uma página completa; módulos não iniciam enquanto ela está pendente.
  return new Promise(()=>{});
 }
 async function validarConta(){
  const data=await lerAcesso(config.apiOrigin+'/webhook/admin-contas');
  if(!Array.isArray(data?.contas))throw Error('Não foi possível verificar seu acesso agora. Tente novamente.');
  const contas=data.contas;
  const selecao=window.ContextoConta.selecao;
  let escolhida;
  if(selecao.tipo==='referencia')escolhida=contas.find(a=>String(a.empresa||'').toLowerCase()===selecao.empresa);
  else if(['legado','chatwoot'].includes(selecao.tipo)){const account=await window.ContextoConta.pronta;escolhida=contas.find(a=>String(a.account_id)===account);}
  else if(contas.length===1)escolhida=contas[0];
  else if(contas.length>1){if(contas.some(a=>!window.ContextoConta.referenciaValida(a.empresa)))throw Error('Não foi possível conferir os links dos estabelecimentos. Atualize o serviço de acesso.');return escolherEmpresa(contas);}
  if(!escolhida)throw Error('conta_nao_autorizada');
  if(!window.ContextoConta.referenciaValida(escolhida.empresa))throw Error('Não foi possível conferir o link deste estabelecimento. Atualize o serviço de acesso.');
  const account=String(escolhida.account_id);
  if(!window.ContextoConta.valido(account))throw Error('conta_inexistente');
  const raw=await lerAcesso(config.apiOrigin+'/webhook/empresa-config?account_id='+encodeURIComponent(account));const empresa=Array.isArray(raw)?raw[0]:raw;
  if(!empresa||String(empresa.account_id)!==account)throw Error('conta_inexistente');
  let modulos=empresa.modulos;
  if(typeof modulos==='string'){try{modulos=JSON.parse(modulos);}catch{modulos={};}}
  navigation=Object.freeze({userId:identity,accountId:account,empresa:String(escolhida.empresa).toLowerCase(),nome:String(escolhida.nome||empresa.nome_empresa||'Estabelecimento'),segmento:String(empresa.segmento||''),modulos:Object.freeze(Object.fromEntries(['pedidos','produtos','conhecimento','profissionais','configuracoes'].map(key=>[key,modulos?.[key]===true])))});
  window.ContextoConta.definir(account,navigation.segmento);
  if(window.parent===window){
   let anterior=null;try{anterior=JSON.parse(sessionStorage.getItem('orbbotia:ultimo-acesso')||'null');sessionStorage.setItem('orbbotia:ultimo-acesso',JSON.stringify({userId:identity,accountId:account}));}catch{}
   if(anterior&&(anterior.userId!==identity||anterior.accountId!==account)){
    const start=route('index.html');start.searchParams.set('empresa',navigation.empresa);start.searchParams.set('retomar_configuracao','1');
    if(location.pathname!==start.pathname){redirecting=true;window.ContextoConta.bloquear();location.replace(start.href);const error=Error('Abrindo o início do novo acesso.');error.acessoTratado=true;throw error;}
    const current=new URL(location.href);current.searchParams.delete('configuracao');current.searchParams.set('retomar_configuracao','1');history.replaceState(history.state,'',current.href);
   }
  }
  const clean=route(location.href);clean.searchParams.delete('account_id');clean.searchParams.delete('segmento');clean.searchParams.set('empresa',navigation.empresa);
  history.replaceState(history.state,'',clean.href);
  window.dispatchEvent(new Event('admin-contexto-resolvido'));
  return account;
 }

 if(enabled&&!loginPage){const style=document.createElement('style');style.textContent='html.admin-pending body{visibility:hidden}';document.head.append(style);document.documentElement.classList.add('admin-pending');}
 const ready=(async()=>{
  if(!loginPage&&window.ContextoConta.selecao.tipo==='invalida')await window.ContextoConta.pronta;
  if(!enabled){if(!loginPage)throw Error('conta_nao_confirmada');return null;}
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.supabaseUrl||'')||!config.publishableKey||config.publishableKey.startsWith('sb_secret_'))throw Error('Acesso administrativo ainda não configurado. Solicite a configuração à equipe responsável.');
  // Reject legacy service_role JWTs accidentally pasted as the public key.
  try{if(JSON.parse(atob(config.publishableKey.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role==='service_role')throw Error('chave_privada');}catch(e){if(e.message==='chave_privada')throw Error('Use somente a chave pública do projeto para configurar o acesso.');}
  client=window.supabase.createClient(config.supabaseUrl,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  const result=await client.auth.getSession();if(result.error){if(!loginPage&&[400,401,403].includes(result.error.status))goLogin();throw Error('Não foi possível verificar sua sessão. Tente novamente.');}session=result.data.session;identity=userIdentity(session);
  client.auth.onAuthStateChange((event,next)=>{session=next;if(event==='SIGNED_OUT'&&!loginPage){goLogin();return;}if(!loginPage&&userIdentity(next)!==identity)invalidarIdentidade();});
  if(!loginPage){if(!session){goLogin();throw Error('Entre para continuar.');}const account=await validarConta();await domReady;conferirIdentidade();showSession();document.documentElement.classList.remove('admin-pending');window.ContextoConta.aprovar(account);window.dispatchEvent(new Event('admin-pronto'));}
  return client;
 })();
 ready.catch(async error=>{await domReady;if(loginPage)return;window.ContextoConta.bloquear();if(redirecting)return;if(error.acessoTratado||['conta_nao_autorizada','conta_invalida','conta_inexistente'].includes(error.message)){document.body.replaceChildren();document.documentElement.classList.remove('admin-pending');document.documentElement.classList.remove('conta-pendente');avisoAcesso(error.message.startsWith('conta_')?'permissao':error.tipoAcesso||'indisponivel');return;}if(error.message.startsWith('conta_'))return;const box=document.createElement('main');box.style.cssText='max-width:640px;margin:40px auto;padding:24px;font:16px system-ui';const h=document.createElement('h1');h.textContent='Não foi possível abrir o sistema';const p=document.createElement('p');p.textContent=error.message;const retry=document.createElement('button');retry.type='button';retry.textContent='Tentar novamente';retry.onclick=()=>location.reload();box.append(h,p,retry);document.body.replaceChildren(box);document.documentElement.classList.remove('admin-pending');document.documentElement.classList.remove('conta-pendente');});
 window.fetch=async(input,init)=>{
  const url=new URL(input instanceof Request?input.url:String(input),location.href);
  const administrative=/^\/webhook(?:-test)?\//.test(url.pathname)&&routes.has(url.pathname.split('/').pop());
  if(!administrative)return originalFetch(input,init);
  if(url.origin!==config.apiOrigin)throw Error('destino_administrativo_invalido');
  await ready;
  conferirIdentidade();const identidade=window.ContextoConta.conta;
  const requestAccount=url.searchParams.get('account_id')||(()=>{try{return JSON.parse(init?.body||'{}').account_id;}catch{return null;}})();
  if(requestAccount!=null&&String(requestAccount)!==identidade)throw Error('conta_divergente');
  const result=await client.auth.getSession();const current=result.data.session;
  if(result.error||!current){goLogin();throw Error('Sua sessão terminou. Entre novamente.');}
  conferirIdentidade(current);const request=new Request(input,init),headers=new Headers(request.headers);
  headers.set('Authorization','Bearer '+current.access_token);headers.delete('x-pizza-admin-key');
  let response;try{response=await originalFetch(new Request(request,{headers,redirect:'error'}));}catch(error){if(error.name==='AbortError')throw error;await domReady;avisoAcesso('indisponivel');error.acessoTratado=true;throw error;}
  conferirIdentidade();await conferirResposta(response);
  return response;
 };
 return {enabled,ready,safeReturn,avisoAcesso,get client(){return client;},get navigation(){return navigation;}};
})();
