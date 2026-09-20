function criarCacheEndereco(storage, agora = () => Date.now()) {
  const key = (conta, telefone) => /^\d+$/.test(String(conta)) && /^\d{10,15}$/.test(String(telefone)) ? `orbbotia:endereco:v1:${conta}:${telefone}` : null;
  return {
    ler(conta, telefone) {
      try {
        const chave = key(conta, telefone);
        const value = chave && JSON.parse(storage.getItem(chave) || 'null');
        if (!value || !Number.isFinite(value.salvo_em) || agora() - value.salvo_em > 30 * 86400000) return null;
        return { rua: String(value.rua || ''), numero: String(value.numero || ''), bairro: String(value.bairro || '') };
      } catch { return null; }
    },
    salvar(conta, telefone, endereco) {
      try {
        const chave = key(conta, telefone);
        if (chave && endereco.rua && endereco.numero && endereco.bairro) storage.setItem(chave, JSON.stringify({ rua: String(endereco.rua), numero: String(endereco.numero), bairro: String(endereco.bairro), salvo_em: agora() }));
      } catch { /* Navegação privada ou quota não bloqueiam o pedido. */ }
    },
    apagar(conta, telefone) { try { const chave = key(conta, telefone); if (chave) storage.removeItem(chave); } catch {} }
  };
}
if (typeof module !== 'undefined') module.exports = criarCacheEndereco;
if (typeof window !== 'undefined') window.criarCacheEndereco = criarCacheEndereco;
