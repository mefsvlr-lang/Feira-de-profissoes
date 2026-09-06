import './App.scss';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { criarAgendamento, listarAgendamentos } from '../../services/api';
import {
  BarraNavegacao,
  Calendario,
  FormularioAgendamento,
  Notificacao,
  OrientacaoAgendamento,
  PainelHorarios,
} from './components';
import {
  algumAgendamentoConflita,
  horarioParaMinutos,
  horarioRegex,
  horarios,
  minutosParaHorario,
  obterHorarioFim,
  obterHorarioInicio,
} from './horarioUtils';

function obterOrientacaoAgendamento(
  diaSelecionado,
  horarioSelecionado,
  horarioSelecionadoOcupado,
) {
  if (diaSelecionado === null) {
    return {
      icone: 'fa-regular fa-calendar',
      titulo: 'Comece escolhendo uma data',
      texto: 'Depois, selecione o horário desejado na lista ao lado.',
    };
  }

  if (!horarioSelecionado) {
    return {
      icone: 'fa-regular fa-clock',
      titulo: `Dia ${diaSelecionado} selecionado`,
      texto: 'Agora escolha um horário para continuar.',
    };
  }

  if (horarioSelecionadoOcupado) {
    return {
      icone: 'fa-solid fa-triangle-exclamation',
      titulo: `${horarioSelecionado} já está ocupado`,
      texto: 'Ajuste o horário antes de concluir o agendamento.',
    };
  }

  return {
    icone: 'fa-regular fa-circle-check',
    titulo: `Dia ${diaSelecionado}, às ${horarioSelecionado}`,
    texto: 'Preencha o título e clique em Enviar para concluir.',
  };
}

