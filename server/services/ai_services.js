const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { OpenAI } = require('openai');
const { Octokit } = require("@octokit/rest");
const axios = require('axios');
const fs = require('fs');

// Make sure the OPENAI_API_KEY environment variable is set
if (!process.env.OPENAI_API_KEY) {
    console.error('The OPENAI_API_KEY environment variable is not set.');
    process.exit(1); // Exit the process if the API key is not set
}

const openaiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });

async function uploadFileViaPath(filePath) {
    try {
        const file = await openaiClient.files.create({
            file: fs.createReadStream(filePath),
            purpose: "assistants",
            });
        return file.id; // Return the ID of the uploaded file
    } catch (error) {
        console.error('Error uploading file:', error);
        throw new Error('Failed to upload file.');
    }
}  

async function uploadFile(fileItem) {
    try {
        const file = await openaiClient.files.create({
            file: fileItem,
            purpose: "assistants",
            });
        return file.id; // Return the ID of the uploaded file
    } catch (error) {
        console.error('Error uploading file:', error);
        throw new Error('Failed to upload file.');
    }
}  

async function createAssistant(name, instructions, description, fileId) {
    try {
        const response = await openaiClient.beta.assistants.create({
            name: name,
            instructions: instructions,
            description: description,
            model: "gpt-4-turbo-preview",
            tools: [{"type": "code_interpreter"}], // Adjust tools as needed
            file_ids: fileId ? [fileId] : [] // Ensure file_ids is an array of the file ID
        });
        return response; // Make sure to return the data part of the response
    } catch (error) {
        console.error('Error creating assistant:', error);
        throw new Error('Failed to create assistant.');
    }
}

//create a thread to use for the prompt
async function createThread() {
    try {
        const response = await openaiClient.beta.threads.create({});
        return response; // Return the data part of the response
    } catch (error) {
        console.error('Error creating thread:', error);
        throw new Error('Failed to create thread.');
    }
}

//add message to the thread to use when running 
async function addMessageToThread(thread, message) {
    try {
        // Determine whether `thread` is an object with an `id` property, else use `thread` directly
        const threadId = typeof thread === 'object' && thread !== null && thread.id ? thread.id : thread;

        const response = await openaiClient.beta.threads.messages.create(
            threadId,
            {
                role: "user",
                content: message,
            }
        );

        return response; // Assuming you want to return the entire response object
    } catch (error) {
        console.error('Error adding message to thread:', error);
        throw new Error('Failed to add to the thread.');
    }
}


async function addFileToThread(thread, fileName, fileId) {
    try {
      const threadId = typeof thread === 'object' && thread !== null && thread.id ? thread.id : thread;
        const response = await openaiClient.beta.threads.messages.create(
            threadId,
            {
                role: "user",
                content: fileName,
                file_ids: [fileId] // Attach the file ID(s) here
            }
        );

        console.log("Message with file added to thread:", response);
        return response; // Return the response data part
    } catch (error) {
        console.error('Error adding file to thread:', error);
        throw new Error('Failed to add file to the thread.');
    }
}


//run the thread and get the response w/ the new message that has been added 
async function runThread(thread, assistantId) {
    const threadId = typeof thread === 'object' && thread !== null && thread.id ? thread.id : thread;
    try {
        const response = await openaiClient.beta.threads.runs.create(
            threadId,
        {
            assistant_id: assistantId,
        });
        return response; // Return the data part of the response
    } catch (error) {
        console.error('Error running thread:', error);
        throw new Error('Failed to run thread.');
    }
}
  

  function runThreadWithStreaming(threadId, assistantId) {
        const stream = openaiClient.beta.threads.runs.createAndStream(threadId, {
          assistant_id: assistantId,
        });
  
        stream
          .on('textCreated', (text) => {
            console.log('\nassistant > ', text);
          })
          .on('textDelta', (textDelta, snapshot) => {
            process.stdout.write(textDelta.value);
          })
          .on('toolCallCreated', (toolCall) => {
            console.log(`\nassistant > ${toolCall.type}\n`);
          })
          .on('toolCallDelta', (toolCallDelta, snapshot) => {
            if (toolCallDelta.type === 'code_interpreter') {
                if (toolCallDelta.code_interpreter.input) {
                  console.log(toolCallDelta.code_interpreter.input);
                }
                if (toolCallDelta.code_interpreter.outputs) {
                  console.log("\noutput >\n");
                  toolCallDelta.code_interpreter.outputs.forEach(output => {
                    if (output.type === "logs") {
                      console.log(`\n${output.logs}\n`);
                    }
                  });
                }
              }
          })
          .on('runCompleted', (run) => {
            console.log("\nRun completed:", run);
            resolve(run); // Resolve the Promise with the run object
          })
          .on('error', (error) => {
            console.error("Error during streaming:", error);
            reject(error); // Reject the Promise on error
          });

          return stream;
  }

