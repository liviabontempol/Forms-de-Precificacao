import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, 'src/database/database.sqlite');

const sqlite = sqlite3.verbose();
const db = new sqlite.Database(dbPath, (err) => {
    if (err) {
        console.error('Erro ao conectar:', err.message);
        process.exit(1);
    }
});

console.log('VISUALIZANDO TABELA VALORES POR CARGO\n');
console.log('='.repeat(100));

const query = `
    SELECT 
        c.id as cargo_id,
        c.cargo,
        c.carga_horaria,
        c.quantidade_postos,
        c.salario_base,
        c.periculosidade,
        c.insalubridade,
        c.adicional_noturno,
        c.reserva_tecnica,
        c.vigencia,
        e.slug,
        e.nome_legivel,
        v.percentual
    FROM cargos c
    LEFT JOIN valores v ON c.id = v.cargo_id
    LEFT JOIN encargos e ON v.slug = e.slug
    ORDER BY c.cargo, e.slug
`;

db.all(query, [], (err, rows) => {
    if (err) {
        console.error('Erro na consulta:', err.message);
        db.close();
        return;
    }

    if (rows.length === 0) {
        console.log('Nenhum dado encontrado.');
        db.close();
        return;
    }

    let cargoAtual = null;
    let totalCargos = 0;
    let totalEncargos = 0;

    rows.forEach((row) => {
        // Quando muda de cargo, exibe o cabeçalho
        if (cargoAtual !== row.cargo) {
            if (cargoAtual !== null) {
                console.log('\n' + '─'.repeat(100));
            }
            
            cargoAtual = row.cargo;
            totalCargos++;
            
            console.log(`\n🔹 CARGO: ${row.cargo} (ID: ${row.cargo_id})`);
            console.log(`   Carga Horária: ${row.carga_horaria}h | Postos: ${row.quantidade_postos} | Salário Base: R$ ${row.salario_base ? row.salario_base.toFixed(2) : '0.00'}`);
            console.log(`   Periculosidade: ${row.periculosidade ? 'Sim' : 'Não'} | Insalubridade: ${row.insalubridade ? 'Sim' : 'Não'} | Adicional Noturno: ${row.adicional_noturno ? 'Sim' : 'Não'}`);
            console.log(`   Reserva Técnica: ${row.reserva_tecnica || 0}% | Vigência: ${row.vigencia} meses`);
            console.log('\n   ENCARGOS E VALORES:');
            console.log('   ' + '─'.repeat(96));
        }

        // Exibe os valores/encargos do cargo
        if (row.slug) {
            totalEncargos++;
            const percentual = row.percentual ? row.percentual.toFixed(3)  : '0.00% ';
            console.log(`   • ${row.slug.padEnd(35)} | ${row.nome_legivel.padEnd(40)} | ${percentual.padStart(8)}`);
        }
    });

    console.log('\n' + '='.repeat(100));
    console.log(`\n📈 RESUMO:`);
    console.log(`   • Total de cargos: ${totalCargos}`);
    console.log(`   • Total de registros de encargos: ${totalEncargos}`);
    console.log('');

    db.close((err) => {
        if (err) console.error('❌ Erro ao fechar banco:', err.message);
    });
});
