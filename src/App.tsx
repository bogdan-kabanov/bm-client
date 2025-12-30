import { AppRouter } from './app/routing';
import { WebSocketProvider } from '@src/entities/websoket/WebsocketProvider';
import { useTime } from '@src/shared/lib/hooks/useTime';
import { ChatDropdownProvider } from '@src/shared/contexts/ChatDropdownContext';

function App() {
    // Инициализируем обновление времени в Redux
    useTime();
    
    return (
        <WebSocketProvider url="">
            <ChatDropdownProvider>
                <AppRouter />
            </ChatDropdownProvider>
        </WebSocketProvider>
    );
}

export default App;

