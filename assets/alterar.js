(function() {
  const API_BASE = (
    document.querySelector('meta[name="api-base"]')?.content ||
    window.__API_BASE__ ||
    window.localStorage.getItem('API_BASE') ||
    'http://localhost:3000'
  ).replace(/\/+$/, '');
  
  // Elementos do DOM
  const cargoSelect = document.getElementById('cargo-select');
  const encargosSection = document.getElementById('encargos-section');
  const encargosList = document.getElementById('encargos-list');
  const encargoSearchInput = document.getElementById('encargo-search');
  const encargosSuggestions = document.getElementById('encargos-suggestions');
  const valoresSection = document.getElementById('valores-section');
  const valoresInputsContainer = document.getElementById('valores-inputs-container');
  const alterarForm = document.getElementById('alterar-form');
  const limparBtn = document.getElementById('limpar-btn');
  const gerarPlanilhaBtn = document.getElementById('gerar-planilha-btn');
  const voltarBtn = document.getElementById('voltar-btn');
  const resultSection = document.getElementById('result');
  
  // Dados carregados
  let cargos = [];
  let encargos = [];
  let selectedEncargos = new Set();
  let cargoSelecionado = null;
  let valoresAtuais = {};
  let carregarValoresAbortController = null;
  let cargoChangeRequestSeq = 0;

  function normalizarTexto(str) {
    return String(str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
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
      .slice(0, 20);

    encargosSuggestions.innerHTML = '';
    sugestoes.forEach(encargo => {
      const option = document.createElement('option');
      option.value = encargo.nome_legivel;
      encargosSuggestions.appendChild(option);
    });
  }
  
  // Utilitários para formatação de moeda
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
    // Multiplica por 100 e formata com 2 casas decimais
    return (n * 100).toFixed(2).replace('.', ',');
  }

  function formatPercentualMaskFromDigits(digits) {
    const onlyDigits = String(digits || '').replace(/\D/g, '');
    const padded = (onlyDigits || '0').padStart(3, '0');
    const integerPart = String(Number(padded.slice(0, -2)));
    const decimalPart = padded.slice(-2);
    return `${integerPart},${decimalPart}%`;
  }

  function getPercentualMaskDigits(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function updatePercentualMaskedInput(input, nextDigits) {
    input.value = formatPercentualMaskFromDigits(nextDigits);
    const cursorPos = Math.max(0, input.value.length - 1);
    input.setSelectionRange(cursorPos, cursorPos);
  }

  function handlePercentualInputKeydown(e) {
    const input = e.target;
    const key = e.key;
    const isDigit = /^[0-9]$/.test(key);
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
    const cursorPos = Math.max(0, input.value.length - 1);
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
    // Retorna o valor dividido por 100 (para armazenar como decimal)
    return Number.isFinite(n) ? n / 100 : NaN;
  }

  // Carregar cargos do backend
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

  // Carregar encargos disponíveis
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

  // Renderizar lista de encargos com checkboxes
  function renderizarEncargos() {
    encargosList.innerHTML = '';
    const termo = normalizarTexto(encargoSearchInput?.value || '');
    const encargosFiltrados = encargos.filter(encargo => {
      if (!termo) return true;
      return normalizarTexto(encargo.nome_legivel).includes(termo);
    });

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

  // Carregar valores atuais do cargo selecionado
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

  // Handler para mudança de cargo
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
      return;
    }
    
    cargoSelecionado = cargos.find(c => c.id === parseInt(cargoId));
    carregarValoresAbortController = new AbortController();
    
    // Carregar valores do cargo
    const valoresCargo = await carregarValoresCargo(cargoId, carregarValoresAbortController.signal);
    if (requestSeq !== cargoChangeRequestSeq || valoresCargo == null) return;
    valoresAtuais = valoresCargo;
    
    // Mostrar seção de encargos
    encargosSection.style.display = 'block';

    selectedEncargos.clear();
    if (encargoSearchInput) encargoSearchInput.value = '';
    atualizarSugestoesEncargo();
    
    // Re-renderizar encargos para limpar seleções anteriores
    renderizarEncargos();
    
    // Limpar campos de valor
    valoresInputsContainer.innerHTML = '';
    valoresSection.classList.remove('visible');
  }

  // Handler para mudança de seleção de encargos
  function onEncargoChange(event) {
    const checkboxes = Array.from(
      document.querySelectorAll('#encargos-list input[type="checkbox"]')
    );

    // Para evitar atualização parcial, permite alteração de uma rubrica por vez.
    if (event && event.target && event.target.checked) {
      checkboxes.forEach(cb => {
        if (cb !== event.target) cb.checked = false;
      });
      selectedEncargos.clear();
      selectedEncargos.add(event.target.value);
    }

    if (event && event.target && !event.target.checked) {
      selectedEncargos.delete(event.target.value);
    }

    const encargosSelecionados = Array.from(selectedEncargos);
    
    if (encargosSelecionados.length === 0) {
      valoresSection.classList.remove('visible');
      valoresInputsContainer.innerHTML = '';
      return;
    }
    
    // Renderizar campos de entrada para os encargos selecionados
    renderizarCamposValor(encargosSelecionados);
    valoresSection.classList.add('visible');
  }

  // Renderizar campos de entrada para valores
  function renderizarCamposValor(slugs) {
    valoresInputsContainer.innerHTML = '';
    
    slugs.forEach(slug => {
      const encargo = encargos.find(e => e.slug === slug);
      if (!encargo) return;
      
      const div = document.createElement('div');
      div.className = 'valor-field';
      
      const label = document.createElement('label');
      label.htmlFor = `valor-${slug}`;
      
      // Mostrar valor atual se existir
      const valorAtual = valoresAtuais[slug];
      const textoValorAtual = valorAtual != null 
        ? ` (Atual: ${formatPercentual(valorAtual)}%)`
        : ' (Sem valor atual)';
      
      label.textContent = `${encargo.nome_legivel}${textoValorAtual}`;
      
      const input = document.createElement('input');
      input.type = 'text';
      input.id = `valor-${slug}`;
      input.name = slug;
      input.placeholder = '0,00%';
      input.dataset.slug = slug;
      
      // Preencher com valor atual se existir
      if (valorAtual != null) {
        input.value = `${formatPercentual(valorAtual)}%`;
        input.dataset.prefilled = 'true';
      } else {
        input.value = '0,00%';
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
    e.preventDefault();
    
    if (!cargoSelecionado) {
      mostrarMensagem('Selecione um cargo', 'error');
      return;
    }
    
    const inputs = valoresInputsContainer.querySelectorAll('input[type="text"]');
    if (inputs.length === 0) {
      mostrarMensagem('Selecione pelo menos um encargo para alterar', 'error');
      return;
    }

    if (inputs.length > 1) {
      mostrarMensagem('Altere apenas uma rubrica por vez para garantir consistência dos dados', 'warning');
      return;
    }
    
    alterarForm.classList.add('loading');
    
    try {
      const input = inputs[0];
      const slug = input.dataset.slug;
      const valorStr = input.value.trim();

      const percentual = parsePercentualString(valorStr);

      if (!Number.isFinite(percentual)) {
        throw new Error(`Valor inválido para ${slug}: ${valorStr}`);
      }

      const response = await fetch(`${API_BASE}/valores`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cargo_id: cargoSelecionado.id,
          slug: slug,
          percentual: percentual
        })
      });

      if (!response.ok) throw new Error(`Erro ao atualizar ${slug}`);
      await response.json();
      
      mostrarMensagem('Valores atualizados com sucesso!', 'success');
      
      // Recarregar valores atuais
      const valoresCargo = await carregarValoresCargo(cargoSelecionado.id);
      if (valoresCargo != null) valoresAtuais = valoresCargo;
      
      // Re-renderizar campos com novos valores
      const encargosSelecionados = Array.from(selectedEncargos);
      renderizarCamposValor(encargosSelecionados);
      
    } catch (error) {
      console.error('Erro ao salvar alterações:', error);
      mostrarMensagem(`Erro ao salvar: ${error.message}`, 'error');
    } finally {
      alterarForm.classList.remove('loading');
    }
  }

  // Gerar planilha com valores atualizados
  async function gerarPlanilha() {
    if (!cargoSelecionado) {
      mostrarMensagem('Selecione um cargo', 'error');
      return;
    }
    
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
    }
  }

  // Limpar seleções
  function limparFormulario() {
    cargoSelect.value = '';
    encargosSection.style.display = 'none';
    valoresSection.classList.remove('visible');
    valoresInputsContainer.innerHTML = '';
    selectedEncargos.clear();
    cargoSelecionado = null;
    valoresAtuais = {};
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
    }, 5000);
  }

  // Event listeners
  cargoSelect.addEventListener('change', onCargoChange);
  encargoSearchInput.addEventListener('input', () => {
    atualizarSugestoesEncargo();
    renderizarEncargos();
  });
  alterarForm.addEventListener('submit', submitAlteracoes);
  limparBtn.addEventListener('click', limparFormulario);
  gerarPlanilhaBtn.addEventListener('click', gerarPlanilha);
  voltarBtn.addEventListener('click', () => { window.location.href = 'index.html'; });

  // Inicialização
  async function init() {
    await carregarCargos();
    await carregarEncargos();
  }

  init();
})();
