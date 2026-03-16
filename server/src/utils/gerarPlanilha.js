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


function roundTo2(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

export async function gerarPlanilha(dados) {
    const tempDir = path.join(__dirname, "..", "temp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Formação de Preços");

    // Remove grid lines - leave sheet completely white
    sheet.views = [{ showGridLines: false }];

    // Define larguras para abrir a planilha legivel sem ajuste manual.
    sheet.columns = [
        { width: 8.43 }, // A - indice/letra
        { width: 71.43 }, // B - descricao
        { width: 14 }, // C - percentual/quantidade
        { width: 20 }, // D - valor unitario
        { width: 20 }, // E - valor total
    ];

    const defaultFont = { name: 'Times New Roman', size: 12 };
    const headerFont = { name: 'Times New Roman', size: 12, bold: true };
    const titleFont = { name: 'Times New Roman', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };

    const styles = {
        title: { font: titleFont, background: 'FF595959' },
        mod: { font: headerFont, background: 'FFA5A5A5' },
        submod: { font: headerFont, background: 'FFD8D8D8' },
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

    let valorAdicionalNoturno = 0;
    //if(dados.insalubridade){   FAZER O CALCULO AQUI }


    // Periculosidade
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
        let val = salarioFinal * pct;
        val = roundTo2(val);
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
        let val = salarioFinal * pct;
        val = roundTo2(val);
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

    const valorDiarioVA = Number(dados.encargosPercentuais.va || 0);
    const valorVA = (valorDiarioVA * 26) * 0.8;
    const totalVA = valorVA * dados.quantidade;
    if (dados.encargosPercentuais.va !== undefined) {
        sheet.addRow(["B", `Auxílio-Refeição/Alimentação ( R$${valorDiarioVA} x 26 dias x quant.empregados - 20% VA)`, dados.quantidade, valorVA, totalVA]);
        valTotal23 += valorVA;
        totTotal23 += totalVA;
    } else {
        sheet.addRow(["B", "Auxílio-Refeição/Alimentação - nao encontrado", dados.quantidade, null, null]);
    }
    // outros (especificar)
    if (dados.encargosPercentuais.outrosEspecificarSub23 !== undefined) {
        const pctOutros = Number(dados.encargosPercentuais.outrosEspecificarSub23 || 0);
        let valorOutros = salarioFinal * pctOutros;
        valorOutros = roundTo2(valorOutros);
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
        multaFgtsDemissaoSemJustaCausa: 'Multa do FGTS para Demissão Sem Justa Causa',
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
        let val = salarioFinal * pct;
        val = roundTo2(val);
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
        ausenciaPorDoenca: 'Ausência por doença',
        licencaPaternidade: 'Licença Paternidade',
        ausenciaPorAcidenteTrabalho: 'Ausência por Acidente de Trabalho',
        afastamentoMaternidade: 'Afastamento Maternidade',
        incidenciaM2Maternidade: 'Incidência do Submódulo 2.2 sobre Afastamento Maternidade',
        outrosEspecificar4: 'Outros (especificar)',
        incidenciaM2CustoReposicao: 'Incidência do Submódulo 2.2',

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
        let val = salarioFinal * pct;
        val = roundTo2(val);
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
        sheet.addRow(["B", "Materiais", "", valormateriais, totalmateriais]);
        valTotal5 += valormateriais;
        totTotal5 += totalmateriais;
    }

    //equip. protecao
    if (dados.encargosPercentuais.equipamentosProtecaoIndividual !== undefined) {
        const valorequipamentosProtecaoIndividual = Number(dados.encargosPercentuais.equipamentosProtecaoIndividual || 0);
        const totalequipamentosProtecaoIndividual = valorequipamentosProtecaoIndividual * dados.quantidade;
        sheet.addRow(["C", "Equipamentos de Proteção Individual", "", valorequipamentosProtecaoIndividual, totalequipamentosProtecaoIndividual]);
        valTotal5 += valorequipamentosProtecaoIndividual;
        totTotal5 += totalequipamentosProtecaoIndividual;
    }

    // reserva tecnica
    if (dados.encargosPercentuais.reservaTecnica !== undefined) {
        const pctReservaTecnica = Number(dados.encargosPercentuais.reservaTecnica || 0);
        let valorReservaTecnica = salarioFinal * pctReservaTecnica;
        valorReservaTecnica = roundTo2(valorReservaTecnica);
        const totalReservaTecnica = valorReservaTecnica * dados.quantidade;
        sheet.addRow(["D", "Reserva Técnica", `${(pctReservaTecnica * 100).toFixed(2)}%`, valorReservaTecnica, totalReservaTecnica]);
        valTotal5 += valorReservaTecnica;
        totTotal5 += totalReservaTecnica;
    }

    // Total
    const rowTotal5 = sheet.addRow(["Total", "", "", valTotal5, totTotal5]);
    sheet.mergeCells(`A${rowTotal5.number}:B${rowTotal5.number}`);
    rowTotal5.getCell(1).font = headerFont;
    addSpacerRow();


    // modulo 6
    const modulo6Row = sheet.addRow(["MÓDULO 6 - Custos Indiretos, Tributos e Lucro"]);
    sheet.mergeCells(`A${modulo6Row.number}:E${modulo6Row.number}`);
    applyStyle(modulo6Row, styles.mod);
    addSpacerRow();

    const somModulos1a5 = salarioFinal + quadroValorTotal + valTotal3 + valTotal4 + valTotal5;


    //cabecalho modulo 6
    const header6 = sheet.addRow(["6", "Custos Indiretos, Tributos e Lucro", "Percentual (%)", "Valor Unitário (R$)", "Valor Total (R$)"]);
    header6.eachCell(c => c.font = headerFont);

    let valTotal6 = 0;
    let totTotal6 = 0;

    // custos indiretos A
    if (dados.encargosPercentuais.custosIndiretos !== undefined) {
        const pctCustosIndiretos = Number(dados.encargosPercentuais.custosIndiretos || 0);
        let valorCustosIndiretos = somModulos1a5 * pctCustosIndiretos;
        valorCustosIndiretos = roundTo2(valorCustosIndiretos);
        const totalCustosIndiretos = valorCustosIndiretos * dados.quantidade;
        sheet.addRow(["A", "Custos Indiretos", `${(pctCustosIndiretos * 100).toFixed(2)}%`, valorCustosIndiretos, totalCustosIndiretos]);
        valTotal6 += valorCustosIndiretos;
        totTotal6 += totalCustosIndiretos;
    }

    // lucro B
    const pctLucro = Number(dados.encargosPercentuais.lucro || 0);
    let valorLucro = (somModulos1a5 - valTotal23) * pctLucro;
    valorLucro = roundTo2(valorLucro);
    const totalLucro = valorLucro * dados.quantidade;
    sheet.addRow(["B", "Lucro", `${(pctLucro * 100).toFixed(2)}%`, valorLucro, totalLucro]);
    valTotal6 += valorLucro;
    totTotal6 += totalLucro;

    // tributos C (somatório): ARRED((cofins + pis + issqn) / (1 - (cofins + pis + issqn)); 4)
    const pctConfinsSomatorio = Number(dados.encargosPercentuais.confins || 0);
    const pctPisSomatorio = Number(dados.encargosPercentuais.pis || 0);
    const pctIssqnSomatorio = Number(dados.encargosPercentuais.issqn || 0);
    const somaTributos = pctConfinsSomatorio + pctPisSomatorio + pctIssqnSomatorio;
    const pctTributos = somaTributos >= 1
        ? 0
        : Math.round((((somaTributos) / (1 - somaTributos)) + Number.EPSILON) * 10000) / 10000;
    let valorTributos = 0;
    valorTributos = roundTo2(valorTributos);
    const totalTributos = valorTributos * dados.quantidade;
    sheet.addRow(["C", "Tributos", `${(pctTributos * 100).toFixed(2)}%`, valorTributos, totalTributos]);
    valTotal6 += valorTributos;
    totTotal6 += totalTributos;


    // confins
    if (dados.encargosPercentuais.confins !== undefined) {
        const pctConfins = Number(dados.encargosPercentuais.confins || 0);
        let valorConfins = 0;
        valorConfins = roundTo2(valorConfins);
        const totalConfins = valorConfins * dados.quantidade;
        sheet.addRow(["", "C.1. Tributo Federal (COFINS)", `${(pctConfins * 100).toFixed(2)}%`, valorConfins, totalConfins]);
        valTotal6 += valorConfins;
        totTotal6 += totalConfins;
    }

    // pis
    if (dados.encargosPercentuais.pis !== undefined) {
        const pctPis = Number(dados.encargosPercentuais.pis || 0);
        let valorPis = 0;
        valorPis = roundTo2(valorPis);
        const totalPis = valorPis * dados.quantidade;
        sheet.addRow(["", "C.2. Tributo Federal (PIS)", `${(pctPis * 100).toFixed(2)}%`, valorPis, totalPis]);
        valTotal6 += valorPis;
        totTotal6 += totalPis;
    }

    // issqn
    if (dados.encargosPercentuais.issqn !== undefined) {
        const pctIssqn = Number(dados.encargosPercentuais.issqn || 0);
        let valorIssqn = 0;
        valorIssqn = roundTo2(valorIssqn);
        const totalIssqn = valorIssqn * dados.quantidade;
        sheet.addRow(["", "C.3. Tributos Municipais (ISSQN)", `${(pctIssqn * 100).toFixed(2)}%`, valorIssqn, totalIssqn]);
        valTotal6 += valorIssqn;
        totTotal6 += totalIssqn;
    }

    // tributosValeAlimentacao
    if (dados.encargosPercentuais.tributosValeAlimentacao !== undefined) {
        const pcttributosValeAlimentacao = Number(dados.encargosPercentuais.tributosValeAlimentacao || 0); /**FAZER LOGICA AQUI */
        let valortributosValeAlimentacao = valorVA * pcttributosValeAlimentacao;
        valortributosValeAlimentacao = roundTo2(valortributosValeAlimentacao);
        const totaltributosValeAlimentacao = valortributosValeAlimentacao * dados.quantidade;
        sheet.addRow(["D", "Tributos sobre Vale Alimentação", `${(pcttributosValeAlimentacao * 100).toFixed(2)}%`, valortributosValeAlimentacao, totaltributosValeAlimentacao]);
        valTotal6 += valortributosValeAlimentacao;
        totTotal6 += totaltributosValeAlimentacao;
    }

    // tributosMunicipais
    if (dados.encargosPercentuais.tributosMunicipais !== undefined) {
        const pctTributosMunicipais = Number(dados.encargosPercentuais.tributosMunicipais || 0);
        const valorTributosMunicipais = 0;
        const totalTributosMunicipais = valorTributosMunicipais * dados.quantidade;
        sheet.addRow(["", "D.1. Tributos Municipais (especificar)", `${(pctTributosMunicipais * 100).toFixed(2)}%`, valorTributosMunicipais, totalTributosMunicipais]);
        valTotal6 += valorTributosMunicipais;
        totTotal6 += totalTributosMunicipais;
    }

    // Total
    const rowTotal6 = sheet.addRow(["Total", "", "", valTotal6, totTotal6]);
    sheet.mergeCells(`A${rowTotal6.number}:B${rowTotal6.number}`);
    rowTotal6.getCell(1).font = headerFont;
    addSpacerRow();


    //quadro resumo 
    const moduloQuadroResumo = sheet.addRow(["2. QUADRO-RESUMO DO CUSTO POR EMPREGADO"]);
    sheet.mergeCells(`A${moduloQuadroResumo.number}:E${moduloQuadroResumo.number}`);
    applyStyle(moduloQuadroResumo, styles.mod);
    addSpacerRow();

    //cabecalho modulo QuadroResumo
    const headerQuadroResumo = sheet.addRow(["", "Mão de obra vinculada à execução contratual (valor por empregado)", "", "Valor Unitário (R$)", "Valor Total (R$)"]);
    headerQuadroResumo.eachCell(c => c.font = headerFont);


    sheet.addRow(["A", "Módulo 1 - Composição da Remuneração", "", salarioFinal, salarioFinal * dados.quantidade]);
    sheet.addRow(["B", "Módulo 2 - Encargos e Benefícios Anuais, Mensais e Diários", "", quadroValorTotal, quadroValorTotal * dados.quantidade]);
    sheet.addRow(["C", "Módulo 3 - Provisão para Rescisão", "", valTotal3, valTotal3 * dados.quantidade]);
    sheet.addRow(["D", "Módulo 4 - Custo de Reposição do Profissional Ausente", "", valTotal4, valTotal4 * dados.quantidade]);
    sheet.addRow(["E", "Módulo 5 - Insumos Diversos", "", valTotal5, valTotal5 * dados.quantidade]);
    const rSub = sheet.addRow(["", "Subtotal (A + B + C + D + E)", "", somModulos1a5, somModulos1a5 * dados.quantidade]);
    rSub.eachCell(c => c.font = headerFont);
    sheet.addRow(["F", "Módulo 6 - Custos Indiretos, Tributos e Lucro", "", valTotal6, totTotal6]);

    const quadroResumoFinalValorTotal = somModulos1a5 + valTotal6;
    const quadroResumoFinalTotTotal = (salarioFinal * dados.quantidade) + quadroTotTotal + totTotal3 + totTotal4 + totTotal5 + totTotal6;

    //total do quadro resumo final
    const quadroResumoFinalTotal = sheet.addRow(["Valor Total", "", "", quadroResumoFinalValorTotal, quadroResumoFinalTotTotal]);
    sheet.mergeCells(`A${quadroResumoFinalTotal.number}:B${quadroResumoFinalTotal.number}`);
    quadroResumoFinalTotal.eachCell(c => c.font = headerFont);

    const qrTotalMeses = quadroResumoFinalValorTotal * dados.vigencia;

    const quadroResumoFinalTotalMeses = sheet.addRow([`Valor Total (${dados.vigencia} meses)`, "", "", qrTotalMeses, qrTotalMeses * dados.quantidade]);
    sheet.mergeCells(`A${quadroResumoFinalTotalMeses.number}:B${quadroResumoFinalTotalMeses.number}`);
    quadroResumoFinalTotalMeses.eachCell(c => c.font = headerFont);
    addSpacerRow();




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
                const isHeaderFont =
                    cell.font?.bold === true &&
                    cell.font?.name === headerFont.name &&
                    cell.font?.size === headerFont.size;

                const isTitleFont =
                    cell.font?.bold === true &&
                    cell.font?.name === titleFont.name &&
                    cell.font?.size === titleFont.size;

                // Keep header cells centered while applying vertical alignment globally.
                if (isHeaderFont || isTitleFont) {
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                } else {
                    cell.alignment = { vertical: 'middle' };
                }

                if (col === 4) {
                    if (typeof cell.value === 'number') {
                        cell.value = roundTo2(cell.value);
                        cell.numFmt = formatoContabil;
                    }
                }
                if (col === 5) {
                    if (typeof cell.value === 'number') {
                        cell.numFmt = formatoContabil;
                    }
                }
                if (col === 3) {
                    let colunaCConvertidaParaPercentual = false;
                    if (typeof cell.value === 'string') {
                        const percentualTexto = cell.value.trim();
                        const percentualMatch = percentualTexto.match(/^(-?\d+(?:[.,]\d+)?)%$/);
                        if (percentualMatch) {
                            const percentualNormalizado = percentualMatch[1].replace(',', '.');
                            const percentualNumero = Number(percentualNormalizado);
                            if (!Number.isNaN(percentualNumero)) {
                                cell.value = percentualNumero / 100;
                                cell.numFmt = '0.00%';
                                colunaCConvertidaParaPercentual = true;
                            }
                        }

                        // Valores sem '%' na coluna C devem permanecer numéricos inteiros.
                        if (!colunaCConvertidaParaPercentual) {
                            const inteiroMatch = percentualTexto.match(/^-?\d+$/);
                            if (inteiroMatch) {
                                cell.value = Number(percentualTexto);
                                cell.numFmt = '0';
                            }
                        }
                    } else if (typeof cell.value === 'number') {
                        cell.numFmt = '0';
                    }
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
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
