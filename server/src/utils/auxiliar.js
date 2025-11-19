// // server/src/utils/gerarPlanilha.js
// // Utilitários para gerar planilhas Excel (.xlsx) a partir de um payload
// // - fornece duas funções exportadas:
// //   * gerarPlanilha(dados, opts): retorna { buffer, nomeArquivo } com o .xlsx em memória
// //   * gerarPlanilhaToFile(dados, opts): grava o .xlsx em um arquivo temporário e retorna o caminho
// //
// // Expectativa de formato do `dados` (exemplo):
// // {
// //   salarioBase: '2500',              // opcional: número/str
// //   salarioMinimo: '1400',            // opcional
// //   multisearch: [                     // array de itens (cada item representa uma linha)
// //     { item: 'Insalubridade', fields: ['1','', '20'] },
// //     { item: 'Periculosidade', fields: ['1',''] }
// //   ]
// // }
// //
// // Observações/assunções:
// // - O código tenta inferir valores a partir de `multisearch` se campos top-level não existirem.
// // - Não lança erros em caso de dados faltantes; usa NaN ou string vazia nas células quando apropriado.
// // - Formata colunas de moeda para 'R$' no .xlsx.
// //
// // Dependências: exceljs (para gerar o arquivo), Node 14+/16+ para APIs modernas (fs/promises, crypto.randomUUID)
// import ExcelJS from 'exceljs';
// import os from 'os';
// import path from 'path';
// import fs from 'fs/promises';
// import { randomUUID } from 'crypto';

// /**
//  * Tenta converter uma entrada (string/número) em Number.
//  * - Aceita vírgula como separador decimal (ex: "1.234,56" ou "1234,56").
//  * - Remove espaços e caracteres não numéricos exceto '.' e '-'.
//  * - Retorna NaN quando não for possível parsear.
//  *
//  * Usar essa função garante tolerância a entradas de formulários que venham com símbolos
//  * ou formatação local (vírgula decimal).
//  */
// function parseNumber(v){
//   if (v == null || v === '') return NaN;
//   // aceita strings com vírgula
//   const s = String(v).replace(/\s+/g, '').replace(',', '.').replace(/[^\d.-]/g,'');
//   const n = Number(s);
//   return Number.isFinite(n) ? n : NaN;
// }

// /**
//  * Procura em `multisearch` um item cujo campo `item` contenha qualquer uma das substrings
//  * fornecidas em `nameMatches` (comparação case-insensitive).
//  *
//  * Uso típico: findItem(ms, ['salário-base','salario base']) para localizar o item do salário.
//  */
// function findItem(multisearch = [], nameMatches = []) {
//   // nameMatches: array of substrings to match case-insensitive, e.g. ['salário-base','salario-base']
//   const lowMatches = nameMatches.map(m => m.toLowerCase());
//   for (const m of multisearch || []) {
//     const itemName = String(m.item || '').toLowerCase();
//     if (lowMatches.some(sub => itemName.includes(sub))) return m;
//   }
//   return null;
// }

// /**
//  * Gera um workbook Excel (em memória) com base nos `dados`.
//  * - dados: payload com `multisearch` (array de itens) e possivelmente `salarioBase`/`salarioMinimo`.
//  * - opts: { salarioMinimoOverride: number, nomeArquivoPrefix: string }
//  *
//  * Retorna: { buffer, nomeArquivo }
//  * - buffer: ArrayBuffer/Buffer do .xlsx (pronto para envio HTTP ou gravação em disco)
//  * - nomeArquivo: sugestão de nome para download
//  */
// export async function gerarPlanilha(dados = {}, opts = {}) {
//   // opts: { salarioMinimoOverride: number, nomeArquivoPrefix: 'planilha' }
//   const ms = Array.isArray(dados.multisearch) ? dados.multisearch : [];
//   // tenta extrair salarioBase: prioridade: dados.salarioBase top-level -> item 'Salário-Base' valueUnitário -> item quant/valor
//   let salarioBase = parseNumber(dados.salarioBase);
//   if (!Number.isFinite(salarioBase)) {
//     const sbItem = findItem(ms, ['salário-base','salario-base','salario base']);
//     if (sbItem && Array.isArray(sbItem.fields)) {
//       // valor unitário costuma estar em index 1
//       salarioBase = parseNumber(sbItem.fields[1]) || parseNumber(sbItem.fields[0]);
//     }
//   }
//   if (!Number.isFinite(salarioBase)) {
//     // não vou lançar erro automaticamente; deixo como NaN e alguns cálculos que dependem dele serão ignorados
//     salarioBase = NaN;
//   }

//   // salario minimo: pode vir no payload ou via opção
//   let salarioMinimo = Number.isFinite(parseNumber(dados.salarioMinimo)) ? parseNumber(dados.salarioMinimo) : undefined;
//   if (!salarioMinimo && Number.isFinite(opts.salarioMinimoOverride)) salarioMinimo = opts.salarioMinimoOverride;
//   // se ainda não tem, coloca um valor padrão razoável (você pode passar real via payload)
//   if (!salarioMinimo) salarioMinimo = 1400.00; // ajuste conforme sua realidade; prefer passar pelo payload

//   // Constrói workbook
//   const workbook = new ExcelJS.Workbook();
//   workbook.creator = 'Forms-de-Precificacao';
//   const sheet = workbook.addWorksheet('Formação de Preços');

