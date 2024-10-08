const { getThreadTranscript, addFileToThread, runThreadWithStreaming, uploadFile, createAssistant, createThread, runThread, addMessageToThread, retrieveRun, listAssistants, deleteAssistant, deleteAllAssistants} = require('../services/ai_services');
const { createOrUpdateFileOnGitHub, createRepository, checkFileExists, checkRepositoryExists, getRepository, getFile } = require('../services/git_services');
const { getRecordsByModelName, deleteRecordsByModelName } = require('../services/database_services');
const { compressDirectory, removeVerboseExtensions, removeUnwantedCharacters, removeDuplicateFileExtensions, createFile, generateInvoice, sendInvoiceEmail, parseMarkdownContent } = require('../services/admin_services');

const WorkerAgent = require('./workerAgent');
const Repo_Maps = require('../data_maps/repo_maps');
const File_Maps = require('../data_maps/file_maps');
const agentThread = require('../database/models/AgentThreads.js'); 
const ServiceManager = require('../services/service_manager.js');

const path = require('path');
const fs = require('fs');

const markdownTemplate = `
  ### README
  Content: Overview of the project, installation instructions, usage examples, development notes, contribution guidelines. Names should be either camel case or include _ between each word.

  ### COMMIT_MESSAGE
  Content: Comment for commit messages in the file system. Text file.

  ### LICENSE
  Content: Terms under which the project's code can be used, modified, and distributed.

  ### main
  Content: Main application code file. Append the appropriate file extension (i.e .js, .json, .cls, etc) to the name.

  ### helper
  Content: Helper application code file. Optional but should be included if relevant. Append the appropriate file extension (i.e .js, .json, .cls, etc) to the name.

  ### .gitignore
  Content: Specifies intentionally untracked files to ignore in the project.

  ### package
  Content: Package.json (or alternative) for starting the project as required. May also be a package.xml file for deployment usage.

  ### config/config.json
  Content:
  {
  "configuration": "Project specific configuration parameters."
  }
  `;

  /*
const markdownTemplate = `
### README
Content: Overview of the project, installation instructions, usage examples, development notes, contribution guidelines. Names should be either camel case or include _ between each word.

### COMMIT_MESSAGE
Content: Comment for commit messages in the file system. Text file.

### LICENSE
Content: Terms under which the project's code can be used, modified, and distributed.

### main
Content: [code]Main application code file. Append the appropriate file extension (i.e .js, .json, .cls, etc) to the name.[/code]

### helper
Content: [code]Helper application code file. Optional but should be included if relevant. Append the appropriate file extension (i.e .js, .json, .cls, etc) to the name.[/code]

### .gitignore
Content: [code]Specifies intentionally untracked files to ignore in the project.[/code]

### package
Content: [code]Package.json (or alternative) for starting the project as required. May also be a package.xml file for deployment usage.[/code]

### config/config.json
Content:
[code]
{
  "configuration": "Project specific configuration parameters."
}
[/code]
`;
*/

// ... the rest of your message sending code remains the same
  

const nonTechnicalTemplate = `
  ### GREETING
  Content: Start with a friendly greeting to welcome the user and create a warm and approachable atmosphere.

  ### UNDERSTANDING THE QUESTION
  Content: Clearly state the user's question to demonstrate understanding. If clarification is needed, ask follow-up questions here.

  ### ANSWERING THE QUESTION
  Content: Provide a clear and concise answer to the user's question. If the answer requires multiple steps or parts, break them down into bullet points or numbered steps for easier understanding.

  ### ADDITIONAL RESOURCES
  Content: Offer resources for further reading or exploration if the user wants to learn more. This could include links to articles, videos, or external websites.

  ### FOLLOW-UP
  Content: Encourage the user to ask any further questions or express if they need more assistance on the topic.

  ### CLOSING
  Content: End with a polite closing statement, thanking the user for their question and inviting them to return with more inquiries in the future.

  ### FEEDBACK REQUEST
  Content: If applicable, ask the user for feedback on the provided assistance or on their overall experience.
  `;    

