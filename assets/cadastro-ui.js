/* Estado visual compartilhado pelos cadastros. */
window.CadastroUI = (() => {
 let timer;
 function notify(message, error=false) {
  if(window.parent!==window){window.parent.postMessage({type:'cadastro-aviso',message,error},location.origin==='null'?'*':location.origin);return;}
  let box=document.getElementById('cadastro-toast');
  if(!box){
   const style=document.createElement('style');
   style.textContent='#cadastro-toast{position:fixed;z-index:10000;top:max(16px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);width:min(520px,calc(100vw - 28px));display:flex;align-items:flex-start;gap:14px;padding:17px 18px;border:2px solid;border-radius:16px;box-shadow:0 16px 48px #0f172a55;font:15px/1.45 system-ui,sans-serif}#cadastro-toast[hidden]{display:none}#cadastro-toast[data-error="false"]{background:#e8fff2;border-color:#22a466;color:#075b39}#cadastro-toast[data-error="true"]{background:#fff0ed;border-color:#dc5947;color:#8f2419}#cadastro-toast .toast-icon{display:grid;place-items:center;flex:none;width:34px;height:34px;border-radius:50%;background:currentColor;font-size:22px;font-weight:800}#cadastro-toast .toast-icon span{color:#fff}#cadastro-toast .toast-copy{flex:1;min-width:0}#cadastro-toast strong{display:block;font-size:16px;line-height:1.2;margin-bottom:4px}#cadastro-toast .toast-close{flex:none;min-width:32px;min-height:32px;padding:0;border:0;border-radius:8px;background:transparent;color:inherit;font-size:22px;cursor:pointer}#cadastro-toast .toast-close:focus-visible{outline:3px solid currentColor;outline-offset:2px}';
   document.head.append(style);
   box=document.createElement('div');box.id='cadastro-toast';
   const icon=document.createElement('span');icon.className='toast-icon';icon.setAttribute('aria-hidden','true');icon.append(document.createElement('span'));
   const copy=document.createElement('div');copy.className='toast-copy';copy.append(document.createElement('strong'),document.createElement('span'));
   const close=document.createElement('button');close.type='button';close.className='toast-close';close.setAttribute('aria-label','Fechar aviso');close.textContent='×';close.onclick=()=>{box.hidden=true;clearTimeout(timer);};
   box.append(icon,copy,close);document.body.append(box);
  }
  const failed=Boolean(error);box.dataset.error=String(failed);box.setAttribute('role',failed?'alert':'status');box.setAttribute('aria-live',failed?'assertive':'polite');
  box.querySelector('.toast-icon span').textContent=failed?'!':'✓';
  box.querySelector('strong').textContent=failed?'Atenção':'Concluído';
  box.querySelector('.toast-copy span').textContent=String(message);
  box.hidden=false;clearTimeout(timer);timer=setTimeout(()=>box.hidden=true,failed?10000:6500);
 }
 function capture(root=document) {
  const nodes=[...root.querySelectorAll('details')],focus=document.activeElement;
  const anchor=[...root.querySelectorAll('[data-ui-key],section[id],form[id]')].find(n=>n.getBoundingClientRect().top>=0&&n.getBoundingClientRect().top<innerHeight);
  const focusRoot=focus?.closest('[id]');
  return {focusRoot:focusRoot?.id,focusIndex:focusRoot?[...focusRoot.querySelectorAll('input,button,select,textarea')].indexOf(focus):-1,x:scrollX,y:scrollY,anchor:anchor?.dataset.uiKey,anchorId:anchor?.id,top:anchor?.getBoundingClientRect().top,focus,focusKey:focus?.dataset.uiKey,focusId:focus?.id,open:nodes.filter(n=>n.open).map(n=>n.dataset.uiKey||n.dataset.groupId||n.id).filter(Boolean)};
 }
 function restore(s,root=document){
  for(const n of root.querySelectorAll('details'))if(s.open.includes(n.dataset.uiKey||n.dataset.groupId||n.id))n.open=true;
  const find=key=>[...root.querySelectorAll('[data-ui-key]')].find(n=>n.dataset.uiKey===key);
  const f=s.focus?.isConnected?s.focus:(s.focusId?document.getElementById(s.focusId):find(s.focusKey))||document.getElementById(s.focusRoot)?.querySelectorAll('input,button,select,textarea')[s.focusIndex];f?.focus?.({preventScroll:true});
  const a=s.anchorId?document.getElementById(s.anchorId):find(s.anchor);
  scrollTo({left:s.x,top:a&&a.getBoundingClientRect().height?scrollY+a.getBoundingClientRect().top-s.top:s.y,behavior:'instant'});
 }
 function abrirAjuda(origem, titulo='Como funciona?', acionador=document.activeElement){
  const fonte=typeof origem==='string'?document.getElementById(origem):origem;
  if(!fonte)return;
  let dialog=document.getElementById('cadastro-help-dialog');
  if(!dialog){
   const style=document.createElement('style');
   style.textContent='.cadastro-help-dialog{position:fixed;inset:0;margin:auto;width:min(560px,calc(100vw - 32px));max-height:min(80dvh,680px);padding:0;border:1px solid #c7d2fe;border-radius:16px;background:#fff;color:#172033;box-shadow:0 20px 60px #0f172a55;overflow:hidden}.cadastro-help-dialog::backdrop{background:#0f172acc;backdrop-filter:blur(3px)}.cadastro-help-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 20px;border-bottom:1px solid #e2e8f0}.cadastro-help-head h2{margin:0;font:700 20px/1.3 system-ui,sans-serif}.cadastro-help-close{min-width:40px;min-height:40px;border:1px solid #cbd5e1;border-radius:10px;background:#f8fafc;color:#172033;font-size:22px;cursor:pointer}.cadastro-help-body{max-height:calc(min(80dvh,680px) - 78px);overflow:auto;padding:20px;font:14px/1.6 system-ui,sans-serif}.cadastro-help-body ol{padding-left:22px}.cadastro-help-body li{margin:8px 0}.cadastro-help-dialog button:focus-visible{outline:3px solid #818cf8;outline-offset:2px}';
   document.head.append(style);
   dialog=document.createElement('dialog');dialog.id='cadastro-help-dialog';dialog.className='cadastro-help-dialog';dialog.setAttribute('aria-labelledby','cadastro-help-title');
   const head=document.createElement('div');head.className='cadastro-help-head';
   const heading=document.createElement('h2');heading.id='cadastro-help-title';
   const close=document.createElement('button');close.type='button';close.className='cadastro-help-close';close.setAttribute('aria-label','Fechar ajuda');close.textContent='×';close.onclick=()=>dialog.close();
   head.append(heading,close);const body=document.createElement('div');body.className='cadastro-help-body';dialog.append(head,body);
   dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
   document.body.append(dialog);
  }
  dialog.querySelector('#cadastro-help-title').textContent=titulo;
  dialog.querySelector('.cadastro-help-body').replaceChildren(...[...fonte.childNodes].map(node=>node.cloneNode(true)));
  dialog.onclose=()=>acionador?.focus?.({preventScroll:true});
  dialog.showModal();dialog.querySelector('.cadastro-help-close').focus();
 }
 return {notify,capture,restore,abrirAjuda};
})();
