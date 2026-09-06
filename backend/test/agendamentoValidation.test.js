import test from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizarAgendamento,
    normalizarId
} from '../src/agendamentoValidation.js';

test('normaliza um agendamento válido', () => {
    assert.deepEqual(
        normalizarAgendamento({
            titulo: '  Palestra de TI  ',
            dia: 6,
            horario_inicio: '10:00',
            horario_fim: '11:00'
        }),
        {
            titulo: 'Palestra de TI',
            dia: '6',
            horario_inicio: '10:00',
            horario_fim: '11:00'
        }
    );
});

test('aceita um agendamento pontual', () => {
    assert.ok(normalizarAgendamento({
        titulo: 'Visita',
        dia: '10',
        horario_inicio: '14:30',
        horario_fim: '14:30'
    }));
});

test('rejeita campos ausentes ou extras', () => {
    assert.equal(normalizarAgendamento({ titulo: 'Incompleto' }), null);
    assert.equal(normalizarAgendamento({
        titulo: 'Completo',
        dia: '1',
        horario_inicio: '08:00',
        horario_fim: '09:00',
        campo_extra: true
    }), null);
});

test('rejeita dia, título e horários inválidos', () => {
    const base = {
        titulo: 'Evento',
        dia: '1',
        horario_inicio: '08:00',
        horario_fim: '09:00'
    };

    assert.equal(normalizarAgendamento({ ...base, dia: '31' }), null);
    assert.equal(normalizarAgendamento({ ...base, titulo: ' '.repeat(3) }), null);
    assert.equal(normalizarAgendamento({ ...base, horario_inicio: '25:00' }), null);
    assert.equal(normalizarAgendamento({ ...base, horario_fim: '07:59' }), null);
});

test('valida IDs inteiros positivos', () => {
    assert.equal(normalizarId('15'), 15);
    assert.equal(normalizarId('0'), null);
    assert.equal(normalizarId('-1'), null);
    assert.equal(normalizarId('1.5'), null);
    assert.equal(normalizarId('abc'), null);
});
