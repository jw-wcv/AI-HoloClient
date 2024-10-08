import React, { useState, useEffect } from 'react';
import TicketModal from './ticketModal';
import { useAuth } from '../general/auth-provider';
import './ticketManager.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';

// TypeScript interfaces for the component's state
interface Ticket {
  id: string;
  assistantThreadId?: string;
  name: string;
  description: string;
  status: 'Todo' | 'In Progress' | 'In Review' | 'Done'; // Updated status options
  priority: 1 | 2 | 3
}

const TicketComponent: React.FC = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [showModal, setShowModal] = useState(false);
  const { token } = useAuth();

  // Function to load tickets from the server
  const loadTickets = async () => {
    if (!token) return; // If there is no token, don't try to load assistants

    try {
      // Use the token to get the list of agents
      const response = await fetch('http://localhost:3000/list-tickets', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`, // Use the token in the Authorization header
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch assistants');
      }

      const data = await response.json();
      setTickets(data.result); // Assuming that the list of assistants is in the `result` field
      console.log(data.result);
    } catch (error) {
      console.error("Failed to load assistants:", error);
    }
  };

  // Call `loadTickets` on component mount and when the modal closes
  useEffect(() => {
    loadTickets();
  }, [token]);

  // Function to render tickets by status
  const renderTickets = (status: 'Todo' | 'In Progress' | 'In Review' | 'Done') => {
    return tickets.filter(ticket => ticket.status === status).map(ticket => (
      <div key={ticket.id} className="list-item">
        <h3>{ticket.name}</h3>
        <p>{ticket.description}</p>
        <p>{ticket.priority}</p>
        {/* More ticket details and options here */}
      </div>
    ));
  };

  return (
    <div className="general-container">
      <button className="positive-button" onClick={() => setShowModal(true)}>
        <FontAwesomeIcon icon={faPlus} />
        <span></span>
      </button>
      {showModal && (
        <TicketModal
          show={showModal}
          onClose={() => setShowModal(false)}
          onTicketCreated={loadTickets} // Reload tickets on creation
        />
      )}
      <div className="kanban-board">
        <div className="kanban-column todo">
          <h2>Todo</h2>
          <div className="list-of-items">
            {renderTickets('Todo')}
          </div>
        </div>
        <div className="kanban-column in-progress">
          <h2>In Progress</h2>
          <div className="list-of-items">
            {renderTickets('In Progress')}
          </div>
        </div>
        <div className="kanban-column in-review">
          <h2>In Review</h2>
          <div className="list-of-items">
            {renderTickets('In Review')}
          </div>
        </div>
        <div className="kanban-column done">
          <h2>Done</h2>
          <div className="list-of-items">
            {renderTickets('Done')}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketComponent;
