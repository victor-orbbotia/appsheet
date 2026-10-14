/* Navegação e apresentação compartilhadas. Autorizações permanecem no servidor. */
window.AdminUI = (() => {
  const root = new URL('../', document.currentScript.src);
  const modules = [
    ['pedidos', 'Pedidos', 'pedidos/index.html'],
    ['produtos', 'Catálogo', 'produtos/novo.html'],
    ['conhecimento', 'Conhecimento', 'conhecimento/novo.html'],
    ['profissionais', 'Equipe', 'profissionais/novo.html'],
    ['configuracoes', 'Configurações', 'configuracoes/index.html']
  ];
  let refresh = null, observer = null, shell = null;

  function destination(path) {
    const context = window.AdminSession.navigation;
    const url = new URL(path, root);
    url.searchParams.set('account_id', context.accountId);
    const segment = document.getElementById('seletor-segmento')?.value || new URLSearchParams(location.search).get('segmento') || context.segmento;
    if (segment) url.searchParams.set('segmento', segment);
    return url.href;
  }

  function link(label, path) {
    const anchor = document.createElement('a');
    anchor.textContent = label;
    anchor.href = destination(path);
    // O hub permite trocar o perfil sem recarregar; usar o perfil vigente ao navegar.
    anchor.addEventListener('click', () => {anchor.href = destination(path);});
    if (location.pathname === new URL(anchor.href).pathname ||
        (path.startsWith('produtos/') && location.pathname.startsWith(new URL('produtos/', root).pathname))) {
      anchor.setAttribute('aria-current', 'page');
    }
    return anchor;
  }

  function fitHeader() {
    if (!shell) return;
    document.body.style.setProperty('--admin-shell-height', `${shell.offsetHeight || 108}px`);
  }

  function createShell(bar) {
    const context = window.AdminSession.navigation;
    if (!context) return;
    shell = document.createElement('header');
    shell.id = 'admin-shell';
    const inner = document.createElement('div');
    inner.className = 'admin-shell-inner';
    const row = document.createElement('div');
    row.className = 'admin-shell-row';
    const backSlot = document.createElement('div');
    backSlot.className = 'admin-back-slot';
    const back = document.querySelector('#link-voltar-menu, #link-voltar, #voltar, #btn-voltar-gestao');
    if (back) {
      const oldRow = back.parentElement;
      back.textContent = '← Voltar';
      back.title = 'Voltar à página anterior do módulo';
      backSlot.append(back);
      // O catálogo tinha uma linha exclusiva para voltar/atualizar; retirar o espaço vazio.
      const actions = document.getElementById('catalog-header-actions');
      if (actions && actions.parentElement === oldRow) oldRow.hidden = true;
    } else if (location.pathname !== new URL('index.html', root).pathname) {
      backSlot.append(link('← Voltar', 'index.html'));
    }
    const brand = document.createElement('span');
    brand.className = 'admin-shell-brand';
    brand.textContent = 'Orbbotia';
    backSlot.append(brand);
    row.append(backSlot, bar);
    const nav = document.createElement('nav');
    nav.id = 'admin-quick-nav';
    nav.setAttribute('aria-label', 'Navegação principal');
    nav.append(link('Início', 'index.html'));
    if (new URLSearchParams(location.search).get('onboarding') === '1') nav.append(link('← Continuar configuração', 'onboarding.html'));
    for (const [key, label, path] of modules) {
      if (context.modulos[key]) nav.append(link(label, path));
    }
    inner.append(row, nav);
    shell.append(inner);
    document.body.prepend(shell);
    document.body.classList.add('admin-shell-active');
    document.documentElement.classList.add('admin-view-ready');
    const content = document.querySelector('#area-modulos, #app-container, main');
    const width = content && getComputedStyle(content).maxWidth;
    if (width && /^\d+(\.\d+)?px$/.test(width)) shell.style.setProperty('--admin-shell-max', width);
    if (document.getElementById('editor-panel')) document.body.classList.add('admin-studio-shell');
    fitHeader();
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(fitHeader).observe(shell);
    window.addEventListener('resize', fitHeader);
  }

  function posicionar() {
    if (new URLSearchParams(location.search).get('embedded') === '1') return;
    const bar = document.getElementById('admin-session-bar');
    if (!bar) return;
    const identity = bar.querySelector('span');
    if (identity) identity.title = identity.textContent;
    if (!refresh) refresh = document.getElementById('refresh-catalog') || document.getElementById('btnAtualizar') || document.querySelector('button[onclick="carregarLista()"]');
    if (!refresh) {
      refresh = document.createElement('button');
      refresh.id = 'admin-refresh';
      refresh.type = 'button';
    }
    if (!refresh.id) refresh.id = 'admin-refresh';
    // Ícone com caixa própria evita herdar espaçamentos e rótulos do formulário.
    if (!refresh.dataset.adminIcon) {
      refresh.dataset.adminIcon = 'true';
      const icon = document.createElement('span');
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = '⟳';
      refresh.replaceChildren(icon);
    }
    refresh.title = 'Atualizar dados da página';
    refresh.setAttribute('aria-label', 'Atualizar dados da página');
    if (refresh.id !== 'refresh-catalog') refresh.onclick = () => window.location.reload();
    if (refresh.parentElement !== bar) bar.insertBefore(refresh, bar.querySelector('button'));
    if (!shell) createShell(bar);
    if (!observer) {
      observer = new MutationObserver(posicionar);
      observer.observe(bar, {childList: true});
    }
  }

  function iniciar() {
    if (window.AdminSession?.enabled) window.AdminSession.ready.then(posicionar).catch(() => {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, {once: true});
  else iniciar();
  return {posicionar};
})();
