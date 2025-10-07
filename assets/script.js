(function(){
  // Dados de exemplo para o autocomplete
const items = [
  'Salário-Base',
  'Função Gratificada',
  'Adicional de Insalubridade',
  'Adicional Noturno',
  'Adicional de Hora Noturna Reduzida',
  '13º (décimo terceiro) Salário',
  'Férias e Adicional de Férias',
  'Incidência do módulo 2.2 sobre os itens A e B',
  'Abono Pecuniário',
  'INSS',
  'Salário Educação',
  'SAT',
  'SESC ou SESI',
  'SENAI - SENAC',
  'SEBRAE',
  'INCRA',
  'FGTS',
  'Transporte (2 x R$ 5,75 x 22 dias x quant.empregados - 6% sal)',
  'Auxílio-Refeição/Alimentação (1 x R$ 29,15 x 22 x quant.empregados - 20% VA)',
  '13º (décimo terceiro) Salário, Férias e Adicional de Férias',
  'GPS, FGTS e outras contribuições',
  'Benefícios Mensais e Diários',
  'Aviso Prévio Indenizado',
  'Incidência do FGTS sobre o Aviso Prévio Indenizado',
  'Multa do FGTS e contribuição social sobre o Aviso Prévio Indenizado',
  'Aviso Prévio Trabalhado',
  'Incidência dos encargos do submódulo 2.2 sobre o Aviso Prévio Trabalhado',
  'Multa do FGTS e contribuição social sobre o Aviso Prévio Trabalhado',
  'Outros (indenização adicional)',
  'Férias',
  'Ausências Legais',
  'Licença-Paternidade',
  'Ausência por acidente de trabalho',
  'Afastamento Maternidade',
  'Outros (especificar)',
  'Incidência do Módulo 2.2',
  'Uniformes',
  'Materiais',
  'Equipamentos de Proteção Individual',
  'Reserva Técnica',
  'Custos Indiretos',
  'Lucro',
  'Tributos',
  'C.1. Tributo Federal (COFINS)',
  'C.2. Tributo Federal (PIS)',
  'C.3. Tributo Municipal (ISSQN)',
  'Tributos sobre Vale Alimentação',
  'D.1. Tributos Municipais (especificar)'
];

  // Elementos
  const form = document.getElementById('sample-form');
  const result = document.getElementById('result');

  
  // MULTISEARCH (autocomplete + multi-select)
  const msInput = document.getElementById('multisearch-input');
  const msList = document.getElementById('multisearch-list');
  const selectedList = document.getElementById('selected-list');
  const multisearchContainer = document.getElementById('multisearch');
  // create cargo inline elements
  const choice = document.getElementById('choice');
  const createInline = document.getElementById('create-cargo-inline');
  const multisearchLabel = document.getElementById('multisearch-label');
  const submitBtn = form.querySelector('button[type="submit"]');
  const newName = () => document.getElementById('new-name');
  const newDesc = () => document.getElementById('new-desc');
  const newHours = () => document.getElementById('new-hours');
  const newSalary = () => document.getElementById('new-salary');
  const saveNewBtn = () => document.getElementById('save-new-cargo');
  const cancelNewBtn = () => document.getElementById('cancel-new-cargo');
  let suggestions = [];
  let selected = [];
  // Guarda os 3 campos por item selecionado: { 'itemName': ['','',''] }
  const itemFields = {};
  let highlighted = -1;

  // helpers para formatação de percentual no formato brasileiro '0,00%'
  function formatPercentString(raw){
    if(raw == null) return '0,00%';
    let s = String(raw).trim();
    if(s === '') return '0,00%';
    // remove % e espaços
    s = s.replace('%','').replace(/\s+/g,'');
    // aceita vírgula ou ponto como separador
    s = s.replace(',', '.');
    // extrai números e ponto
    s = s.match(/-?[0-9]*\.?[0-9]*/);
    s = s ? s[0] : '';
    let n = parseFloat(s);
    if(!isFinite(n)) n = 0;
    // arredonda para 2 casas
    const fixed = n.toFixed(2);
    // troca ponto por vírgula
    return fixed.replace('.',',') + '%';
  }

  function stripPercentFormatting(formatted){
    if(formatted == null) return '';
    let s = String(formatted).trim();
    s = s.replace('%','').replace(/\s+/g,'');
    s = s.replace(',','.');
    return s;
  }

  function renderSelected(){
    selectedList.innerHTML = '';
    selected.forEach((s, idx) => {
      const li = document.createElement('li');
      // header with name + remove
      const header = document.createElement('div'); header.className = 'item-header';
      const span = document.createElement('span'); span.textContent = s; span.className='item-name';
      const btn = document.createElement('button'); btn.className='remove'; btn.type='button'; btn.textContent='×';
      btn.setAttribute('aria-label','Remover '+s);
      btn.addEventListener('click', ()=>{
        delete itemFields[s]; selected.splice(idx,1); renderSelected();
      });
      header.appendChild(span); header.appendChild(btn);
      li.appendChild(header);

      // fields container: Quantidade, Valor Unitário, Percentual
  const fields = itemFields[s] || ['', '', ''];
      const fieldsContainer = document.createElement('div'); fieldsContainer.className='item-fields';
      const labels = ['Quantidade','Valor Unitário','Percentual'];
      for(let i=0;i<3;i++){
        const inp = document.createElement('input');
        // tipos: 0 -> quantidade (number), 1 -> valor unitário (number), 2 -> percentual (formatted text)
        if(i===0){ inp.type = 'number'; inp.step = '1'; inp.min = '0'; }
        else if(i===1){ inp.type = 'number'; inp.step = 'any'; inp.min = '0'; }
        else { inp.type = 'text'; }
        inp.className='item-field'; inp.placeholder = labels[i];
        inp.setAttribute('aria-label', labels[i] + ' para ' + s);
        // set initial value (for percentual, format)
  if(i===2){ inp.value = fields[i] ? formatPercentString(fields[i]) : ''; }
        else { inp.value = fields[i] || ''; }
        // store indices to identify
        inp.dataset.item = s; inp.dataset.index = String(i);
        if(i===2){
          // percentual: strip on focus, format on blur
          inp.addEventListener('focus', (e)=>{ const v = e.target.value; e.target.value = stripPercentFormatting(v); });
          inp.addEventListener('blur', (e)=>{ const raw = stripPercentFormatting(e.target.value); e.target.value = formatPercentString(raw); const it = e.target.dataset.item; const ix = Number(e.target.dataset.index); if(!itemFields[it]) itemFields[it] = ['', '', '']; itemFields[it][ix] = raw; });
          inp.addEventListener('input', (e)=>{ const it = e.target.dataset.item; const ix = Number(e.target.dataset.index); if(!itemFields[it]) itemFields[it] = ['', '', '']; itemFields[it][ix] = stripPercentFormatting(e.target.value); });
        } else {
          inp.addEventListener('input', (e)=>{
            const it = e.target.dataset.item; const ix = Number(e.target.dataset.index);
            if(!itemFields[it]) itemFields[it] = ['', '', ''];
            itemFields[it][ix] = e.target.value;
          });
        }
        fieldsContainer.appendChild(inp);
      }
      li.appendChild(fieldsContainer);
      selectedList.appendChild(li);
    });
  }

  function showSuggestions(list){
    msList.innerHTML = '';
    if(!list.length){ msList.style.display='none'; return }
    list.forEach((s,i)=>{
      const li = document.createElement('li'); li.textContent = s; li.role='option';
      li.addEventListener('click', ()=>{ addSelected(s); msInput.value=''; msList.style.display='none'; });
      if(i===highlighted) li.classList.add('highlight');
      msList.appendChild(li);
    });
    msList.style.display='block';
  }

  function addSelected(value){
    if(!selected.includes(value)){
      selected.push(value);
      // inicializa 3 campos vazios
      itemFields[value] = ['', '', ''];
    }
    renderSelected();
  }

  function filterSuggestions(q){
    if(!q) return items.slice();
    const low=q.toLowerCase();
    return items.filter(i=>i.toLowerCase().includes(low) && !selected.includes(i));
  }

  msInput.addEventListener('input', (e)=>{
    const q = e.target.value.trim();
    suggestions = filterSuggestions(q);
    highlighted = -1;
    showSuggestions(suggestions);
  });

  msInput.addEventListener('keydown', (e)=>{
    if(e.key==='ArrowDown'){
      if(suggestions.length){ highlighted = Math.min(highlighted+1, suggestions.length-1); showSuggestions(suggestions); }
      e.preventDefault();
    } else if(e.key==='ArrowUp'){
      if(suggestions.length){ highlighted = Math.max(highlighted-1, 0); showSuggestions(suggestions); }
      e.preventDefault();
    } else if(e.key==='Enter'){
      if(highlighted>=0 && suggestions[highlighted]){
        addSelected(suggestions[highlighted]); msInput.value=''; msList.style.display='none'; e.preventDefault();
      }
    } else if(e.key==='Backspace'){
      if(msInput.value===''){
        // remove last selected
        selected.pop(); renderSelected();
      }
    }
  });

  // clique fora para fechar
  document.addEventListener('click', (e)=>{
    if(!document.getElementById('multisearch').contains(e.target)){
      msList.style.display='none';
    }
  });

  // Submissão do formulário
  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    // validações antes de salvar
    const choiceVal = form.choice.value;
    // se estiver no modo criar cargo, não permita submit do formulário (usuário deve usar o botão salvar dentro do layout)
    if(choiceVal === '__create__'){
      alert('Finalize a criação do cargo ou cancele antes de submeter o formulário.');
      return;
    }
    if(!choiceVal){ alert('Selecione um cargo antes de submeter.'); return }
    if(selected.length===0){ alert('Selecione ao menos uma linha a ser alterada antes de submeter.'); return }
    // verificar que pelo menos um dos três campos por item foi preenchido
    for(const s of selected){
      const f = itemFields[s] || [];
      if(!(f[0] || f[1] || f[2])){ alert(`Preencha ao menos um dos campos para a linha: ${s}`); return }
    }

    const data = {
      choice: choiceVal,
      multisearch: selected.map(s=>({ item: s, fields: itemFields[s] || ['', '', ''] }))
    };
    result.textContent = JSON.stringify(data, null, 2);
    // Salva no localStorage
    saveResponse(data);
    renderResponsesCount();
  });

  // A11y: focus on suggestion when mouseover
  msList.addEventListener('mousemove', (e)=>{
    const li = e.target.closest('li');
    if(!li) return;
    const nodes = Array.from(msList.querySelectorAll('li'));
    highlighted = nodes.indexOf(li);
    showSuggestions(suggestions);
  });

  // quando o usuário escolhe 'Criar Novo Cargo' mostramos o layout inline
  if(choice){
    choice.addEventListener('change', (e)=>{
      const val = e.target.value;
      if(val === '__create__'){
        if(createInline) createInline.classList.remove('hidden');
        if(multisearchContainer) multisearchContainer.classList.add('hidden');
        if(multisearchLabel) multisearchLabel.classList.add('hidden');
        if(submitBtn) submitBtn.classList.add('hidden');
      } else {
        // selecionou um cargo existente (ou vazio): esconder layout de criação e mostrar as linhas originais
        if(createInline) createInline.classList.add('hidden');
        if(multisearchContainer) multisearchContainer.classList.remove('hidden');
        if(multisearchLabel) multisearchLabel.classList.remove('hidden');
        if(submitBtn) submitBtn.classList.remove('hidden');
      }
    });
  }

  // Inicializa lista vazia de seleções
  renderSelected();
  renderResponsesCount();

  // ---------- Persistência e exportação ----------
  const STORAGE_KEY = 'form_responses_v1';

  function loadResponses(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    }catch(e){ return [] }
  }

  function saveResponse(obj){
    const all = loadResponses();
    all.push({timestamp: new Date().toISOString(), ...obj});
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }

  function clearResponses(){
    localStorage.removeItem(STORAGE_KEY);
    renderResponsesCount();
  }

  function renderResponsesCount(){
    const span = document.getElementById('responses-count');
    const n = loadResponses().length;
    span.textContent = n ? `${n} resposta(s) armazenada(s)` : 'Nenhuma resposta armazenada';
  }

  // Exporta para XLSX usando SheetJS se disponível, senão CSV
  function exportResponses(){
    const data = loadResponses();
    if(!data.length){ alert('Não há respostas para exportar.'); return }

    // Normaliza para tabela: transforma multisearch em string separada por ';'
    const table = data.map(r=>({
      timestamp: r.timestamp,
      choice: r.choice,
      // transforma o array de objetos em uma string legível por célula
      multisearch: Array.isArray(r.multisearch) ? r.multisearch.map(m=>{
        const f = Array.isArray(m.fields) ? m.fields.slice() : [];
        // converter o terceiro campo (percentual) para número decimal (ex: '12.5')
        if(f.length>2){
          const raw = String(f[2]||'').replace(',','.');
          const num = Number(raw);
          f[2] = isFinite(num) ? num : f[2];
        }
        return `${m.item} [${f.join(' | ')}]`;
      }).join(' ; ') : r.multisearch
    }));

    if(window.XLSX){
      const ws = XLSX.utils.json_to_sheet(table);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Respostas');
      const wbout = XLSX.write(wb, {bookType:'xlsx', type:'array'});
      const blob = new Blob([wbout], {type:'application/octet-stream'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'respostas.xlsx';
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } else {
      // fallback CSV
      const headers = Object.keys(table[0]);
      const rows = [headers.join(',')].concat(table.map(r=>headers.map(h=>`"${String(r[h]||'').replace(/"/g,'""')}"`).join(',')));
      const blob = new Blob([rows.join('\n')], {type:'text/csv;charset=utf-8;'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'respostas.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    }
  }

  // Wire up export/clear buttons (adicionados ao index.html)
  const exportBtn = document.getElementById('export-xlsx');
  const clearBtn = document.getElementById('clear-responses');
  if(exportBtn) exportBtn.addEventListener('click', exportResponses);
  if(clearBtn) clearBtn.addEventListener('click', ()=>{ if(confirm('Limpar todas as respostas armazenadas?')){ clearResponses(); } });

  // handlers para salvar/cancelar novo cargo inline
  const saveBtn = saveNewBtn();
  const cancelBtn = cancelNewBtn();
  if(saveBtn){
    saveBtn.addEventListener('click', ()=>{
      const nameEl = newName();
      if(!nameEl) return;
      const name = nameEl.value.trim();
      if(!name){ alert('Informe o nome do cargo'); return }
      // valida campos obrigatórios do novo cargo: carga horária e salário
      const hoursEl = newHours(); const salaryEl = newSalary();
      const hours = hoursEl ? hoursEl.value.trim() : '';
      const salary = salaryEl ? salaryEl.value.trim() : '';
      if(!hours){ alert('Informe a carga horária do novo cargo'); return }
      if(!salary){ alert('Informe o salário do novo cargo'); return }
      // criar option com value único
      const val = 'cargo_' + Date.now();
      const opt = document.createElement('option'); opt.value = val; opt.textContent = name;
      // inserir antes da opção __create__ se existir
      const createOpt = Array.from(choice.options).find(o=>o.value==='__create__');
      if(createOpt) choice.insertBefore(opt, createOpt);
      else choice.appendChild(opt);
      choice.value = val;
      // esconder layout e limpar fields
      if(createInline) createInline.classList.add('hidden');
      if(multisearchContainer) multisearchContainer.classList.remove('hidden');
      if(multisearchLabel) multisearchLabel.classList.remove('hidden');
      if(submitBtn) submitBtn.classList.remove('hidden');
      nameEl.value = '';
      if(newDesc()) newDesc().value = '';
      if(newHours()) newHours().value = '';
      if(newSalary()) newSalary().value = '';
  // após criar o cargo; voltar ao fluxo normal
    });
  }
  if(cancelBtn){
    cancelBtn.addEventListener('click', ()=>{
  if(createInline) createInline.classList.add('hidden');
  if(choice) choice.value = '';
  if(multisearchContainer) multisearchContainer.classList.remove('hidden');
  if(multisearchLabel) multisearchLabel.classList.remove('hidden');
  if(submitBtn) submitBtn.classList.remove('hidden');
    });
  }
})();
