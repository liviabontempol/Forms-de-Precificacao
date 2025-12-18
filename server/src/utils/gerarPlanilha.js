import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// DEBUG: confirmar que a versão atual do módulo está sendo carregada
console.log('[DEBUG] carregar: gerarPlanilha.js carregado em', new Date().toISOString());
function applyBackground(cell, argbColor) {
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: argbColor }
  };
}

export async function gerarPlanilha(dados) {
  // normaliza / defaults
  const quantidade = Number(dados.quantidade ?? 0);
  const salarioBase = Number(dados.salarioBase ?? 0);

  const encargosPercentuais = {
    inss: 0.20,
    sesi: 0.015,
    senai: 0.01,
    incra: 0.002,
    salarioEducacao: 0.025,
    fgts: 0.08,
    rat: 0.0246,
    sebrae: 0.06,
    salario13: 0.0909,
    ferias: 0.0909,
    adicionalFerias: 0.0303,
    abonoPecuario: 0,
    incidenciaM1sobre13eFerias: 0.0769,
    afastamentoMaternidade: 0.00003,
    incidenciaM1sobreAfastMaternidade: 0.0001,
    avisoPrevioIndenizado: 0.0327,
    incidenciaFgtsAvisoPrevioIndenizado: 0.002616,
    multaFgtsAvisoPrevioIndenizado: 0.0002,
    avisoPrevioTrabalhado: 0.0194,
    incidenciaMod1AvisoPrevioTrabalhado: 0.007,
    multaFgtsAvisoPrevioTrabalhado: 0.0001,
    multaFgtsDemissaoSemJustaCausa: 0.015,
    ausenciaPorDoenca: 0.0282,
    licencaPaternidade: 0.0002,
    ausenciasLegais: 0.011,
    ausenciaPorAcidenteTrabalho: 0.0247,
    incidenciaMod1CustoReposicao: 0.0233
  };
  // soma das porcentagens (ex: 0.2 + 0.08 + ...)
  const encargosPercent = Object.values(encargosPercentuais).reduce((s, v) => s + Number(v || 0), 0);
  const reservaTecnicaPercent = Number(dados.reservaTecnicaPercent ?? 0.08); // 8% padrão
  const salarioMinimo = Number(dados.salarioMinimo ?? 1518); //salario minimo 2025
  let somaModulo1Unit = 0;

  const beneficios = dados.beneficios ?? {};

  const VT_FIXO = Number(process.env.VT_FIXO ?? 5.75);
  const VA_FIXO = Number(process.env.VA_FIXO ?? 29.15);
  const vt = VT_FIXO;
  const va = VA_FIXO;

  // periculosidade e insalubridade (opcionais)
  const temPericulosidade = !!dados.periculosidade;
  const periculosidadeValor = temPericulosidade ? salarioBase * 0.30 : 0;

  // insalubridade: aceitar '20' ou '40' ou um percent diretamente
  let insalubridadeValor = 0;
  if (dados.insalubridade) {
    // se for '20' ou '40' -> aplicar sobre salarioMinimo
    if (dados.insalubridade === "20" || dados.insalubridade === "40") {
      const pct = Number(dados.insalubridade) / 100;
      insalubridadeValor = salarioMinimo * pct;
    } else {
      // se passar um percent como 0.2 ou 0.4
      const pct = Number(dados.insalubridade);
      if (!isNaN(pct) && pct > 0 && pct <= 1) {
        insalubridadeValor = salarioMinimo * pct;
      }
    }
  }

  // Somatório de adicionais opcionais (unitário)
  const adicionaisUnitarios = periculosidadeValor + insalubridadeValor;


  // Cria pasta temp dentro do mesmo diretório do utils (server/src/temp)
  const tempDir = path.join(__dirname, "..", "temp");
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Formação de Preços");

  // Fontes/estilos básicos
  const defaultFont = { name: 'Times New Roman', size: 12 };
  const headerFont = { name: 'Times New Roman', size: 12, bold: true };
  const titleFont = { name: 'Times New Roman', size: 18, bold: true };

  // --- Módulo 1 - Composição da Remuneração ---
  // Título (mesclado + fonte maior)
  const titleRow = sheet.addRow(["ANEXO I - PLANILHA DE CUSTOS E FORMAÇÃO DE PREÇOS"]);
  titleRow.font = titleFont;
  sheet.mergeCells(`A${titleRow.number}:E${titleRow.number}`);
  applyBackground(titleRow.getCell(1), 'FFD9D9D9');

  const postoRow = sheet.addRow([`Posto de Trabalho: ${dados.cargo ?? ""} (${dados.jornada ? dados.jornada + 'h/semana' : ""})`]);
  // mescla também a linha do posto de trabalho
  postoRow.font = defaultFont;
  sheet.mergeCells(`A${postoRow.number}:E${postoRow.number}`);

  // Módulo 1 (mesclado + bold)
  const modulo1Row = sheet.addRow(["MÓDULO 1 - Composição da Remuneração"]);
  modulo1Row.font = headerFont;
  sheet.mergeCells(`A${modulo1Row.number}:E${modulo1Row.number}`);
  try {
    for (let c = 1; c <= 5; c++) {
      const cell = modulo1Row.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA6A6A6' } };
      cell.font = Object.assign({}, modulo1Row.font, { color: { argb: 'FF000000' } });
    }
  } catch (e) { }

  sheet.addRow([]);
  // Cabeçalho de colunas (negrito)
  const headerRow1 = sheet.addRow(["1", "Composição da Remuneração", "Quantidade", "Valor Unitário (R$)", "Valor Total (R$)"]);
  headerRow1.eachCell(c => c.font = headerFont);

  // Salário base linha
  sheet.addRow(["A", "Salário-Base", quantidade, salarioBase, salarioBase * quantidade]);

  // Periculosidade (opcional - amarelo editável)
  if (periculosidadeValor > 0) {
    sheet.addRow(["B", "Adicional de Periculosidade (30% do salário base)", "", periculosidadeValor, ""]);
  } else {
    sheet.addRow(["B", "Adicional de Periculosidade (30% do salário base) - (não aplicado)", "", 0, 0]);
  }

  // Insalubridade (opcional)
  if (insalubridadeValor > 0) {
    sheet.addRow(["C", `Adicional de Insalubridade (aplicado sobre salário mínimo)`, "", insalubridadeValor, ""]);
  } else {
    sheet.addRow(["C", `Adicional de Insalubridade - (não aplicado)`, "", 0, 0]);
  }


  // Total módulo 1 (simplificado)
  // Soma apenas das linhas exibidas no Módulo 1 (salário + adicionais mostrados)
  somaModulo1Unit = salarioBase + adicionaisUnitarios;

  // calcular os itens do Módulo 2 com base no salario final.
  const valor13 = somaModulo1Unit / 12; // 13º unitário
  const valorFerias = (somaModulo1Unit / 12) * 1.33; // férias + 1/3
  const fgts = somaModulo1Unit * 0.08; // FGTS 8%
  const encargos = somaModulo1Unit * encargosPercent;

  // Calcular benefícios unitários agora que somaModulo1Unit existe (usar somente inputs)
  // vtUnit = (3 * vt) - (0.06 * somaModulo1Unit)
  // vrUnit = (va * 22) - (0.20 * va)
  // Se vt/va não forem informados, tratar como 0 (sem default fixo).
  // Como VT/VA são fixos, usa-se os valores fixos para os cálculos abaixo.
  const vtUnit = (Number.isFinite(vt) && vt > 0) ? ((3 * vt * 22) - (0.06 * somaModulo1Unit)) : 0;
  const vrUnit = (Number.isFinite(va) && va > 0) ? ((va * 22) - (0.20 * va * 22)) : 0;
  const beneficiosDiarios = vtUnit + vrUnit;

  // Agora que temos os valores unitários do Módulo 2, calculamos custos diretos,
  // totais por posto, reserva técnica e tributos.
  const custosDiretosUnit = somaModulo1Unit + encargos + valorFerias + valor13 + fgts;
  const totalPorPosto = custosDiretosUnit + beneficiosDiarios; // simplificação: custos diretos + benefícios
  const totalMensal = totalPorPosto * quantidade;
  // Reserva técnica sobre custos diretos
  const reservaTecnicaUnit = custosDiretosUnit * reservaTecnicaPercent;
  const reservaTecnicaTotal = reservaTecnicaUnit * quantidade;

  // Tributos (se informados como percentuais)
  const tributos = dados.tributos ?? {};
  const iss = Number(tributos.iss ?? 0);
  const pisCofins = Number(tributos.pisCofins ?? 0);
  const irpjCsll = Number(tributos.irpjCsll ?? 0);
  const totalTributosUnit = (iss + pisCofins + irpjCsll) * totalPorPosto; // se vier em fração (ex: 0.02)

  const rowTotalM1 = sheet.addRow(["Total Módulo 1", "", "", somaModulo1Unit, (somaModulo1Unit * quantidade)]);
  sheet.mergeCells(`A${rowTotalM1.number}:B${rowTotalM1.number}`);
  rowTotalM1.getCell(1).font = headerFont;

  // --- Módulo 2 - Encargos e Benefícios ---
  sheet.addRow([]);
  const modulo2Row = sheet.addRow(["MÓDULO 2 - Encargos e Benefícios Anuais, Mensais e Diários"]);
  modulo2Row.font = headerFont;
  sheet.mergeCells(`A${modulo2Row.number}:E${modulo2Row.number}`);
  try {
    for (let c = 1; c <= 5; c++) {
      const cell = modulo2Row.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA6A6A6' } };
      cell.font = Object.assign({}, modulo2Row.font, { color: { argb: 'FF000000' } });
    }
  } catch (e) { }
  sheet.addRow([]);
  // Submódulo 2.1 - 13º (décimo terceiro) Salário, Férias e Adicional de Férias
  const sub21Row = sheet.addRow(["Submódulo 2.1 - 13º (décimo terceiro) Salário, Férias e Adicional de Férias"]);
  sub21Row.font = headerFont;

  sheet.mergeCells(`A${sub21Row.number}:E${sub21Row.number}`);
  try {
    for (let c = 1; c <= 5; c++) {
      const cell = sub21Row.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };

    }
  } catch (e) { }
  sheet.addRow([]);
  // cabeçalho de tabela para o submódulo
  const header21 = sheet.addRow(["2.1", "13º (décimo terceiro) Salário, Férias e Adicional de Férias", "Percentual (%)", "Valor Unitário (R$)", "Valor Total (R$)"]);
  header21.eachCell(c => c.font = headerFont);

  // A: 13º salário
  const pctA = somaModulo1Unit ? (valor13 / somaModulo1Unit) : 0;
  const valA = valor13;
  const totA = valA * quantidade;
  sheet.addRow(["A", "13º (décimo terceiro) Salário", `${(pctA * 100).toFixed(2)}%`, valA, totA]);

  // B: Férias e adicional de férias
  const pctB = somaModulo1Unit ? (valorFerias / somaModulo1Unit) : 0;
  const valB = valorFerias;
  const totB = valB * quantidade;
  sheet.addRow(["B", "Férias e Adicional de Férias", `${(pctB * 100).toFixed(2)}%`, valB, totB]);

  // C: Incidência do módulo 2.2 sobre A e B (usar configuração se disponível)
  const pctC = Number(encargosPercentuais.incidenciaM1sobre13eFerias || 0);
  const valC = somaModulo1Unit * pctC;
  const totC = valC * quantidade;
  sheet.addRow(["C", "Incidência do módulo 2.2 sobre os itens A e B", `${(pctC * 100).toFixed(2)}%`, valC, totC]);

  // D: Abono Pecuniário
  const pctD = Number(encargosPercentuais.abonoPecuario || 0);
  const valD = somaModulo1Unit * pctD;
  const totD = valD * quantidade;
  sheet.addRow(["D", "Abono Pecuniário", `${(pctD * 100).toFixed(2)}%`, valD, totD]);

  // Total do Submódulo 2.1
  const pctTotal21 = pctA + pctB + pctC + pctD;
  const valTotal21 = valA + valB + valC + valD;
  const totTotal21 = totA + totB + totC + totD;
  const rowTotal21 = sheet.addRow(["Total", "", `${(pctTotal21 * 100).toFixed(2)}%`, valTotal21, totTotal21]);
  // mesclar colunas A e B e deixar "Total" em negrito
  sheet.mergeCells(`A${rowTotal21.number}:B${rowTotal21.number}`);
  rowTotal21.getCell(1).font = headerFont;

  // Submódulo 2.2 - Encargos Previdenciários (GPS), FGTS e outras contribuições
  sheet.addRow([]);
  const sub22Row = sheet.addRow(["Submódulo 2.2 - Encargos Previdenciários (GPS), Fundo de Garantia por Tempo de Serviço (FGTS) e outras contribuições"]);
  sub22Row.font = headerFont;
  sheet.mergeCells(`A${sub22Row.number}:E${sub22Row.number}`);
  try {
    for (let c = 1; c <= 5; c++) {
      const cell = sub22Row.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
      cell.font = Object.assign({}, sub22Row.font, { color: { argb: 'FF000000' } });
    }
  } catch (e) { }
  sheet.addRow([]);
  const header22 = sheet.addRow(["2.2", "GPS, FGTS e outras contribuições", "Percentual (%)", "Valor Unitário (R$)", "Valor Total (R$)"]);
  header22.eachCell(c => c.font = headerFont);

  // A: INSS
  const pctA2 = Number(encargosPercentuais.inss || 0);
  const valA2 = somaModulo1Unit * pctA2;
  const totA2 = valA2 * quantidade;
  sheet.addRow(["A", "INSS", `${(pctA2 * 100).toFixed(2)}%`, valA2, totA2]);

  // B: Salário Educação
  const pctB2 = Number(encargosPercentuais.salarioEducacao || 0);
  const valB2 = somaModulo1Unit * pctB2;
  const totB2 = valB2 * quantidade;
  sheet.addRow(["B", "Salário Educação", `${(pctB2 * 100).toFixed(2)}%`, valB2, totB2]);

  // C: SAT / RAT
  const pctC2 = Number(encargosPercentuais.rat || 0);
  const valC2 = somaModulo1Unit * pctC2;
  const totC2 = valC2 * quantidade;
  sheet.addRow(["C", "SAT (RAT)", `${(pctC2 * 100).toFixed(2)}%`, valC2, totC2]);

  // D: SESC/SESI
  const pctD2 = Number(encargosPercentuais.sesi || 0);
  const valD2 = somaModulo1Unit * pctD2;
  const totD2 = valD2 * quantidade;
  sheet.addRow(["D", "SESC/SESI", `${(pctD2 * 100).toFixed(2)}%`, valD2, totD2]);

  // E: SENAI/SENAC
  const pctE2 = Number(encargosPercentuais.senai || 0);
  const valE2 = somaModulo1Unit * pctE2;
  const totE2 = valE2 * quantidade;
  sheet.addRow(["E", "SENAI / SENAC", `${(pctE2 * 100).toFixed(2)}%`, valE2, totE2]);

  // F: SEBRAE
  const pctF2 = Number(encargosPercentuais.sebrae || 0);
  const valF2 = somaModulo1Unit * pctF2;
  const totF2 = valF2 * quantidade;
  sheet.addRow(["F", "SEBRAE", `${(pctF2 * 100).toFixed(2)}%`, valF2, totF2]);

  // G: INCRA
  const pctG2 = Number(encargosPercentuais.incra || 0);
  const valG2 = somaModulo1Unit * pctG2;
  const totG2 = valG2 * quantidade;
  sheet.addRow(["G", "INCRA", `${(pctG2 * 100).toFixed(2)}%`, valG2, totG2]);

  // H: FGTS
  const pctH2 = Number(encargosPercentuais.fgts || 0);
  const valH2 = somaModulo1Unit * pctH2;
  const totH2 = valH2 * quantidade;
  sheet.addRow(["H", "FGTS", `${(pctH2 * 100).toFixed(2)}%`, valH2, totH2]);

  // Total Submódulo 2.2
  const pctTotal22 = pctA2 + pctB2 + pctC2 + pctD2 + pctE2 + pctF2 + pctG2 + pctH2;
  const valTotal22 = valA2 + valB2 + valC2 + valD2 + valE2 + valF2 + valG2 + valH2;
  const totTotal22 = totA2 + totB2 + totC2 + totD2 + totE2 + totF2 + totG2 + totH2;
  const rowTotal22 = sheet.addRow(["Total", "", `${(pctTotal22 * 100).toFixed(2)}%`, valTotal22, totTotal22]);
  sheet.mergeCells(`A${rowTotal22.number}:B${rowTotal22.number}`);
  rowTotal22.getCell(1).font = headerFont;
  sheet.addRow([]);

  // Submódulo 2.3 - Benefícios Mensais e Diários
  const sub23Row = sheet.addRow(["Submódulo 2.3 - Benefícios Mensais e Diários"]);
  sub23Row.font = headerFont;
  sheet.mergeCells(`A${sub23Row.number}:E${sub23Row.number}`);
  try {
    for (let c = 1; c <= 5; c++) {
      const cell = sub23Row.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
      cell.font = Object.assign({}, sub23Row.font, { color: { argb: 'FF000000' } });
    }
  } catch (e) { }
  sheet.addRow([]);
  const header23 = sheet.addRow(["2.3", "Benefícios Mensais e Diários", "Quantidade", "Valor Unitário (R$)", "Valor Total (R$)"]);
  header23.eachCell(c => c.font = headerFont);

  // calcular valores unitários mensais conforme modelo
  const vtMonthlyUnit = (Number.isFinite(vt) && vt > 0) ? ((3 * vt * 22) - (0.06 * somaModulo1Unit)) : 0;
  const vrMonthlyUnit = (Number.isFinite(va) && va > 0) ? ((va * 22) - (0.20 * va * 22)) : 0; // 20% sobre o total do VA mensal

  // A: Transporte
  const rowA = sheet.addRow(["A", "Transporte (3 x R$ " + (vt || 0).toFixed(2) + " x 22 dias x quant.empregados - 6% sal)", quantidade, vtMonthlyUnit, (vtMonthlyUnit * quantidade)]);
  rowA.getCell(3).numFmt = '#,##0';
  rowA.getCell(4).numFmt = '#,##0.00';
  rowA.getCell(5).numFmt = '#,##0.00';

  // B: Auxílio-Refeição/Alimentação
  const rowB = sheet.addRow(["B", "Auxílio-Refeição/Alimentação (1 x R$ " + (va || 0).toFixed(2) + " x 22 x quant.empregados - 20% VA)", quantidade, vrMonthlyUnit, (vrMonthlyUnit * quantidade)]);
  rowB.getCell(3).numFmt = '#,##0';
  rowB.getCell(4).numFmt = '#,##0.00';
  rowB.getCell(5).numFmt = '#,##0.00';

  // C: Outros (especificar) - usar `outrosBenef` se houver, caso contrário tentar `beneficios.outros` ou 0
  const outrosUnit = (typeof outrosBenef !== 'undefined' && Number.isFinite(outrosBenef)) ? outrosBenef : Number(beneficios.outros ?? 0);
  const rowC = sheet.addRow(["C", "Outros (especificar)", quantidade, outrosUnit, (outrosUnit * quantidade)]);
  rowC.getCell(3).numFmt = '#,##0';
  rowC.getCell(4).numFmt = '#,##0.00';
  rowC.getCell(5).numFmt = '#,##0.00';

  // Total Submódulo 2.3
  const totalValUnit23 = vtMonthlyUnit + vrMonthlyUnit + outrosUnit;
  const totalValTotal23 = (vtMonthlyUnit * quantidade) + (vrMonthlyUnit * quantidade) + (outrosUnit * quantidade);
  const rowTotal23 = sheet.addRow(["Total", "", "", totalValUnit23, totalValTotal23]);
  // mesclar A:B e deixar 'Total' em negrito
  sheet.mergeCells(`A${rowTotal23.number}:B${rowTotal23.number}`);
  rowTotal23.getCell(1).font = headerFont;
  rowTotal23.getCell(4).numFmt = '#,##0.00';
  rowTotal23.getCell(5).numFmt = '#,##0.00';


  // --- Quadro-Resumo do Módulo 2 - Encargos e Benefícios ---
  // calcular percentual do submódulo 2.3 em relação ao somaModulo1Unit
  const pct23 = somaModulo1Unit ? (totalValUnit23 / somaModulo1Unit) : 0;
  const pctTotalModule2 = pctTotal21 + pctTotal22 + pct23;
  const valModule2UnitTotal = valTotal21 + valTotal22 + totalValUnit23;
  const valModule2Total = totTotal21 + totTotal22 + totalValTotal23;

  sheet.addRow([]);
  const quadroRow = sheet.addRow(["Quadro-Resumo do Módulo 2 - Encargos e Benefícios anuais, mensais e diários"]);
  quadroRow.font = headerFont;
  sheet.mergeCells(`A${quadroRow.number}:E${quadroRow.number}`);
  try {
    for (let c = 1; c <= 5; c++) {
      const cell = quadroRow.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
      cell.font = Object.assign({}, quadroRow.font, { color: { argb: 'FF000000' } });
    }
  } catch (e) { }
  sheet.addRow([]);
  const headerQuadro = sheet.addRow(["2", "Encargos e Benefícios Anuais, Mensais e Diários", "Percentual (%)", "Valor Unitário (R$)", "Valor Total (R$)"]);
  headerQuadro.eachCell(c => c.font = headerFont);
  const r21 = sheet.addRow(["2.1", "13º (décimo terceiro) Salário, Férias e Adicional de Férias", `${(pctTotal21 * 100).toFixed(2)}%`, valTotal21, totTotal21]);
  const r22 = sheet.addRow(["2.2", "GPS, FGTS e outras contribuições", `${(pctTotal22 * 100).toFixed(2)}%`, valTotal22, totTotal22]);
  const r23 = sheet.addRow(["2.3", "Benefícios Mensais e Diários", `${(pct23 * 100).toFixed(2)}%`, totalValUnit23, totalValTotal23]);
  const rTot = sheet.addRow(["Total", "", `${(pctTotalModule2 * 100).toFixed(2)}%`, valModule2UnitTotal, valModule2Total]);
  sheet.mergeCells(`A${rTot.number}:B${rTot.number}`);
  rTot.getCell(1).font = headerFont;
  // aplicar formatação de moeda e percentuais nas células relevantes
  [r21, r22, r23, rTot].forEach(r => {
    // percentual na coluna 3
    try { r.getCell(3).numFmt = '0.00%'; } catch (e) { }
    try { r.getCell(4).numFmt = '#,##0.00'; } catch (e) { }
    try { r.getCell(5).numFmt = '#,##0.00'; } catch (e) { }
  });

  // Reserva Técnica
  // Módulo 3 - Provisão para Rescisão
  sheet.addRow([]);
  const modulo3Row = sheet.addRow(["MÓDULO 3 - Provisão para Rescisão"]);
  modulo3Row.font = headerFont;
  sheet.mergeCells(`A${modulo3Row.number}:E${modulo3Row.number}`);
  try {
    for (let c = 1; c <= 5; c++) {
      const cell = modulo3Row.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA6A6A6' } };
      cell.font = Object.assign({}, modulo3Row.font, { color: { argb: 'FF000000' } });
    }
  } catch (e) { }
  sheet.addRow([]);
  const header3 = sheet.addRow(["3", "Provisão para Rescisão", "Percentual (%)", "Valor Unitário (R$)", "Valor Total (R$)"]);
  header3.eachCell(c => c.font = headerFont);

  // A: Aviso Prévio Indenizado
  const pctA3 = 0.0651; // 6.5100%
  const valA3 = somaModulo1Unit * pctA3;
  const totA3 = valA3 * quantidade;
  sheet.addRow(["A", "Aviso Prévio Indenizado", `${(pctA3 * 100).toFixed(4)}%`, valA3, totA3]);

  // B: Incidência do FGTS sobre o Aviso Prévio Indenizado
  const pctB3 = 0.00430; // 0.430%
  const valB3 = somaModulo1Unit * pctB3;
  const totB3 = valB3 * quantidade;
  sheet.addRow(["B", "Incidência do FGTS sobre o Aviso Prévio Indenizado", `${(pctB3 * 100).toFixed(4)}%`, valB3, totB3]);

  // C: Multa do FGTS e contribuição social sobre o Aviso Prévio Indenizado
  const pctC3 = 0.03900; // 3.9000%
  const valC3 = somaModulo1Unit * pctC3;
  const totC3 = valC3 * quantidade;
  sheet.addRow(["C", "Multa do FGTS e contribuição social sobre o Aviso Prévio Indenizado", `${(pctC3 * 100).toFixed(4)}%`, valC3, totC3]);

  // D: Aviso Prévio Trabalhado (0%)
  const pctD3 = 0;
  sheet.addRow(["D", "Aviso Prévio Trabalhado", `${(pctD3 * 100).toFixed(4)}%`, "-", "-"]);

  // E: Incidência dos encargos do submódulo 2.2 sobre o Aviso Prévio Trabalhado (0%)
  const pctE3 = 0;
  sheet.addRow(["E", "Incidência dos encargos do submódulo 2.2 sobre o Aviso Prévio Trabalhado", `${(pctE3 * 100).toFixed(4)}%`, "-", "-"]);

  // F: Multa do FGTS e contribuição social sobre o Aviso Prévio Trabalhado (0%)
  const pctF3 = 0;
  sheet.addRow(["F", "Multa do FGTS e contribuição social sobre o Aviso Prévio Trabalhado", `${(pctF3 * 100).toFixed(4)}%`, "-", "-"]);

  // G: Outros (indenização adicional)
  const pctG3 = 0.00730; // 0.7300%
  const valG3 = somaModulo1Unit * pctG3;
  const totG3 = valG3 * quantidade;
  sheet.addRow(["G", "Outros (indenização adicional)", `${(pctG3 * 100).toFixed(4)}%`, valG3, totG3]);

  // Total Módulo 3
  const pctTotal3 = pctA3 + pctB3 + pctC3 + pctD3 + pctE3 + pctF3 + pctG3;
  const valTotal3 = (valA3 || 0) + (valB3 || 0) + (valC3 || 0) + (valG3 || 0);
  const totTotal3 = (totA3 || 0) + (totB3 || 0) + (totC3 || 0) + (totG3 || 0);
  const rowTotal3 = sheet.addRow(["Total", "", `${(pctTotal3 * 100).toFixed(4)}%`, valTotal3, totTotal3]);
  // mesclar A:B e destacar 'Total'
  sheet.mergeCells(`A${rowTotal3.number}:B${rowTotal3.number}`);
  rowTotal3.getCell(1).font = headerFont;
  try { rowTotal3.getCell(4).numFmt = '#,##0.00'; } catch (e) { }
  try { rowTotal3.getCell(5).numFmt = '#,##0.00'; } catch (e) { }
  // --- MÓDULO 4 - Custo de Reposição do Profissional Ausente ---
  sheet.addRow([]);
  const modulo4Row = sheet.addRow(["MÓDULO 4 - Custo de Reposição do Profissional Ausente"]);
  modulo4Row.font = headerFont;
  sheet.mergeCells(`A${modulo4Row.number}:E${modulo4Row.number}`);
  try {
    for (let c = 1; c <= 5; c++) {
      const cell = modulo4Row.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA6A6A6' } };
      cell.font = Object.assign({}, modulo4Row.font, { color: { argb: 'FF000000' } });
    }
  } catch (e) { }
  sheet.addRow([]);
  const header41 = sheet.addRow(["4.1", "Ausências Legais", "Percentual (%)", "Valor Unitário (R$)", "Valor Total (R$)"]);
  header41.eachCell(c => c.font = headerFont);

  // A: Férias (0%)
  const pctA4 = 0.0;
  sheet.addRow(["A", "Férias", `${(pctA4 * 100).toFixed(4)}%`, "-", "-"]);

  // B: Ausências Legais (3.260%)
  const pctB4 = 0.03260;
  const valB4 = somaModulo1Unit * pctB4;
  const totB4 = valB4 * quantidade;
  sheet.addRow(["B", "Ausências Legais", `${(pctB4 * 100).toFixed(4)}%`, valB4, totB4]);

  // C: Licença-Paternidade (0.030%)
  const pctC4 = 0.00030;
  const valC4 = somaModulo1Unit * pctC4;
  const totC4 = valC4 * quantidade;
  sheet.addRow(["C", "Licença-Paternidade", `${(pctC4 * 100).toFixed(4)}%`, valC4, totC4]);

  // D: Ausência por acidente de trabalho (0.040%)
  const pctD4 = 0.00040;
  const valD4 = somaModulo1Unit * pctD4;
  const totD4 = valD4 * quantidade;
  sheet.addRow(["D", "Ausência por acidente de trabalho", `${(pctD4 * 100).toFixed(4)}%`, valD4, totD4]);

  // E: Afastamento Maternidade (0.010%)
  const pctE4 = 0.00010;
  const valE4 = somaModulo1Unit * pctE4;
  const totE4 = valE4 * quantidade;
  sheet.addRow(["E", "Afastamento Maternidade", `${(pctE4 * 100).toFixed(4)}%`, valE4, totE4]);

  // F: Outros (0%)
  const pctF4 = 0.0;
  sheet.addRow(["F", "Outros (especificar)", `${(pctF4 * 100).toFixed(4)}%`, "-", "-"]);

  // G: Incidência do Módulo 2.2 (1.25%)
  const pctG4 = 0.0125;
  const valG4 = somaModulo1Unit * pctG4;
  const totG4 = valG4 * quantidade;
  sheet.addRow(["G", "Incidência do Módulo 2.2", `${(pctG4 * 100).toFixed(4)}%`, valG4, totG4]);

  // Total Módulo 4
  const pctTotal4 = pctA4 + pctB4 + pctC4 + pctD4 + pctE4 + pctF4 + pctG4;
  const valTotal4 = (valB4 || 0) + (valC4 || 0) + (valD4 || 0) + (valE4 || 0) + (valG4 || 0);
  const totTotal4 = (totB4 || 0) + (totC4 || 0) + (totD4 || 0) + (totE4 || 0) + (totG4 || 0);
  const rowTotal4 = sheet.addRow(["Total", "", `${(pctTotal4 * 100).toFixed(3)}%`, valTotal4, totTotal4]);
  sheet.mergeCells(`A${rowTotal4.number}:B${rowTotal4.number}`);
  rowTotal4.getCell(1).font = headerFont;
  try { rowTotal4.getCell(4).numFmt = '#,##0.00'; } catch (e) { }
  try { rowTotal4.getCell(5).numFmt = '#,##0.00'; } catch (e) { }

  // --- MÓDULO 5 - Insumos Diversos ---
  sheet.addRow([]);
  const modulo5Row = sheet.addRow(["MÓDULO 5 - Insumos Diversos"]);
  modulo5Row.font = headerFont;
  sheet.mergeCells(`A${modulo5Row.number}:E${modulo5Row.number}`);
  try {
    for (let c = 1; c <= 5; c++) {
      const cell = modulo5Row.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA6A6A6' } };
      cell.font = Object.assign({}, modulo5Row.font, { color: { argb: 'FF000000' } });
    }
  } catch (e) { }
  sheet.addRow([]);
  const header5 = sheet.addRow(["5", "Insumos Diversos", "Percentual (%)", "Valor Unitário (R$)", "Valor Total (R$)"]);
  header5.eachCell(c => c.font = headerFont);

  // allow overrides via payload.dados.insumos
  const insumos = (dados && dados.insumos) ? dados.insumos : {};
  const uniformesUnit = Number(insumos.uniformesUnit) || 31.84;
  const materiaisUnit = Number(insumos.materiaisUnit) || 0;
  const epiUnit = Number(insumos.epiUnit) || 8.92;

  // A: Uniformes
  const valA5 = uniformesUnit;
  const totA5 = valA5 * quantidade;
  sheet.addRow(["A", "Uniformes", "-", valA5, totA5]);

  // B: Materiais
  const valB5 = materiaisUnit;
  const totB5 = valB5 * quantidade;
  if (valB5) sheet.addRow(["B", "Materiais", "-", valB5, totB5]);
  else sheet.addRow(["B", "Materiais", "-", "-", "-"]);

  // C: Equipamentos de Proteção Individual
  const valC5 = epiUnit;
  const totC5 = valC5 * quantidade;
  sheet.addRow(["C", "Equipamentos de Proteção Individual", "-", valC5, totC5]);

  // D: Reserva Técnica (1.00%)
  const pctD5 = 0.01;
  const valD5 = somaModulo1Unit * pctD5;
  const totD5 = valD5 * quantidade;
  sheet.addRow(["D", "Reserva Técnica", `${(pctD5 * 100).toFixed(2)}%`, valD5, totD5]);

  // Total Módulo 5
  const valTotal5 = (valA5 || 0) + (valB5 || 0) + (valC5 || 0) + (valD5 || 0);
  const totTotal5 = (totA5 || 0) + (totB5 || 0) + (totC5 || 0) + (totD5 || 0);
  const rowTotal5 = sheet.addRow(["Total", "", "", valTotal5, totTotal5]);
  sheet.mergeCells(`A${rowTotal5.number}:B${rowTotal5.number}`);
  rowTotal5.getCell(1).font = headerFont;
  try { rowTotal5.getCell(4).numFmt = '#,##0.00'; } catch (e) { }
  try { rowTotal5.getCell(5).numFmt = '#,##0.00'; } catch (e) { }


  // --- MÓDULO 6 - Custos Indiretos, Tributos e Lucro ---
  sheet.addRow([]);
  const modulo6Row = sheet.addRow(["MÓDULO 6 - Custos Indiretos, Tributos e Lucro"]);
  modulo6Row.font = headerFont;
  sheet.mergeCells(`A${modulo6Row.number}:E${modulo6Row.number}`);
  try {
    for (let c = 1; c <= 5; c++) {
      const cell = modulo6Row.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA6A6A6' } };
      cell.font = Object.assign({}, modulo6Row.font, { color: { argb: 'FF000000' } });
    }
  } catch (e) { }
  sheet.addRow([]);
  const header6 = sheet.addRow(["6", "Custos Indiretos, Tributos e Lucro", "Percentual (%)", "Valor Unitário (R$)", "Valor Total (R$)"]);
  header6.eachCell(c => c.font = headerFont);

  // A: Custos Indiretos (7%) applied on totalPorPosto
  const pctA6 = 0.07;
  const valA6 = totalPorPosto * pctA6;
  const totA6 = valA6 * quantidade;
  sheet.addRow(["A", "Custos Indiretos", `${(pctA6 * 100).toFixed(2)}%`, valA6, totA6]);

  // B: Lucro (0% default)
  const pctB6 = 0.0;
  if (pctB6 > 0) {
    const valB6 = totalPorPosto * pctB6;
    const totB6 = valB6 * quantidade;
    sheet.addRow(["B", "Lucro", `${(pctB6 * 100).toFixed(2)}%`, valB6, totB6]);
  } else {
    sheet.addRow(["B", "Lucro", `${(pctB6 * 100).toFixed(2)}%`, "-", "-"]);
  }

  // C: Tributos (16.62%) applied on totalPorPosto
  const pctC6 = 0.1662;
  const valC6 = totalPorPosto * pctC6;
  const totC6 = valC6 * quantidade;
  sheet.addRow(["C", "Tributos", `${(pctC6 * 100).toFixed(2)}%`, valC6, totC6]);

  // C.1 - Tributo Federal (COFINS) 7.60%
  const pctC1_6 = 0.076;
  sheet.addRow(["", "C.1. Tributo Federal (COFINS)", `${(pctC1_6 * 100).toFixed(2)}%`, "-", "-"]);
  // C.2 - Tributo Federal (PIS) 1.65%
  const pctC2_6 = 0.0165;
  sheet.addRow(["", "C.2. Tributo Federal (PIS)", `${(pctC2_6 * 100).toFixed(2)}%`, "-", "-"]);
  // C.3 - Tributo Municipal (ISSQN) 5%
  const pctC3_6 = 0.05;
  sheet.addRow(["", "C.3. Tributo Municipal (ISSQN)", `${(pctC3_6 * 100).toFixed(2)}%`, "-", "-"]);

  // D: Tributos sobre Vale Alimentação (5.263%) — base on Módulo 2.3 unit value if available
  const pctD6 = 0.05263;
  const baseForD = (typeof totalValUnit23 !== 'undefined' && totalValUnit23) ? totalValUnit23 : totalPorPosto;
  const valD6 = baseForD * pctD6;
  const totD6 = valD6 * quantidade;
  sheet.addRow(["D", "Tributos sobre Vale Alimentação", `${(pctD6 * 100).toFixed(3)}%`, valD6, totD6]);
  // D.1 Tributos Municipais (especificar) 5%
  const pctD1 = 0.05;
  sheet.addRow(["", "D.1. Tributos Municipais (especificar)", `${(pctD1 * 100).toFixed(2)}%`, "-", "-"]);

  // Total Módulo 6
  const valTotal6 = (valA6 || 0) + (valC6 || 0) + (valD6 || 0);
  const totTotal6 = (totA6 || 0) + (totC6 || 0) + (totD6 || 0);
  const rowTotal6 = sheet.addRow(["Total", "", "", valTotal6, totTotal6]);
  sheet.mergeCells(`A${rowTotal6.number}:B${rowTotal6.number}`);
  rowTotal6.getCell(1).font = headerFont;
  try { rowTotal6.getCell(4).numFmt = '#,##0.00'; } catch (e) { }
  try { rowTotal6.getCell(5).numFmt = '#,##0.00'; } catch (e) { }

  // --- QUADRO-RESUMO DO CUSTO POR EMPREGADO ---
  sheet.addRow([]);
  const quadroFinal = sheet.addRow(["2. QUADRO-RESUMO DO CUSTO POR EMPREGADO"]);
  quadroFinal.font = headerFont;
  sheet.mergeCells(`A${quadroFinal.number}:E${quadroFinal.number}`);
  try {
    for (let c = 1; c <= 5; c++) {
      const cell = quadroFinal.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA6A6A6' } };
      cell.font = Object.assign({}, quadroFinal.font, { color: { argb: 'FF000000' } });
    }
  } catch (e) { }
  sheet.addRow([]);
  const headerFinal = sheet.addRow(["", "Mão de obra vinculada à execução contratual (valor por empregado)", "", "Valor Unitário (R$)", "Valor Total (R$)"]);
  headerFinal.eachCell(c => c.font = headerFont);

  const unitA = somaModulo1Unit || 0;
  const totalA = (somaModulo1Unit || 0) * quantidade;
  const unitB = (typeof valModule2UnitTotal !== 'undefined') ? valModule2UnitTotal : 0;
  const totalB = (typeof valModule2Total !== 'undefined') ? valModule2Total : 0;
  const unitC = (typeof valTotal3 !== 'undefined') ? valTotal3 : 0;
  const totalC = (typeof totTotal3 !== 'undefined') ? totTotal3 : 0;
  const unitD = (typeof valTotal4 !== 'undefined') ? valTotal4 : 0;
  const totalD = (typeof totTotal4 !== 'undefined') ? totTotal4 : 0;
  const unitE = (typeof valTotal5 !== 'undefined') ? valTotal5 : 0;
  const totalE = (typeof totTotal5 !== 'undefined') ? totTotal5 : 0;

  const rA = sheet.addRow(["A", "Módulo 1 - Composição da Remuneração", "", unitA, totalA]);
  const rB = sheet.addRow(["B", "Módulo 2 - Encargos e Benefícios Anuais, Mensais e Diários", "", unitB, totalB]);
  const rC = sheet.addRow(["C", "Módulo 3 - Provisão para Rescisão", "", unitC, totalC]);
  const rD = sheet.addRow(["D", "Módulo 4 - Custo de Reposição do Profissional Ausente", "", unitD, totalD]);
  const rE = sheet.addRow(["E", "Módulo 5 - Insumos Diversos", "", unitE, totalE]);

  const subtotalUnit = unitA + unitB + unitC + unitD + unitE;
  const subtotalTotal = totalA + totalB + totalC + totalD + totalE;
  const rSub = sheet.addRow(["Subtotal (A + B +C+ D+E)", "", "", subtotalUnit, subtotalTotal]);

  const unitF = (typeof valTotal6 !== 'undefined') ? valTotal6 : 0;
  const totalF = (typeof totTotal6 !== 'undefined') ? totTotal6 : 0;
  const rF = sheet.addRow(["F", "Módulo 6 – Custos Indiretos, Tributos e Lucro", "", unitF, totalF]);

  const valorUnitTotal = subtotalUnit + unitF;
  const valorTotalTotal = subtotalTotal + totalF;
  const rVal = sheet.addRow(["Valor Total", "", "", valorUnitTotal, valorTotalTotal]);
  const rVal4 = sheet.addRow(["Valor Total (4 meses)", "", "", valorUnitTotal * 4, valorTotalTotal * 4]);

  // formatamento moeda para essas linhas
  [rA, rB, rC, rD, rE, rSub, rF, rVal, rVal4].forEach(r => {
    try { r.getCell(4).numFmt = '#,##0.00'; } catch (e) { }
    try { r.getCell(5).numFmt = '#,##0.00'; } catch (e) { }
  });

  // // Tributos (se fornecidos)
  // sheet.addRow([]);
  // sheet.addRow(["TRIBUTOS (aplicados sobre total por posto se informados)"]);
  // sheet.addRow([`ISS (${Number(iss * 100).toFixed(2)}%)`, "", (iss * totalPorPosto), (iss * totalPorPosto * quantidade)]);
  // sheet.addRow([`PIS/COFINS (${Number(pisCofins * 100).toFixed(2)}%)`, "", (pisCofins * totalPorPosto), (pisCofins * totalPorPosto * quantidade)]);
  // sheet.addRow([`IRPJ/CSLL (${Number(irpjCsll * 100).toFixed(2)}%)`, "", (irpjCsll * totalPorPosto), (irpjCsll * totalPorPosto * quantidade)]);

  // // Totais finais simplificados
  // sheet.addRow([]);
  // sheet.addRow(["TOTAL POR POSTO (custos diretos + benefícios + tributos unit)", "", totalPorPosto, (totalPorPosto * quantidade)]);
  // sheet.addRow(["TOTAL MENSAL (todos os postos)", "", "", totalMensal]);
  // sheet.addRow([]);

  // Ajustes de colunas para ficar legível
  sheet.columns.forEach(col => {
    col.width = 25;
    if (!col.numFmt) col.numFmt = '#,##0.##';
  });

  // Ensure integer counts show no decimals and monetary columns show up to 2 decimals
  // Col 2 -> Quantidade (no decimals), Col 3 & 4 -> Valores (up to 2 decimals)
  sheet.eachRow((row, rowNumber) => {
    try {
      const qtyCell = row.getCell(2);
      if (qtyCell && typeof qtyCell.value === 'number') qtyCell.numFmt = '#,##0';
      const unitCell = row.getCell(3);
      if (unitCell && typeof unitCell.value === 'number') unitCell.numFmt = '#,##0.##';
      const totalCell = row.getCell(4);
      if (totalCell && typeof totalCell.value === 'number') totalCell.numFmt = '#,##0.##';

      // If any cell was accidentally written as a string ending with a dot (e.g. "1234."),
      // normalize it: remove trailing dot and convert to a numeric cell.
      [qtyCell, unitCell, totalCell].forEach(cell => {
        if (!cell) return;
        if (typeof cell.value === 'string') {
          const v = cell.value.trim();
          // match digits followed by a single dot and nothing else
          if (/^\d+\.$/.test(v)) {
            const normalized = Number(v.slice(0, -1));
            if (isFinite(normalized)) {
              cell.value = normalized;
              // apply appropriate format
              if (cell === qtyCell) cell.numFmt = '#,##0';
              else cell.numFmt = '#,##0.##';
            }
          }
        }
      });
    } catch (e) {
      // safe to ignore row formatting errors
    }
  });
  // Aplicar fonte padrão (Times New Roman 12) a todas as células que ainda não tenham fonte definida
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      try {
        if (!cell.font) {
          cell.font = defaultFont;
        } else {
          // assegurar nome e tamanho quando não especificados
          const f = cell.font;
          if (!f.name) f.name = defaultFont.name;
          if (!f.size) f.size = defaultFont.size;
        }
      } catch (e) {
        // ignorar
      }
    });
  });
  // Nome e salva arquivo em temp
  const nomeArquivo = `planilha_${Date.now()}.xlsx`;
  const caminhoArquivo = path.join(tempDir, nomeArquivo);

  await workbook.xlsx.writeFile(caminhoArquivo);

  return caminhoArquivo;
}
