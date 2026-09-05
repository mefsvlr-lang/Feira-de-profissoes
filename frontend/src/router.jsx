import Agendamentos from './pages/Agendamentos/App';
import Agenda from './pages/Agenda/Index';
import Notfound from './pages/Notfound/Index';
import { BrowserRouter,Routes,Route } from 'react-router-dom';

export default function Nav(){
    return(
        <BrowserRouter>
        <Routes>
            <Route path='/' element={<Agendamentos/>}/>
            <Route path='/agenda' element={<Agenda/>}/>
            <Route path='*' element={<Notfound/>}/>
        </Routes>
        </BrowserRouter>
    );
}
