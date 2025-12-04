(function(){
  const form = document.getElementById('sample-form');
  const result = document.getElementById('result');
  const newName = () => document.getElementById('new-name');
  const newDesc = () => document.getElementById('new-desc');
  const newHours = () => document.getElementById('new-hours');
  const newQuantidade = () => document.getElementById('new-quantidade');
  const newSalary = () => document.getElementById('new-salary');
  const newVt = () => document.getElementById('new-vt');
  const newVa = () => document.getElementById('new-va');
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
  // attach to new benefit inputs
  attachCurrencyInput(document.getElementById('new-vt'));
  attachCurrencyInput(document.getElementById('new-va'));
  attachCurrencyInput(document.getElementById('new-vt-inline'));
  attachCurrencyInput(document.getElementById('new-va-inline'));

  

  async function downloadPlanilha(payload) {
  try {
    const resp = await fetch('http://localhost:3000/gerar-planilha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(()=>null);
      throw new Error(`Erro ${resp.status}: ${txt || resp.statusText}`);
    }

    // recebe o conteúdo como blob
    const blob = await resp.blob();

    // tenta extrair o filename do header Content-Disposition
    const cd = resp.headers.get('Content-Disposition') || resp.headers.get('content-disposition') || '';
    let filename = 'planilha.xlsx';
    const match = /filename\\*?=(?:UTF-8'')?\"?([^\";\\n]+)/i.exec(cd);
    if (match && match[1]) {
      filename = decodeURIComponent(match[1].replace(/['"]/g,''));
    }

    // cria link para download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Erro ao gerar/baixar planilha:', err);
      alert('Erro ao gerar a planilha: ' + (err.message || err));
      throw err;
  }
}


  form.addEventListener('submit', async (e)=>{
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
    // monta payload compatível com gerarPlanilha.js
    const quantidadeEl = newQuantidade();
    const quantidade = quantidadeEl ? Number(quantidadeEl.value) || 1 : 1;
    // read benefits inputs (use dataset.cents if available)
    const vtEl = newVt();
    const vaEl = newVa();
    let vtVal = 0;
    let vaVal = 0;
    if (vtEl && typeof vtEl.dataset.cents !== 'undefined') vtVal = Number(vtEl.dataset.cents)/100;
    else if (vtEl) vtVal = parseBRLString(vtEl.value) || 0;
    if (vaEl && typeof vaEl.dataset.cents !== 'undefined') vaVal = Number(vaEl.dataset.cents)/100;
    else if (vaEl) vaVal = parseBRLString(vaEl.value) || 0;

    const payload = {
      cargo: name,
      jornada: hours || '',
      quantidade: quantidade,
      salarioBase: Number(salary) || 0,
      // defaults razoáveis; podem ser alterados no backend ou adicionados inputs no futuro
      encargosPercent: 0.30,
      reservaTecnicaPercent: 0.08,
      salarioMinimo: Number(salary) || 0,
      beneficios: { vt: vtVal, vr: vaVal, assistencia: 0, outros: 0 },
      adicionalNoturno: 0,
      horaIntervaloNoturno: 0,
      horaFictaNoturna: 0,
      periculosidade: periculosidade,
      insalubridade: insalubridade ? String(insalubridadePct || 20) : false,
      tributos: { iss: 0, pisCofins: 0, irpjCsll: 0 }
    };

    // gerar e baixar a planilha; se falhar, aborta sem salvar localmente
    try {
      await downloadPlanilha(payload);
    } catch (err) {
      return;
    }
    // mostra resumo (opcional)
    if(result) result.textContent = JSON.stringify(payload, null, 2);
    // limpa formulário
    nameEl.value = ''; if(descEl) descEl.value = ''; if(hoursEl) hoursEl.value = '';
    if(salaryEl){ salaryEl.value = formatBRL(0); salaryEl.dataset.cents = '0'; }
    const vtResetEl = newVt(); const vaResetEl = newVa();
    if(vtResetEl){ vtResetEl.value = 'R$5,75'; vtResetEl.dataset.cents = String(Math.round(5.75*100)); }
    if(vaResetEl){ vaResetEl.value = 'R$29,15'; vaResetEl.dataset.cents = String(Math.round(29.15*100)); }
  });

  

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
      const vtInline = document.getElementById('new-vt-inline'); if(vtInline){ vtInline.value = 'R$5,75'; vtInline.dataset.cents = String(Math.round(5.75*100)); }
      const vaInline = document.getElementById('new-va-inline'); if(vaInline){ vaInline.value = 'R$29,15'; vaInline.dataset.cents = String(Math.round(29.15*100)); }
    });
  }

  // Mostrar/ocultar seletor de percentual quando usuário marca sim/nao para insalubridade
  const insalSim = document.getElementById('insalubridade-sim');
  const insalNao = document.getElementById('insalubridade-nao');
  const insalOpts = document.getElementById('insalubridade-options');
  if(insalSim){ insalSim.addEventListener('change', ()=>{ if(insalOpts) insalOpts.style.display = insalSim.checked ? 'block' : 'none'; }); }
  if(insalNao){ insalNao.addEventListener('change', ()=>{ if(insalOpts) insalOpts.style.display = insalNao.checked ? 'none' : insalOpts.style.display; }); }

    
})();