const conversationalTemplate = 'TBD';

class ManagingAgent {
  constructor() {
    this.workerAgents = [];
  }

  // This creates the Agent & Thread and maps them all together
  async createAgentThread(taskDescription, agentName) {
    try {
      let instructions = `Hello ${agentName},\n\nYou have been tasked with: ${taskDescription}\n\n`;

      const assistantResponse = await createAssistant(agentName, instructions); 
      const assistantId = assistantResponse.id; // Extract the assistant ID
      //change to use existing assistants if available later

      const threadResponse = await createThread();  
      const threadId = threadResponse.id; // Extract the thread ID
      const threadStatus = 'idle';

      console.log(`Assistant ID: ${assistantId}, Thread ID: ${threadId}`);

      //add message to thread
      await addMessageToThread(threadResponse, '----------------------Instructions Section Start----------------------');
      await addMessageToThread(threadResponse, 'Here is a template for any technical responses. Please be sure to include all of the following sections to be parsed as individual files: ' + markdownTemplate);
      await addMessageToThread(threadResponse, 'You are never to respond with links to files to download. You should always provide the actual files as a response per the technical template when files are required. Use "---" to break between each file section in your response.')
      await addMessageToThread(threadResponse, 'Additionally, you are never to return partial code. If you are asked to work on a file, you should always return a completed version of that file. If you are given a folder, you should return the entire contents of that folder.');
      await addMessageToThread(threadResponse, 'You should also make sure you always retain any existing functionality when making changes, unless specified otherwise.');
      //await addMessageToThread(threadResponse, 'For any non-technical responses, please use the following markdown template: ' + nonTechnicalTemplate);
      await addMessageToThread(threadResponse, 'Please strictly follow the provided guidelines and markdown template schemas when dealing with technical topics in order to ensure compatibility with external processes.');
      await addMessageToThread(threadResponse, '----------------------Instructions Section End----------------------');
      await addMessageToThread(threadResponse, instructions);
      
      /*
      await addMessageToThread(threadResponse, '----------------------Instructions Section Start----------------------');
      await addMessageToThread(threadResponse, 'When providing technical responses that include code, wrap the code portions within [code] and [/code] tags. This applies to main application code, helper files, .gitignore, package files, and configuration files.');
      await addMessageToThread(threadResponse, 'Here is a template for any technical responses. Please be sure to include all of the following sections to be parsed as individual files, with code sections properly tagged: ' + markdownTemplate);
      await addMessageToThread(threadResponse, 'You are never to respond with links to files to download. You should always provide the actual files as a response per the technical template when files are required. Use "---" to break between each file section in your response.');
      await addMessageToThread(threadResponse, 'Additionally, you are never to return partial code. If you are asked to work on a file, you should always return a completed version of that file. If you are given a folder, you should return the entire contents of that folder.');
      await addMessageToThread(threadResponse, 'Make sure to retain any existing functionality when making changes, unless specified otherwise.');
      await addMessageToThread(threadResponse, 'For any non-technical responses, please use the following markdown template: ' + nonTechnicalTemplate);
      await addMessageToThread(threadResponse, 'Please strictly follow the provided guidelines and markdown template schemas to complete your task efficiently and ensure compatibility elsewhere.');
      await addMessageToThread(threadResponse, '----------------------Instructions Section End----------------------');
      */

      try {
        // Create the assistantThread model
        const assistantThread = new agentThread({ assistantId, threadId, agentName, threadStatus });
        await assistantThread.save();
        return assistantThread;
      } catch (error) {
        console.error('Error creating agentThread:', error);
      }
    } catch (error) {
      console.error('Error in createAgentThread:', error);
      throw error; // or handle the error as needed
    }
  }

  // This is the async option that returns the results to the websocket in a streaming fashion. 
  // However, it does not currently generate files as well
  async runAndRetrieveResults(threadId, assistantId) {
    try {
      // Run the thread
      const run = await runThread(threadId, assistantId); 
      //const run = runThreadWithStreaming(threadId, assistantId);

      const results = await retrieveRun(threadId, run);

      getThreadTranscript(threadId).then(transcript => {
        console.log("Complete Transcript:\n", transcript);
      }).catch(error => {
        console.error("Error:", error);
      });

      return results;
    } catch (error) {
      console.error('Error in runAndRetrieveResults:', error);
      throw error; // or handle the error as needed
    }
  }