export default function Agendamentos() {
  const [diaSelecionado, setDiaSelecionado] = useState(null);
  const [horarioSelecionado, setHorarioSelecionado] = useState('');
  const [eventoInicio, setEventoInicio] = useState('');
  const [eventoFim, setEventoFim] = useState('');
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

  const agendamentosDoDia = useMemo(
    () =>
      agendamentos.filter(
        (agendamento) => Number(agendamento.dia) === diaSelecionado,
      ),
    [agendamentos, diaSelecionado],
  );

  const horariosDisponiveis = useMemo(
    () =>
      horarios.filter(
        (horario) =>
          !algumAgendamentoConflita(agendamentosDoDia, horario, horario),
      ),
    [agendamentosDoDia],
  );

  const horarioSelecionadoOcupado =
    Boolean(horarioSelecionado) &&
    algumAgendamentoConflita(
      agendamentosDoDia,
      horarioSelecionado,
      horarioSelecionado,
    );
  const estaProcessando = enviando || carregandoAgenda;
  const eventoBloqueado = diaSelecionado === null || estaProcessando;
  const orientacaoAgendamento = obterOrientacaoAgendamento(
    diaSelecionado,
    horarioSelecionado,
    horarioSelecionadoOcupado,
  );

  function avisarDiaObrigatorio() {
    adicionarNotificacao(
      'erro',
      'Selecione uma data antes de escolher um horário.',
    );
  }

  function limparSelecao() {
    setDiaSelecionado(null);
    setHorarioSelecionado('');
    setEventoInicio('');
    setEventoFim('');
  }

  function selecionarDia(dia) {
    setDiaSelecionado(dia);
    setHorarioSelecionado('');
    setEventoInicio('');
    setEventoFim('');
  }

  function selecionarHorario(hora) {
    if (diaSelecionado === null) {
      avisarDiaObrigatorio();
      return;
    }

    setHorarioSelecionado(hora);
  }

  function alterarMinutos(quantidade) {
    if (diaSelecionado === null) {
      avisarDiaObrigatorio();
      return;
    }

    if (!horarioSelecionado) {
      adicionarNotificacao(
        'erro',
        'Selecione um horário antes de ajustar os minutos.',
      );
      return;
    }

    const totalMinutos = horarioParaMinutos(horarioSelecionado) + quantidade;

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

    setHorarioSelecionado(minutosParaHorario(totalMinutos));
  }

  function existeConflitoNoDia(inicio, fim) {
    return algumAgendamentoConflita(agendamentosDoDia, inicio, fim);
  }

  function criarDadosAgendamento(tituloNormalizado, dia, horario) {
    return {
      titulo: tituloNormalizado,
      dia,
      horario_inicio: horario,
      horario_fim: horario,
    };
  }

  function criarDadosEvento(tituloNormalizado, dia, inicio, fim) {
    return {
      titulo: tituloNormalizado,
      dia,
      horario_inicio: inicio,
      horario_fim: fim,
    };
  }

  async function salvarNaAgenda(dados) {
    const registroCriado = await criarAgendamento(dados);
    setAgendamentos((atuais) => [...atuais, registroCriado]);
  }

  function registrarHorarioConflitante(dia, horario) {
    setAgendamentos((atuais) => {
      const horarioJaRegistrado = atuais.some(
        (agendamento) =>
          Number(agendamento.dia) === Number(dia) &&
          obterHorarioInicio(agendamento) === horario &&
          obterHorarioFim(agendamento) === horario,
      );

      if (horarioJaRegistrado) {
        return atuais;
      }

      return [
        ...atuais,
        {
          titulo: '',
          dia,
          horario_inicio: horario,
          horario_fim: horario,
        },
      ];
    });
  }

  async function enviarAgendamento(event) {
    event.preventDefault();

    const tituloNormalizado = titulo.trim();
    const diaAgendado = String(diaSelecionado);
    const horarioAgendado = horarioSelecionado;

    if (!tituloNormalizado || diaSelecionado === null || !horarioAgendado) {
      adicionarNotificacao(
        'erro',
        'Preencha o título e selecione um dia e um horário.',
      );
      return;
    }

    if (existeConflitoNoDia(horarioAgendado, horarioAgendado)) {
      adicionarNotificacao(
        'erro',
        `O horário ${horarioAgendado} já está agendado para este dia.`,
      );
      return;
    }

    setEnviando(true);

    try {
      await salvarNaAgenda(
        criarDadosAgendamento(tituloNormalizado, diaAgendado, horarioAgendado),
      );

      setTitulo('');
      limparSelecao();
      adicionarNotificacao(
        'sucesso',
        `Agendamento salvo para o dia ${diaAgendado}, às ${horarioAgendado}.`,
      );
    } catch (error) {
      if (error.status === 409) {
        registrarHorarioConflitante(diaAgendado, horarioAgendado);
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

  async function enviarEvento() {
    const tituloNormalizado = titulo.trim();
    const diaAgendado = String(diaSelecionado);
    const inicio = eventoInicio.trim();
    const fim = eventoFim.trim();

    if (diaSelecionado === null) {
      avisarDiaObrigatorio();
      return;
    }

    if (!tituloNormalizado || !inicio || !fim) {
      adicionarNotificacao(
        'erro',
        'Preencha o título, selecione um dia e informe o início e fim do evento.',
      );
      return;
    }

    if (!horarioRegex.test(inicio) || !horarioRegex.test(fim)) {
      adicionarNotificacao('erro', 'Informe horários válidos para o evento.');
      return;
    }

    if (horarioParaMinutos(fim) < horarioParaMinutos(inicio)) {
      adicionarNotificacao(
        'erro',
        'O horário final não pode ser antes do horário inicial.',
      );
      return;
    }

    if (existeConflitoNoDia(inicio, fim)) {
      adicionarNotificacao(
        'erro',
        'Esse evento conflita com outro horário já agendado para este dia.',
      );
      return;
    }

    setEnviando(true);

    try {
      await salvarNaAgenda(criarDadosEvento(tituloNormalizado, diaAgendado, inicio, fim));

      setTitulo('');
      limparSelecao();
      adicionarNotificacao(
        'sucesso',
        `Evento salvo para o dia ${diaAgendado}, das ${inicio} até ${fim}.`,
      );
    } catch (error) {
      adicionarNotificacao(
        'erro',
        error.message || 'Não foi possível salvar o evento.',
      );
    } finally {
      setEnviando(false);
    }
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

      <BarraNavegacao />

      <main>
        <div className="calendario">
          <div className="dias">
            <Calendario
              diaSelecionado={diaSelecionado}
              enviando={enviando}
              onSelecionarDia={selecionarDia}
            />

            <OrientacaoAgendamento orientacao={orientacaoAgendamento} />

            <FormularioAgendamento
              titulo={titulo}
              enviando={enviando}
              carregandoAgenda={carregandoAgenda}
              onTitulo={setTitulo}
              onSubmit={enviarAgendamento}
            />
          </div>

          <PainelHorarios
            diaSelecionado={diaSelecionado}
            horarioSelecionado={horarioSelecionado}
            horarioSelecionadoOcupado={horarioSelecionadoOcupado}
            horariosDisponiveis={horariosDisponiveis}
            eventoInicio={eventoInicio}
            eventoFim={eventoFim}
            eventoBloqueado={eventoBloqueado}
            enviando={enviando}
            carregandoAgenda={carregandoAgenda}
            onAlterarMinutos={alterarMinutos}
            onEventoBloqueado={avisarDiaObrigatorio}
            onEventoInicio={setEventoInicio}
            onEventoFim={setEventoFim}
            onSalvarEvento={enviarEvento}
            onSelecionarHorario={selecionarHorario}
          />
        </div>
      </main>
    </div>
  );
}
