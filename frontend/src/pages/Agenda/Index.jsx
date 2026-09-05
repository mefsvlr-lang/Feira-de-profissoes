import './Index.scss';
import { Link } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { colunasCalendario } from '../../data/calendario';
import {
  editarAgendamento,
  listarAgendamentos,
  removerAgendamento,
} from '../../services/api';

const diasDoMes = Array.from({ length: 30 }, (_, indice) => indice + 1);

function ordenarPorHorario(primeiro, segundo) {
  return String(primeiro.horario).localeCompare(String(segundo.horario));
}

export default function Agenda() {
  const [selectedDay, setSelectedDay] = useState(null);
  const [agendamentos, setAgendamentos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [agendamentoEmRemocao, setAgendamentoEmRemocao] = useState('');
  const [erroRemocao, setErroRemocao] = useState('');
  const [edicao, setEdicao] = useState(null);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [erroEdicao, setErroEdicao] = useState('');
  const ultimoDiaFocado = useRef(null);

  const carregarAgenda = useCallback(async (signal) => {
    setCarregando(true);
    setErro('');

    try {
      const dados = await listarAgendamentos({ signal });

      if (!Array.isArray(dados)) {
        throw new Error('O backend retornou uma agenda inválida.');
      }

      const ordenados = [...dados].sort(ordenarPorHorario);

      setAgendamentos(ordenados);
    } catch (error) {
      if (error.name !== 'AbortError') {
        setErro(error.message || 'Não foi possível carregar a agenda.');
      }
    } finally {
      if (!signal?.aborted) {
        setCarregando(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    carregarAgenda(controller.signal);

    return () => controller.abort();
  }, [carregarAgenda]);

  const agendamentosPorDia = useMemo(
    () =>
      agendamentos.reduce((grupos, agendamento) => {
        const dia = Number(agendamento.dia);

        if (!Number.isInteger(dia) || dia < 1 || dia > 30) {
          return grupos;
        }

        if (!grupos[dia]) {
          grupos[dia] = [];
        }

        grupos[dia].push(agendamento);
        return grupos;
      }, {}),
    [agendamentos],
  );

  const agendamentosSelecionados =
    selectedDay === null ? [] : agendamentosPorDia[selectedDay] || [];

  function openDay(dia, elemento) {
    ultimoDiaFocado.current = elemento;
    setErroRemocao('');
    setErroEdicao('');
    setEdicao(null);
    setSelectedDay(dia);
  }

  function closeDay() {
    if (agendamentoEmRemocao || salvandoEdicao) {
      return;
    }

    setErroRemocao('');
    setErroEdicao('');
    setEdicao(null);
    setSelectedDay(null);
    window.requestAnimationFrame(() => ultimoDiaFocado.current?.focus());
  }

  function iniciarEdicao(agendamento) {
    setErroRemocao('');
    setErroEdicao('');
    setEdicao({
      diaOriginal: String(agendamento.dia),
      horarioOriginal: String(agendamento.horario).trim(),
      titulo: String(agendamento.titulo),
      dia: String(agendamento.dia),
      horario: String(agendamento.horario).trim(),
    });
  }

  function cancelarEdicao() {
    if (salvandoEdicao) {
      return;
    }

    setErroEdicao('');
    setEdicao(null);
  }

  async function salvarEdicao(event) {
    event.preventDefault();

    const titulo = edicao.titulo.trim();
    const dia = String(edicao.dia).trim();
    const horario = String(edicao.horario).trim();
    const numeroDia = Number(dia);
    const horarioValido = /^([01]\d|2[0-3]):[0-5]\d$/.test(horario);

    if (
      !titulo ||
      !Number.isInteger(numeroDia) ||
      numeroDia < 1 ||
      numeroDia > 30 ||
      !horarioValido
    ) {
      setErroEdicao('Preencha o texto, o dia e um horário válido.');
      return;
    }

    setSalvandoEdicao(true);
    setErroEdicao('');

    try {
      const agendamentoAtualizado = await editarAgendamento({
        diaOriginal: edicao.diaOriginal,
        horarioOriginal: edicao.horarioOriginal,
        titulo,
        dia,
        horario,
      });

      setAgendamentos((atuais) =>
        atuais
          .map((agendamento) =>
            String(agendamento.dia) === edicao.diaOriginal &&
            String(agendamento.horario).trim() === edicao.horarioOriginal
              ? agendamentoAtualizado
              : agendamento,
          )
          .sort(ordenarPorHorario),
      );
      setEdicao(null);
      setSelectedDay(Number(agendamentoAtualizado.dia));
    } catch (error) {
      setErroEdicao(
        error.message || 'Não foi possível editar o agendamento.',
      );
    } finally {
      setSalvandoEdicao(false);
    }
  }

  async function deleteSchedule(agendamento) {
    const identificador = `${agendamento.dia}-${agendamento.horario}`;
    setAgendamentoEmRemocao(identificador);
    setErroRemocao('');
    setErroEdicao('');

    try {
      await removerAgendamento({
        dia: agendamento.dia,
        horario: agendamento.horario,
      });

      setAgendamentos((atuais) =>
        atuais.filter(
          (item) =>
            !(
              Number(item.dia) === Number(agendamento.dia) &&
              String(item.horario).trim() ===
                String(agendamento.horario).trim()
            ),
        ),
      );
    } catch (error) {
      setErroRemocao(
        error.message || 'Não foi possível excluir o agendamento.',
      );
    } finally {
      setAgendamentoEmRemocao('');
    }
  }

  function closeDayWithEscape(event) {
    if (event.key === 'Escape') {
      if (edicao) {
        cancelarEdicao();
        return;
      }

      closeDay();
      return;
    }

    if (event.key === 'Tab') {
      const elementosFocaveis = event.currentTarget.querySelectorAll(
        '.day-expanded a[href], .day-expanded button:not(:disabled), .day-expanded input:not(:disabled), .day-expanded select:not(:disabled)',
      );
      const primeiroElemento = elementosFocaveis[0];
      const ultimoElemento = elementosFocaveis[elementosFocaveis.length - 1];

      if (!primeiroElemento || !ultimoElemento) {
        return;
      }

      const deveVoltarAoFim =
        event.shiftKey && document.activeElement === primeiroElemento;
      const deveVoltarAoInicio =
        !event.shiftKey && document.activeElement === ultimoElemento;

      if (deveVoltarAoFim || deveVoltarAoInicio) {
        event.preventDefault();
        (deveVoltarAoFim ? ultimoElemento : primeiroElemento).focus();
      }
    }
  }

  return (
    <div className="Agenda">
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
        <div className="agenda">
          <h1>AGENDA</h1>

          {carregando && (
            <p className="agenda-status" role="status">
              Carregando agendamentos...
            </p>
          )}

          {erro && (
            <div className="agenda-status agenda-error" role="alert">
              <span>{erro}</span>
              <button type="button" onClick={() => carregarAgenda()}>
                Tentar novamente
              </button>
            </div>
          )}

          <div className="dias">
            {colunasCalendario.map((coluna) => (
              <div className="coluna" key={coluna.nome}>
                <p>{coluna.nome}</p>

                {coluna.dias.map((dia, indiceDia) => {
                  const eventosDoDia = agendamentosPorDia[dia.numero] || [];

                  if (!dia.ativo) {
                    return (
                      <div
                        className="day-inative"
                        key={`${coluna.nome}-${indiceDia}`}
                        aria-hidden="true"
                      >
                        <span className="day-number">{dia.numero}</span>
                      </div>
                    );
                  }

                  return (
                    <button
                      className="day-ative"
                      type="button"
                      key={`${coluna.nome}-${indiceDia}`}
                      aria-label={`Dia ${dia.numero}: ${eventosDoDia.length} agendamento(s)`}
                      onClick={(event) => openDay(dia.numero, event.currentTarget)}
                    >
                      <span className="day-number">{dia.numero}</span>
                      <span className="day-summary">
                        {eventosDoDia.map((agendamento, indice) => (
                          <span
                            className="day-event-preview"
                            key={`${agendamento.horario}-${agendamento.titulo}-${indice}`}
                          >
                            {agendamento.horario}
                          </span>
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {selectedDay !== null && (
            <div
              className="day-overlay"
              role="dialog"
              aria-modal="true"
              aria-labelledby="selected-day-title"
              onKeyDown={closeDayWithEscape}
            >
              <button
                className="day-overlay-background"
                type="button"
                aria-label="Fechar dia selecionado"
                tabIndex={-1}
                onClick={closeDay}
              />

              <section className="day-expanded">
                <button
                  className="day-close"
                  type="button"
                  aria-label="Fechar"
                  onClick={closeDay}
                  autoFocus
                >
                  &times;
                </button>

                <h2 id="selected-day-title">Dia {selectedDay} de setembro</h2>

                {erroRemocao && (
                  <p className="day-delete-error" role="alert">
                    {erroRemocao}
                  </p>
                )}

                {agendamentosSelecionados.length > 0 ? (
                  <ul className="day-event-list">
                    {agendamentosSelecionados.map((agendamento) => {
                      const identificador = `${agendamento.dia}-${agendamento.horario}`;
                      const estaExcluindo =
                        agendamentoEmRemocao === identificador;
                      const estaEditando =
                        edicao?.diaOriginal === String(agendamento.dia) &&
                        edicao?.horarioOriginal ===
                          String(agendamento.horario).trim();

                      return (
                        <li
                          className={estaEditando ? 'day-event-editing' : ''}
                          key={identificador}
                        >
                          {estaEditando ? (
                            <form
                              className="day-event-edit-form"
                              aria-busy={salvandoEdicao}
                              onSubmit={salvarEdicao}
                              noValidate
                            >
                              <label className="day-edit-title">
                                <span>Texto</span>
                                <input
                                  type="text"
                                  maxLength="120"
                                  value={edicao.titulo}
                                  disabled={salvandoEdicao}
                                  onChange={(event) =>
                                    setEdicao((atual) => ({
                                      ...atual,
                                      titulo: event.target.value,
                                    }))
                                  }
                                  autoFocus
                                />
                              </label>

                              <div className="day-edit-fields">
                                <label>
                                  <span>Dia</span>
                                  <select
                                    value={edicao.dia}
                                    disabled={salvandoEdicao}
                                    onChange={(event) =>
                                      setEdicao((atual) => ({
                                        ...atual,
                                        dia: event.target.value,
                                      }))
                                    }
                                  >
                                    {diasDoMes.map((dia) => (
                                      <option value={dia} key={dia}>
                                        {dia}
                                      </option>
                                    ))}
                                  </select>
                                </label>

                                <label>
                                  <span>Horário</span>
                                  <input
                                    type="time"
                                    step="60"
                                    value={edicao.horario}
                                    disabled={salvandoEdicao}
                                    onChange={(event) =>
                                      setEdicao((atual) => ({
                                        ...atual,
                                        horario: event.target.value,
                                      }))
                                    }
                                  />
                                </label>
                              </div>

                              {erroEdicao && (
                                <p className="day-edit-error" role="alert">
                                  {erroEdicao}
                                </p>
                              )}

                              <div className="day-edit-actions">
                                <button
                                  className="day-edit-cancel"
                                  type="button"
                                  disabled={salvandoEdicao}
                                  onClick={cancelarEdicao}
                                >
                                  Cancelar
                                </button>
                                <button
                                  className="day-edit-save"
                                  type="submit"
                                  disabled={salvandoEdicao}
                                >
                                  {salvandoEdicao ? 'Salvando...' : 'Salvar'}
                                </button>
                              </div>
                            </form>
                          ) : (
                            <>
                              <div className="day-event-content">
                                <strong>{agendamento.horario}</strong>
                                <span>{agendamento.titulo}</span>
                              </div>

                              <div className="day-event-actions">
                                <button
                                  className="day-event-edit"
                                  type="button"
                                  title="Editar"
                                  aria-label={`Editar agendamento das ${agendamento.horario}: ${agendamento.titulo}`}
                                  disabled={
                                    Boolean(agendamentoEmRemocao) ||
                                    salvandoEdicao ||
                                    Boolean(edicao)
                                  }
                                  onClick={() => iniciarEdicao(agendamento)}
                                >
                                  <i
                                    className="fa-solid fa-pen"
                                    aria-hidden="true"
                                  />
                                </button>

                                <button
                                  className="day-event-delete"
                                  type="button"
                                  title="Lixeira"
                                  aria-label={
                                    estaExcluindo
                                      ? `Excluindo agendamento das ${agendamento.horario}`
                                      : `Excluir agendamento das ${agendamento.horario}: ${agendamento.titulo}`
                                  }
                                  disabled={
                                    Boolean(agendamentoEmRemocao) ||
                                    salvandoEdicao ||
                                    Boolean(edicao)
                                  }
                                  onClick={() => deleteSchedule(agendamento)}
                                >
                                  <i
                                    className="fa-solid fa-trash-can"
                                    aria-hidden="true"
                                  />
                                </button>
                              </div>
                            </>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="day-empty-state">
                    <p className="day-without-events">
                      Nenhum agendamento para este dia.
                    </p>
                    <p className="day-schedule-callout">
                      Agende seu horário agora
                    </p>
                    <Link className="day-schedule-link" to="/">
                      Agendar agora
                    </Link>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
