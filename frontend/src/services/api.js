const API_URL = (
  process.env.REACT_APP_API_URL || 'http://localhost:8000'
).replace(/\/$/, '');

async function lerJson(response) {
  const texto = await response.text();

  if (!texto) {
    return null;
  }

  try {
    return JSON.parse(texto);
  } catch {
    return null;
  }
}

async function tratarResposta(response) {
  const dados = await lerJson(response);

  if (!response.ok) {
    const mensagem =
      dados && typeof dados.erro === 'string'
        ? dados.erro
        : `Não foi possível concluir a solicitação (${response.status}).`;

    const erro = new Error(mensagem);
    erro.status = response.status;
    throw erro;
  }

  return dados;
}

export async function criarAgendamento(dados) {
  const response = await fetch(`${API_URL}/agendamento`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(dados),
  });

  return tratarResposta(response);
}

export async function listarAgendamentos({ signal } = {}) {
  const response = await fetch(`${API_URL}/agenda`, { signal });

  return tratarResposta(response);
}

export async function removerAgendamento({ dia, horario }) {
  const response = await fetch(`${API_URL}/remover`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      dia: String(dia),
      horario: String(horario),
    }),
  });

  return tratarResposta(response);
}

export async function editarAgendamento({
  diaOriginal,
  horarioOriginal,
  titulo,
  dia,
  horario,
}) {
  const response = await fetch(`${API_URL}/editar`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      diaOriginal: String(diaOriginal),
      horarioOriginal: String(horarioOriginal),
      titulo: String(titulo),
      dia: String(dia),
      horario: String(horario),
    }),
  });

  return tratarResposta(response);
}
