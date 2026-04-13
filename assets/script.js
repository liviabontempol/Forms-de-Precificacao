(function () {
  const form = document.getElementById('sample-form');
  const result = document.getElementById('result');
  const newName = () => document.getElementById('new-name');
  const newHours = () => document.getElementById('new-hours');
  const newVigencia = () => document.getElementById('new-vigencia');
  const newQuantidade = () => document.getElementById('new-quantidade');
  const newSalary = () => document.getElementById('new-salary');
  const newReservaTecnica = () => document.getElementById('new-reserva-tecnica');
  const newUniformes = () => document.getElementById('new-uniformes');
  const newMateriais = () => document.getElementById('new-materiais');
  const newEpi = () => document.getElementById('new-epi');
  function getCheckedRadioValue(name, scope) {
    const root = scope && typeof scope.querySelector === 'function' ? scope : document;
    const scoped = root.querySelector(`input[name="${name}"]:checked`);
    if (scoped) return scoped.value;
    const fallback = document.querySelector(`input[name="${name}"]:checked`);
    return fallback ? fallback.value : null;
  }

  const newPericulosidade = (scope) => {
    return getCheckedRadioValue('periculosidade', scope) === 'sim';
  };
  const newInsalubridade = (scope) => {
    return getCheckedRadioValue('insalubridade', scope) === 'sim';
  };
  const newInsalubridadePct = () => {
    const el = document.getElementById('insalubridade-percent');
    return el ? Number(el.value) : null;
  };
  const newAdicionalNoturno = (scope) => {
    return getCheckedRadioValue('adicional-noturno', scope) === 'sim';
  };
  const newUniforme = (scope) => {
    return getCheckedRadioValue('uniforme', scope) === 'sim';
  };
  const newMaterial = (scope) => {
    return getCheckedRadioValue('material', scope) === 'sim';
  };
  const newEpiAtivo = (scope) => {
    return getCheckedRadioValue('epi', scope) === 'sim';
  };

  // Helper: parse and format BRL currency strings
  function parseBRLString(str) {
    if (str == null) return NaN;
    let s = String(str).replace(/\s/g, '').replace('R$', '');
    // remove thousand separators
    s = s.replace(/\./g, '').replace(',', '.');
    s = s.replace(/[^0-9.-]/g, '');
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }

  function formatBRL(n) {
    if (!Number.isFinite(n)) return 'R$0,00';
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function parsePercentStringToDecimal(str) {
    if (str == null) return NaN;
    let s = String(str).replace(/\s/g, '').replace('%', '');
    s = s.replace(/\./g, '').replace(',', '.');
    s = s.replace(/[^0-9.-]/g, '');
    if (s === '') return NaN;
    const n = Number(s);
    if (!Number.isFinite(n)) return NaN;
    // Entrada em percentual (ex.: 8,00%) vira fração decimal (0.08).
    return n / 100;
  }

  function formatPercentFromCenti(c) {
    const safe = Number.isFinite(c) && c >= 0 ? Math.floor(c) : 0;
    return `${(safe / 100).toFixed(2).replace('.', ',')}%`;
  }

  // Currency input: user types only digits; each new digit shifts previous to the left (cents-aware)
  const salaryInput = document.getElementById('new-salary');
  const salaryInputInline = document.getElementById('new-salary-inline');
  const reservaTecnicaInput = document.getElementById('new-reserva-tecnica');
  const uniformesInput = document.getElementById('new-uniformes');
  const materiaisInput = document.getElementById('new-materiais');
  const epiInput = document.getElementById('new-epi');

  function attachCurrencyInput(el) {
    if (!el) return;
    // initialize cents from any existing value or zero
    const initial = parseBRLString(el.value);
    let cents = Number.isFinite(initial) ? Math.round(initial * 100) : 0;
    el.dataset.cents = String(cents);
    el.value = formatBRL(cents / 100);

    // handle typed keys (digits build the cents value)
    el.addEventListener('keydown', (ev) => {
      // allow navigation keys
      const allow = ['Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter'];
      if (allow.includes(ev.key) || (ev.ctrlKey || ev.metaKey)) return;

      // digits 0-9
      if (/^[0-9]$/.test(ev.key)) {
        ev.preventDefault();
        const d = Number(ev.key);
        cents = (cents * 10) + d;
        el.dataset.cents = String(cents);
        el.value = formatBRL(cents / 100);
        return;
      }

      // Backspace -> remove last digit
      if (ev.key === 'Backspace') {
        ev.preventDefault();
        cents = Math.floor(cents / 10);
        el.dataset.cents = String(cents);
        el.value = formatBRL(cents / 100);
        return;
      }

      // Delete -> clear
      if (ev.key === 'Delete') {
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
      if (digits.length === 0) return;
      // interpret pasted digits as amount in cents (e.g. '123456' -> 1234.56)
      cents = Number(digits);
      el.dataset.cents = String(cents);
      el.value = formatBRL(cents / 100);
    });

    // on focus: show numeric value without R$ (optional UX)
    el.addEventListener('focus', () => {
      // show plain number with comma for cents for easier editing if needed
      const v = Number(el.dataset.cents) || 0;
      el.value = (v / 100).toFixed(2).replace('.', ',');
      setTimeout(() => { el.selectionStart = el.selectionEnd = el.value.length; }, 0);
    });

    // on blur: format nicely
    el.addEventListener('blur', () => {
      const v = Number(el.dataset.cents) || 0;
      el.value = formatBRL(v / 100);
    });
  }

  attachCurrencyInput(salaryInput);
  attachCurrencyInput(salaryInputInline);
  attachCurrencyInput(uniformesInput);
  attachCurrencyInput(materiaisInput);
  attachCurrencyInput(epiInput);

  function attachPercentInput(el) {
    if (!el) return;

    const initialDecimal = parsePercentStringToDecimal(el.value);
    // "centi-percent": 8,25% => 825
    let centiPercent = Number.isFinite(initialDecimal) ? Math.round(initialDecimal * 10000) : 0;
    el.dataset.centiPercent = String(centiPercent);
    el.value = formatPercentFromCenti(centiPercent);

    el.addEventListener('keydown', (ev) => {
      const allow = ['Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter'];
      if (allow.includes(ev.key) || (ev.ctrlKey || ev.metaKey)) return;

      if (/^[0-9]$/.test(ev.key)) {
        ev.preventDefault();
        centiPercent = (centiPercent * 10) + Number(ev.key);
        el.dataset.centiPercent = String(centiPercent);
        el.value = formatPercentFromCenti(centiPercent);
        return;
      }

      if (ev.key === 'Backspace') {
        ev.preventDefault();
        centiPercent = Math.floor(centiPercent / 10);
        el.dataset.centiPercent = String(centiPercent);
        el.value = formatPercentFromCenti(centiPercent);
        return;
      }

      if (ev.key === 'Delete') {
        ev.preventDefault();
        centiPercent = 0;
        el.dataset.centiPercent = '0';
        el.value = formatPercentFromCenti(0);
        return;
      }

      ev.preventDefault();
    });

    el.addEventListener('paste', (ev) => {
      ev.preventDefault();
      const text = (ev.clipboardData || window.clipboardData).getData('text') || '';
      const digits = (text.match(/\d+/g) || []).join('');
      centiPercent = digits ? Number(digits) : 0;
      el.dataset.centiPercent = String(centiPercent);
      el.value = formatPercentFromCenti(centiPercent);
    });

    el.addEventListener('focus', () => {
      setTimeout(() => { el.selectionStart = el.selectionEnd = el.value.length; }, 0);
    });

    el.addEventListener('blur', () => {
      const v = Number(el.dataset.centiPercent) || 0;
      el.value = formatPercentFromCenti(v);
    });
  }

  attachPercentInput(reservaTecnicaInput);
  


  async function downloadPlanilha(payload) {
    try {
      const { hostname, protocol, port } = window.location;
      const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
      const API_BASE_URL = isLocal
        ? (port === '3000' ? '' : `${protocol}//${hostname}:3000`)
        : ''; // usar URL relativa em produção
      const resp = await fetch(`${API_BASE_URL}/gerar-planilha`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => null);
        throw new Error(`Erro ${resp.status}: ${txt || resp.statusText}`);
      }

      // recebe o conteúdo como blob
      const blob = await resp.blob();

      // tenta extrair o filename do header Content-Disposition
      const cd = resp.headers.get('Content-Disposition') || resp.headers.get('content-disposition') || '';
      let filename = 'planilha.xlsx';
      const utf8Match = /filename\*=UTF-8''([^;\n]+)/i.exec(cd);
      const plainMatch = /filename="?([^";\n]+)"?/i.exec(cd);
      const rawFilename = utf8Match?.[1] || plainMatch?.[1] || '';
      if (rawFilename) {
        filename = decodeURIComponent(rawFilename.replace(/['"]/g, '').trim());
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


  if (form) {
    form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameEl = newName();
    const hoursEl = newHours();
    const vigenciaEl = newVigencia();
    const quantidadeEl = newQuantidade();
    const salaryEl = newSalary();
    const reservaTecnicaEl = newReservaTecnica();
    const name = nameEl ? nameEl.value.trim() : '';
    const periculosidade = newPericulosidade(form);
    const insalubridade = newInsalubridade(form);
    const insalubridadePct = insalubridade ? (newInsalubridadePct() || 20) : null;
    const adicionalNoturno = newAdicionalNoturno(form);
    const uniformeAtivo = newUniforme(form);
    const materialAtivo = newMaterial(form);
    const epiAtivo = newEpiAtivo(form);
    const hours = hoursEl ? hoursEl.value.trim() : '';
    const quantidadeRaw = quantidadeEl ? quantidadeEl.value.trim() : '';
    const vigencia = vigenciaEl ? Number(vigenciaEl.value) || 12 : 12;
    const uniformesEl = newUniformes();
    const materiaisEl = newMateriais();
    const epiEl = newEpi();
    if (!name) { alert('Informe o nome do cargo'); return; }
    if (!hours) { alert('Informe a carga horária do novo cargo'); return; }
    if (!quantidadeRaw) { alert('Informe a quantidade de postos'); return; }
    // salary: prefer in-memory cents value (data-cents) from the masked input
    let salary;
    if (salaryEl && typeof salaryEl.dataset.cents !== 'undefined') {
      salary = Number(salaryEl.dataset.cents) / 100;
    } else {
      const salaryRaw = salaryEl ? salaryEl.value.trim() : '';
      if (!salaryRaw) { alert('Informe o salário-base do novo cargo'); return; }
      // normaliza salário (permite vírgula)
      salary = parseBRLString(salaryRaw);
    }

    if (!Number.isFinite(salary) || salary <= 0) {
      alert('Informe um salário-base maior que zero');
      return;
    }

    let reservaTecnica = 0;
    if (reservaTecnicaEl && typeof reservaTecnicaEl.dataset.centiPercent !== 'undefined') {
      reservaTecnica = (Number(reservaTecnicaEl.dataset.centiPercent) || 0) / 10000;
    } else if (reservaTecnicaEl) {
      const parsedReserva = parsePercentStringToDecimal(reservaTecnicaEl.value);
      reservaTecnica = Number.isFinite(parsedReserva) ? parsedReserva : 0;
    }

    const uniformes = (uniformeAtivo && uniformesEl)
      ? ((typeof uniformesEl.dataset.cents !== 'undefined')
        ? (Number(uniformesEl.dataset.cents) || 0) / 100
        : (parseBRLString(uniformesEl.value) || 0))
      : 0;

    const materiais = (materialAtivo && materiaisEl)
      ? ((typeof materiaisEl.dataset.cents !== 'undefined')
        ? (Number(materiaisEl.dataset.cents) || 0) / 100
        : (parseBRLString(materiaisEl.value) || 0))
      : 0;

    const equipamentosProtecaoIndividual = (epiAtivo && epiEl)
      ? ((typeof epiEl.dataset.cents !== 'undefined')
        ? (Number(epiEl.dataset.cents) || 0) / 100
        : (parseBRLString(epiEl.value) || 0))
      : 0;

    // monta payload compatível com gerarPlanilha.js
    const quantidade = Number(quantidadeRaw);
    if (!/^\d+$/.test(quantidadeRaw) || !Number.isInteger(quantidade) || quantidade<1){
      alert('Informe uma quantidade valida');
      return;
    }

    const payload = {
      cargo: name,
      jornada: hours || '',
      quantidade: quantidade,
      salarioBase: salary,
      reservaTecnica: reservaTecnica,
      salarioMinimo: salary,
      beneficios: { assistencia: 0, outros: 0 },
      adicionalNoturno: adicionalNoturno,
      horaIntervaloNoturno: 0,
      horaFictaNoturna: 0,
      vigencia: vigencia,
      periculosidade: periculosidade,
      insalubridade: insalubridade ? String(insalubridadePct || 20) : false,
      tributos: { iss: 0, pisCofins: 0, irpjCsll: 0 },
      encargosPercentuais: {
        ...(uniformeAtivo ? { uniformes } : {}),
        ...(materialAtivo ? { materiais } : {}),
        ...(epiAtivo ? { equipamentosProtecaoIndividual } : {})
      }
    };

    // gerar e baixar a planilha; se falhar, aborta sem salvar localmente
    try {
      await downloadPlanilha(payload);
    } catch (err) {
      return;
    }
     // mostra resumo (opcional)
if (result) {
  result.textContent = JSON.stringify(payload, null, 2);
}

// limpa formulário
nameEl.value = '';

if (hoursEl) {
  hoursEl.value = '';
}

if (quantidadeEl) {
  quantidadeEl.value = '1';
}

if (salaryEl) {
  salaryEl.value = formatBRL(0);
  salaryEl.dataset.cents = '0';
}

if (reservaTecnicaEl) {
  reservaTecnicaEl.value = '0,00%';
  reservaTecnicaEl.dataset.centiPercent = '0';
}

const uniformesResetEl = newUniformes();
if (uniformesResetEl) {
  uniformesResetEl.value = formatBRL(0);
  uniformesResetEl.dataset.cents = '0';
}

const materiaisResetEl = newMateriais();
if (materiaisResetEl) {
  materiaisResetEl.value = formatBRL(0);
  materiaisResetEl.dataset.cents = '0';
}

const epiResetEl = newEpi();
if (epiResetEl) {
  epiResetEl.value = formatBRL(0);
  epiResetEl.dataset.cents = '0';
}

const uniformeSim = document.getElementById('uniforme-sim');
const uniformeNao = document.getElementById('uniforme-nao');
if (uniformeSim) uniformeSim.checked = false;
if (uniformeNao) uniformeNao.checked = true;

const materialSim = document.getElementById('material-sim');
const materialNao = document.getElementById('material-nao');
if (materialSim) materialSim.checked = false;
if (materialNao) materialNao.checked = true;

const epiSim = document.getElementById('epi-sim');
const epiNao = document.getElementById('epi-nao');
if (epiSim) epiSim.checked = false;
if (epiNao) epiNao.checked = true;

const uniformeOpts = document.getElementById('uniforme-options');
if (uniformeOpts) uniformeOpts.style.display = 'none';
const materialOpts = document.getElementById('material-options');
if (materialOpts) materialOpts.style.display = 'none';
const epiOpts = document.getElementById('epi-options');
if (epiOpts) epiOpts.style.display = 'none';
    });
  }



  // cancelar: limpa campos do form
  const cancelBtn = document.getElementById('cancel-new-cargo');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      const n = newName(); const h = newHours(); const q = newQuantidade(); const s = newSalary();
      const rt = newReservaTecnica();
      const v = newVigencia();
      if (n) n.value = '';
      if (h) h.value = '';
      if (q) q.value = '1';
      if (v) v.value = '12';
      if (s) { s.value = formatBRL(0); s.dataset.cents = '0'; }
      if (rt) { rt.value = '0,00%'; rt.dataset.centiPercent = '0'; }
      // limpar radios/select
      const pSim = document.getElementById('periculosidade-sim');
      const pNao = document.getElementById('periculosidade-nao');
      if (pSim) pSim.checked = false; if (pNao) pNao.checked = true;
      const iSim = document.getElementById('insalubridade-sim');
      const iNao = document.getElementById('insalubridade-nao');
      if (iSim) iSim.checked = false; if (iNao) iNao.checked = true;
      const pct = document.getElementById('insalubridade-percent');
      if (pct) pct.value = '20';
      const anSim = document.getElementById('adicional-noturno-sim');
      const anNao = document.getElementById('adicional-noturno-nao');
      if (anSim) anSim.checked = false; if (anNao) anNao.checked = true;
      const opts = document.getElementById('insalubridade-options'); if (opts) opts.style.display = 'none';
      const optsInline = document.getElementById('insalubridade-options-inline'); if (optsInline) optsInline.style.display = 'none';
      const sInline = document.getElementById('new-salary-inline'); if (sInline) { sInline.value = formatBRL(0); sInline.dataset.cents = '0'; }

      const u = newUniformes(); if (u) { u.value = formatBRL(0); u.dataset.cents = '0'; }
      const m = newMateriais(); if (m) { m.value = formatBRL(0); m.dataset.cents = '0'; }
      const epi = newEpi(); if (epi) { epi.value = formatBRL(0); epi.dataset.cents = '0'; }

      const uSim = document.getElementById('uniforme-sim');
      const uNao = document.getElementById('uniforme-nao');
      if (uSim) uSim.checked = false; if (uNao) uNao.checked = true;
      const mSim = document.getElementById('material-sim');
      const mNao = document.getElementById('material-nao');
      if (mSim) mSim.checked = false; if (mNao) mNao.checked = true;
      const epiSim = document.getElementById('epi-sim');
      const epiNao = document.getElementById('epi-nao');
      if (epiSim) epiSim.checked = false; if (epiNao) epiNao.checked = true;

      const uOpts = document.getElementById('uniforme-options'); if (uOpts) uOpts.style.display = 'none';
      const mOpts = document.getElementById('material-options'); if (mOpts) mOpts.style.display = 'none';
      const epiOpts = document.getElementById('epi-options'); if (epiOpts) epiOpts.style.display = 'none';

    });
  }

  // Mostrar/ocultar seletor de percentual quando usuário marca sim/nao para insalubridade
  const insalSim = document.getElementById('insalubridade-sim');
  const insalNao = document.getElementById('insalubridade-nao');
  const insalOpts = document.getElementById('insalubridade-options');
  if (insalSim) { insalSim.addEventListener('change', () => { if (insalOpts) insalOpts.style.display = insalSim.checked ? 'block' : 'none'; }); }
  if (insalNao) { insalNao.addEventListener('change', () => { if (insalOpts) insalOpts.style.display = insalNao.checked ? 'none' : insalOpts.style.display; }); }

  const uniformeSim = document.getElementById('uniforme-sim');
  const uniformeNao = document.getElementById('uniforme-nao');
  const uniformeOpts = document.getElementById('uniforme-options');
  if (uniformeSim) { uniformeSim.addEventListener('change', () => { if (uniformeOpts) uniformeOpts.style.display = uniformeSim.checked ? 'block' : 'none'; }); }
  if (uniformeNao) { uniformeNao.addEventListener('change', () => { if (uniformeOpts) uniformeOpts.style.display = uniformeNao.checked ? 'none' : uniformeOpts.style.display; }); }

  const materialSim = document.getElementById('material-sim');
  const materialNao = document.getElementById('material-nao');
  const materialOpts = document.getElementById('material-options');
  if (materialSim) { materialSim.addEventListener('change', () => { if (materialOpts) materialOpts.style.display = materialSim.checked ? 'block' : 'none'; }); }
  if (materialNao) { materialNao.addEventListener('change', () => { if (materialOpts) materialOpts.style.display = materialNao.checked ? 'none' : materialOpts.style.display; }); }

  const epiSim = document.getElementById('epi-sim');
  const epiNao = document.getElementById('epi-nao');
  const epiOpts = document.getElementById('epi-options');
  if (epiSim) { epiSim.addEventListener('change', () => { if (epiOpts) epiOpts.style.display = epiSim.checked ? 'block' : 'none'; }); }
  if (epiNao) { epiNao.addEventListener('change', () => { if (epiOpts) epiOpts.style.display = epiNao.checked ? 'none' : epiOpts.style.display; }); }


})();
