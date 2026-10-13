/* Contexto administrativo. Identidade e autorização continuam no servidor. */
window.ContextoConta = (() => {
  const loginPage=/\/acesso\.html$/.test(location.pathname);
  const origens=new Set([location.origin,'https://chat.orbbotia.com']);
  const valido=value=>/^[1-9]\d{0,14}$/.test(String(value??''));
  const params=new URLSearchParams(location.search);
  let conta=null,resolver,rejeitar;
  const pronta=new Promise((resolve,reject)=>{resolver=resolve;rejeitar=reject;});
  pronta.catch(()=>{});
  if(!loginPage){
    document.documentElement.classList.add('conta-pendente');
    const style=document.createElement('style');
    style.textContent='html.conta-pendente body{visibility:hidden!important}';
    document.head.append(style);
  }
  document.documentElement.classList.add('orbbotia-admin');
  if(loginPage)document.documentElement.classList.add('orbbotia-login');
  function definir(account){if(!valido(account))return false;conta=String(account);resolver(conta);return true;}
  function mensagemDoPainel(event){
    if(window.parent===window||event.source!==window.parent||!origens.has(event.origin))return null;
    let value;try{value=typeof event.data==='string'?JSON.parse(event.data):event.data;}catch{return null;}
    if(value?.event!=='appContext')return null;
    const account=value.data?.account?.id??value.data?.conversation?.account_id;
    if(!valido(account))return null;
    return {account:String(account),segmento:value.data?.segmento};
  }
  function solicitar(){if(window.parent===window)return;for(const origin of origens)window.parent.postMessage('chatwoot-dashboard-app:fetch-info',origin);}
  function bloquear(){if(!loginPage)document.documentElement.classList.add('conta-pendente');}
  function aprovar(account){if(String(account)!==conta||!valido(account))throw Error('conta_divergente');document.documentElement.classList.remove('conta-pendente');}
  function navegar(account,segmento){if(!valido(account)){bloquear();return;}bloquear();const url=new URL(location.href);url.searchParams.set('account_id',String(account));if(segmento)url.searchParams.set('segmento',segmento);location.replace(url.href);}
  if(loginPage)resolver(null);
  else if(params.has('account_id')){if(params.getAll('account_id').length!==1||!definir(params.get('account_id')))rejeitar(Error('conta_invalida'));}
  else if(window.parent===window)rejeitar(Error('conta_obrigatoria'));
  else{window.addEventListener('message',event=>{const contexto=mensagemDoPainel(event);if(contexto)definir(contexto.account);});solicitar();}
  return {valido,pronta,mensagemDoPainel,solicitar,navegar,bloquear,aprovar,get conta(){return conta;}};
})();
