import { useState, useEffect } from 'react';
import './WithdrawalNotifications.css';
import usdt from "@src/assets/currency/usdt.png";

interface WithdrawalNotification {
  id: number;
  currency: string;
  amount: number;
  username: string;
  timestamp: number;
}

const names = [
  "Eleonora Costa",
  "Rocío Romero",
  "Emily Taylor",
  "Noah Lambert",
  "Leon Schmidt",
  "Camille Giraud",
  "Quentin Renaud",
  "Hugo Richard",
  "Pablo Ramos",
  "Diego Pereira",
  "Jacob Garcia",
  "Vittoria Rossi",
  "Thomas Chevalier",
  "Esteban Ibarra",
  "Harper Young",
  "Lea Schwarz",
  "Martina Barbieri",
  "Martina Russo",
  "Zoé Bernard",
  "Andrés Sánchez",
  "Carlos Chávez",
  "Alex Allen",
  "Leon Hoffmann",
  "Amelie Hoffmann",
  "Pablo Reyes",
  "Nathan Francois",
  "Bastien Francois",
  "Riccardo Ferrari",
  "Lucía Reyes",
  "Quentin Bernard",
  "Olivia Thomas",
  "Sarah Taylor",
  "Benjamin Thompson",
  "Juan Pérez",
  "Marie Braun",
  "Leonardo Romano",
  "María Ibarra",
  "Marco Bianchi",
  "Mia Klein",
  "Marie Weber",
  "Emma Giraud",
  "Thomas Durand",
  "Ben Zimmermann",
  "Lisa Mitchell",
  "Isabella Martin",
  "Jules Chevalier",
  "Emma Michel",
  "Sara Rizzo",
  "Ana Dias",
  "Ethan King",
  "Sophie Richter",
  "Noelia Castillo",
  "Daniel King",
  "Camila Rocha",
  "Robert Walker",
  "Sophia Thompson",
  "Alejandro Rodríguez",
  "Charlotte Carter",
  "Émile Bernard",
  "David Robinson",
  "Emma Lambert",
  "Bastien Robert",
  "Lola Moreau",
  "Alessandro Greco",
  "Noelia Pérez",
  "Luiza Costa",
  "Hannah Wolf",
  "Harper Robinson",
  "Gabriele De Luca",
  "Greta Schäfer",
  "Beatriz Dias",
  "Liam Brown",
  "Valentina Herrera",
  "Lorenzo Gallo",
  "Lorenzo Rossi",
  "Élodie Roux",
  "Luiza Ferreira",
  "Jules Francois",
  "Pablo Ramírez",
  "Fernando Mendoza",
  "Lisa Wright",
  "Maël Dubois",
  "Marie Hoffmann",
  "Amélie Lambert",
  "Lukas Klein",
  "Martina Colombo",
  "Juan Castillo",
  "Rocío García",
  "Lukas Bauer",
  "Chloé Lefebvre",
  "Louis Michel",
  "Emma Thomas",
  "Sarah Durand",
  "Anna Adams",
  "Isabella Mitchell",
  "Emma Schäfer",
  "Isabela Oliveira",
  "Ava Smith",
  "Amelia Garcia",
  "Mia Brown",
  "Amelia Perez",
  "Leonardo Gallo",
  "Rafael Rocha",
  "Giulia Ferrari",
  "Amelia Martinez",
  "Thomas Laurent",
  "Bastien Moreau",
  "Gabriel Simon",
  "Mattia Rossi",
  "Diego Cruz",
  "William Perez",
  "Lorenzo Bruno",
  "Jacob Johnson",
  "Rafael Araujo",
  "Javier Herrera",
  "Diego Herrera",
  "Robert Carter",
  "Alessandro Marino",
  "Finn Klein",
  "Aurora Rizzo",
  "Maria Wright",
  "Alessia Rossi",
  "Charlotte Hill",
  "Daniel Hill",
  "Camille Chevalier",
  "Felix Schäfer",
  "Aurora Bianchi",
  "Carolina Ibarra",
  "Camila Castillo",
  "Finn Bauer",
  "David Anderson",
  "Luis Flores",
  "Beatriz Silva",
  "Amélie Bertrand",
  "Lucas Santos",
  "David Clark",
  "María Morales",
  "Logan Nelson",
  "Riccardo Lombardi",
  "Ethan Thomas",
  "Camila López",
  "Fernando Torres",
  "Harper Jackson",
  "Beatrice Giordano",
  "Pedro Ferreira",
  "Camille Simon",
  "Isabella Nelson",
  "Paul Braun",
  "Inès Dubois",
  "Esteban Romero",
  "Robert Thompson",
  "Caio Souza",
  "Noah Braun",
  "Noelia Reyes",
  "Daniela Vargas",
  "Sophie Klein",
  "David Garcia",
  "Emma Hoffmann",
  "Finn Schmidt",
  "Noah Moreau",
  "Robert Robinson",
  "Gabriela Pérez",
  "Miguel Herrera",
  "Rocío Delgado",
  "Zoé Durand",
  "Élodie Robert",
  "Robert Martinez",
  "Quentin Roux",
  "Lisa Anderson",
  "Rafael Ferreira",
  "Davide Ricci",
  "Lea Koch",
  "Leonardo Russo",
  "Alessia Romano",
  "Matheus Martins",
  "Alejandro Ibarra",
  "Clara Fournier",
  "Vittoria Ricci",
  "Camila Vargas",
  "Jonas Fischer",
  "James Baker",
  "Manon Roux",
  "Francesco De Luca",
  "Sarah Mitchell",
  "Anna Taylor",
  "Miguel Morales",
  "Chloé Chevalier",
  "Léa Renaud",
  "Rafael Costa",
  "Alessandro Russo",
  "Nathan Petit",
  "Isabella Reyes",
  "Émile Giraud",
  "Guilherme Lima",
  "Valentina Orteга",
  "Greta Krause",
  "Emma Simon",
  "Harper Thomas",
  "Diego Gomes",
  "Mia Müller",
  "Larissa Ribeiro",
  "Léa Laurent",
  "Javier Navarro",
  "Andrés Delgado",
  "Riccardo De Luca",
  "Ana Ferreira",
  "Michael Martin",
  "Jonas Koch",
  "Leonardo Rossi",
  "José Vargas",
  "Ana Oliveira",
  "Leon Krause",
  "Maël Durand",
  "Caio Silva",
  "Olivia Anderson",
  "Noah Brown",
  "Sarah Smith",
  "Jules Bernard",
  "Giulia Bianchi",
  "Luis Martínez",
  "Emma Vogel",
  "Marco Ricci",
  "Emma White",
  "Finn Koch",
  "Alejandro Sánchez",
  "Leonardo Greco",
  "Emma Perez",
  "Hannah Klein",
  "Zoé Lambert",
  "Matheus Costa",
  "Juan Romero",
  "Francesco Rizzo",
  "Pablo Chávez",
  "Sara De Luca",
  "Diego Pérez",
  "Paul Schneider",
  "Logan Young",
  "Sara Mancini",
  "Hannah Weber",
  "Maximilian Krause",
  "Emma Johnson",
  "Lea Hoffmann",
  "Hannah Wagner",
  "Luisa Krause",
  "Finn Wagner",
  "Gabriel Martins",
  "Niccolò Ferrari",
  "Chloé Moreau",
  "Vittoria Rizzo",
  "Leon Zimmermann",
  "Lara Koch",
  "Lucas Araujo",
  "Amelie Becker",
  "Alessia Bianchi",
  "Charlotte Martinez",
  "Clara Meyer",
  "Lorenzo Rizzo",
  "Gabriel Giraud",
  "Ava Lewis",
  "Clara Schröder",
  "Daniela Flores",
  "Alejandro Romero",
  "Quentin Lambert",
  "Robert Jackson",
  "James Jackson",
  "Alex Robinson",
  "Amélie Moreau",
  "Émile Bertrand",
  "John Clark",
  "José García",
  "João Barros",
  "Leon Richter",
  "Moritz Schäfer",
  "Helena Rocha",
  "Lorenzo Russo",
  "Zoé Richard",
  "Gabriele Greco",
  "Noah Schröder",
  "Felix Müller",
  "Francesco Rossi",
  "Nico Müller",
  "William Hill",
  "Davide Esposito",
  "Marie Schröder",
  "Niccolò Colombo",
  "Rafael Lima",
  "Émile Renaud",
  "Diego Ramos",
  "David Roberts",
  "Louis Petit",
  "Gabriel Martin",
  "Alessandro Ferrari",
  "Sophia Nelson",
  "Beatriz Barros",
  "Santiago Orteга",
  "Sarah Lambert",
  "Benjamin Jackson",
  "Charlotte Wright",
  "Liam Adams",
  "María Vargas",
  "Alessandro Bianchi",
  "Emma Lewis",
  "Diego Ribeiro",
  "Marco Russo",
  "Davide Conti",
  "Emma Lefebvre",
  "Lucía Castillo",
  "Vittoria Ferrari",
  "Felipe Barbosa",
  "José Delgado",
  "Alessandro Lombardi",
  "Anna Young",
  "Amelie Schwarz",
  "Emma Koch",
  "Chloé Durand",
  "Emily Brown",
  "Élodie Giraud",
  "Isabela Ribeiro",
  "Lukas Zimmermann",
  "Noelia Chávez",
  "Hugo Petit",
  "Riccardo Gallo",
  "Mia Zimmermann",
  "Sofia Ferrari",
  "Alessandro Gallo",
  "Emma Fournier",
  "Lisa Martin",
  "Emma Müller",
  "Beatrice Greco",
  "Pablo Navarro",
  "Juan Flores",
  "Lara Schneider",
  "Maria Roberts",
  "Carlos Navarro",
  "Sofia Rizzo",
  "Felipe Carvalho",
  "Isabella King",
  "Noelia Romero",
  "Mattia Costa",
  "Eleonora Mancini",
  "Lorenzo Colombo",
  "Lucía Martínez",
  "Moritz Wolf",
  "Camille Michel",
  "Beatriz Ferreira",
  "Maria Anderson",
  "Sara Greco",
  "Lukas Müller",
  "Jonas Neumann",
  "Sofia Bianchi",
  "Lina Becker",
  "Mia Braun",
  "Zoé Dubois",
  "Caio Rodrigues",
  "Riccardo Bruno",
  "William Martin",
  "Louis Francois",
  "Aline Moreau",
  "Liam Clark",
  "Greta Hoffmann",
  "Emily Anderson",
  "Arthur Dubois",
  "Beatrice Lombardi",
  "Felix Hoffmann",
  "Zoé Giraud",
  "Martina De Luca",
  "Daniela Torres",
  "Sara Russo",
  "Gabriele Esposito",
  "Paula Navarro",
  "Olivia Green",
  "Beatrice Gallo",
  "Felix Becker",
  "Manon Richard",
  "Lucas Almeida",
  "Camila Chávez",
  "Chiara Colombo",
  "Carolina Mendoza",
  "Guilherme Oliveira",
  "Leon Müller",
  "Maximilian Wagner",
  "Giulia Romano",
  "Chiara De Luca",
  "Marco Rizzo",
  "Sophia Roberts",
  "Jonas Krause",
  "Marco Barbieri",
  "Miguel Álvarez",
  "Emma Schneider",
  "Chloé Simon",
  "Gabriel Oliveira",
  "Daniela Chávez",
  "Robert Johnson",
  "Noelia Ramos",
  "Carolina Pereira",
  "Léa Petit",
  "Mia Green",
  "Diego Sánchez",
  "Gabriela Guerrero",
  "Luis Reyes",
  "Guilherme Costa",
  "Amelie Schröder",
  "Beatriz Santos",
  "Maël Richard",
  "Greta Wolf",
  "Santiago Cruz",
  "Luiza Araujo",
  "Moritz Bauer",
  "Esteban Flores",
  "Matheus Lima",
  "Niccolò Marino",
  "Beatrice Esposito",
  "Juan Álvarez",
  "Alessandro De Luca",
  "Ximena Cruz",
  "Jules Bonnet",
  "Émile Laurent",
  "Paul Klein",
  "Miguel Orteга",
  "Camila Sánchez",
  "Finn Fischer",
  "Liam Anderson",
  "Finn Neumann",
  "Lucas Petit",
  "Lucas Moreau",
  "Sofía Ibarra",
  "Matheus Barros",
  "Mia Koch",
  "Mia Carter",
  "Alessia Rizzo",
  "Finn Wolf",
  "Beatrice Ricci",
  "Fernando Delgado",
  "Michael Walker",
  "Emma Chevalier",
  "Emma Francois",
  "Emma Mitchell",
  "Marco Mancini",
  "Gabriela Delgado",
  "Olivia Adams",
  "Alejandro Morales",
  "Marie Wolf",
  "Luisa Richter",
  "Vittoria Greco",
  "Andrés Orteга",
  "Santiago García",
  "Élodie Lefebvre",
  "Hugo Morel",
  "Lina Richter",
  "Sara Bruno",
  "Carlos González",
  "María Herrera",
  "Noah Richter",
  "Gabriel Rodrigues",
  "Mattia Ricci",
  "Jonas Wolf",
  "Aurora Giordano",
  "Fernando Ramos",
  "Inès Simon",
  "Lola Bertrand",
  "Gabriele Bianchi",
  "Guilherme Correia",
  "Amélie Robert",
  "Michael King",
  "Lucía Romero",
  "Chloé Bertrand",
  "Chloe Brown",
  "Émile Simon",
  "Jacob Martinez",
  "John Green",
  "Matheus Gomes",
  "Paula Orteга",
  "Sofía Álvarez",
  "Santiago Flores",
  "Javier Torres",
  "Luiza Barros",
  "Felipe Costa",
  "Leonardo Ferrari",
  "Carolina Pérez",
  "James Carter",
  "Manon Morel",
  "Eleonora Ferrari",
  "Chiara Giordano",
  "Rafael Gomes",
  "Amélie Martin",
  "Hannah Hoffmann",
  "Daniel Johnson",
  "Aurora Barbieri",
  "Ximena Reyes",
  "Larissa Almeida",
  "Greta Vogel",
  "Hugo Martin",
  "Lucas Barros",
  "Lola Petit",
  "Paul Schäfer",
  "Lara Schäfer",
  "Helena Barros",
  "David King",
  "Emma Meyer",
  "Noelia Orteга"
];

