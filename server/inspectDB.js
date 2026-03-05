import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.resolve('src/database/database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erro abrindo DB:', err.message);
    process.exit(1);
  }
});

db.serialize(() => {
  console.log('DB:', dbPath);

  db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", (err, tables) => {
    if (err) return console.error('Erro listando tabelas:', err.message);
    console.log('\nTabelas:');
    tables.forEach(t => console.log('-', t.name));

    const checks = [
      { q: 'SELECT COUNT(*) AS cnt FROM cargos', name: 'cargos' },
      { q: 'SELECT COUNT(*) AS cnt FROM encargos', name: 'encargos' },
      { q: 'SELECT COUNT(*) AS cnt FROM valores', name: 'valores' }
    ];

    let i = 0;
    function next() {
      if (i >= checks.length) return printSamples();
      const item = checks[i++];
      db.get(item.q, (e, row) => {
        if (e) console.log(item.name + ': error');
        else console.log(item.name + ':', row.cnt);
        next();
      });
    }

    function printSamples() {
      console.log('\nAmostras:');
      db.all('SELECT * FROM cargos LIMIT 5', (e1, cargos) => {
        if (!e1) {
          console.log('\ncargos:');
          console.table(cargos);
        }
        db.all('SELECT * FROM encargos', (e2, encargos) => {
          if (!e2) {
            console.log('\nencargos:');
            console.table(encargos);
          }
          console.log('\n')
          db.all('SELECT * FROM valores LIMIT 10', (e3, valores) => {
            if (!e3) {
              console.log('\nvalores:');
              console.table(valores);
            }
            db.close();
          });
        });
      });
    }

    next();
  });
});
