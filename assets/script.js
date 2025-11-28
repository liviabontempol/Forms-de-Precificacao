(function(){
  const form = document.getElementById('sample-form');
  const result = document.getElementById('result');
  const newName = () => document.getElementById('new-name');
  const newDesc = () => document.getElementById('new-desc');
  const newHours = () => document.getElementById('new-hours');
  const newSalary = () => document.getElementById('new-salary');
  const newPericulosidade = () => {
    const r = document.querySelector('input[name="periculosidade"]:checked');
    return r ? (r.value === 'sim') : false;
  };
  const newInsalubridade = () => {
    const r = document.querySelector('input[name="insalubridade"]:checked');
    return r ? (r.value === 'sim') : false;
  };
  const newInsalubridadePct = () => {
    const el = document.getElementById('insalubridade-percent');
    return el ? Number(el.value) : null;
  };

  // Helper: parse and format BRL currency strings
  function parseBRLString(str){
    if (str == null) return NaN;
    let s = String(str).replace(/\s/g,'').replace('R$','');
    // remove thousand separators
    s = s.replace(/\./g,'').replace(',','.');
    s = s.replace(/[^0-9.-]/g,'');
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }

  function formatBRL(n){
    if (!Number.isFinite(n)) return 'R$0,00';
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  // Currency input: user types only digits; each new digit shifts previous to the left (cents-aware)
  const salaryInput = document.getElementById('new-salary');
  const salaryInputInline = document.getElementById('new-salary-inline');

  function attachCurrencyInput(el){
    if(!el) return;
    // initialize cents from any existing value or zero
    const initial = parseBRLString(el.value);
    let cents = Number.isFinite(initial) ? Math.round(initial * 100) : 0;
    el.dataset.cents = String(cents);
    el.value = formatBRL(cents / 100);

    // handle typed keys (digits build the cents value)
    el.addEventListener('keydown', (ev) => {
      // allow navigation keys
      const allow = ['Tab','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','Enter'];
      if(allow.includes(ev.key) || (ev.ctrlKey || ev.metaKey)) return;

      // digits 0-9
      if(/^[0-9]$/.test(ev.key)){
        ev.preventDefault();
        const d = Number(ev.key);
        cents = (cents * 10) + d;
        el.dataset.cents = String(cents);
        el.value = formatBRL(cents / 100);
        return;
      }

      // Backspace -> remove last digit
      if(ev.key === 'Backspace'){
        ev.preventDefault();
        cents = Math.floor(cents / 10);
        el.dataset.cents = String(cents);
        el.value = formatBRL(cents / 100);
        return;
      }

      // Delete -> clear
      if(ev.key === 'Delete'){
        ev.preventDefault();
        cents = 0;
        el.dataset.cents = String(cents);
        el.value = formatBRL(0);
        return;
      }

      // block anything else
      ev.preventDefault();
    });

    // paste: extract digits and set as cents (last two digits are cents)
    el.addEventListener('paste', (ev) => {
      ev.preventDefault();
      const text = (ev.clipboardData || window.clipboardData).getData('text') || '';
      const digits = (text.match(/\d+/g) || []).join('');
      if(digits.length === 0) return;
      // interpret pasted digits as amount in cents (e.g. '123456' -> 1234.56)
      cents = Number(digits);
      el.dataset.cents = String(cents);
      el.value = formatBRL(cents / 100);
    });

    // on focus: show numeric value without R$ (optional UX)
    el.addEventListener('focus', ()=>{
      // show plain number with comma for cents for easier editing if needed
      const v = Number(el.dataset.cents) || 0;
      el.value = (v / 100).toFixed(2).replace('.',',');
      setTimeout(()=>{ el.selectionStart = el.selectionEnd = el.value.length; }, 0);
    });

    // on blur: format nicely
    el.addEventListener('blur', ()=>{
      const v = Number(el.dataset.cents) || 0;
      el.value = formatBRL(v / 100);
    });
  }

  attachCurrencyInput(salaryInput);
  attachCurrencyInput(salaryInputInline);

  const STORAGE_KEY = 'form_responses_v1';

  function loadResponses(){
    try{ const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : []; }catch(e){ return []; }
  }

  function saveResponse(obj){
    const all = loadResponses();
    all.push({ timestamp: new Date().toISOString(), ...obj });
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

  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const nameEl = newName();
    const descEl = newDesc();
    const hoursEl = newHours();
    const salaryEl = newSalary();
    const name = nameEl ? nameEl.value.trim() : '';
    const periculosidade = newPericulosidade();
    const insalubridade = newInsalubridade();
    const insalubridadePct = insalubridade ? (newInsalubridadePct() || 20) : null;
    const hours = hoursEl ? hoursEl.value.trim() : '';
    if(!name){ alert('Informe o nome do cargo'); return; }
    if(!hours){ alert('Informe a carga horária do novo cargo'); return; }
    // salary: prefer in-memory cents value (data-cents) from the masked input
    let salary;
    if(salaryEl && typeof salaryEl.dataset.cents !== 'undefined'){
      salary = Number(salaryEl.dataset.cents) / 100;
    } else {
      const salaryRaw = salaryEl ? salaryEl.value.trim() : '';
      if(!salaryRaw){ alert('Informe o salário-base do novo cargo'); return; }
      // normaliza salário (permite vírgula)
      salary = parseBRLString(salaryRaw);
    }
    const data = { name, periculosidade, insalubridade, insalubridadePct, hours: Number(hours) || hours, salary: Number(salary) || salary };
    // mostra resumo
    if(result) result.textContent = JSON.stringify(data, null, 2);
    saveResponse(data);
    renderResponsesCount();
    // limpa formulário
    nameEl.value = ''; if(descEl) descEl.value = ''; if(hoursEl) hoursEl.value = '';
    if(salaryEl){ salaryEl.value = formatBRL(0); salaryEl.dataset.cents = '0'; }
  });

  // Exporta para XLSX usando SheetJS se disponível, senão CSV
  function exportResponses(){
    const data = loadResponses();
    if(!data.length){ alert('Não há respostas para exportar.'); return }
    const table = data.map(r=>({ timestamp: r.timestamp, name: r.name, periculosidade: r.periculosidade ? 'Sim' : 'Não', insalubridade: r.insalubridade ? `Sim (${r.insalubridadePct || ''}%)` : 'Não', hours: r.hours || '', salary: r.salary || '' }));
    if(window.XLSX){
      const ws = XLSX.utils.json_to_sheet(table);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Cargos');
      const wbout = XLSX.write(wb, {bookType:'xlsx', type:'array'});
      const blob = new Blob([wbout], {type:'application/octet-stream'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'cargos.xlsx'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } else {
      const headers = Object.keys(table[0]);
      const rows = [headers.join(',')].concat(table.map(r=>headers.map(h=>`"${String(r[h]||'').replace(/"/g,'""')}"`).join(',')));
      const blob = new Blob([rows.join('\n')], {type:'text/csv;charset=utf-8;'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'cargos.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    }
  }

  const exportBtn = document.getElementById('export-xlsx');
  const clearBtn = document.getElementById('clear-responses');
  if(exportBtn) exportBtn.addEventListener('click', exportResponses);
  if(clearBtn) clearBtn.addEventListener('click', ()=>{ if(confirm('Limpar todas as respostas armazenadas?')) clearResponses(); });

  // cancelar: limpa campos do form
  const cancelBtn = document.getElementById('cancel-new-cargo');
  if(cancelBtn){
    cancelBtn.addEventListener('click', ()=>{
      const n = newName(); const d = newDesc(); const h = newHours(); const s = newSalary();
      if(n) n.value = '';
      if(d) d.value = '';
      if(h) h.value = '';
      if(s){ s.value = formatBRL(0); s.dataset.cents = '0'; }
      // limpar radios/select
      const pSim = document.getElementById('periculosidade-sim');
      const pNao = document.getElementById('periculosidade-nao');
      if(pSim) pSim.checked = false; if(pNao) pNao.checked = true;
      const iSim = document.getElementById('insalubridade-sim');
      const iNao = document.getElementById('insalubridade-nao');
      if(iSim) iSim.checked = false; if(iNao) iNao.checked = true;
      const pct = document.getElementById('insalubridade-percent');
      if(pct) pct.value = '20';
      const opts = document.getElementById('insalubridade-options'); if(opts) opts.style.display = 'none';
      const optsInline = document.getElementById('insalubridade-options-inline'); if(optsInline) optsInline.style.display = 'none';
      const sInline = document.getElementById('new-salary-inline'); if(sInline){ sInline.value = formatBRL(0); sInline.dataset.cents = '0'; }
    });
  }

  // Mostrar/ocultar seletor de percentual quando usuário marca sim/nao para insalubridade
  const insalSim = document.getElementById('insalubridade-sim');
  const insalNao = document.getElementById('insalubridade-nao');
  const insalOpts = document.getElementById('insalubridade-options');
  if(insalSim){ insalSim.addEventListener('change', ()=>{ if(insalOpts) insalOpts.style.display = insalSim.checked ? 'block' : 'none'; }); }
  if(insalNao){ insalNao.addEventListener('change', ()=>{ if(insalOpts) insalOpts.style.display = insalNao.checked ? 'none' : insalOpts.style.display; }); }

  renderResponsesCount();
})();
