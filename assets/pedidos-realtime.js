window.PedidosRealtime=(()=>{
 let stop=null;
 function iniciar({client,conta,atualizar,status}){
  stop?.();let encerrado=false,timer=null,channel=null,busy=false,pendente=false,usuario=null;
  const agenda=()=>{if(encerrado)return;pendente=true;clearTimeout(timer);timer=setTimeout(run,500);};
  async function run(){if(encerrado||document.hidden||busy)return;busy=true;pendente=false;try{await atualizar();}catch{if(!encerrado)status('Não foi possível atualizar. Tentaremos novamente.');}finally{busy=false;if(pendente&&!encerrado)agenda();}}
  const visibility=()=>{if(!document.hidden)agenda();};
  async function conectar(){
   if(encerrado)return;
   const {data,error}=await client.auth.getSession();if(encerrado)return;
   if(error||!data.session){status('Atualização automática indisponível');return;}
   usuario=data.session.user.id;
   await client.realtime.setAuth(data.session.access_token);if(encerrado)return;
   channel=client.channel('pedidos:'+conta,{config:{private:true}})
    .on('broadcast',{event:'fila_alterada'},agenda)
    .subscribe(state=>{if(encerrado)return;status(state==='SUBSCRIBED'?'Atualização em tempo real':'Reconectando atualização automática…');if(state==='SUBSCRIBED')agenda();});
  }
  const auth=client.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'||(usuario&&session?.user.id!==usuario)){encerrar();return;}if(event==='TOKEN_REFRESHED')setTimeout(()=>{if(!encerrado)client.realtime.setAuth(session.access_token).catch(()=>{});},0);});
  const fallback=setInterval(agenda,60000);
  document.addEventListener('visibilitychange',visibility);window.addEventListener('online',agenda);
  function encerrar(){encerrado=true;clearTimeout(timer);clearInterval(fallback);auth.data.subscription.unsubscribe();if(channel)client.removeChannel(channel);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('online',agenda);}
  stop=encerrar;
  conectar().catch(()=>status('Atualização periódica ativa'));
  return stop;
 }
 window.addEventListener('pagehide',()=>stop?.());
 return {iniciar};
})();
