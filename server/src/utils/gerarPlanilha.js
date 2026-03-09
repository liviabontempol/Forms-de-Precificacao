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
    sheet.views = [{ showGridLines: false }];

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

    function addSpacerRow() {
        const spacer = sheet.addRow([]);
        sheet.mergeCells(`A${spacer.number}:E${spacer.number}`);
        spacer.height = 7.5;
        return spacer;
    }

    // Título 
    sheet.addRow([]);
    const titleRow = sheet.addRow(["ANEXO I - PLANILHA DE CUSTOS E FORMAÇÃO DE PREÇOS"]);
    sheet.mergeCells(`A${titleRow.number}:E${titleRow.number}`);
    applyStyle(titleRow, styles.title);

    const postoRow = sheet.addRow([`Posto de Trabalho: ${dados.cargo ?? ""} (${dados.jornada ? dados.jornada + 'h/semana' : ""})`]);
    postoRow.font = headerFont;
    sheet.mergeCells(`A${postoRow.number}:E${postoRow.number}`);

    //modulo 1
    const modulo1Row = sheet.addRow(["MÓDULO 1 - Composição da Remuneração"]);
    sheet.mergeCells(`A${modulo1Row.number}:E${modulo1Row.number}`);
    applyStyle(modulo1Row, styles.mod);

    addSpacerRow();

    //cabecalho
    const header1 = sheet.addRow(["1", "Composição da Remuneração", "Quantidade", "Valor Unitário (R$)", "Valor Total (R$)"]);
    header1.eachCell(c => c.font = headerFont);
    sheet.addRow(["A", "Salário-Base", dados.quantidade, dados.salarioBase, dados.salarioBase * dados.quantidade]);

    // Calcular valores dos adicionais
    const salarioMinimo = 1518.00;
    const valorPericulosidade = dados.periculosidade ? (dados.salarioBase * 0.30) : 0;
    let valorInsalubridade = 0;
    if (dados.insalubridade) {
        // se for '20' ou '40' -> aplicar sobre salarioMinimo
        if (dados.insalubridade === "20" || dados.insalubridade === "40") {
            const pct = Number(dados.insalubridade) / 100;
            valorInsalubridade = salarioMinimo * pct;
        } else {
            // se passar um percent como 0.2 ou 0.4
            const pct = Number(dados.insalubridade);
            if (!isNaN(pct) && pct > 0 && pct <= 1) {
                valorInsalubridade = salarioMinimo * pct;
            }
        }
    }

    const valorAdicionalNoturno = dados.adicionalNoturno ? dados.adicionalNoturno : 0;

    // Periculosidade (opcional - amarelo editável)
    if (dados.periculosidade) {
        sheet.addRow(["B", "Adicional de Periculosidade", "", valorPericulosidade, null]);
    } else {
        sheet.addRow(["B", "Adicional de Periculosidade (30% do salário base)", "", 0, 0]);
    }
    // Insalubridade (opcional)
    if (valorInsalubridade > 0) {
        const insalubridadePct = dados.insalubridade === "20" || dados.insalubridade === "40"
            ? dados.insalubridade
            : (Number(dados.insalubridade) * 100).toFixed(0);
        sheet.addRow(["C", `Adicional de Insalubridade (${insalubridadePct}% do salário mínimo)`, "", valorInsalubridade, null]);
    } else {
        sheet.addRow(["C", `Adicional de Insalubridade - (não aplicado)`, "", 0, 0]);
    }
    // Adicional Noturno (opcional)
    if (dados.adicionalNoturno) {
        sheet.addRow(["D", `Adicional Noturno`, "", valorAdicionalNoturno, null]);
    } else {
        sheet.addRow(["D", `Adicional Noturno - (não aplicado)`, "", 0, 0]);
    }
    const adicionaisUnitarios = valorPericulosidade + valorInsalubridade + valorAdicionalNoturno;
    const salarioFinal = adicionaisUnitarios + dados.salarioBase;
    //total
    const totalM1 = sheet.addRow(["Total", "", "", salarioFinal, (salarioFinal * dados.quantidade)]);
    sheet.mergeCells(`A${totalM1.number}:B${totalM1.number}`);
    totalM1.getCell(1).font = headerFont;

    //modulo 2
    addSpacerRow();
    const modulo2Row = sheet.addRow(["MÓDULO 2 - Encargos e Benefícios Anuais, Mensais e Diários"]);
    sheet.mergeCells(`A${modulo2Row.number}:E${modulo2Row.number}`);
    applyStyle(modulo2Row, styles.mod);
    addSpacerRow();

    //submodulo 2.1
    const sub21Row = sheet.addRow(["Submódulo 2.1 - 13º (décimo terceiro) Salário, Férias e Adicional de Férias"]);
    sheet.mergeCells(`A${sub21Row.number}:E${sub21Row.number}`);
    applyStyle(sub21Row, styles.submod);
    addSpacerRow();


    const encargosSub21 = {
        salario13: '13º Salário',
        feriasAdicionalDeFerias: 'Férias e Adicional de Férias',
        incidenciaM2sobre13eFerias: 'Incidência do módulo 2.2 sobre os itens A e B',
        abonoPecuniario: 'Abono Pecuniário'
    };

    //cabecalho
    const header21 = sheet.addRow(["2.1", "13º (décimo terceiro) Salário, Férias e Adicional de Férias", "Percentual (%)", "Valor Unitário (R$)", "Valor Total (R$)"]);
    header21.eachCell(c => c.font = headerFont);

    let pctTotal21 = 0;
    let valTotal21 = 0;
    let totTotal21 = 0;
    let letraAtual21 = 'A';

    Object.entries(encargosSub21).forEach(([slug, descricao]) => {
        const percentual = dados.encargosPercentuais?.[slug];
        if (percentual === undefined) return;

        const pct = Number(percentual || 0);
        const val = salarioFinal * pct;
        const tot = val * dados.quantidade;
        sheet.addRow([letraAtual21, descricao, `${(pct * 100).toFixed(2)}%`, val, tot]);

        pctTotal21 += pct;
        valTotal21 += val;
        totTotal21 += tot;
        letraAtual21 = String.fromCharCode(letraAtual21.charCodeAt(0) + 1);
    });

    //total do submodulo 2.1
    const rowTotal21 = sheet.addRow(["Total", "", `${(pctTotal21 * 100).toFixed(2)}%`, valTotal21, totTotal21]);
    sheet.mergeCells(`A${rowTotal21.number}:B${rowTotal21.number}`);
    rowTotal21.getCell(1).font = headerFont;
    addSpacerRow();

    //submodulo 2.2
    const sub22Row = sheet.addRow(["Submódulo 2.2 - Encargos Previdenciários (GPS), Fundo de Garantia por Tempo de Serviço (FGTS) e outras contribuições."]);
    sheet.mergeCells(`A${sub22Row.number}:E${sub22Row.number}`);
    applyStyle(sub22Row, styles.submod);
    addSpacerRow();


    const encargosSub22 = {
        inss: 'INSS',
        salarioEducacao: 'Salário Educação',
        sat: 'SAT ou RAT (Seguro Acidente do Trabalho)',
        sesi: 'SESC/SESI',
        senai: 'SENAI / SENAC',
        sebrae: 'SEBRAE',
        incra: 'INCRA',
        fgts: 'FGTS'
    };

    //cabecalho do submodulo 2.2
    const header22 = sheet.addRow(["2.2", "GPS, FGTS e outras contribuições", "Percentual (%)", "Valor Unitário (R$)", "Valor Total (R$)"]);
    header22.eachCell(c => c.font = headerFont);

    let pctTotal22 = 0;
    let valTotal22 = 0;
    let totTotal22 = 0;
    let letraAtual22 = 'A';

    Object.entries(encargosSub22).forEach(([slug, descricao]) => {
        const percentual = dados.encargosPercentuais?.[slug];
        if (percentual === undefined) return;

        const pct = Number(percentual || 0);
        const val = salarioFinal * pct;
        const tot = val * dados.quantidade;

        sheet.addRow([letraAtual22, descricao, `${(pct * 100).toFixed(2)}%`, val, tot]);

        pctTotal22 += pct;
        valTotal22 += val;
        totTotal22 += tot;
        letraAtual22 = String.fromCharCode(letraAtual22.charCodeAt(0) + 1);
    });

    // Total
    const rowTotal22 = sheet.addRow(["Total", "", `${(pctTotal22 * 100).toFixed(2)}%`, valTotal22, totTotal22]);
    sheet.mergeCells(`A${rowTotal22.number}:B${rowTotal22.number}`);
    rowTotal22.getCell(1).font = headerFont;
    addSpacerRow();

    //submodulo 2.3
    const sub23Row = sheet.addRow(["Submódulo 2.3 - Benefícios Mensais e Diários"]);
    sheet.mergeCells(`A${sub23Row.number}:E${sub23Row.number}`);
    applyStyle(sub23Row, styles.submod);
    addSpacerRow();

    //cabecalho submodulo 2.3
    const header23 = sheet.addRow(["2.3", "Benefícios Mensais e Diários", "Quantidade", "Valor Unitário (R$)", "Valor Total (R$)"]);
    header23.eachCell(c => c.font = headerFont);

    let valTotal23 = 0;
    let totTotal23 = 0;

    // vt
    if (dados.encargosPercentuais.vt !== undefined) {
        const valorPassagem = Number(dados.encargosPercentuais.vt || 0);
        const descontoLegal = 0.06 * dados.salarioBase;
        const valorVT = (3 * valorPassagem * 26) - descontoLegal;
        const totalVT = valorVT * dados.quantidade;
        sheet.addRow(["A", `Transporte (3 x R$${valorPassagem} x 26 dias x - 6% sal)`, dados.quantidade, valorVT, totalVT]);
        valTotal23 += valorVT;
        totTotal23 += totalVT;
    } else {
        sheet.addRow(["A", "Transporte - nao encontrado", dados.quantidade, null, null]);
    }
    // va
    if (dados.encargosPercentuais.va !== undefined) {
        const valorDiarioVA = Number(dados.encargosPercentuais.va || 0);
        const valorVA = (valorDiarioVA * 26) * 0.8;
        const totalVA = valorVA * dados.quantidade;
        sheet.addRow(["B", `Auxílio-Refeição/Alimentação ( R$${valorDiarioVA} x 26 dias x quant.empregados - 20% VA)`, dados.quantidade, valorVA, totalVA]);
        valTotal23 += valorVA;
        totTotal23 += totalVA;
    } else {
        sheet.addRow(["B", "Auxílio-Refeição/Alimentação - nao encontrado", dados.quantidade, null, null]);
    }
    // outros (especificar)
    if (dados.encargosPercentuais.outrosEspecificarSub23 !== undefined) {
        const pctOutros = Number(dados.encargosPercentuais.outrosEspecificarSub23 || 0);
        const valorOutros = salarioFinal * pctOutros;
        const totalOutros = valorOutros * dados.quantidade;
        sheet.addRow(["C", "Outros (especificar)", `${(pctOutros * 100).toFixed(2)}%`, valorOutros, totalOutros]);
        valTotal23 += valorOutros;
        totTotal23 += totalOutros;
    }

    // Total
    const rowTotal23 = sheet.addRow(["Total", "", "", valTotal23, totTotal23]);
    sheet.mergeCells(`A${rowTotal23.number}:B${rowTotal23.number}`);
    rowTotal23.getCell(1).font = headerFont;
    addSpacerRow();

    // quadro resumo do modulo 2
    const quadroResumoRow = sheet.addRow(["Quadro-Resumo do Módulo 2 - Encargos e Benefícios anuais, mensais e diários "]);
    sheet.mergeCells(`A${quadroResumoRow.number}:E${quadroResumoRow.number}`);
    applyStyle(quadroResumoRow, styles.submod);
    addSpacerRow();

    //cabecalho do quadro resumo do modulo 2
    const quadroResumo = sheet.addRow(["2", "Encargos e Benefícios Anuais, Mensais e Diários", "Percentual (%)", "Valor Unitário (R$)", "Valor Total (R$)"]);
    quadroResumo.eachCell(c => c.font = headerFont);

    sheet.addRow(["2.1", "13º (décimo terceiro) Salário, Férias e Adicional de Férias", `${(pctTotal21 * 100).toFixed(2)}%`, valTotal21, totTotal21]);
    sheet.addRow(["2.2", "GPS, FGTS e outras contribuições", `${(pctTotal22 * 100).toFixed(2)}%`, valTotal22, totTotal22]);
    sheet.addRow(["2.3", "Benefícios Mensais e Diários", "", valTotal23, totTotal23]);

    const quadroPctTotal = pctTotal21 + pctTotal22;
    const quadroValorTotal = valTotal21 + valTotal22 + valTotal23;
    const quadroTotTotal = totTotal21 + totTotal22 + totTotal23;

    //total do quadro resumo
    const quadroResumoTotal = sheet.addRow(["Total", "", `${(quadroPctTotal * 100).toFixed(2)}%`, quadroValorTotal, quadroTotTotal]);
    sheet.mergeCells(`A${quadroResumoTotal.number}:B${quadroResumoTotal.number}`);
    quadroResumoTotal.getCell(1).font = headerFont;
    addSpacerRow();

    //modulo 3
    const modulo3Row = sheet.addRow(["MÓDULO 3 - Provisão para Rescisão"]);
    sheet.mergeCells(`A${modulo3Row.number}:E${modulo3Row.number}`);
    applyStyle(modulo3Row, styles.mod);
    addSpacerRow();

    const encargosMod3 = {
        avisoPrevioIndenizado: 'Aviso Prévio Indenizado',
        incidenciaFgtsAvisoPrevioIndenizado: 'Incidência do FGTS sobre o Aviso Prévio Indenizado',
        multaFgtsAvisoPrevioIndenizado: 'Multa do FGTS e contribuição social sobre o Aviso Prévio Indenizado',
        avisoPrevioTrabalhado: 'Aviso Prévio Trabalhado',
        incidenciaM2AvisoPrevioTrabalhado: 'Incidência dos encargos do Submódulo 2.2 sobre o Aviso Prévio Trabalhado',
        multaFgtsAvisoPrevioTrabalhado: 'Multa FGTS e contribuição social sobre o Aviso Prévio Trabalhado',
        outrosIndAdicional: 'Outros (indenização adicional)'
    };

    //cabecalho modulo 3
    const header3 = sheet.addRow(["3", "Provisão para Rescisão", "Percentual (%)", "Valor Unitário (R$)", "Valor Total (R$)"]);
    header3.eachCell(c => c.font = headerFont);

    let pctTotal3 = 0;
    let valTotal3 = 0;
    let totTotal3 = 0;
    let letraAtual3 = 'A';


    Object.entries(encargosMod3).forEach(([slug, descricao]) => {
        const percentual = dados.encargosPercentuais?.[slug];
        if (percentual === undefined) return;

        const pct = Number(percentual || 0);
        const val = salarioFinal * pct;
        const tot = val * dados.quantidade;

        sheet.addRow([letraAtual3, descricao, `${(pct * 100).toFixed(2)}%`, val, tot]);

        pctTotal3 += pct;
        valTotal3 += val;
        totTotal3 += tot;
        letraAtual3 = String.fromCharCode(letraAtual3.charCodeAt(0) + 1);
    });

    // Total
    const rowTotal3 = sheet.addRow(["Total", "", `${(pctTotal3 * 100).toFixed(2)}%`, valTotal3, totTotal3]);
    sheet.mergeCells(`A${rowTotal3.number}:B${rowTotal3.number}`);
    rowTotal3.getCell(1).font = headerFont;
    addSpacerRow();

    //modulo 4
    const modulo4Row = sheet.addRow(["MÓDULO 4 - Custo de Reposição do Profissional Ausente"]);
    sheet.mergeCells(`A${modulo4Row.number}:E${modulo4Row.number}`);
    applyStyle(modulo4Row, styles.mod);
    addSpacerRow();

    const encargosMod4 = {
        feriasAusenciaLegal: 'Férias',
        ausenciasLegais: 'Ausências Legais',
        licencaPaternidade: 'Licença Paternidade',
        ausenciaPorAcidenteTrabalho: 'Ausência por Acidente de Trabalho',
        afastamentoMaternidade: 'Afastamento Maternidade',
        outrosEspecificar4: 'Outros (especificar)',
        incidenciaM2CustoReposicao: 'Incidência do Submódulo 2.2'
    };

    //cabecalho modulo 4
    const header4 = sheet.addRow(["4", "Ausências Legais", "Percentual (%)", "Valor Unitário (R$)", "Valor Total (R$)"]);
    header4.eachCell(c => c.font = headerFont);

    let pctTotal4 = 0;
    let valTotal4 = 0;
    let totTotal4 = 0;
    let letraAtual4 = 'A';

    Object.entries(encargosMod4).forEach(([slug, descricao]) => {
        const percentual = dados.encargosPercentuais?.[slug];
        if (percentual === undefined) return;

        const pct = Number(percentual || 0);
        const val = salarioFinal * pct;
        const tot = val * dados.quantidade;

        sheet.addRow([letraAtual4, descricao, `${(pct * 100).toFixed(2)}%`, val, tot]);

        pctTotal4 += pct;
        valTotal4 += val;
        totTotal4 += tot;
        letraAtual4 = String.fromCharCode(letraAtual4.charCodeAt(0) + 1);
    });

    // Total
    const rowTotal4 = sheet.addRow(["Total", "", `${(pctTotal4 * 100).toFixed(2)}%`, valTotal4, totTotal4]);
    sheet.mergeCells(`A${rowTotal4.number}:B${rowTotal4.number}`);
    rowTotal4.getCell(1).font = headerFont;
    addSpacerRow();

    //modulo 5
    const modulo5Row = sheet.addRow(["MÓDULO 5 - Insumos Diversos"]);
    sheet.mergeCells(`A${modulo5Row.number}:E${modulo5Row.number}`);
    applyStyle(modulo5Row, styles.mod);
    addSpacerRow();

    const encargosMod5 = {
        uniformes: 'Uniformes',
        materiais: 'Materiais',
        equipamentosProtecaoIndividual: 'Equipamentos de Proteção Individual',
        reservaTecnica: 'Reserva Técnica'
    };

    //cabecalho modulo 5
    const header5 = sheet.addRow(["5", "Insumos Diversos", "Percentual (%)", "Valor Unitário (R$)", "Valor Total (R$)"]);
    header5.eachCell(c => c.font = headerFont);

    let valTotal5 = 0;
    let totTotal5 = 0;

    //uniformes
    if (dados.encargosPercentuais.uniformes !== undefined) {
        const valorUniformes = Number(dados.encargosPercentuais.uniformes || 0);
        const totalUniformes = valorUniformes * dados.quantidade;
        sheet.addRow(["A", "Uniformes", "", valorUniformes, totalUniformes]);
        valTotal5 += valorUniformes;
        totTotal5 += totalUniformes;
    }

    //materiais
    if (dados.encargosPercentuais.materiais !== undefined) {
        const valormateriais = Number(dados.encargosPercentuais.materiais || 0);
        const totalmateriais = valormateriais * dados.quantidade;
        sheet.addRow(["A", "materiais", "", valormateriais, totalmateriais]);
        valTotal5 += valormateriais;
        totTotal5 += totalmateriais;
    }

    //equip. protecao
    if (dados.encargosPercentuais.equipamentosProtecaoIndividual !== undefined) {
        const valorequipamentosProtecaoIndividual = Number(dados.encargosPercentuais.equipamentosProtecaoIndividual || 0);
        const totalequipamentosProtecaoIndividual = valorequipamentosProtecaoIndividual * dados.quantidade;
        sheet.addRow(["A", "equipamentosProtecaoIndividual", "", valorequipamentosProtecaoIndividual, totalequipamentosProtecaoIndividual]);
        valTotal5 += valorequipamentosProtecaoIndividual;
        totTotal5 += totalequipamentosProtecaoIndividual;
    }

    // reserva tecnica
    if (dados.encargosPercentuais.reservaTecnica !== undefined) {
        const pctReservaTecnica = Number(dados.encargosPercentuais.reservaTecnica || 0);
        const valorReservaTecnica = salarioFinal * pctReservaTecnica;
        const totalReservaTecnica = valorReservaTecnica * dados.quantidade;
        sheet.addRow(["C", "Reserva Técnica", `${(pctReservaTecnica * 100).toFixed(2)}%`, valorReservaTecnica, totalReservaTecnica]);
        valTotal5 += valorReservaTecnica;
        totTotal5 += totalReservaTecnica;
    }

    // Total
    const rowTotal5 = sheet.addRow(["Total", "", "", valTotal5, totTotal5]);
    sheet.mergeCells(`A${rowTotal5.number}:B${rowTotal5.number}`);
    rowTotal4.getCell(1).font = headerFont;
    addSpacerRow();


    // modulo 6
    const modulo6Row = sheet.addRow(["MÓDULO 6 - Custos Indiretos, Tributos e Lucro"]);
    sheet.mergeCells(`A${modulo6Row.number}:E${modulo6Row.number}`);
    applyStyle(modulo6Row, styles.mod);
    addSpacerRow();

    const encargosMod6 = {
        custosIndiretos: 'Custos Indiretos',
        confins: 'Tributo Federal (CONFINS)',
        pis: 'Tributo Federal (PIS)',
        issqn: 'Tributo Municipal (ISSQN)',
        tributosValeAlimentacao: 'Tributos sobre Vale Alimentação',
        tributosMunicipais: 'Tributos Municipais (especificar)'
    };

    //cabecalho modulo 6
    const header6 = sheet.addRow(["6", "Custos Indiretos, Tributos e Lucro", "Percentual (%)", "Valor Unitário (R$)", "Valor Total (R$)"]);
    header6.eachCell(c => c.font = headerFont);

    //********************************************* */




    //quadro resumo 
    const moduloQuadroResumo = sheet.addRow(["2. QUADRO-RESUMO DO CUSTO POR EMPREGADO"]);
    sheet.mergeCells(`A${moduloQuadroResumo.number}:E${moduloQuadroResumo.number}`);
    applyStyle(moduloQuadroResumo, styles.mod);
    addSpacerRow();

    //cabecalho modulo QuadroResumo
    const headerQuadroResumo = sheet.addRow(["QuadroResumo", "Insumos Diversos", "Percentual (%)", "Valor Unitário (R$)", "Valor Total (R$)"]);
    headerQuadroResumo.eachCell(c => c.font = headerFont);

    sheet.addRow(["A", "Módulo 1 - Composição da Remuneração", "", salarioFinal, salarioFinal * dados.quantidade]);
    sheet.addRow(["B", "Módulo 2 - Encargos e Benefícios Anuais, Mensais e Diários", "", quadroValorTotal, quadroValorTotal * dados.quantidade]);
    sheet.addRow(["C", "Módulo 3 - Provisão para Rescisão", "", valTotal3, valTotal3 * dados.quantidade]);
    sheet.addRow(["D", "Módulo 4 - Custo de Reposição do Profissional Ausente", "", valTotal4, valTotal4 * dados.quantidade]);
    const rSub = sheet.addRow(["Subtotal (A + B + C + D + E)", "", "", valTotal5, valTotal5 * dados.quantidade]);
    //sheet.addRow(["F", "Módulo 6 – Custos Indiretos, Tributos e Lucro", "", valTotal6, totTotal6]);

    const quadroResumoFinalValorTotal = salarioFinal + quadroValorTotal + valTotal3 + valTotal4 + valTotal5 /*+ valTotal6 */;
    const quadroResumoFinalTotTotal = (salarioFinal*dados.quantidade) + quadroTotTotal + totTotal3 + totTotal4 + totTotal5 /*+ totTotal6 */;

    //total do quadro resumo final
    const quadroResumoFinalTotal = sheet.addRow(["Total", "", "", quadroResumoFinalValorTotal, quadroResumoFinalTotTotal]);
    sheet.mergeCells(`A${quadroResumoFinalTotal.number}:B${quadroResumoFinalTotal.number}`);
    quadroResumoFinalTotal.getCell(1).font = headerFont;
    addSpacerRow();


    //********************************************* */



    // estilizacao final e formatacao
    const borderStyle = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
    };

    const formatoContabil = '_-"R$" * #,##0.00_-;\\-"R$" * #,##0.00_-;_-"R$" * "-"??_-;_-@_-';

    sheet.eachRow((row, rowNumber) => {
        if (row.height !== 7.5) {
            for (let col = 1; col <= 5; col++) {
                const cell = row.getCell(col);
                cell.border = borderStyle;
                cell.alignment = { vertical: 'middle' };

                if (rowNumber > 6) {
                    if (col === 4 || col === 5) {
                        if (typeof cell.value === 'number') {
                            cell.numFmt = formatoContabil;
                        }
                    }
                    if (col === 3) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    }
                }
            };
        };
    });


    // salva e retorna o caminho do arquivo
    const filename = `planilha_${Date.now()}.xlsx`;
    const filepath = path.join(tempDir, filename);
    await workbook.xlsx.writeFile(filepath);
    return filepath;


}
