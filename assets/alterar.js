(function() {
  const API_BASE = 'http://localhost:3000';
  
  // Elementos do DOM
  const cargoSelect = document.getElementById('cargo-select');
  const encargosSection = document.getElementById('encargos-section');
  const encargosList = document.getElementById('encargos-list');
  const valoresSection = document.getElementById('valores-section');
  const valoresInputsContainer = document.getElementById('valores-inputs-container');
  const alterarForm = document.getElementById('alterar-form');
  const limparBtn = document.getElementById('limpar-btn');
  const gerarPlanilhaBtn = document.getElementById('gerar-planilha-btn');
  const resultSection = document.getElementById('result');
  
  // Dados carregados
  let cargos = [];
  let encargos = [];
  let cargoSelecionado = null;
  let valoresAtuais = {};
  
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
    // Multiplica por 100 e formata com até 4 casas decimais
    return (n * 100).toFixed(4).replace('.', ',');
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
      renderizarEncargos();
    } catch (error) {
      console.error('Erro ao carregar encargos:', error);
      encargosList.innerHTML = '<p style="color: red;">Erro ao carregar encargos</p>';
    }
  }

  // Renderizar lista de encargos com checkboxes
  function renderizarEncargos() {
    encargosList.innerHTML = '';
    
    encargos.forEach(encargo => {
      const div = document.createElement('div');
      div.className = 'encargo-item';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `encargo-${encargo.slug}`;
      checkbox.value = encargo.slug;
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
  async function carregarValoresCargo(cargoId) {
    try {
      const response = await fetch(`${API_BASE}/valores?cargo_id=${cargoId}`);
      if (!response.ok) throw new Error('Erro ao carregar valores');
      
      const valores = await response.json();
      valoresAtuais = {};
      
      valores.forEach(valor => {
        valoresAtuais[valor.slug] = valor.percentual;
      });
      
      return valoresAtuais;
    } catch (error) {
      console.error('Erro ao carregar valores:', error);
      mostrarMensagem('Erro ao carregar valores do cargo', 'error');
      return {};
    }
  }

  // Handler para mudança de cargo
  async function onCargoChange() {
    const cargoId = cargoSelect.value;
    
    if (!cargoId) {
      encargosSection.style.display = 'none';
      valoresSection.classList.remove('visible');
      cargoSelecionado = null;
      return;
    }
    
    cargoSelecionado = cargos.find(c => c.id === parseInt(cargoId));
    
    // Carregar valores do cargo
    await carregarValoresCargo(cargoId);
    
    // Mostrar seção de encargos
    encargosSection.style.display = 'block';
    
    // Re-renderizar encargos para limpar seleções anteriores
    renderizarEncargos();
    
    // Limpar campos de valor
    valoresInputsContainer.innerHTML = '';
    valoresSection.classList.remove('visible');
  }

  // Handler para mudança de seleção de encargos
  function onEncargoChange() {
    const encargosSelecionados = Array.from(
      document.querySelectorAll('#encargos-list input[type="checkbox"]:checked')
    );
    
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
  function renderizarCamposValor(checkboxes) {
    valoresInputsContainer.innerHTML = '';
    
    checkboxes.forEach(checkbox => {
      const slug = checkbox.value;
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
      input.placeholder = '0,0000';
      input.dataset.slug = slug;
      
      // Preencher com valor atual se existir
      if (valorAtual != null) {
        input.value = formatPercentual(valorAtual);
      }
      
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
    
    alterarForm.classList.add('loading');
    
    try {
      const promises = [];
      
      inputs.forEach(input => {
        const slug = input.dataset.slug;
        const valorStr = input.value.trim();
        
        if (valorStr === '') {
          mostrarMensagem(`Valor vazio para ${slug}`, 'warning');
          return;
        }
        
        const percentual = parsePercentualString(valorStr);
        
        if (!Number.isFinite(percentual)) {
          throw new Error(`Valor inválido para ${slug}: ${valorStr}`);
        }
        
        // Fazer requisição PUT para cada valor
        const promise = fetch(`${API_BASE}/valores`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cargo_id: cargoSelecionado.id,
            slug: slug,
            percentual: percentual
          })
        }).then(response => {
          if (!response.ok) throw new Error(`Erro ao atualizar ${slug}`);
          return response.json();
        });
        
        promises.push(promise);
      });
      
      await Promise.all(promises);
      
      mostrarMensagem('Valores atualizados com sucesso!', 'success');
      
      // Recarregar valores atuais
      await carregarValoresCargo(cargoSelecionado.id);
      
      // Re-renderizar campos com novos valores
      const encargosSelecionados = Array.from(
        document.querySelectorAll('#encargos-list input[type="checkbox"]:checked')
      );
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
    cargoSelecionado = null;
    valoresAtuais = {};
    
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
  alterarForm.addEventListener('submit', submitAlteracoes);
  limparBtn.addEventListener('click', limparFormulario);
  gerarPlanilhaBtn.addEventListener('click', gerarPlanilha);

  // Inicialização
  async function init() {
    await carregarCargos();
    await carregarEncargos();
  }

  init();
})();