//retrieve the results of the run  (non streaming version)
async function retrieveRun(thread, run) {
    let keepRetrievingRun;
    const threadId = typeof thread === 'object' && thread !== null && thread.id ? thread.id : thread;

    while (run.status === "queued" || run.status === "in_progress") {
      keepRetrievingRun = await openaiClient.beta.threads.runs.retrieve(
        (thread_id = threadId),
        (run_id = run.id)
      );
      console.log(`Run status: ${keepRetrievingRun.status}`);

      if (keepRetrievingRun.status === "completed") {
        console.log("\n");

        // Step 6: Retrieve the Messages added by the Assistant to the Thread
        const allMessages = await openaiClient.beta.threads.messages.list(
          (thread_id = threadId)
        );

        console.log(
          "------------------------------------------------------------ \n"
        );

        //break;
        return allMessages.data[0].content[0].text.value;
      } else if (
        keepRetrievingRun.status === "queued" ||
        keepRetrievingRun.status === "in_progress"
      ) {
        // pass
      } else {
        console.log(`Run status: ${keepRetrievingRun.status}`);
        break;
      }
    }
}


/* streaming version
async function retrieveRun(threadId, assistantId) {
    return new Promise((resolve, reject) => {
      let messages = []; // Store messages received during the stream
  
      try {
        const stream = openaiClient.beta.threads.runs.createAndStream(threadId, {
          assistant_id: assistantId,
        });
  
        stream
          .on('textCreated', (text) => {
            // Optionally handle complete text messages here
          })
          .on('textDelta', (textDelta) => {
            // Collecting deltas of text. Adjust based on how you want to use these.
            messages.push(textDelta.value);
          })
          .on('runCompleted', (run) => {
            // Run has completed. Resolve the promise with collected messages or run data.
            console.log("\nRun completed");
            resolve({
              messages: messages,
              run: run
            });
          })
          .on('error', (error) => {
            console.error("Error during streaming:", error);
            reject(error); // Reject the promise on error
          });
  
      } catch (error) {
        console.error('Error running thread with streaming:', error);
        reject(error); // Reject the promise on catch
      }
    });
  }
  */

  /*
  async function getThreadTranscript(threadId) {
    try {
      // Fetch all messages from the specified thread
      const response = await openaiClient.beta.threads.messages.list(threadId);
  
      // Check if the response contains data and messages
      if (response && response.data) {
        const messagesInDescendingOrder = response.data.reverse();
        // Format messages into a transcript
        const transcript = messagesInDescendingOrder.map((message, index) => {
          const sender = message.role === 'user' ? 'User' : 'Assistant';
          const messageContent = message.content.map(content => content.type === 'text' ? content.text.value : '').join('\n');
          return `${index + 1}. [${sender}]: ${messageContent}`;
        }).join('\n\n');

        return transcript;
      } else {
        throw new Error('No messages found in the thread.');
      }
    } catch (error) {
      console.error('Error retrieving thread transcript:', error);
      throw error;
    }
  }
  */

  //changed above
  async function getThreadTranscript(threadId) {
    try {
      const response = await openaiClient.beta.threads.messages.list(threadId);
      if (response && response.data) {
        const messagesInDescendingOrder = response.data.reverse();
        const transcript = messagesInDescendingOrder.map((message, index) => {
          const sender = message.role === 'user' ? 'User' : 'Assistant';
          const messageContent = message.content.map(content => {
            console.log(content.type);
            switch (content.type) {
              case 'text':
                return content.text.value;
              case 'code':
                return `\`\`\`${content.language}\n${content.code}\n\`\`\``; // Formatting code block
              default:
                return '';
            }
          }).join('\n');
          return `${index + 1}. [${sender}]: ${messageContent}`;
        }).join('\n\n');
        return transcript;
      } else {
        throw new Error('No messages found in the thread.');
      }
    } catch (error) {
      console.error('Error retrieving thread transcript:', error);
      throw error;
    }
  }
  
  

// List all assistants
async function listAssistants(limit = 100, order = 'desc', after = null, before = null) {
    try {
        const response = await openaiClient.beta.assistants.list({
            limit: limit,
            order: order,
            after: after,
            before: before
        });
        return response.data; // Returns the list of assistant objects
    } catch (error) {
        console.error('Error listing assistants:', error);
        throw error;
    }
}

// Delete an assistant by ID
async function deleteAssistant(assistantId) {
    const url = `https://api.openai.com/v1/assistants/${assistantId}`;
  
    try {
      const response = await axios.delete(url, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'OpenAI-Beta': 'assistants=v1'
        }
      });
      console.log(`Assistant ${assistantId} deleted:`, response.data);
      return response.data; // Returns the deletion status
    } catch (error) {
      console.error(`Error deleting assistant ${assistantId}:`, error.response.data);
      throw error;
    }
  }
  
async function deleteAllAssistants() {
    try {
        const lsAssistants = await listAssistants();

        for (const assistant of lsAssistants) {
            console.log('Deleting assistant: ' + assistant.id);
            await deleteAssistant(assistant.id);
        }

    } catch (error) {
        console.error('Error in deleteAllAssistants:', error);
        throw error;
    }
}





module.exports = { uploadFileViaPath, getThreadTranscript, addFileToThread, runThreadWithStreaming, uploadFile, createAssistant, createThread, runThread, addMessageToThread, retrieveRun, listAssistants, deleteAssistant, deleteAllAssistants};
