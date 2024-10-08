const mongoose = require('mongoose');
const agentThread = require('../database/models/AgentThreads.js'); 
const Ticket = require('../database/models/Ticket.js'); 
const { ObjectId } = require('mongoose').Types;

// Function to get records by model name
async function getRecordsByModelName(modelName, query = {}) {
    try {
      // Check if the model exists
      if (!mongoose.modelNames().includes(modelName)) {
        throw new Error(`Model '${modelName}' does not exist.`);
      }
  
      // Dynamically get the model
      const Model = mongoose.model(modelName);
  
      // Retrieve and return records based on the provided query
      const records = await Model.find(query);
      return records;
    } catch (error) {
      console.error('Error retrieving records:', error);
      throw error;
    }
  }

  async function deleteRecordsByModelName(modelName, query = {}) {
    try {
        // Check if the model exists
        if (!mongoose.modelNames().includes(modelName)) {
            throw new Error(`Model '${modelName}' does not exist.`);
        }

        // Dynamically get the model
        const Model = mongoose.model(modelName);

        // Delete records based on the provided query
        const result = await Model.deleteMany(query);
        console.log(`${result.deletedCount} records deleted.`);
        return result;
    } catch (error) {
        console.error('Error deleting records:', error);
        throw error;
    }
}

async function findRecordById(modelName, id) {
  try {
      if (!mongoose.modelNames().includes(modelName)) {
          throw new Error(`Model '${modelName}' does not exist.`);
      }

      const Model = mongoose.model(modelName);

      // Retrieve a single record by ID
      const result = await Model.findById(id);
      if (result) {
          console.log(`Record with ID ${id} found.`);
          return result;
      } else {
          console.log(`No record found with ID ${id}.`);
          return null;
      }
  } catch (error) {
      console.error('Error retrieving record:', error);
      throw error;
  }
}


async function deleteRecordById(modelName, id) {
  try {
      if (!mongoose.modelNames().includes(modelName)) {
          throw new Error(`Model '${modelName}' does not exist.`);
      }

      const Model = mongoose.model(modelName);

      // Delete a single record by ID
      const result = await Model.findByIdAndDelete(id);
      if (result) {
          console.log(`Record with ID ${id} deleted.`);
          return result;
      } else {
          console.log(`No record found with ID ${id}.`);
          return null;
      }
  } catch (error) {
      console.error('Error deleting record:', error);
      throw error;
  }
}











// Function to find AgentThread records by assistantId
async function findAgentThreadsByAssistantId(assistantId) {
  try {
    const modelName = 'agentThread'; // Replace with your actual AgentThread model name
    if (!mongoose.modelNames().includes(modelName)) {
      throw new Error(`Model '${modelName}' does not exist.`);
    }
    const AgentThread = mongoose.model(modelName);
    const agentThreads = await AgentThread.find({ assistantId: assistantId });
    return agentThreads;
  } catch (error) {
    console.error('Error finding agent threads:', error);
    throw error;
  }
}

// Functions to insert/delete a new Ticket record
async function insertTicket(name, description, priority, threadId) {
  try {
    // Create a new ticket record with the provided name and description
    const newTicket = await Ticket.create({
      name: name,
      description: description,
      status: 'Todo',  // Assuming default status is 'Todo',
      priority: priority,
      threadId: threadId,
      // assistantThreadId can be left undefined, and createdAt will automatically be set by Mongoose as per the schema defaults
    });

    return newTicket; // Return the newly created ticket
  } catch (error) {
    console.error('Error inserting ticket:', error);
    throw error; // Propagate the error further if needed
  }
}

async function deleteTicketById(ticketId) {
  try {
      // Assuming ticketId is a string and needs to be converted to ObjectId
      const query = { _id: new ObjectId(ticketId) };
      await deleteRecordsByModelName('Ticket', query);
      console.log('Ticket deleted successfully');
  } catch (error) {
      console.error('Failed to delete ticket:', error);
  }
}

async function updateTicketStatusById(ticketId, newStatus, newName, newDescription) {
  try {
    const query = { _id: new ObjectId(ticketId) };
    const update = { status: newStatus, name: newName, description: newDescription };
    const options = { new: true }; // Returns the document after update was applied

    const updatedTicket = await Ticket.findOneAndUpdate(query, update, options);

    if(updatedTicket) {
      console.log('Ticket updated successfully:', updatedTicket);
    } else {
      console.log('Ticket not found or no update was necessary.');
    }
  } catch (error) {
    console.error('Failed to update ticket:', error);
  }
}

module.exports = { updateTicketStatusById, deleteTicketById, findAgentThreadsByAssistantId, getRecordsByModelName, deleteRecordsByModelName, deleteRecordById, findRecordById, insertTicket };