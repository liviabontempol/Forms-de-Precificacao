import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function gerarPlanilha(dados) {
  // normaliza / defaults
  const quantidade = Number(dados.quantidade ?? 1);
  const salarioBase = Number(dados.salarioBase ?? 0);
  const encargosPercent = Number(dados.encargosPercent ?? 0.30); // 30% padrão
  const reservaTecnicaPercent = Number(dados.reservaTecnicaPercent ?? 0.08); // 8% padrão
  const salarioMinimo = Number(dados.salarioMinimo ?? 0);

  const beneficios = dados.beneficios ?? {};
  const vt = Number(beneficios.vt ?? 0);
  const vr = Number(beneficios.vr ?? 0);
  const assistencia = Number(beneficios.assistencia ?? 0);
  const outrosBenef = Number(beneficios.outros ?? 0);

  // adicionais opcionais (já em valor unitário)
  const adicionalNoturno = Number(dados.adicionalNoturno ?? 0);
  const horaIntervaloNoturno = Number(dados.horaIntervaloNoturno ?? 0);
  const horaFictaNoturna = Number(dados.horaFictaNoturna ?? 0);

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

  // Cálculos padrão (unidades)
  const valor13 = salarioBase / 12; // 13º unitário
  const valorFerias = (salarioBase / 12) * 1.33; // férias + 1/3 (fator 1,33 conforme você mencionou)
  const fgts = salarioBase * 0.08; // FGTS 8%
  const encargos = salarioBase * encargosPercent;

  // Somatório de adicionais opcionais (unitário)
  const adicionaisUnitarios = periculosidadeValor + insalubridadeValor + adicionalNoturno + horaIntervaloNoturno + horaFictaNoturna;

  // Benefícios unitários (somatória)
  const beneficiosUnitarios = vt + vr + assistencia + outrosBenef;

  // Custos diretos unitários (mão de obra): salário + encargos + férias + 13º + FGTS + adicionais (simplificado)
  const custosDiretosUnit = salarioBase + encargos + valorFerias + valor13 + fgts + adicionaisUnitarios;

  // Totais por posto e geral
  const totalPorPosto = custosDiretosUnit + beneficiosUnitarios; // simplificação: custos diretos + benefícios
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

  // Cria pasta temp dentro do mesmo diretório do utils (server/src/temp)
  const tempDir = path.join(__dirname, "..", "temp");
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Formação de Preços");

  // Estilos básicos
  const headerStyle = { bold: true };

  // --- Módulo 1 - Composição da Remuneração ---
  sheet.addRow(["ANEXO I - PLANILHA DE CUSTOS E FORMAÇÃO DE PREÇOS"]).font = { bold: true };
  sheet.addRow([]);
  sheet.addRow([`Posto de Trabalho: ${dados.cargo ?? ""} (${dados.jornada ?? ""})`]);
  sheet.addRow([]);

  sheet.addRow(["MÓDULO 1 - Composição da Remuneração"]).font = headerStyle;
  sheet.addRow(["Composição", "Quantidade", "Valor Unitário (R$)", "Valor Total (R$)"]);

  // Salário base linha
  sheet.addRow(["Salário-Base", quantidade, salarioBase, salarioBase * quantidade]);

  // Periculosidade (opcional - amarelo editável)
  if (periculosidadeValor > 0) {
    sheet.addRow(["Adicional de Periculosidade (30% do salário base)", quantidade, periculosidadeValor, periculosidadeValor * quantidade]);
  } else {
    sheet.addRow(["Adicional de Periculosidade (30% do salário base) - (não aplicado)", quantidade, 0, 0]);
  }

  // Insalubridade (opcional)
  if (insalubridadeValor > 0) {
    sheet.addRow([`Adicional de Insalubridade (aplicado sobre salário mínimo)`, quantidade, insalubridadeValor, insalubridadeValor * quantidade]);
  } else {
    sheet.addRow([`Adicional de Insalubridade - (não aplicado)`, quantidade, 0, 0]);
  }

  // Adicional Noturno e Horas (opcionais)
  sheet.addRow(["Adicional Noturno + DSR", quantidade, adicionalNoturno, adicionalNoturno * quantidade]);
  sheet.addRow(["Hora de Intervalo Noturno + DSR", quantidade, horaIntervaloNoturno, horaIntervaloNoturno * quantidade]);
  sheet.addRow(["Hora Ficta Noturna + DSR", quantidade, horaFictaNoturna, horaFictaNoturna * quantidade]);

  // Total módulo 1 (simplificado)
  sheet.addRow([]);
  sheet.addRow(["Total Módulo 1 (Custos Diretos - unitário)", "", custosDiretosUnit.toFixed(2), (custosDiretosUnit * quantidade).toFixed(2)]);

  // --- Módulo 2 - Encargos e Benefícios ---
  sheet.addRow([]);
  sheet.addRow(["MÓDULO 2 - Encargos e Benefícios Anuais, Mensais e Diários"]).font = headerStyle;

  // 13º, Férias, FGTS, Encargos Previdenciários
  sheet.addRow(["Item", "Percentual (se aplicável)", "Valor Unitário (R$)", "Valor Total (R$)"]);
  sheet.addRow(["13º salário (unitário)", `${(valor13 / salarioBase * 100 || 0).toFixed(2)}%`, valor13.toFixed(2), (valor13 * quantidade).toFixed(2)]);
  sheet.addRow(["Férias + 1/3 (unitário)", "", valorFerias.toFixed(2), (valorFerias * quantidade).toFixed(2)]);
  sheet.addRow(["FGTS (8%)", "8%", fgts.toFixed(2), (fgts * quantidade).toFixed(2)]);
  sheet.addRow(["Encargos (ex.: INSS, etc.)", `${(encargosPercent * 100).toFixed(2)}%`, encargos.toFixed(2), (encargos * quantidade).toFixed(2)]);
  sheet.addRow([]);

  // Benefícios (se houver)
  sheet.addRow(["BENEFÍCIOS"]);
  sheet.addRow(["Vale-transporte (unit)", vt.toFixed(2), "", (vt * quantidade).toFixed(2)]);
  sheet.addRow(["Vale-refeição/alimentação (unit)", vr.toFixed(2), "", (vr * quantidade).toFixed(2)]);
  sheet.addRow(["Assistência médica/odontológica (unit)", assistencia.toFixed(2), "", (assistencia * quantidade).toFixed(2)]);
  sheet.addRow(["Outros benefícios (unit)", outrosBenef.toFixed(2), "", (outrosBenef * quantidade).toFixed(2)]);
  sheet.addRow(["Total Benefícios (unit)", "", beneficiosUnitarios.toFixed(2), (beneficiosUnitarios * quantidade).toFixed(2)]);

  // Reserva Técnica
  sheet.addRow([]);
  sheet.addRow(["Reserva Técnica", `${(reservaTecnicaPercent * 100).toFixed(2)}%`, reservaTecnicaUnit.toFixed(2), reservaTecnicaTotal.toFixed(2)]);

  // Tributos (se fornecidos)
  sheet.addRow([]);
  sheet.addRow(["TRIBUTOS (aplicados sobre total por posto se informados)"]);
  sheet.addRow([`ISS (${(iss*100).toFixed(2)}%)`, "", (iss * totalPorPosto).toFixed(2), (iss * totalPorPosto * quantidade).toFixed(2)]);
  sheet.addRow([`PIS/COFINS (${(pisCofins*100).toFixed(2)}%)`, "", (pisCofins * totalPorPosto).toFixed(2), (pisCofins * totalPorPosto * quantidade).toFixed(2)]);
  sheet.addRow([`IRPJ/CSLL (${(irpjCsll*100).toFixed(2)}%)`, "", (irpjCsll * totalPorPosto).toFixed(2), (irpjCsll * totalPorPosto * quantidade).toFixed(2)]);

  // Totais finais simplificados
  sheet.addRow([]);
  sheet.addRow(["TOTAL POR POSTO (custos diretos + benefícios + tributos unit)", "", totalPorPosto.toFixed(2), (totalPorPosto * quantidade).toFixed(2)]);
  sheet.addRow(["TOTAL MENSAL (todos os postos)", "", "", totalMensal.toFixed(2)]);
  sheet.addRow([]);

  // Ajustes de colunas para ficar legível
  sheet.columns.forEach(col => {
    col.width = 25;
    if (!col.numFmt) col.numFmt = '#,##0.00';
  });

  // Nome e salva arquivo em temp
  const nomeArquivo = `planilha_${Date.now()}.xlsx`;
  const caminhoArquivo = path.join(tempDir, nomeArquivo);

  await workbook.xlsx.writeFile(caminhoArquivo);

  return caminhoArquivo;
}
