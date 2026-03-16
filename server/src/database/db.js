import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import encargosJSON from './encargos.json' with { type: 'json' };
import cargosJSON from './cargos.json' with { type: 'json' };
import valoresJSON from './valores.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, 'database.sqlite');

const sqlite = sqlite3.verbose();
const db = new sqlite.Database(dbPath, (err) => {
    if (err) console.error('Erro de conexão:', err.message);
    else console.log('Banco de dados conectado.');
});

db.run("PRAGMA foreign_keys = ON");
db.serialize(() => {

    db.run(`CREATE TABLE IF NOT EXISTS cargos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cargo TEXT NOT NULL UNIQUE,
        carga_horaria INTEGER,
        quantidade_postos INTEGER,
        salario_base REAL,
        periculosidade INTEGER DEFAULT 0,
        insalubridade INTEGER DEFAULT 0,
        adicional_noturno INTEGER DEFAULT 0,
        reserva_tecnica REAL,
        vigencia INTEGER
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS encargos (
        slug TEXT PRIMARY KEY, 
        nome_legivel TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS valores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cargo_id INTEGER NOT NULL,
        slug TEXT NOT NULL,
        percentual REAL,
        FOREIGN KEY (cargo_id) REFERENCES cargos(id) ON DELETE CASCADE,
        FOREIGN KEY (slug) REFERENCES encargos(slug) ON DELETE CASCADE,
        UNIQUE(cargo_id, slug)
    )`);

    // Verifica se o banco já foi inicializado
    db.get('SELECT COUNT(*) as count FROM encargos', [], (err, row) => {
        if (err) {
            console.error('Erro ao verificar banco:', err.message);
            return;
        }

        // Se já tem dados, não faz o seed novamente
        if (row.count > 0) {
            console.log('Banco de dados já inicializado. Pulando seed...');
            return;
        }

        console.log('Inicializando banco de dados pela primeira vez...');

        // PASSO 1: Insere todos os encargos
        const insertEncargo = db.prepare(`INSERT OR IGNORE INTO encargos (slug, nome_legivel) VALUES (?, ?)`);
        (encargosJSON || []).forEach(e => {
            insertEncargo.run(e.slug, e.nome_legivel);
        });
        
        // PASSO 2: Só insere cargos DEPOIS que os encargos foram finalizados
        insertEncargo.finalize(() => {
            const insertCargo = db.prepare(`INSERT OR IGNORE INTO cargos 
            (cargo, carga_horaria, quantidade_postos, salario_base, periculosidade, insalubridade, adicional_noturno, reserva_tecnica, vigencia) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
            (cargosJSON || []).forEach(c => {
                const salario = c.salario_base ? Number(String(c.salario_base).replace(/,/g, '.')) : null;
                const temPerc = Number(c.periculosidade) > 0 ? 1 : 0;
                const temIns = Number(c.insalubridade) > 0 ? 1 : 0;
                const temAdcN = Number(c.adicional_noturno) > 0 ? 1 : 0;
                const reservaT = c.reserva_tecnica ? Number(String(c.reserva_tecnica).replace(/,/g, '.')) : 0;
                insertCargo.run(c.cargo, c.carga_horaria, c.quantidade_postos, salario, temPerc, temIns, temAdcN, reservaT, c.vigencia);
            });

            // PASSO 3: Só insere valores DEPOIS que os cargos foram finalizados
            insertCargo.finalize(() => {
            const insertValor = db.prepare(`
            INSERT INTO valores (cargo_id, slug, percentual) 
            VALUES (?, ?, ?)
            ON CONFLICT(cargo_id, slug) DO UPDATE SET percentual = excluded.percentual
        `);

            (cargosJSON || []).forEach(c => {
                // Busca o ID do cargo de forma síncrona dentro do serialize
                db.get(`SELECT id FROM cargos WHERE cargo = ?`, [c.cargo], (err, row) => {
                    if (err) {
                        console.error(`Erro ao buscar cargo ${c.cargo}:`, err.message);
                        return;
                    }
                    if (!row) {
                        console.error(`Cargo não encontrado: ${c.cargo}`);
                        return;
                    }

                    const cargoId = row.id;

                    // Primeiro insere todos os valores padrão
                    const valoresPadrao = valoresJSON[0] || valoresJSON;
                    Object.entries(valoresPadrao).forEach(([slug, percentual]) => {
                        insertValor.run(cargoId, slug, percentual, (err) => {
                            if (err) console.error(`Erro ao inserir valor padrão para ${c.cargo} (${slug}):`, err.message);
                        });
                    });

                    // Depois sobrescreve com valores_distintos se existirem
                    if (c.valores_distintos) {
                        Object.entries(c.valores_distintos).forEach(([slug, percentual]) => {
                            insertValor.run(cargoId, slug, percentual, (err) => {
                                if (err) console.error(`Erro ao inserir valor distinto para ${c.cargo} (${slug}):`, err.message);
                            });
                        });
                    }
                });
            });

            console.log('Comandos de seed enfileirados. Aguardando execução do banco...');
            });
        });
    });
});



export default db;