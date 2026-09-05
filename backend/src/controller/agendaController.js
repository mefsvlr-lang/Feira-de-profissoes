import { Router } from "express";
import agendamentos from '../agendamentos.js';

const endpoints = Router();

endpoints.get('/agenda', (req, res) => {
    return res.status(200).json(agendamentos);
});

endpoints.delete('/remover', (req, res) => {
    const dados = req.body;

    if (
        !dados ||
        typeof dados !== 'object' ||
        Array.isArray(dados) ||
        typeof dados.dia !== 'string' ||
        typeof dados.horario !== 'string' ||
        dados.dia.trim() === '' ||
        dados.horario.trim() === ''
    ) {
        return res.status(400).json({
            erro: 'Informe dia e horario para remover o agendamento.'
        });
    }

    const dia = dados.dia.trim();
    const horario = dados.horario.trim();
    const indice = agendamentos.findIndex((agendamento) =>
        agendamento.dia === dia && agendamento.horario === horario
    );

    if (indice === -1) {
        return res.status(404).json({
            erro: 'Agendamento não encontrado.'
        });
    }

    const [agendamentoRemovido] = agendamentos.splice(indice, 1);

    return res.status(200).json(agendamentoRemovido);
});

endpoints.put('/editar', (req, res) => {
    const dados = req.body;
    const camposPermitidos = [
        'diaOriginal',
        'horarioOriginal',
        'titulo',
        'dia',
        'horario'
    ];

    if (!dados || typeof dados !== 'object' || Array.isArray(dados)) {
        return res.status(400).json({
            erro: 'O corpo da requisição deve ser um objeto JSON.'
        });
    }

    const camposRecebidos = Object.keys(dados);
    const possuiSomenteCamposPermitidos = camposRecebidos.every((campo) =>
        camposPermitidos.includes(campo)
    );
    const possuiTodosOsCampos = camposPermitidos.every((campo) =>
        typeof dados[campo] === 'string' && dados[campo].trim() !== ''
    );

    if (!possuiSomenteCamposPermitidos || !possuiTodosOsCampos) {
        return res.status(400).json({
            erro: 'Informe o agendamento original e os novos dados completos.'
        });
    }

    const diaOriginal = dados.diaOriginal.trim();
    const horarioOriginal = dados.horarioOriginal.trim();
    const titulo = dados.titulo.trim();
    const dia = dados.dia.trim();
    const horario = dados.horario.trim();
    const numeroDia = Number(dia);
    const horarioValido = /^([01]\d|2[0-3]):[0-5]\d$/.test(horario);

    if (
        titulo.length > 120 ||
        !Number.isInteger(numeroDia) ||
        numeroDia < 1 ||
        numeroDia > 30 ||
        !horarioValido
    ) {
        return res.status(400).json({
            erro: 'Informe um título de até 120 caracteres, um dia de 1 a 30 e um horário válido.'
        });
    }

    const indice = agendamentos.findIndex((agendamento) =>
        agendamento.dia === diaOriginal &&
        agendamento.horario === horarioOriginal
    );

    if (indice === -1) {
        return res.status(404).json({
            erro: 'Agendamento não encontrado.'
        });
    }

    const horarioJaAgendado = agendamentos.some((agendamento, indiceAtual) =>
        indiceAtual !== indice &&
        agendamento.dia === dia &&
        agendamento.horario === horario
    );

    if (horarioJaAgendado) {
        return res.status(409).json({
            erro: 'Este horário já está agendado para este dia.'
        });
    }

    const agendamentoAtualizado = { titulo, dia, horario };
    agendamentos[indice] = agendamentoAtualizado;

    return res.status(200).json(agendamentoAtualizado);
});

export default endpoints;
