import agenda from './controller/agendaController.js';
import agendamento from './controller/agendamentoController.js';

export function addRoutes(api){
    api.use(agenda);
    api.use(agendamento);
}
