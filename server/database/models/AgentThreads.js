const mongoose = require('mongoose');

const agentThreadSchema = new mongoose.Schema({
  assistantId: { type: String, required: true, unique: true },
  threadId: { type: String, required: true },
  agentName: {type: String, required: false},
  threadStatus: {type: String, required: false}
});

module.exports = mongoose.model('agentThread', agentThreadSchema);
