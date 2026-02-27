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
    const tempDir = path.join(__dirname, "..", "temp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Formação de Preços");
    
    // Remove grid lines - leave sheet completely white
    sheet.views[0].showGridLines = false;

    const defaultFont = { name: 'Times New Roman', size: 12 };
    const headerFont = { name: 'Times New Roman', size: 12, bold: true };
    const titleFont = { name: 'Times New Roman', size: 16, bold: true };

    const styles = {
        title: { font: titleFont, background: 'FFD9D9D9' },
        mod: { font: headerFont, background: 'FFA6A6A6' },
        submod: { font: headerFont, background: 'FFA6A6A6' },
        default: { font: defaultFont }
    };

    function applyStyle(row, style) {
        if (style.background) row.eachCell(cell => applyBackground(cell, style.background));
        if (style.font) row.font = style.font;
    }

    // Título 
    sheet.addRow([]);
    const titleRow = sheet.addRow(["ANEXO I - PLANILHA DE CUSTOS E FORMAÇÃO DE PREÇOS"]);
    titleRow.font = titleFont;
    sheet.mergeCells(`A${titleRow.number}:E${titleRow.number}`);
    titleRow.eachCell(cell => applyBackground(cell, 'FFD9D9D9'));

    const postoRow = sheet.addRow([`Posto de Trabalho: ${dados.cargo ?? ""} (${dados.jornada ? dados.jornada + 'h/semana' : ""})`]);
    postoRow.font = headerFont;
    sheet.mergeCells(`A${postoRow.number}:E${postoRow.number}`);

    //modulo 1
    const modulo1Row = sheet.addRow(["MÓDULO 1 - Composição da Remuneração"]);
    sheet.mergeCells(`A${modulo1Row.number}:E${modulo1Row.number}`);
    modulo1Row.eachCell(cell => applyBackground(cell, 'FFA6A6A6'));
    modulo1Row.getCell(1).font = { ...headerFont, color: { argb: 'FF000000' } };

    const spacerRow = sheet.addRow([]);
    sheet.mergeCells(`A${spacerRow.number}:E${spacerRow.number}`);
    spacerRow.height = 7.5;

    //cabecalho
    const headerM1 = sheet.addRow(["1", "Composição da Remuneração", "Quantidade", "Valor Unitário (R$)", "Valor Total (R$)"]);
    headerM1.eachCell(c => c.font = headerFont);
    sheet.addRow(["A", "Salário-Base", dados.quantidade, dados.salarioBase, dados.salarioBase * dados.quantidade]);
    // Periculosidade (opcional - amarelo editável)
    if (dados.periculosidade > 0) {
        sheet.addRow(["B", "Adicional de Periculosidade (30% do salário base)", "", dados.periculosidade, ""]);
    } else {
        sheet.addRow(["B", "Adicional de Periculosidade (30% do salário base) - (não aplicado)", "", 0, 0]);
    }
    // Insalubridade (opcional)
    if (dados.insalubridade > 0) {
        sheet.addRow(["C", `Adicional de Insalubridade (aplicado sobre salário mínimo)`, "", dados.insalubridade, ""]);
    } else {
        sheet.addRow(["C", `Adicional de Insalubridade - (não aplicado)`, "", 0, 0]);
    }
    if (dados.adicionalNoturno > 0) {
        sheet.addRow(["D", `Adicional de Adicional Noturno)`, "", dados.adicionalNoturno, ""]);
    } else {
        sheet.addRow(["D", `Adicional de Adicional Noturno`, "", 0, 0]);
    }
    const adicionaisUnitarios = (dados.periculosidade + dados.insalubridade + dados.adicionalNoturno);
    const salarioFinal = adicionaisUnitarios + dados.salarioBase;
    //total
    const totalM1 = sheet.addRow(["Total", "", "", salarioFinal, (salarioFinal * dados.quantidade)]);
    sheet.mergeCells(`A${totalM1.number}:C${totalM1.number}`);
    totalM1.getCell(1).font = headerFont;

    //modulo 2
    sheet.addRow([spacerRow]);
    const modulo2Row = sheet.addRow(["MÓDULO 2 - Encargos e Benefícios Anuais, Mensais e Diários"]);
    sheet.mergeCells(`A${modulo2Row.number}:E${modulo2Row.number}`);
    modulo2Row.eachCell(cell => applyBackground(cell, 'FFA6A6A6'));
    modulo2Row.getCell(1).font = { ...headerFont, color: { argb: 'FF000000' } };
    sheet.addRow([spacerRow]);

    const sub21Row = sheet.addRow(["Submódulo 2.1 - 13º (décimo terceiro) Salário, Férias e Adicional de Férias"]);
    sheet.mergeCells(`A${sub21Row.number}:E${sub21Row.number}`);
    // salva e retorna o caminho do arquivo
    const filename = `planilha_${Date.now()}.xlsx`;
    const filepath = path.join(tempDir, filename);
    await workbook.xlsx.writeFile(filepath);
    return filepath;
}
