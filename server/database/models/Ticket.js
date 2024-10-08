const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  assistantThreadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'agentThread',
    required: false,
  },
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    required: true,
    default: 'Todo'  // Set default status here if all new tickets should start as 'Todo'
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  priority: {
    type: Number,
    default: 3,
  },
  threadId: {
    type: String,
    required: true,
  },
});

const Ticket = mongoose.model('Ticket', ticketSchema);
module.exports = Ticket; 
