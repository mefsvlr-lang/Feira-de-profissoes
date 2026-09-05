import { Router } from "express";
import agendamentos from '../agendamentos.js';

const endpoints = Router();

endpoints.post('/agendamento', (req, res) => {
    const dados = req.body;
    const camposPermitidos = ['titulo', 'dia', 'horario'];

    if (!dados || typeof dados !== 'object' || Array.isArray(dados)) {
        return res.status(400).json({ erro: 'O corpo da requisição deve ser um objeto JSON.' });
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
            erro: 'Informe somente titulo, dia e horario, todos preenchidos.'
        });
    }

    const agendamento = {
        titulo: dados.titulo.trim(),
        dia: dados.dia.trim(),
        horario: dados.horario.trim()
    };

    const horarioJaAgendado = agendamentos.some((registro) =>
        registro.dia === agendamento.dia && registro.horario === agendamento.horario
    );

    if (horarioJaAgendado) {
        return res.status(409).json({
            erro: 'Este horário já está agendado para este dia.'
        });
    }

    agendamentos.push(agendamento);

    return res.status(201).json(agendamento);
});

export default endpoints;
