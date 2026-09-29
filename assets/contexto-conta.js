/* Contexto de apresentação. A autorização continua obrigatória no servidor. */
window.ContextoConta = (() => {
  const origens = new Set([location.origin, 'https://chat.orbbotia.com']);
  function mensagemDoPainel(event) {
    if (window.parent === window || event.source !== window.parent || !origens.has(event.origin)) return null;
    let value;
    try { value = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; } catch { return null; }
    if (value?.event !== 'appContext') return null;
    const account = value.data?.account?.id ?? value.data?.conversation?.account_id;
    if (!['string', 'number'].includes(typeof account) || !String(account).trim()) return null;
    return { account: String(account), segmento: value.data?.segmento };
  }
  function solicitar() {
    if (window.parent === window) return;
    for (const origin of origens) window.parent.postMessage('chatwoot-dashboard-app:fetch-info', origin);
  }
  function navegar(account, segmento) {
    // Uma nova navegação elimina consultas e formulários da conta anterior juntos.
    const url = new URL(location.href);
    url.searchParams.set('account_id', account);
    url.searchParams.set('segmento', segmento);
    location.replace(url.href);
  }
  return { mensagemDoPainel, solicitar, navegar };
})();
