    import express from "express";
    //import bodyParser from "body-parser";
    import fs from "fs";
    import path from "path";
        import cors from "cors";
        import { gerarPlanilha } from "./utils/gerarPlanilha.js";


    const app = express();
    app.use(cors());
    app.use(express.json());
    //app.use(helmelt()); deixar aqui caso suba p web
    //app.use(bodyParser.json());   
    //app.use(express.static("public"));  serve o front, ver se faz sentido ter essa linha


    app.post("/gerar-planilha", async (req, res) => {
    try {
        const dados = req.body; 
        const caminhoArquivo = await gerarPlanilha(dados);  
    
     res.download(caminhoArquivo, path.basename(caminhoArquivo), (err) => {
      if (err) {
        console.error('Erro no download:', err);
        if (!res.headersSent) res.status(500).send('Erro ao enviar arquivo');
      }
      // remove assincronamente 
      fs.unlink(caminhoArquivo, (unlinkErr) => {
        if (unlinkErr) console.error('Erro ao remover tmp:', unlinkErr);
      });
    });


    } catch (error) {
        console.error( error);
       // res.status(500).send("Erro ao gerar planilha");
        if (!res.headersSent) res.status(500).send('Erro ao gerar planilha');

    }
    });
        
    const PORT = 3000;
    app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

    print(gerarPlanilha());
    
