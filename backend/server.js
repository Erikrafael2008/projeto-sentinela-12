const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();

app.use(express.json());
app.use(cors());

app.use(express.static(path.join(__dirname, "../frontend")));

const DB_FILE = path.join(__dirname, "db.json");

function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    return {
      usuarios: [],
      pacientes: [],
      triagens: [],
      consultas: [],
      tv_chamada: null,
      tv_historico: [],
      altas: []
    };
  }

  const db = JSON.parse(fs.readFileSync(DB_FILE));

  if (!db.tv_chamada) db.tv_chamada = null;
  if (!db.tv_historico) db.tv_historico = [];
  if (!db.altas) db.altas = [];

  return db;
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}


// =====================================================
// LOGIN
// =====================================================

app.post("/login", (req, res) => {
  const db = readDB();

  const user = db.usuarios.find(u =>
    u.usuario === req.body.usuario &&
    u.senha === req.body.senha
  );

  if (!user) {
    return res.status(401).json({
      erro: "Login inválido"
    });
  }

  res.json(user);
});


// =====================================================
// ATENDIMENTO - CADASTRAR PACIENTE
// =====================================================

app.post("/atendimento", (req, res) => {
  const db = readDB();

  const paciente = {
    id: Date.now(),
    nome: req.body.nome,
    cpf: req.body.cpf,
    tipo: req.body.tipo,
    status: "triagem",
    createdAt: new Date()
  };

  db.pacientes.push(paciente);

  writeDB(db);

  res.json(paciente);
});


// =====================================================
// LISTAR PACIENTES
// =====================================================

app.get("/pacientes", (req, res) => {
  const db = readDB();

  res.json(db.pacientes);
});


// =====================================================
// TRIAGEM
// =====================================================

app.post("/triagem", (req, res) => {
  const db = readDB();

  let risco = req.body.risco;

  if (req.body.temperatura >= 39) {
    risco = "vermelho";
  } else if (req.body.temperatura >= 38) {
    risco = "amarelo";
  } else if (!risco) {
    risco = "verde";
  }

  const triagem = {
    id: Date.now(),
    nome: req.body.nome,
    sintoma: req.body.sintoma,
    temperatura: req.body.temperatura,
    alergia: req.body.alergia,
    observacao: req.body.observacao,
    risco,
    status: "aguardando_medico",
    createdAt: new Date()
  };

  db.triagens.push(triagem);

  writeDB(db);

  res.json(triagem);
});


// =====================================================
// LISTAR TRIAGENS
// =====================================================

app.get("/triagens", (req, res) => {
  const db = readDB();

  res.json(db.triagens);
});


// =====================================================
// MÍDIA INDOOR - TV
// =====================================================

app.post("/tv/chamar", (req, res) => {
  const db = readDB();

  const chamada = {
    id: Date.now().toString(),
    localTipo: req.body.localTipo,
    localNumero: req.body.localNumero,
    paciente: req.body.paciente,
    hora: new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit"
    })
  };

  db.tv_chamada = chamada;

  db.tv_historico.unshift(chamada);

  if (db.tv_historico.length > 5) {
    db.tv_historico.pop();
  }

  writeDB(db);

  res.json(chamada);
});


app.get("/tv/chamada", (req, res) => {
  const db = readDB();

  res.json({
    chamada: db.tv_chamada,
    historico: db.tv_historico
  });
});


// =====================================================
// LISTA DE MEDICAÇÕES
// =====================================================

app.get("/lista-medicacoes", (req, res) => {
  res.json([
    "Dipirona",
    "Paracetamol",
    "Ibuprofeno",
    "Amoxicilina",
    "Azitromicina",
    "Loratadina",
    "Omeprazol",
    "Buscopan",
    "Dramin",
    "Soro fisiológico"
  ]);
});


// =====================================================
// CONSULTA
// =====================================================

app.post("/consulta", (req, res) => {
  const db = readDB();

  const consulta = {
    id: Date.now(),
    paciente: req.body.paciente,
    diagnostico: req.body.diagnostico,
    medicacao: req.body.medicacao,
    obs: req.body.obs,
    createdAt: new Date()
  };

  db.consultas.push(consulta);

  writeDB(db);

  res.json(consulta);
});


// =====================================================
// MEDICAÇÕES / CONSULTAS
// =====================================================

app.get("/medicacoes", (req, res) => {
  const db = readDB();

  res.json(db.consultas);
});


// =====================================================
// DAR ALTA
// =====================================================
//
// Essa rota recebe o paciente, diagnóstico,
// medicação e observações.
//
// Atualiza:
// - paciente para "alta"
// - triagem para "alta"
// - cria um registro em "altas"
//
// =====================================================

app.post("/alta", (req, res) => {
  const db = readDB();

  const {
    paciente,
    diagnostico,
    medicacao,
    obs
  } = req.body;

  if (!paciente) {
    return res.status(400).json({
      erro: "Paciente não informado."
    });
  }

  // Procura o paciente pelo nome.
  // Em caso de nomes repetidos, pega o último cadastrado.
  let pacienteEncontrado = null;

  for (let i = db.pacientes.length - 1; i >= 0; i--) {
    if (
      String(db.pacientes[i].nome).trim().toLowerCase() ===
      String(paciente).trim().toLowerCase()
    ) {
      pacienteEncontrado = db.pacientes[i];
      break;
    }
  }

  // Atualiza o status do paciente
  if (pacienteEncontrado) {
    pacienteEncontrado.status = "alta";
    pacienteEncontrado.altaAt = new Date();
  }

  // Atualiza a triagem correspondente
  for (let i = db.triagens.length - 1; i >= 0; i--) {
    if (
      String(db.triagens[i].nome).trim().toLowerCase() ===
      String(paciente).trim().toLowerCase()
    ) {
      db.triagens[i].status = "alta";
      db.triagens[i].altaAt = new Date();
      break;
    }
  }

  // Cria registro da alta
  const alta = {
    id: Date.now(),
    paciente: paciente,
    diagnostico: diagnostico || "",
    medicacao: medicacao || "",
    obs: obs || "",
    data: new Date().toISOString()
  };

  db.altas.push(alta);

  writeDB(db);

  res.json({
    sucesso: true,
    mensagem: "Alta realizada com sucesso.",
    alta: alta
  });
});


// =====================================================
// LISTAR ALTAS
// =====================================================

app.get("/altas", (req, res) => {
  const db = readDB();

  res.json(db.altas);
});


// =====================================================
// SERVIDOR
// =====================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Porta ${PORT}`);
});
