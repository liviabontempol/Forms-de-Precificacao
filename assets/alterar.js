(function() {
  const API_BASE = (
    document.querySelector('meta[name="api-base"]')?.content ||
    globalThis.__API_BASE__ ||
    globalThis.localStorage.getItem('API_BASE') ||
    'http://localhost:3000'
  ).replace(/\/+$/, '');
  
  const cargoSelect = document.getElementById('cargo-select');
  const encargosSection = document.getElementById('encargos-section');
  const encargosList = document.getElementById('encargos-list');
  const encargoSearchInput = document.getElementById('encargo-search');
  const encargosSuggestions = document.getElementById('encargos-suggestions');
  const encargosSummary = document.getElementById('encargos-summary');
  const valoresSection = document.getElementById('valores-section');
  const valoresInputsContainer = document.getElementById('valores-inputs-container');
  const alterarForm = document.getElementById('alterar-form');
  const salvarAlteracoesBtn = document.getElementById('salvar-alteracoes-btn');
  const limparBtn = document.getElementById('limpar-btn');
  const gerarPlanilhaBtn = document.getElementById('gerar-planilha-btn');
  const voltarBtn = document.getElementById('voltar-btn');
  const resultSection = document.getElementById('result');
  
  let cargos = [];
  let encargos = [];
  let selectedEncargos = new Set();
  let cargoSelecionado = null;
  let valoresAtuais = {};
  let carregarValoresAbortController = null;
  let cargoChangeRequestSeq = 0;
  let submitInFlight = false;
  const MONETARIO_SLUG_HINTS = new Set([
    'vt',
    'va',
    'uniformes',
    'materiais',
    'equipamentosprotecaoindividual'
  ]);

  function limparElemento(elemento) {
    if (!elemento) return;
    elemento.replaceChildren();
  }

  function estaVisivel(elemento) {
    return !!elemento && globalThis.getComputedStyle(elemento).display !== 'none';
  }

  function capturarEstadoTela() {
    return {
      cargoId: cargoSelect.value,
      encargosVisiveis: estaVisivel(encargosSection),
      valoresVisiveis: valoresSection.classList.contains('visible'),
      termoBusca: encargoSearchInput?.value || '',
      encargosSelecionados: Array.from(selectedEncargos)
    };
  }

  function restaurarEstadoTela(estadoTela) {
    if (!estadoTela) return;

    const perdeuEtapaEncargos = estadoTela.encargosVisiveis && !estaVisivel(encargosSection);
    const perdeuEtapaValores = estadoTela.valoresVisiveis && !valoresSection.classList.contains('visible');
    if (!perdeuEtapaEncargos && !perdeuEtapaValores) return;

    if (estadoTela.cargoId && cargoSelect.value !== estadoTela.cargoId) {
      cargoSelect.value = estadoTela.cargoId;
    }

    if (estadoTela.encargosVisiveis) {
      encargosSection.style.display = 'block';
    }

    if (encargoSearchInput) {
      encargoSearchInput.value = estadoTela.termoBusca;
    }

    selectedEncargos.clear();
    estadoTela.encargosSelecionados.forEach(slug => selectedEncargos.add(slug));

    renderizarEncargos();

    if (estadoTela.valoresVisiveis && estadoTela.encargosSelecionados.length > 0) {
      renderizarCamposValor(estadoTela.encargosSelecionados);
      valoresSection.classList.add('visible');
    }
  }

  function normalizarTexto(str) {
    return String(str || '')
      .normalize('NFD')
      .replaceAll(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function atualizarSugestoesEncargo() {
    if (!encargosSuggestions) return;

    const termo = normalizarTexto(encargoSearchInput?.value || '');
    const sugestoes = encargos
      .filter(encargo => {
        if (!termo) return true;
        return normalizarTexto(encargo.nome_legivel).includes(termo);
      })
      .slice(0, 5);

    limparElemento(encargosSuggestions);
    sugestoes.forEach(encargo => {
      const option = document.createElement('option');
      option.value = encargo.nome_legivel;
      encargosSuggestions.appendChild(option);
    });
  }

  function atualizarResumoEncargos(totalVisivel = encargos.length) {
    if (!encargosSummary) return;

    if (!cargoSelecionado) {
      encargosSummary.textContent = 'Selecione um cargo';
      return;
    }

    encargosSummary.textContent = `${selectedEncargos.size} selecionada(s) de ${totalVisivel}`;
  }
  
  function parseBRLString(str) {
    if (str == null) return NaN;
    let s = String(str).replace(/\s/g, '').replace('R$', '');
    s = s.replace(/\./g, '').replace(',', '.');
    s = s.replace(/[^0-9.-]/g, '');
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }

  function formatBRL(n) {
    if (!Number.isFinite(n)) return 'R$0,00';
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function formatPercentual(n) {
    if (!Number.isFinite(n)) return '0';
    return (n * 100).toFixed(2).replace('.', ',');
  }

  function formatPercentualMaskFromDigits(digits) {
    const onlyDigits = String(digits || '').replaceAll(/\D/g, '');
    const padded = (onlyDigits || '0').padStart(3, '0');
    const integerPart = String(Number(padded.slice(0, -2)));
    const decimalPart = padded.slice(-2);
    return `${integerPart},${decimalPart}%`;
  }

  function formatMonetarioMaskFromDigits(digits) {
    const onlyDigits = String(digits || '').replaceAll(/\D/g, '');
    const padded = (onlyDigits || '0').padStart(3, '0');
    const integerPart = String(Number(padded.slice(0, -2))).replaceAll(/\B(?=(\d{3})+(?!\d))/g, '.');
    const decimalPart = padded.slice(-2);
    return `R$ ${integerPart},${decimalPart}`;
  }

  function getPercentualMaskDigits(value) {
    return String(value || '').replaceAll(/\D/g, '');
  }

  function updatePercentualMaskedInput(input, nextDigits) {
    const isMonetario = input.dataset.tipo === 'monetario';
    input.value = isMonetario
      ? formatMonetarioMaskFromDigits(nextDigits)
      : formatPercentualMaskFromDigits(nextDigits);
    const cursorPos = isMonetario
      ? input.value.length
      : Math.max(0, input.value.length - 1);
    input.setSelectionRange(cursorPos, cursorPos);
  }

  function normalizarSlug(slug) {
    return String(slug || '').toLowerCase().replaceAll(/[^a-z0-9]/g, '');
  }

  function detectarTipoRubrica(slug, valorAtual) {
    const slugNormalizado = normalizarSlug(slug);
    if (MONETARIO_SLUG_HINTS.has(slugNormalizado)) return 'monetario';
    if (Number.isFinite(valorAtual) && valorAtual > 1) return 'monetario';
    return 'percentual';
  }

  function parseValorPorTipo(str, tipo) {
    return tipo === 'monetario' ? parseBRLString(str) : parsePercentualString(str);
  }

  function valoresSaoIguais(valorNovo, valorAtual, tipo) {
    const novo = Number.isFinite(valorNovo) ? valorNovo : 0;
    const atual = Number.isFinite(valorAtual) ? valorAtual : 0;

    if (tipo === 'monetario') {
      // Compara por centavos para evitar ruído de ponto flutuante.
      return Math.round(novo * 100) === Math.round(atual * 100);
    }

    // Percentual com precisão de 2 casas na interface (base 10.000 em decimal).
    return Math.round(novo * 10000) === Math.round(atual * 10000);
  }

  function handlePercentualInputKeydown(e) {
    const input = e.target;
    const key = e.key;
     if (e.ctrlKey || e.metaKey || e.altKey) return;
    const isDigit = /^\d$/.test(key);
    const isNavigationKey = ['Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key);

    if (isNavigationKey) return;

    if (isDigit) {
      e.preventDefault();
      const baseDigits = input.dataset.prefilled === 'true' ? '' : getPercentualMaskDigits(input.value);
      input.dataset.prefilled = 'false';
      updatePercentualMaskedInput(input, `${baseDigits}${key}`);
      return;
    }

    if (key === 'Backspace') {
      e.preventDefault();
      const baseDigits = input.dataset.prefilled === 'true' ? '' : getPercentualMaskDigits(input.value).slice(0, -1);
      input.dataset.prefilled = 'false';
      updatePercentualMaskedInput(input, baseDigits);
      return;
    }

    if (key === 'Delete') {
      e.preventDefault();
      input.dataset.prefilled = 'false';
      updatePercentualMaskedInput(input, '');
      return;
    }

    if (key.length === 1) {
      e.preventDefault();
    }
  }

  function handlePercentualInputFocus(e) {
    const input = e.target;
    const cursorPos = input.dataset.tipo === 'monetario'
      ? input.value.length
      : Math.max(0, input.value.length - 1);
    input.setSelectionRange(0, cursorPos);
  }

  function handlePercentualInputPaste(e) {
    e.preventDefault();
    const input = e.target;
    const textoColado = e.clipboardData?.getData('text') || '';
    input.dataset.prefilled = 'false';
    updatePercentualMaskedInput(input, getPercentualMaskDigits(textoColado));
  }

  function parsePercentualString(str) {
    if (str == null || str === '') return NaN;
    let s = String(str).replace(/\s/g, '').replace('%', '');
    s = s.replace(/\./g, '').replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? n / 100 : NaN;
  }

  async function carregarCargos() {
    try {
      const response = await fetch(`${API_BASE}/cargos`);
      if (!response.ok) throw new Error('Erro ao carregar cargos');
      
      cargos = await response.json();
      
      cargoSelect.innerHTML = '<option value="">Selecione um cargo...</option>';
      cargos.forEach(cargo => {
        const option = document.createElement('option');
        option.value = cargo.id;
        option.textContent = cargo.cargo;
        cargoSelect.appendChild(option);
      });
    } catch (error) {
      console.error('Erro ao carregar cargos:', error);
      cargoSelect.innerHTML = '<option value="">Erro ao carregar cargos</option>';
      mostrarMensagem('Erro ao carregar lista de cargos', 'error');
    }
  }

  async function carregarEncargos() {
    try {
      const response = await fetch(`${API_BASE}/rubricas`);
      if (!response.ok) throw new Error('Erro ao carregar encargos');
      
      encargos = await response.json();
      atualizarSugestoesEncargo();
      renderizarEncargos();
    } catch (error) {
      console.error('Erro ao carregar encargos:', error);
      encargosList.innerHTML = '<p style="color: red;">Erro ao carregar encargos</p>';
    }
  }

  function renderizarEncargos() {
    limparElemento(encargosList);
    const termo = normalizarTexto(encargoSearchInput?.value || '');
    const encargosFiltrados = encargos.filter(encargo => {
      if (!termo) return true;
      return normalizarTexto(encargo.nome_legivel).includes(termo);
    });

    atualizarResumoEncargos(encargosFiltrados.length);

    if (encargosFiltrados.length === 0) {
      const semResultado = document.createElement('p');
      semResultado.className = 'encargos-no-result';
      semResultado.textContent = 'Nenhuma rubrica encontrada.';
      encargosList.appendChild(semResultado);
      return;
    }
    
    encargosFiltrados.forEach(encargo => {
      const div = document.createElement('div');
      div.className = 'encargo-item';
      if (selectedEncargos.has(encargo.slug)) {
        div.classList.add('is-selected');
      }
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `encargo-${encargo.slug}`;
      checkbox.value = encargo.slug;
      checkbox.checked = selectedEncargos.has(encargo.slug);
      checkbox.addEventListener('change', onEncargoChange);
      
      const label = document.createElement('label');
      label.htmlFor = `encargo-${encargo.slug}`;
      label.textContent = encargo.nome_legivel;
      
      div.appendChild(checkbox);
      div.appendChild(label);
      encargosList.appendChild(div);
    });
  }

  async function carregarValoresCargo(cargoId, signal) {
    try {
      const response = await fetch(`${API_BASE}/valores?cargo_id=${cargoId}`, { signal });
      if (!response.ok) throw new Error('Erro ao carregar valores');
      
      const valores = await response.json();
      const valoresAtuaisCargo = {};
      
      valores.forEach(valor => {
        valoresAtuaisCargo[valor.slug] = valor.percentual;
      });
      
      return valoresAtuaisCargo;
    } catch (error) {
      if (error.name === 'AbortError') return null;
      console.error('Erro ao carregar valores:', error);
      mostrarMensagem('Erro ao carregar valores do cargo', 'error');
      return null;
    }
  }

  async function onCargoChange() {
    const cargoId = cargoSelect.value;
    const requestSeq = ++cargoChangeRequestSeq;
    
    if (carregarValoresAbortController) {
      carregarValoresAbortController.abort();
    }
    
    if (!cargoId) {
      encargosSection.style.display = 'none';
      valoresSection.classList.remove('visible');
      selectedEncargos.clear();
      cargoSelecionado = null;
      valoresAtuais = {};
      atualizarResumoEncargos(0);
      return;
    }
    
    cargoSelecionado = cargos.find(c => c.id === parseInt(cargoId));
    carregarValoresAbortController = new AbortController();
    
    const valoresCargo = await carregarValoresCargo(cargoId, carregarValoresAbortController.signal);
    if (requestSeq !== cargoChangeRequestSeq || valoresCargo == null) return;
    valoresAtuais = valoresCargo;
    
    encargosSection.style.display = 'block';

    selectedEncargos.clear();
    if (encargoSearchInput) encargoSearchInput.value = '';
    atualizarSugestoesEncargo();
    
    renderizarEncargos();
    
    // Limpar campos de valor
    limparElemento(valoresInputsContainer);
    valoresSection.classList.remove('visible');
    atualizarResumoEncargos(encargos.length);
  }

  // Handler para mudança de seleção de encargos
  function onEncargoChange(event) {
    const checkbox = event?.target;
    if (!checkbox || checkbox.type !== 'checkbox') return;
    const card = checkbox.closest('.encargo-item');

    if (checkbox.checked) {
      selectedEncargos.add(checkbox.value);
      if (card) card.classList.add('is-selected');
    } else {
      selectedEncargos.delete(checkbox.value);
      if (card) card.classList.remove('is-selected');
    }

    const encargosSelecionados = [...selectedEncargos];
    atualizarResumoEncargos(encargosList?.querySelectorAll('.encargo-item').length || encargos.length);

    if (encargosSelecionados.length === 0) {
      valoresSection.classList.remove('visible');
      limparElemento(valoresInputsContainer);
      return;
    }

    renderizarCamposValor(encargosSelecionados);
    valoresSection.classList.add('visible');
  }

  // Renderizar campos de entrada para valores
  function renderizarCamposValor(slugs) {
    limparElemento(valoresInputsContainer);
    
    slugs.forEach(slug => {
      const encargo = encargos.find(e => e.slug === slug);
      if (!encargo) return;
      
      const div = document.createElement('div');
      div.className = 'valor-field';
      
      const label = document.createElement('label');
      label.htmlFor = `valor-${slug}`;
      
      // Mostrar valor atual se existir
      const valorAtual = valoresAtuais[slug];
      const tipoRubrica = detectarTipoRubrica(slug, valorAtual);
      let textoValorAtual;

if (valorAtual == null) {
  textoValorAtual = ' (Sem valor atual)';
} else if (tipoRubrica === 'monetario') {
  textoValorAtual = ` (Atual: ${formatBRL(valorAtual)})`;
} else {
  textoValorAtual = ` (Atual: ${formatPercentual(valorAtual)}%)`;
}
      
      label.textContent = `${encargo.nome_legivel}${textoValorAtual}`;
      
      const input = document.createElement('input');
      input.type = 'text';
      input.id = `valor-${slug}`;
      input.name = slug;
      input.placeholder = tipoRubrica === 'monetario' ? 'R$ 0,00' : '0,00%';
      input.dataset.slug = slug;
      input.dataset.tipo = tipoRubrica;
      
      // Preencher com valor atual se existir
      if (valorAtual != null) {
        input.value = tipoRubrica === 'monetario'
          ? formatBRL(valorAtual)
          : `${formatPercentual(valorAtual)}%`;
        input.dataset.prefilled = 'true';
      } else {
        input.value = tipoRubrica === 'monetario' ? 'R$ 0,00' : '0,00%';
        input.dataset.prefilled = 'false';
      }

      input.inputMode = 'numeric';
      input.autocomplete = 'off';
      input.addEventListener('keydown', handlePercentualInputKeydown);
      input.addEventListener('focus', handlePercentualInputFocus);
      input.addEventListener('paste', handlePercentualInputPaste);
      
      div.appendChild(label);
      div.appendChild(input);
      valoresInputsContainer.appendChild(div);
    });
  }

  // Submeter alterações
  async function submitAlteracoes(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!cargoSelecionado) {
      mostrarMensagem('Selecione um cargo', 'error');
      return;
    }

    if (submitInFlight) {
      mostrarMensagem('Salvamento em andamento. Aguarde a conclusão para evitar conflito.', 'warning');
      return;
    }
    
    const inputs = valoresInputsContainer.querySelectorAll('input[type="text"]');
    if (inputs.length === 0) {
      mostrarMensagem('Selecione pelo menos um encargo para alterar', 'error');
      return;
    }
    
    const estadoTelaAntesDaOperacao = capturarEstadoTela();
    submitInFlight = true;
    alterarForm.classList.add('loading');
    if (salvarAlteracoesBtn) salvarAlteracoesBtn.disabled = true;
    
    try {
      const rubricasDigitadas = Array.from(inputs).map(input => {
        const slug = input.dataset.slug;
        const tipo = input.dataset.tipo || 'percentual';
        const valorStr = input.value.trim();
        const percentual = parseValorPorTipo(valorStr, tipo);

        if (!Number.isFinite(percentual)) {
          throw new Error(`Valor inválido para ${slug}: ${valorStr}`);
        }

        return { slug, percentual, tipo };
      });

      const rubricasAlteradas = rubricasDigitadas
        .filter(({ slug, percentual, tipo }) => {
          const valorAtualBruto = valoresAtuais[slug];
          const valorAtualNumerico = Number.isFinite(Number(valorAtualBruto))
            ? Number(valorAtualBruto)
            : 0;

          return !valoresSaoIguais(percentual, valorAtualNumerico, tipo);
        })
        .map(({ slug, percentual }) => ({ slug, percentual }));

      if (rubricasAlteradas.length === 0) {
        mostrarMensagem('Nenhuma alteração de valor detectada. Ajuste ao menos um campo antes de salvar.', 'warning');
        return;
      }

      const response = await fetch(`${API_BASE}/valores/lote`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cargo_id: cargoSelecionado.id,
          rubricas: rubricasAlteradas
        })
      });

      const payloadResposta = await response.json().catch(() => null);

      if (!response.ok) {
        const mensagemErro = payloadResposta?.error || 'Falha ao salvar todas as rubricas.';
        throw new Error(mensagemErro);
      }

      const totalAtualizadas = Number(payloadResposta?.atualizadas || 0);
      if (totalAtualizadas !== rubricasAlteradas.length) {
        throw new Error('A confirmação do servidor não contempla todas as rubricas enviadas.');
      }

      mostrarMensagem(`${rubricasAlteradas.length} rubrica(s) salva(s) com sucesso!`, 'success');
      
      // Recarregar valores atuais
      const valoresCargo = await carregarValoresCargo(cargoSelecionado.id);
      if (valoresCargo != null) valoresAtuais = valoresCargo;
      
      // Re-renderizar campos com novos valores
      const encargosSelecionados = Array.from(selectedEncargos);
      renderizarCamposValor(encargosSelecionados);
      
    } catch (error) {
      console.error('Erro ao salvar alterações:', error);
      mostrarMensagem(`Erro ao salvar: ${error.message}`, 'error');
      restaurarEstadoTela(estadoTelaAntesDaOperacao);
    
    } finally {
      alterarForm.classList.remove('loading');
      submitInFlight = false;
      if (salvarAlteracoesBtn) salvarAlteracoesBtn.disabled = false;
    }
  }

  // Gerar planilha com valores atualizados
  async function gerarPlanilha(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!cargoSelecionado) {
      mostrarMensagem('Selecione um cargo', 'error');
      return;
    }
    
    const estadoTelaAntesDaOperacao = capturarEstadoTela();

    try {
      // Fazer requisição para gerar planilha
      const response = await fetch(`${API_BASE}/gerar-planilha`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cargo_id: cargoSelecionado.id
        })
      });
      
      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }
      
      // Baixar o arquivo
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cargoSelecionado.cargo.replace(/\s+/g, '_')}_atualizado.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      
      mostrarMensagem('Planilha gerada com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao gerar planilha:', error);
      mostrarMensagem(`Erro ao gerar planilha: ${error.message}`, 'error');
    } finally {
      restaurarEstadoTela(estadoTelaAntesDaOperacao);
    }
  }

  // Limpar seleções
  function limparFormulario() {
    cargoSelect.value = '';
    encargosSection.style.display = 'none';
    valoresSection.classList.remove('visible');
    limparElemento(valoresInputsContainer);
    selectedEncargos.clear();
    cargoSelecionado = null;
    valoresAtuais = {};
    atualizarResumoEncargos(0);
    if (encargoSearchInput) encargoSearchInput.value = '';
    atualizarSugestoesEncargo();
    
    // Desmarcar todos os checkboxes
    document.querySelectorAll('#encargos-list input[type="checkbox"]').forEach(cb => {
      cb.checked = false;
    });
    
    mostrarMensagem('Formulário limpo', 'info');
  }

  // Mostrar mensagens para o usuário
  function mostrarMensagem(msg, tipo = 'info') {
    resultSection.textContent = msg;
    resultSection.style.color = 
      tipo === 'error' ? '#e53e3e' :
      tipo === 'success' ? '#38a169' :
      tipo === 'warning' ? '#d69e2e' :
      'var(--muted)';
    
    // Limpar mensagem após 5 segundos
    setTimeout(() => {
      if (resultSection.textContent === msg) {
        resultSection.textContent = '';
      }
    }, 6000);
  }

  // Event listeners
  cargoSelect?.addEventListener('change', onCargoChange);
  encargoSearchInput?.addEventListener('input', () => {
    atualizarSugestoesEncargo();
    renderizarEncargos();
  });
  alterarForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    e.stopPropagation();
     submitAlteracoes(e);
  });
  salvarAlteracoesBtn?.addEventListener('click', submitAlteracoes);
  limparBtn?.addEventListener('click', limparFormulario);
  gerarPlanilhaBtn?.addEventListener('click', gerarPlanilha);
  voltarBtn?.addEventListener('click', () => { globalThis.location.href = 'index.html'; });

  // Inicialização
  async function init() {
    await carregarCargos();
    await carregarEncargos();
    atualizarResumoEncargos(encargos.length);
  }

  init();
})();
