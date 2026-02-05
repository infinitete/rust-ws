import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Login } from './pages/Login';
import { ChatRoom } from './pages/ChatRoom';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/chat/:username" element={<ChatRoom />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
