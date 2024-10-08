const axios = require('axios');
const { queryAssistant } = require('../services/ai_services');

class WorkerAgent {
  constructor(instructions, assistantId, threadId, run ) {
    this.instructions = instructions;
    this.assistantId = assistantId;
    this.threadId = threadId;
    this.run = run;
  }
}

module.exports = WorkerAgent;
