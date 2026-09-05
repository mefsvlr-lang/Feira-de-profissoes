import './App.scss';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { colunasCalendario } from '../../data/calendario';
import { criarAgendamento, listarAgendamentos } from '../../services/api';

const horarios = Array.from(
  { length: 24 },
  (_, hora) => `${String(hora).padStart(2, '0')}:00`,
);

function Notificacao({ notificacao, onClose }) {
  const { id, tipo, texto } = notificacao;

  useEffect(() => {
    const temporizador = window.setTimeout(() => {
      onClose(id);
    }, 5000);

    return () => window.clearTimeout(temporizador);
  }, [id, onClose]);

  return (
    <div
      className={`notificacao ${tipo}`}
      role={tipo === 'erro' ? 'alert' : 'status'}
      aria-atomic="true"
    >
      <span>{texto}</span>
      <button
        type="button"
        aria-label="Fechar notificação"
        onClick={() => onClose(id)}
      >
        &times;
      </button>
    </div>
  );
}

export default function Agendamentos() {
  const [diaSelecionado, setDiaSelecionado] = useState(null);
  const [horarioSelecionado, setHorarioSelecionado] = useState('');
  const [titulo, setTitulo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [notificacoes, setNotificacoes] = useState([]);
  const [agendamentos, setAgendamentos] = useState([]);
  const [carregandoAgenda, setCarregandoAgenda] = useState(true);
  const proximoIdNotificacao = useRef(0);

  const adicionarNotificacao = useCallback((tipo, texto) => {
    proximoIdNotificacao.current += 1;
    const id = proximoIdNotificacao.current;

    setNotificacoes((atuais) => [...atuais, { id, tipo, texto }]);
  }, []);

  const removerNotificacao = useCallback((id) => {
    setNotificacoes((atuais) =>
      atuais.filter((notificacao) => notificacao.id !== id),
    );
  }, []);

  const carregarAgendamentos = useCallback(async (signal) => {
    setCarregandoAgenda(true);

    try {
      const dados = await listarAgendamentos({ signal });

      if (!Array.isArray(dados)) {
        throw new Error('O backend retornou uma agenda inválida.');
      }

      setAgendamentos(dados);
    } finally {
      if (!signal?.aborted) {
        setCarregandoAgenda(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    carregarAgendamentos(controller.signal).catch((error) => {
      if (error.name !== 'AbortError') {
        adicionarNotificacao(
          'erro',
          error.message ||
            'Não foi possível consultar os horários disponíveis.',
        );
      }
    });

    return () => controller.abort();
  }, [adicionarNotificacao, carregarAgendamentos]);

  const horariosOcupados = new Set(
    agendamentos
      .filter((agendamento) => Number(agendamento.dia) === diaSelecionado)
      .map((agendamento) => String(agendamento.horario).trim()),
  );

  const horariosDisponiveis = horarios.filter(
    (horario) => !horariosOcupados.has(horario),
  );

  const horarioSelecionadoOcupado =
    Boolean(horarioSelecionado) && horariosOcupados.has(horarioSelecionado);

  function selecionarDia(dia) {
    setDiaSelecionado(dia);
    setHorarioSelecionado('');
  }

  function selecionarHorario(hora) {
    if (diaSelecionado === null) {
      adicionarNotificacao(
        'erro',
        'Selecione uma data antes de escolher um horário.',
      );
      return;
    }

    setHorarioSelecionado(hora);
  }

  function alterarMinutos(quantidade) {
    if (!horarioSelecionado) {
      adicionarNotificacao(
        'erro',
        'Selecione um horário antes de ajustar os minutos.',
      );
      return;
    }

    const [hora, minuto] = horarioSelecionado.split(':').map(Number);
    const totalMinutos = hora * 60 + minuto + quantidade;

    if (totalMinutos < 0) {
      adicionarNotificacao(
        'erro',
        'O horário não pode ser anterior a 00:00.',
      );
      return;
    }

    if (totalMinutos >= 24 * 60) {
      adicionarNotificacao(
        'erro',
        'O horário não pode ultrapassar 23:59.',
      );
      return;
    }

    const novoHorario = `${String(Math.floor(totalMinutos / 60)).padStart(
      2,
      '0',
    )}:${String(totalMinutos % 60).padStart(2, '0')}`;

    setHorarioSelecionado(novoHorario);
  }

  async function enviarAgendamento(event) {
    event.preventDefault();

    const tituloNormalizado = titulo.trim();
    const diaAgendado = String(diaSelecionado);
    const horarioAgendado = horarioSelecionado;

    if (!tituloNormalizado || diaSelecionado === null || !horarioSelecionado) {
      adicionarNotificacao(
        'erro',
        'Preencha o título e selecione um dia e um horário.',
      );
      return;
    }

    if (horariosOcupados.has(horarioAgendado)) {
      adicionarNotificacao(
        'erro',
        `O horário ${horarioAgendado} já está agendado para este dia.`,
      );
      return;
    }

    setEnviando(true);

    try {
      const agendamentoCriado = await criarAgendamento({
        titulo: tituloNormalizado,
        dia: diaAgendado,
        horario: horarioAgendado,
      });

      setAgendamentos((atuais) => [...atuais, agendamentoCriado]);
      setTitulo('');
      setDiaSelecionado(null);
      setHorarioSelecionado('');
      adicionarNotificacao(
        'sucesso',
        `Agendamento salvo para o dia ${diaAgendado}, às ${horarioAgendado}.`,
      );
    } catch (error) {
      if (error.status === 409) {
        setAgendamentos((atuais) => {
          const horarioJaRegistrado = atuais.some(
            (agendamento) =>
              Number(agendamento.dia) === Number(diaAgendado) &&
              String(agendamento.horario).trim() === horarioAgendado,
          );

          if (horarioJaRegistrado) {
            return atuais;
          }

          return [
            ...atuais,
            { titulo: '', dia: diaAgendado, horario: horarioAgendado },
          ];
        });
        setHorarioSelecionado('');
      }

      adicionarNotificacao(
        'erro',
        error.message || 'Não foi possível salvar o agendamento.',
      );
    } finally {
      setEnviando(false);
    }
  }

  let orientacaoAgendamento = {
    icone: 'fa-regular fa-calendar',
    titulo: 'Comece escolhendo uma data',
    texto: 'Depois, selecione o horário desejado na lista ao lado.',
  };

  if (diaSelecionado !== null && !horarioSelecionado) {
    orientacaoAgendamento = {
      icone: 'fa-regular fa-clock',
      titulo: `Dia ${diaSelecionado} selecionado`,
      texto: 'Agora escolha um horário para continuar.',
    };
  }

  if (diaSelecionado !== null && horarioSelecionado) {
    orientacaoAgendamento = horarioSelecionadoOcupado
      ? {
          icone: 'fa-solid fa-triangle-exclamation',
          titulo: `${horarioSelecionado} já está ocupado`,
          texto: 'Ajuste o horário antes de concluir o agendamento.',
        }
      : {
          icone: 'fa-regular fa-circle-check',
          titulo: `Dia ${diaSelecionado}, às ${horarioSelecionado}`,
          texto: 'Preencha o título e clique em Enviar para concluir.',
        };
  }

  return (
    <div className="Agendamento">
      {notificacoes.length > 0 && (
        <div className="notificacoes">
          {notificacoes.map((notificacao) => (
            <Notificacao
              key={notificacao.id}
              notificacao={notificacao}
              onClose={removerNotificacao}
            />
          ))}
        </div>
      )}

      <nav>
        <Link className="botao-agenda" to="/agenda">
          Ver agenda
        </Link>
        <img src="/assets/images/Agenda-FREI.png" alt="Logo Agenda do FREI" />
        <Link className="botao-agendamentos" to="/">
          Ver agendamento
        </Link>
      </nav>

      <main>
        <div className="calendario">
          <div className="dias">
            <div className="botoes">
              {colunasCalendario.map((coluna, indiceColuna) => (
                <div className={`coluna${indiceColuna + 1}`} key={coluna.nome}>
                  <p>{coluna.nome}</p>

                  {coluna.dias.map((dia, indiceDia) =>
                    dia.ativo ? (
                      <button
                        className={`date-ative${
                          diaSelecionado === dia.numero ? ' date-select' : ''
                        }`}
                        type="button"
                        key={`${coluna.nome}-${indiceDia}`}
                        aria-label={`Selecionar dia ${dia.numero} de setembro`}
                        aria-pressed={diaSelecionado === dia.numero}
                        disabled={enviando}
                        onClick={() => selecionarDia(dia.numero)}
                      >
                        <span>{dia.numero}</span>
                      </button>
                    ) : (
                      <div
                        className="date-inative"
                        key={`${coluna.nome}-${indiceDia}`}
                        aria-hidden="true"
                      >
                        <span>{dia.numero}</span>
                      </div>
                    ),
                  )}
                </div>
              ))}
            </div>

            <div className="orientacao-agendamento" aria-live="polite">
              <i className={orientacaoAgendamento.icone} aria-hidden="true" />
              <div>
                <strong>{orientacaoAgendamento.titulo}</strong>
                <span>{orientacaoAgendamento.texto}</span>
              </div>
            </div>

            <div className="formulario">
              <form onSubmit={enviarAgendamento} noValidate>
                <label htmlFor="titulo">Título:</label>
                <input
                  id="titulo"
                  type="text"
                  maxLength="120"
                  value={titulo}
                  disabled={enviando}
                  onChange={(event) => {
                    setTitulo(event.target.value);
                  }}
                  required
                />
                <button type="submit" disabled={enviando || carregandoAgenda}>
                  {enviando ? 'Enviando...' : 'Enviar'}
                </button>
              </form>
            </div>
          </div>

          <div className="horario">
            <p className="horario-data">
              {diaSelecionado !== null
                ? `Dia: ${diaSelecionado} de setembro${
                    horarioSelecionado ? `, às ${horarioSelecionado}` : ''
                  }`
                : 'Dia:'}
            </p>

            <div className="ajuste-minutos">
              <p>Ajustar minutos</p>
              <div className="ajuste-minutos-botoes">
                {[-1, -10, -30].map((quantidade) => (
                  <button
                    type="button"
                    key={quantidade}
                    aria-label={`Diminuir ${Math.abs(quantidade)} minuto${
                      quantidade < -1 ? 's' : ''
                    } do horário`}
                    disabled={
                      !horarioSelecionado || enviando || carregandoAgenda
                    }
                    onClick={() => alterarMinutos(quantidade)}
                  >
                    {quantidade}
                  </button>
                ))}

                <output
                  className={`horario-ajustado${
                    horarioSelecionadoOcupado ? ' horario-ocupado' : ''
                  }`}
                  aria-label="Horário selecionado"
                  aria-live="polite"
                  title={
                    horarioSelecionadoOcupado
                      ? 'Este horário já está ocupado'
                      : undefined
                  }
                >
                  {horarioSelecionado || '--:--'}
                </output>

                {[1, 10, 30].map((quantidade) => (
                  <button
                    type="button"
                    key={quantidade}
                    aria-label={`Adicionar ${quantidade} minuto${
                      quantidade > 1 ? 's' : ''
                    } ao horário`}
                    disabled={
                      !horarioSelecionado || enviando || carregandoAgenda
                    }
                    onClick={() => alterarMinutos(quantidade)}
                  >
                    +{quantidade}
                  </button>
                ))}
              </div>
            </div>

            <div className="horario-lista">
              {horariosDisponiveis.map((hora) => (
                <button
                  className={`horario-item${
                    diaSelecionado === null ? ' horario-bloqueado' : ''
                  }`}
                  type="button"
                  key={hora}
                  aria-pressed={
                    Boolean(horarioSelecionado) &&
                    horarioSelecionado.slice(0, 2) === hora.slice(0, 2)
                  }
                  aria-disabled={
                    diaSelecionado === null || enviando || carregandoAgenda
                  }
                  disabled={enviando || carregandoAgenda}
                  onClick={() => selecionarHorario(hora)}
                >
                  {hora}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
