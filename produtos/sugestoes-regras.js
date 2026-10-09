'use strict';
// Cadastro das regras futuras. A escolha e a comunicação pelo agente permanecem na lógica antiga.
window.SugestoesRegras = (() => {
  const endpoint = 'https://n8n.orbbotia.com/webhook/empresa-config-salvar';
  const $ = id => document.getElementById(id);
  let accountId = '';
  let version = 0;
  let rules = [];
  let categories = [];
  let ready = false;
  let busy = false;
  let editingId = null;

  function categoryName(id) {
    return categories.find(category => category.id === id)?.name || 'Categoria indisponível';
  }

  function updateCatalog(products = []) {
    const byId = new Map();
    for (const raw of products) {
      const product = raw?.json || raw;
      if (!product || product.ativo === false || product.ativo === 'false' || product.deletado === true) continue;
      const id = String(product.categoria_id || '');
      if (id && product.categoria) byId.set(id, { id, name: String(product.categoria) });
    }
    categories = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    $('upsell-rule-new').disabled = !ready || !categories.length || busy;
    if (!$('upsell-rule-form').classList.contains('hidden')) fillSelects();
    render();
  }

  function loadConfig(config, currentAccountId) {
    const nextAccountId = String(currentAccountId || '');
    const preserveForm = nextAccountId === accountId && !$('upsell-rule-form').classList.contains('hidden');
    accountId = nextAccountId;
    ready = Array.isArray(config?.upsell_regras) && Number.isInteger(Number(config?.upsell_regras_versao));
    rules = ready ? structuredClone(config.upsell_regras) : [];
    version = ready ? Number(config.upsell_regras_versao) : 0;
    if (!preserveForm) {
      editingId = null;
      $('upsell-rule-form').classList.add('hidden');
    }
    $('upsell-rule-new').disabled = !ready || !categories.length;
    render();
  }

  function fillSelect(select, selected, optional = false) {
    select.replaceChildren(new Option(optional ? 'Nenhuma' : 'Selecione uma categoria', ''));
    for (const category of categories) select.add(new Option(category.name, category.id));
    if (selected && !categories.some(category => category.id === selected)) {
      select.add(new Option('Categoria indisponível — ' + selected.slice(0, 8), selected));
    }
    select.value = selected || '';
  }

  function fillSelects(rule = rules.find(item => item.id === editingId)) {
    fillSelect($('upsell-rule-trigger'), rule?.gatilho_categoria_id);
    for (let index = 1; index <= 3; index++) {
      fillSelect($('upsell-rule-offer-' + index), rule?.ofertas_categoria_ids?.[index - 1], index > 1);
    }
  }

  function showForm(rule = null) {
    if (!ready || busy) return;
    editingId = rule?.id || null;
    $('upsell-rule-form-title').textContent = rule ? 'Editar regra' : 'Nova regra';
    $('upsell-rule-name').value = rule?.nome || '';
    $('upsell-rule-active').checked = rule?.ativo !== false;
    fillSelects(rule);
    $('upsell-rule-form').classList.remove('hidden');
    $('upsell-rule-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('upsell-rule-name').focus({ preventScroll: true });
  }

  function closeForm() {
    editingId = null;
    $('upsell-rule-form').classList.add('hidden');
  }

  function button(label, action, disabled = false) {
    const control = document.createElement('button');
    control.type = 'button';
    control.textContent = label;
    control.disabled = disabled || busy;
    control.className = 'rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-sm font-semibold text-indigo-700 disabled:opacity-40';
    control.addEventListener('click', action);
    return control;
  }

  function render() {
    const list = $('upsell-rules-list');
    list.replaceChildren();
    if (!ready) {
      const message = document.createElement('p');
      message.className = 'rounded-lg bg-white p-3 text-sm text-amber-900';
      message.textContent = 'Para cadastrar estas regras, publique primeiro a atualização do banco e do workflow empresa-config.';
      list.append(message);
      return;
    }
    if (!categories.length) {
      const message = document.createElement('p');
      message.className = 'rounded-lg bg-white p-3 text-sm text-slate-600';
      message.textContent = 'Cadastre produtos ativos em categorias identificadas pelo sistema para criar regras.';
      list.append(message);
    }
    if (!rules.length) {
      const message = document.createElement('p');
      message.className = 'rounded-lg bg-white p-3 text-sm text-slate-600';
      message.textContent = 'Nenhuma regra preparada. As sugestões atuais do agente continuam como estão.';
      list.append(message);
    }
    rules.forEach((rule, index) => {
      const details = document.createElement('details');
      details.className = 'rounded-xl border border-slate-200 bg-white p-3';
      const summary = document.createElement('summary');
      summary.className = 'cursor-pointer font-semibold text-slate-800';
      summary.textContent = `${index + 1}ª prioridade · ${rule.nome}${rule.ativo ? '' : ' · Pausada'}`;
      const description = document.createElement('p');
      description.className = 'my-2 text-sm text-slate-600';
      description.textContent = `Pedido com ${categoryName(rule.gatilho_categoria_id)} → sugerir ${rule.ofertas_categoria_ids.map(categoryName).join(', ')}.`;
      const actions = document.createElement('div');
      actions.className = 'flex flex-wrap gap-2';
      actions.append(
        button('Editar', () => showForm(rule)),
        button('Subir', () => move(index, -1), index === 0),
        button('Descer', () => move(index, 1), index === rules.length - 1),
        button('Excluir', () => remove(index))
      );
      details.append(summary, description, actions);
      list.append(details);
    });
  }

  async function persist(candidate, successMessage) {
    if (!ready || busy) return false;
    busy = true;
    $('upsell-rule-save').disabled = true;
    $('upsell-rule-new').disabled = true;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId, upsell_regras: candidate, upsell_regras_versao: version })
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.success !== true || !Number.isInteger(Number(result.versao)) || Number(result.versao) !== version + 1) {
        throw new Error(result?.mensagem || 'O servidor não confirmou as regras. Confira se a atualização do workflow foi publicada.');
      }
      rules = structuredClone(candidate);
      version = Number(result.versao);
      CadastroUI.notify(successMessage);
      return true;
    } catch (error) {
      CadastroUI.notify(error.message || 'Não foi possível salvar as regras.', true);
      return false;
    } finally {
      busy = false;
      $('upsell-rule-save').disabled = false;
      $('upsell-rule-new').disabled = !categories.length;
      render();
    }
  }

  async function saveForm(event) {
    event.preventDefault();
    const name = $('upsell-rule-name').value.trim();
    const trigger = $('upsell-rule-trigger').value;
    const offers = [1, 2, 3].map(index => $('upsell-rule-offer-' + index).value).filter(Boolean);
    if (!name || !trigger || !offers.length) return CadastroUI.notify('Informe nome, categoria do pedido e ao menos uma sugestão.', true);
    if (offers.includes(trigger) || new Set(offers).size !== offers.length) return CadastroUI.notify('Escolha categorias sugeridas diferentes entre si e da categoria gatilho.', true);
    if (![trigger, ...offers].every(id => categories.some(category => category.id === id))) return CadastroUI.notify('Uma categoria não está disponível. Atualize o catálogo antes de salvar.', true);
    const rule = { id: editingId || crypto.randomUUID(), nome: name, gatilho_categoria_id: trigger, ofertas_categoria_ids: offers, ativo: $('upsell-rule-active').checked };
    const candidate = structuredClone(rules);
    const index = candidate.findIndex(item => item.id === rule.id);
    if (index < 0) candidate.push(rule); else candidate[index] = rule;
    if (await persist(candidate, index < 0 ? 'Regra cadastrada.' : 'Regra atualizada.')) closeForm();
  }

  async function move(index, direction) {
    const next = index + direction;
    if (next < 0 || next >= rules.length) return;
    const candidate = structuredClone(rules);
    [candidate[index], candidate[next]] = [candidate[next], candidate[index]];
    await persist(candidate, 'Prioridade atualizada.');
  }

  async function remove(index) {
    if (!confirm('Excluir esta regra preparada? As sugestões atuais do agente não serão alteradas.')) return;
    const candidate = rules.filter((_, itemIndex) => itemIndex !== index);
    if (await persist(candidate, 'Regra excluída.')) closeForm();
  }

  $('upsell-rule-new').addEventListener('click', () => showForm());
  $('upsell-rule-cancel').addEventListener('click', closeForm);
  $('upsell-rule-form').addEventListener('submit', saveForm);
  return { updateCatalog, loadConfig };
})();
