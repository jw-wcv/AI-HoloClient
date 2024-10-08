import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../general/auth-provider';
import './ticketManager.css';

interface TicketModalProps {
  show: boolean;
  onClose: () => void;
  onTicketCreated: () => void;
}

const TicketModal: React.FC<TicketModalProps> = ({ show, onClose, onTicketCreated }) => {
  // Add the priority field to your ticketData state with a default value
  const [ticketData, setTicketData] = useState({
    name: '',
    description: '',
    status: 'Todo',
    priority: 3, // default priority
  });
  const { token } = useAuth();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setTicketData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const threadId = await createThread();
      if (threadId) {
        await createTicket(threadId);
        onTicketCreated();
        alert('Ticket created successfully!');
        onClose();
      }
    } catch (error) {
      console.error('Error creating ticket:', error);
    }
  };

  const createTicket = async (threadId) => {
    try {
        // Include the threadId with the ticketData in the body of the POST request
        const dataToSend = {
            ...ticketData,  // assuming ticketData is accessible in this context
            threadId: threadId
        };

        await axios.post('http://localhost:3000/create-ticket', dataToSend, {
            headers: { Authorization: `Bearer ${token}` },
        });
    } catch (error) {
        console.error('Error creating ticket:', error);
    }
}

  const createThread = async () => {
    try {
      // Send a POST request to create a thread and capture the response
      const response = await axios.post('http://localhost:3000/create-thread', {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
  
      // Assuming the thread ID is in the response data under the key 'threadId'
      const threadId = response.data.result.id;
      console.log('Created thread ID:', threadId);
  
      // Return threadId for use in other functions
      return threadId;
    } catch (error) {
      console.error('Error creating thread:', error);
      return null; // Return null or throw an error as needed
    }
  }

  if (!show) {
    return null;
  }

  return (
    <div className="add-item-modal-overlay">
      <div className="add-item-modal">
        <h2>Create New Ticket</h2>
        <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name">Name:</label>
          <input
            type="text"
            id="name"
            name="name"
            value={ticketData.name}
            onChange={handleInputChange}
            required
          />
          </div>
          <div className="form-group">
          <label htmlFor="description">Description:</label>
          <textarea
            id="description"
            name="description"
            value={ticketData.description}
            onChange={handleInputChange}
            required
          />
          </div>
          <div className="form-group">
            <label htmlFor="priority">Priority:</label>
            <select
              id="priority"
              name="priority"
              value={ticketData.priority}
              onChange={handleInputChange}
              required
            >
              <option value="1">High</option>
              <option value="2">Medium</option>
              <option value="3">Low</option>
              {/* Add more options here if needed */}
            </select>
          </div>
          <div className="form-actions">
            <button className="submit-button" type="submit">Submit Ticket</button>
            <button className="cancel-button" type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TicketModal;