  //working on this last
  async processDirectory(directoryPath, repoOwner, repoName) {
    try {
      const files = await fs.promises.readdir(directoryPath);
      for (const fileName of files) {
        const filePath = path.join(directoryPath, fileName);
        const fileContent = await fs.promises.readFile(filePath, 'utf8');
        
        let commitMessage = fileName === 'COMMIT_MESSAGE.txt' ? fileContent : `Update ${fileName}`;
        await createOrUpdateFileOnGitHub(repoOwner, repoName, `${repoName}/${fileName}`, fileContent, commitMessage);
      }
    } catch (err) {
      console.error('Error processing directory:', err);
    }
  }
  
   formatTaskName(taskName) {
    // Replace spaces with hyphens and remove any non-alphanumeric characters except hyphens and underscores
    return taskName.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-_]/g, '');
  }

  //this creates the files and returns them
  async processComplexTask(threadId, assistantId, taskName) {
    const results = [];
    const repos = [];
    const repoMaps = [];

    const threadRunResult = await this.runAndRetrieveResults(threadId, assistantId);
    results.push(threadRunResult);

   // let repoPath = repoName + '.md';
    let repoName = this.formatTaskName(taskName);
    let repoOwner = 'jw-wcv'; //eventually move to client .env file and pass as param

    //get repo information or create it if a new one is needed
    try {
      const checkRepo = await checkRepositoryExists(repoOwner, repoName);
      if (!checkRepo) {
        let repo = await createRepository(repoName);
        repos.push(repo);
      } else {
        let repo = await getRepository(repoOwner, repoName);
        repos.push(repo);
      }

      for (const repo of repos) {
        const repo_map = new Repo_Maps(repo.name, repo.owner, repo.name, results, repo);
        repoMaps.push(repo_map);
      }

      if (repoMaps.length === 0) {
        console.error('No repository information available in repoMaps.');
        return;
      }

      results.forEach(async (result, index) => {
        console.log(`Creating or updating file on GitHub with owner: ${repoOwner}, repo: ${repoName}`);
        const commitResult = await createOrUpdateFileOnGitHub(repoOwner, repoName, 'README.md', result, 'Initial commit.');
        
        let filesData = parseMarkdownContent(result); 
        console.log('result: ');
        console.log(result);

        filesData.forEach(async ({ fileName, fileContent }) => {
          const filePath = path.join(__dirname, '..', '..', 'file_outputs', 'uncompressed_directories', repoName, fileName);
          createFile(filePath, fileContent);
        }); 

        const directoryPath = path.join(__dirname, '..', '..', 'file_outputs', 'uncompressed_directories', repoName); 
        const outputZipPath = path.join(__dirname, '..', '..', 'file_outputs', 'compressed_directories', repoName+'.zip');

        (async () => {
          await removeDuplicateFileExtensions(directoryPath);
          await removeUnwantedCharacters(directoryPath);
          await removeVerboseExtensions(directoryPath);
          console.log('processing directory: ', directoryPath);
          await this.processDirectory(directoryPath, repoOwner, repoName);

          compressDirectory(directoryPath, outputZipPath)
          .then(() => console.log('Compression completed.'))
          .catch(err => console.error('An error occurred:', err));
        })();
      });

      return results;
    } catch (error) {
      console.log(error); 
    }
  }

  identifySubTasks(taskDescription) {
      // Logic to break down the taskDescription into smaller tasks
      // This is an example, adjust based on task structure
      return taskDescription.split(';').map(task => ({ type: 'analyze', details: task.trim() }));
  }

  compileResults(results) {
      // Logic to compile and assess results from WorkerAgents
      // Adjust as needed
      return results.join('\n');
  }


}

module.exports = ManagingAgent;