//   // Define colunas (usar chave facilita addRow com objetos)
//   sheet.columns = [
//     { header: 'Item', key: 'item', width: 40 },
//     { header: 'Quantidade', key: 'quantidade', width: 12 },
//     { header: 'Valor Unitário (R$)', key: 'valorUnitario', width: 18 },
//     { header: 'Valor Total (R$)', key: 'valorTotal', width: 18 }
//   ];

//   // Função auxiliar para formatar número de moeda
//   function fmtNum(n){ return Number.isFinite(n) ? Number(n).toFixed(2) : ''; }

//   // percorre os itens recebidos e calcula valores respeitando suas regras
//   const rows = [];
//   for (const m of ms) {
//     const name = String(m.item || '');
//     const fields = Array.isArray(m.fields) ? m.fields : [];
//     const quantidade = Number.isFinite(parseNumber(fields[0])) ? parseNumber(fields[0]) : 1;
//     let valorUnitario = parseNumber(fields[1]); // prefer valor unitário informado
//     const percentualRaw = parseNumber(fields[2]); // se usuário inseriu percentual (ex: 9.16 = 9.16%)
//     // Regras específicas:
//     const low = name.toLowerCase();

//     if (low.includes('periculosidade')) {
//       // sempre 30% do salario base (se disponível)
//       if (Number.isFinite(salarioBase)) {
//         valorUnitario = salarioBase * 0.30;
//       } else {
//         // sem salário base, mantemos valor informado (se houver) ou NaN
//         valorUnitario = Number.isFinite(valorUnitario) ? valorUnitario : NaN;
//       }
//     } else if (low.includes('insalubridade')) {
//       // Insalubridade: 20% ou 40% do salário mínimo. Se percent fornecido (20 ou 40) usa, senão assume 20
//       const pct = (Number.isFinite(percentualRaw) ? percentualRaw : 20);
//       valorUnitario = salarioMinimo * (pct / 100);
//     } else {
//       // regra genérica:
//       if (!Number.isFinite(valorUnitario)) {
//         // se não tem valor unitário mas tem percentual, aplicamos sobre salário base (se houver)
//         if (Number.isFinite(percentualRaw) && Number.isFinite(salarioBase)) {
//           valorUnitario = salarioBase * (percentualRaw / 100);
//         } else {
//           // sem info, deixa em branco (NaN)
//           valorUnitario = NaN;
//         }
//       }
//     }

//     const valorTotal = (Number.isFinite(valorUnitario) && Number.isFinite(quantidade)) ? (valorUnitario * quantidade) : NaN;

//     rows.push({
//       item: name,
//       quantidade: Number.isFinite(quantidade) ? quantidade : '',
//       valorUnitario: Number.isFinite(valorUnitario) ? Number(valorUnitario) : '',
//       valorTotal: Number.isFinite(valorTotal) ? Number(valorTotal) : ''
//     });
//   }

//   // Adiciona cabeçalho (já está definido por sheet.columns) e linhas
//   sheet.addRows(rows);

//   // Opções de formatação de cabeçalho (negrito)
//   const headerRow = sheet.getRow(1);
//   headerRow.eachCell(cell => {
//     cell.font = { bold: true };
//     cell.alignment = { vertical: 'middle', horizontal: 'center' };
//   });

//   // Formatação das colunas monetárias
//   // coluna 3 e 4
//   sheet.getColumn('valorUnitario').numFmt = '"R$"#,##0.00;[Red]-"R$"#,##0.00';
//   sheet.getColumn('valorTotal').numFmt = '"R$"#,##0.00;[Red]-"R$"#,##0.00';

//   // Eventual soma total (opcional) na última linha
//   const lastRow = sheet.lastRow.number + 1;
//   sheet.getCell(`C${lastRow}`).value = 'Total';
//   sheet.getCell(`C${lastRow}`).font = { bold: true };
//   const totalRangeStart = 2;
//   const totalRangeEnd = sheet.lastRow.number;
//   // soma da coluna D (valorTotal)
//   sheet.getCell(`D${lastRow}`).value = { formula: `SUM(D${totalRangeStart}:D${totalRangeEnd})` };
//   sheet.getCell(`D${lastRow}`).numFmt = '"R$"#,##0.00;[Red]-"R$"#,##0.00';
//   sheet.getCell(`D${lastRow}`).font = { bold: true };

//   // Gera buffer e devolve junto com nome sugerido
//   const buffer = await workbook.xlsx.writeBuffer();
//   const nomeArquivo = `${opts.nomeArquivoPrefix || 'planilha'}_${Date.now()}.xlsx`;
//   return { buffer, nomeArquivo };
// }

// export async function gerarPlanilhaToFile(dados = {}, opts = {}) {
//   // grava buffer em file temporário e retorna caminho absoluto
//   const { buffer, nomeArquivo } = await gerarPlanilha(dados, opts);
//   const tmpDir = opts.tmpDir || os.tmpdir();
//   const fileName = `${nomeArquivo.replace(/\s+/g,'_')}`;
//   const fullPath = path.join(tmpDir, `${randomUUID()}_${fileName}`);
//   await fs.writeFile(fullPath, buffer);
//   return fullPath; // path absoluto
// }