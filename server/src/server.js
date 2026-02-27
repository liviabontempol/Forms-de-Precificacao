import express from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import { gerarPlanilha } from './utils/gerarPlanilha.js';
import db from './database/db.js';

const app = express();
app.use(cors());
app.use(express.json());
//app.use(helmelt()); deixar aqui caso suba p web
//app.use(express.static("public"));  serve o front, ver se faz sentido ter essa linha


function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

async function obterDadosDoBD(cargoId) {
  const cargo = await dbGet('SELECT * FROM cargos WHERE id = ?', [cargoId]);
  if (!cargo) return null;

  const valores = await dbAll('SELECT slug, percentual FROM valores WHERE cargo_id = ?', [cargoId]);

  const encargosPercentuais = {};
  valores.forEach(v => {
    encargosPercentuais[v.slug] = v.percentual ?? 0;
  });

  return {
    cargo: cargo.cargo,
    jornada: cargo.carga_horaria,
    quantidade: cargo.quantidade_postos,
    salarioBase: cargo.salario_base,
    periculosidade: !!cargo.periculosidade,
    insalubridade: cargo.insalubridade ?? 0,
    adicionalNoturno: !!cargo.adicional_noturno,
    reservaTecnica: cargo.reserva_tecnica ?? 0,
    vigencia: cargo.vigencia ?? 0,
    encargosPercentuais
  };
}



app.get('/cargos', (req, res) => {
  db.all('SELECT * FROM cargos', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows)
  });
});

app.get('/rubricas', (req, res) => {
  db.all('SELECT * FROM encargos', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows)
  });
});

app.get('/valores', (req, res) => {
  const { cargo_id } = req.query;
  const sql = cargo_id ? 'SELECT * FROM valores WHERE cargo_id = ?' : 'SELECT * FROM valores';
  const params = cargo_id ? [cargo_id] : [];
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.put('/valores', (req, res) => {
  const { cargo_id, slug, percentual } = req.body;
  if (!cargo_id || !slug) return res.status(400).json({ error: 'cargo_id and slug are required' });
  const pct = (percentual == null) ? null : Number(String(percentual).replace(',', '.'));
  if (pct !== null && Number.isNaN(pct)) return res.status(400).json({ error: 'percentual inválido' });
  const sql = 'INSERT INTO valores (cargo_id, slug, percentual) VALUES (?, ?, ?) ON CONFLICT (cargo_id,slug) DO UPDATE SET percentual = excluded.percentual';
  db.run(sql, [cargo_id, slug, pct], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    db.get(`SELECT * FROM valores WHERE slug = ? AND cargo_id = ?`, [slug, cargo_id], (e, row) => {
      if (e) return res.status(500).json({ error: e.message });
      res.json(row);
    });
  });
});


app.post('/cargos', (req, res) => {
  const { cargo, salario_base, carga_horaria, quantidade_postos, periculosidade, insalubridade, adicional_noturno, reserva_tecnica, vigencia } = req.body;

  if (typeof cargo !== 'string' || !cargo.trim()) {
    return res.status(400).json({ error: 'cargo is required' });
  }

  const parseNullableNumber = (val) => {
    if (val == null || val === '') return null;
    const n = Number(String(val).replace(',', '.'));
    return Number.isNaN(n) ? NaN : n;
  };

  const salario = parseNullableNumber(salario_base);
  if (salario !== null && Number.isNaN(salario)) return res.status(400).json({ error: 'salario_base inválido' });

  const carga = parseNullableNumber(carga_horaria);
  if (carga !== null && Number.isNaN(carga)) return res.status(400).json({ error: 'carga_horaria inválida' });

  const postos = parseNullableNumber(quantidade_postos);
  if (postos !== null && Number.isNaN(postos)) return res.status(400).json({ error: 'quantidade_postos inválida' });

  const sql = `INSERT INTO cargos (cargo, salario_base, carga_horaria, quantidade_postos, periculosidade, insalubridade, adicional_noturno, reserva_tecnica, vigencia) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  db.run(
    sql,
    [cargo.trim(), salario, carga, postos, periculosidade ? 1 : 0, insalubridade ? 1 : 0,  adicional_noturno ? 1 : 0,  reserva_tecnica ?? null,  vigencia ?? null,], function (err) {
      if (err) {
        console.error('DB insert cargos error:', err);
        return res.status(500).json({ error: 'db error' });
      }
      db.get('SELECT * FROM cargos WHERE id = ?', [this.lastID], (e, row) => {
        if (e) {
          console.error('DB select cargos error:', e);
          return res.status(500).json({ error: 'db error' });
        }
        res.status(201).json(row);
      });
    }
  );
});



app.post("/gerar-planilha", async (req, res) => {
  try {
    let dados;

    // alteração de um encargo do BD
    if (req.body.cargo_id && req.body.slug && req.body.percentual !== undefined) {
      const dadosBD = await obterDadosDoBD(req.body.cargo_id);
      if (!dadosBD) return res.status(404).json({ error: 'Cargo não encontrado' });

      dadosBD.encargosPercentuais[req.body.slug] = Number(
        String(req.body.percentual).replace(',', '.')
      );
      dados = dadosBD;
    } 
    //input novo
    else if (req.body.cargo && req.body.salarioBase) {
      dados = {
        cargo: req.body.cargo,
        jornada: req.body.carga_horaria ?? 0,
        quantidade: req.body.quantidade_postos ?? 0,
        salarioBase: Number(String(req.body.salarioBase).replace(',', '.')),
        periculosidade: !!req.body.periculosidade,
        insalubridade: req.body.insalubridade ?? 0,
        adicionalNoturno: !!req.body.adicionalNoturno,
        reservaTecnica: req.body.reservaTecnica ?? 0,
        vigencia: req.body.vigencia ?? 0,
        encargosPercentuais: req.body.encargosPercentuais || {}
      };
    } else {
      return res.status(400).json({ error: 'Dados inválidos' });
    }

    const caminhoArquivo = await gerarPlanilha(dados);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, private'
    );
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.download(caminhoArquivo, path.basename(caminhoArquivo), (err) => {
      if (err) {
        console.error('Erro no download:', err);
        if (!res.headersSent) res.status(500).send('Erro ao enviar arquivo');
      }
      fs.unlink(caminhoArquivo, (unlinkErr) => {
        if (unlinkErr) console.error('Erro ao remover tmp:', unlinkErr);
      });
    });

  } catch (error) {
    console.error(error);
    if (!res.headersSent) res.status(500).send('Erro ao gerar planilha');

  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));