export function WithdrawalNotifications() {
  const [notifications, setNotifications] = useState<WithdrawalNotification[]>([]);

  const generateDeterministicNotifications = () => {
    const now = Date.now();
    const currentHour = new Date().getHours();
    const currentMinute = new Date().getMinutes();
    
    const daySeed = Math.floor(now / (24 * 60 * 60 * 1000));
    const hourSeed = currentHour;
    
    const notificationsCount = 5 + (currentHour % 3);
    const newNotifications: WithdrawalNotification[] = [];
    
    // Вычисляем стартовый индекс для имен (по кругу)
    const nameStartIndex = (daySeed * 24 + hourSeed) % names.length;
    
    // Вычисляем стартовый seed для сумм (отдельно от имен)
    const amountStartSeed = (daySeed * 97 + hourSeed * 31 + currentMinute) % 1000;
    
    for (let i = 0; i < notificationsCount; i++) {
      // Берем имя по кругу
      const nameIndex = (nameStartIndex + i) % names.length;
      
      // Генерируем уникальный seed для суммы (не зависящий от порядка i)
      const amountSeed = amountStartSeed * 17 + i * 13;
      const amountRandom = (Math.sin(amountSeed) + 1) / 2;
      
      // Генерируем сумму в случайном порядке
      const amount = Math.floor(100 + amountRandom * 2300);
      
      // Отдельный seed для времени
      const timeSeed = amountStartSeed * 23 + i * 19;
      const timeRandom = (Math.sin(timeSeed) + 1) / 2;
      const timeAgo = Math.floor(timeRandom * 120);
      
      // Генерируем уникальный ID, комбинируя timestamp с индексом и случайным числом
      const uniqueId = now - i * 60000 - timeAgo * 60000 + i + Math.floor(Math.random() * 1000);
      
      newNotifications.push({
        id: uniqueId,
        currency: 'USDT',
        amount: amount,
        username: names[nameIndex],
        timestamp: now - i * 60000 - timeAgo * 60000
      });
    }
    
    return newNotifications.sort((a, b) => b.timestamp - a.timestamp);
  };

  useEffect(() => {
    const initialNotifications = generateDeterministicNotifications();
    setNotifications(initialNotifications);

    const interval = setInterval(() => {
      const updatedNotifications = generateDeterministicNotifications();
      setNotifications(updatedNotifications);
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="withdrawal-notifications">
      <h3 className="panel-title">Recent Withdrawals</h3>
      
      <div className="notifications-list">
        {notifications.map((notification, index) => (
          <div
            key={notification.id}
            className={`notification-item ${index === 0 ? 'new' : ''}`}
          >
            <div className="notification-icon">
              <img src={usdt} alt="usdt"/>
            </div>
            <div className="notification-content">
              <div className="notification-amount">
                {formatAmount(notification.amount)} {notification.currency}
              </div>
              <div className="notification-user">{notification.username}</div>
            </div>
            <div className="notification-time">{formatTime(notification.timestamp)}</div>
          </div>
        ))}
      </div>

      {notifications.length === 0 && (
        <div className="empty-notifications">
          <div className="empty-icon">⏰</div>
          <p>No recent withdrawals</p>
        </div>
      )}
    </div>
  );
}