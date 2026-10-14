'use strict';
// Preferências autorizadas da conta; não substituem validação no servidor.
window.CatalogoContexto=(()=>{
 let snapshot=null;
 const ready=AdminSession.ready.then(async()=>{
  const response=await fetch(ORBBOTIA_ADMIN.apiOrigin+'/webhook/admin-onboarding',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account_id:AdminSession.navigation.accountId,acao:'consultar'})});
  const data=await response.json();if(!response.ok||data.status!=='sucesso')throw Error('Não foi possível carregar o modelo e as regras do estabelecimento. Atualize para tentar novamente.');
  snapshot=Object.freeze({modelo:data.onboarding.modelo,regras:data.onboarding.regras_catalogo});return snapshot;
 });
 ready.catch(error=>window.CadastroUI?.notify(error.message,true));
 return{ready,get modelo(){return snapshot?.modelo;},get regras(){return snapshot?.regras;}};
})();
