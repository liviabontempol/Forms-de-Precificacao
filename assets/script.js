(function(){
  // Dados de exemplo para o autocomplete
  const items = [
    'Salário-Base', 'Função Gratificada', 'Adicional de Insalubridade', 'Adicional Noturno', 'Adicional de Hora Noturna Reduzida', '13º (décimo terceiro) Salário', 'Férias e Adicional de Férias', 'Incidência do módulo 2.2 sobre os itens A e B', 'Abono Pecuniário', 'INSS', 'Salário Educação' , 'SAT' , 'SESC ou SESI' ,'SENAI - SENAC' , 'SEBRAE' , 'INCRA' , 'FGTS' , 'Transporte (2 x R$ 5,75 x 22 dias x quant.empregados - 6% sal)', 'Auxílio-Refeição/Alimentação (1 x R$ 29,15 x 22 x quant.empregados - 20% VA)' , 'Equipamentos de Proteção Individual' , 'Aviso Prévio Indenizado' , 'Incidência do FGTS sobre o Aviso Prévio Indenizado' , 'Multa do FGTS e contribuição social sobre o Aviso Prévio Indenizado' , 'Aviso Prévio Trabalhado' , 'Incidência dos encargos do submódulo 2.2 sobre o Aviso Prévio Trabalhado' , 'Multa do FGTS e contribuição social sobre o Aviso Prévio Trabalhado' , 'Outros (indenização adicional)' , 'Férias' , 'Ausências Legais' , 'Licença-Paternidade' , 'Ausência por acidente de trabalho' , 'Afastamento Maternidade' ,'Outros (especificar)', 'Incidência do Módulo 2.2' , 'Uniformes' , 'Materiais' , 'Reserva Técnica' ,'Custos Indiretos', 'Lucro', 'Tributo Federal (COFINS)' , 'Tributos sobre Vale Alimentação' , 'Tributo Federal (PIS)' , 'Tributo Municipal (ISSQN)' , 'Tributos Municipais (especificar)'
  ];

  const schools = [
    'Escola Estadual São José', 'Colégio Santa Maria', 'Escola Municipal Central', 'Escola Técnica de Tecnologia', 'Instituto Alpha'
  ];

  // Elementos
  const form = document.getElementById('sample-form');
  const result = document.getElementById('result');

  // Preenche datalist de escolas
  const datalist = document.getElementById('schools-list');
  schools.forEach(s => {
    const opt = document.createElement('option'); opt.value = s; datalist.appendChild(opt);
  });

  // MULTISEARCH (autocomplete + multi-select)
  const msInput = document.getElementById('multisearch-input');
  const msList = document.getElementById('multisearch-list');
  const selectedList = document.getElementById('selected-list');
  let suggestions = [];
  let selected = [];
  let highlighted = -1;

  function renderSelected(){
    selectedList.innerHTML = '';
    selected.forEach((s, idx) => {
      const li = document.createElement('li'); li.textContent = s;
      const btn = document.createElement('button'); btn.className='remove'; btn.type='button'; btn.textContent='×';
      btn.setAttribute('aria-label','Remover '+s);
      btn.addEventListener('click', ()=>{
        selected.splice(idx,1); renderSelected();
      });
      li.appendChild(btn);
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
    if(!selected.includes(value)) selected.push(value);
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
    const data = {
      choice: form.choice.value,
      multisearch: selected.slice(),
      school: form.school.value,
      text: form.text.value
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
      multisearch: Array.isArray(r.multisearch) ? r.multisearch.join('; ') : r.multisearch,
      school: r.school,
      text: r.text
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
})();
