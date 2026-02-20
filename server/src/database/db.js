import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import encargosJSON from './encargos.json' assert { type: 'json' };
import cargosJSON from './cargos.json' assert { type: 'json' };

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
        cargo TEXT NOT NULL,
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



    console.log('Sincronizando encargos e cargos a partir dos JSONs...');

    const insertEncargo = db.prepare(`INSERT OR IGNORE INTO encargos (slug, nome_legivel) VALUES (?, ?)`);
    (encargosJSON || []).forEach(e => {
        insertEncargo.run(e.slug, e.nome_legivel);
    });
    insertEncargo.finalize();

    const insertCargo = db.prepare(`INSERT OR IGNORE INTO cargos (cargo, salario_base, carga_horaria, quantidade_postos, periculosidade, insalubridade, adicional_noturno, reserva_tecnica, vigencia) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    (cargosJSON || []).forEach(c => {
        const salario = c.salario_base ? Number(String(c.salario_base).replace(/,/g, '.')) : null;
        const temPerc = Number(c.periculosidade) > 0 ? 1 : 0;
        const temIns = Number(c.insalubridade) > 0 ? 1 : 0;
        const temAdcN = Number(c.adicional_noturno) > 0 ? 1 : 0;
        const reservaT = c.reserva_tecnica ? Number(String(c.reserva_tecnica).replace(/,/g, '.')) : 0;
        insertCargo.run(c.cargo, c.carga_horaria, c.quantidade_postos, salario, temPerc, temIns, temAdcN, reservaT, c.vigencia);
    });
    insertCargo.finalize();

    // 3. SEED: popula `valores` com valor = 0.0 para cada combinação cargo x encargo (boas práticas: garante existência e unicidade)
    db.all(`SELECT id FROM cargos`, (err, cargosRows) => {
        if (err) return console.error('Erro lendo cargos:', err);
        db.all(`SELECT slug FROM encargos`, (err2, encargosRows) => {
            if (err2) return console.error('Erro lendo encargos:', err2);
            // popular com NULL para indicar 'não inicializado' ao invés de 0.0
            const insertValor = db.prepare(`INSERT OR IGNORE INTO valores (percentual, cargo_id, slug) VALUES (?, ?, ?)`);
            cargosRows.forEach(cr => {
                encargosRows.forEach(er => {
                    insertValor.run(null, cr.id, er.slug);
                });
            });
            insertValor.finalize();
        });
    });
});
  

export default db;