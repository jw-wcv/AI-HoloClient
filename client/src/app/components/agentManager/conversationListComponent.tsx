import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../general/auth-provider';
import './conversationListComponent.css';
import AddAssistant from './addAssistant';
import ConversationComponent from './conversationComponent';

interface Assistant {
  id: string;
  name: string;
  description: string;
}

interface AgentThread {
  _id: string;
  assistantId: string;
  threadId: string;
  agentName: string;
}

function ConversationListcomponent() {
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [selectedAssistantId, setSelectedAssistantId] = useState<string | null>(null);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [selectedAgentName, setselectedAgentName] = useState<string | null>(null);
  const [agentThreads, setAgentThreads] = useState<AgentThread[]>([]);
  const { token } = useAuth();
  const [openDrawerId, setOpenDrawerId] = useState<string | null>(null);

   // States and functions for AddAssistant
   const [showAddAssistantModal, setShowAddAssistantModal] = useState(false);
   const [addAssistantForm, setAddAssistantForm] = useState({
     name: '',
     instructions: '',
     description: 'developer',
   });

   const handleAddAssistantFormChange = (e) => {
    const { name, value } = e.target;
    setAddAssistantForm(prevForm => ({ ...prevForm, [name]: value }));
  };

  const handleAddAssistantSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      alert('You are not authenticated.');
      return;
    }
    try {
      // POST request to create assistant
      const response = await axios.post(
        'http://localhost:3000/create-agent-thread',
        addAssistantForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log(response.data);
      alert('Assistant created successfully!');
      setShowAddAssistantModal(false);
      loadAssistants();
    } catch (error) {
      console.error('Error creating assistant:', error);
      alert('Error creating assistant.');
    }
  };

  const handleViewConversation = (threadId: string, assistantId: string, agentName: string ) => {
    setSelectedThread(threadId);
    setSelectedAssistantId(assistantId);
    setselectedAgentName(agentName);
  };

  /*
  const runAgentThread = async () => {
    if (!selectedThread || !selectedAssistantId) {
      alert('Please select a thread and an assistant to run.');
      return;
    }
  
    try {
      const response = await axios.post(
        'http://localhost:3000/run-agent-thread',
        { threadId: selectedThread, assistantId: selectedAssistantId },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      console.log('Agent thread run successfully:', response.data);
      
      // Refresh the conversation and re-render the modal
      if (selectedThread) {
        setShowConversationModal(false);
        await loadConversation(selectedThread);
      }
    } catch (error) {
      console.error('Error running agent thread:', error);
    }
  };
  */

  const loadAssistants = async () => {
    if (!token) return; // If there is no token, don't try to load assistants

    try {
      // Use the token to get the list of agents
      const response = await fetch('http://localhost:3000/list-agents', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`, // Use the token in the Authorization header
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch assistants');
      }

      const data = await response.json();
      setAssistants(data.result); // Assuming that the list of assistants is in the `result` field
    } catch (error) {
      console.error("Failed to load assistants:", error);
    }
  };

  const deleteAssistant = async (assistantId: string) => {
    if (!token) return; // If there is no token, don't try to delete the assistant

    try {
      // Use the token to send the delete request
      const response = await axios.post('http://localhost:3000/delete-specific-agent', { assistantId }, {
        headers: {
          'Authorization': `Bearer ${token}`, // Use the token in the Authorization header
        },
      });

      if (response.data) {
        alert('Assistant deleted successfully!');
        loadAssistants(); // Refresh the list after deletion
      }
    } catch (error) {
      console.error('Error deleting assistant:', error);
      alert('Error deleting assistant.');
    }
  };

  const loadAgentThreads = async (assistantId: string) => {
    if (!token) return;

    try {
      const response = await axios.post(
        'http://localhost:3000/search-agent-threads',
        { assistantId },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      setAgentThreads(response.data.agentThreads);
      //setShowThreadsModal(true); // Open the modal after loading the threads
    } catch (error) {
      console.error('Error fetching agent threads:', error);
    }
  };

  
  // Toggle drawer on assistant click
  const handleAssistantClick = (assistantId: string) => {
    // Toggle the drawer: if it's already open, close it; otherwise, open it
    if (openDrawerId === assistantId) {
      setOpenDrawerId(null);
    } else {
      setOpenDrawerId(assistantId);
      loadAgentThreads(assistantId);
    }
  };


  function getStatusColor(status) {
    switch (status) {
      case 'active':
        return 'status-green';
      case 'pending':
        return 'status-yellow';
      case 'inactive':
        return 'status-red';
      default:
        return '';
    }
  }

  const clearSelection = () => {
    setSelectedThread(null);
    setSelectedAssistantId(null);
  };

  useEffect(() => {
    loadAssistants();
  }, [token]); // Dependency array should include `token`
  
  return (
    <div className="general-container">
      <AddAssistant
        showModal={showAddAssistantModal}
        setShowModal={setShowAddAssistantModal}
        form={addAssistantForm}
        handleFormChange={handleAddAssistantFormChange}
        handleFormSubmit={handleAddAssistantSubmit}
      />
      {assistants.map((assistant) => (
        <React.Fragment key={assistant.id}>
        <div className="list-item">
          <div onClick={() => handleAssistantClick(assistant.id)}>
          <span className={`status-dot ${getStatusColor('active')}`} />
            <p className="list-item-name" >
              {assistant.name}
            </p>
            <p className="list-item-description">
              {assistant.description}
            </p>
          </div>
          <button onClick={() => deleteAssistant(assistant.id)} className="negative-button">
            Delete
          </button>
        </div>
        {/* Conditional drawer for threads */}
        {openDrawerId === assistant.id && (
        <div className="drawer open">
          <ul>
            {agentThreads.map((thread, index) => (
              <li key={thread._id} className="list-item">
                {/* Status indicator */}
                <div>
                  <span className={`status-dot ${getStatusColor('active')}`} /> {/* This function 'getStatusColor' will determine the color class based on thread status */}
                  <span>Thread ID: {thread.threadId} - Assistant ID: {assistant.id}</span>
                </div>
                <button onClick={() => handleViewConversation(thread.threadId, assistant.id, thread.agentName)}>View</button>
              </li>
            ))}
          </ul>
        </div>
        )}
        </React.Fragment>
      ))}
      
      {selectedThread && (
       <ConversationComponent 
       threadId={selectedThread}
       assistantId={selectedAssistantId}
       token={token}
       onClose={clearSelection}
       agentName={selectedAgentName} // Ensure this prop is passed
      />
      )}
    </div>
  );
}


export default ConversationListcomponent;
