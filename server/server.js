require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const cors = require('cors');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const os = require('os');
const path = require('path');
const axios = require('axios');
const util = require('util');
const readdir = util.promisify(fs.readdir);
const stat = util.promisify(fs.stat);
const readFile = util.promisify(fs.readFile);

const { v4: uuidv4 } = require('uuid'); // Import UUID to generate session IDs
const { body, validationResult } = require('express-validator');
const { Server } = require('ws');
const activeStreams = {}; // Holds references to active streams

const ManagingAgent = require('./agents/managingAgent.js');
const managingAgent = new ManagingAgent();
const ServiceManager = require('./services/service_manager.js');
const aiServices = require('./services/ai_services.js');
const User = require('./database/models/User.js'); // Assuming you have a User model
const { updateTicketStatusById, deleteTicketById, insertTicket, findAgentThreadsByAssistantId, getRecordsByModelName, deleteRecordsByModelName } = require('./services/database_services');
const { extractMetadataZipForOrg, checkRetrieveStatus, updateEnvFileWithToken, getOAuthToken, getSFToken, getSFMetadata, getSFToolingMetadata, getOrgDetails, refreshAccessToken } = require('./services/salesforce_services');
const { deleteRepository } = require('./services/git_services');
const SF_OAUTH_AUTHORIZE_URL = process.env.SF_OAUTH_AUTHORIZE_URL;
const SF_CLIENT_ID = process.env.SF_CLIENT_ID;
const SF_REDIRECT_URI = process.env.SF_REDIRECT_URI;


const FILE_INPUTS_DIR = path.join(__dirname, '..', 'file_inputs', 'salesforce');
const FILE_OUTPUTS_DIR = path.join(__dirname, '..', 'file_outputs', 'salesforce');
const ENVS_DIR = path.join(FILE_INPUTS_DIR, 'envs');
const XMLS_DIR = path.join(FILE_INPUTS_DIR, 'xmls');
const DOCUMENTATION_DIR = path.join(FILE_OUTPUTS_DIR, 'documentation');
// Constants for directories //
const SF_ORGS_DIR = path.join(__dirname, '..', 'file_inputs', 'salesforce', 'sf_orgs');



const app = express();
app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 }, // for example, limit file size to 50MB
}));

app.use(helmet());
app.use(morgan('combined'));
app.use(bodyParser.json());
app.use(express.json());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
}));

app.use(cors((req, callback) => {
  const allowedOrigins = ['http://localhost:5001'];
  const origin = req.header('Origin');
  if (!origin || allowedOrigins.includes(origin)) {
    callback(null, { origin: true });
  } else {
    callback(new Error('Not allowed by CORS'));
  }
}));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Middleware for authentication
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token == null) {
      return res.status(401).json({ error: 'No token provided' });
    }
  
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
      if (err) {
        console.error('Token verification error:', err.message);
        return res.status(403).json({ error: 'Failed to authenticate token' });
      }
      req.user = user;
      console.log('Token verified for user:', user);
      next();
    });
  }

//helper file for upload-thread-file
async function uploadFileFromBuffer(buffer, originalName) {
  const tempFilePath = path.join(os.tmpdir(), originalName);
  fs.writeFileSync(tempFilePath, buffer);

  try {
    const fileId = await aiServices.uploadFileViaPath(tempFilePath);
    console.log('Successfully uploaded file:', fileId);
    fs.unlinkSync(tempFilePath); // Cleanup
    return fileId;
  } catch (error) {
    console.error('Error uploading file:', error);
    fs.unlinkSync(tempFilePath); // Ensure cleanup even in case of error
    throw error;
  }
  }  
  
/* AI Agent Endpoints */
  /* Thread Functions Below */
    app.post('/create-agent', authenticateToken, async (req, res) => {
      try {

          // Extract parameters from the request body
          const { name, instructions, description } = req.body;

          // Logging the extracted parameters
          console.log('name:', name);
          console.log('instructions:', instructions);
          console.log('description:', description);
          const result = await aiServices.createAssistant(name, instructions, description);
          console.log(result);

          // Sending response back to the client
          res.json({ message: 'Task processed successfully.', result });
      } catch (error) {
          // Logging and returning the error response
          console.error('Error processing task:', error);
          res.status(500).json({ error: 'Error processing task' });
          //working on branch 
      }
    });

    app.post('/create-thread', authenticateToken, async (req, res) => {
      try {

          const result = await aiServices.createThread();
          console.log(result);

          // Sending response back to the client
          res.json({ message: 'Task processed successfully.', result });
      } catch (error) {
          // Logging and returning the error response
          console.error('Error processing task:', error);
          res.status(500).json({ error: 'Error processing task' });
      }
    });

    app.post('/create-agent-thread', authenticateToken, async (req, res) => {
      try {
          // Extract parameters from the request body
          const { instructions, name } = req.body;

          // Logging the extracted parameters
          console.log('Task Description:', instructions);
          console.log('Agent Name:', name);

          // Passing the extracted parameters to the processComplexTask method    askDescription, agentName, filePath, fileIncluded
          const result = await managingAgent.createAgentThread(instructions, name);

          // Sending response back to the client
          res.json({ message: 'Task processed successfully.', result });
      } catch (error) {
          // Logging and returning the error response
          console.error('Error processing task:', error);
          res.status(500).json({ error: 'Error processing task' });
      }
    });

    app.get('/list-agents', authenticateToken, async (req, res) => {
      try {
          const result = await aiServices.listAssistants();
          console.log(result);

          // Sending response back to the client
          res.json({ message: 'Task processed successfully.', result });
      } catch (error) {
          // Logging and returning the error response
          console.error('Error processing task:', error);
          res.status(500).json({ error: 'Error processing task' });
      }
    });

    app.post('/delete-specific-agent', authenticateToken, async (req, res) => {
      try {

          // Extract parameters from the request body
          const { assistantId } = req.body;

          // Logging the extracted parameters
          console.log('assistantId:', assistantId);
          const result = await aiServices.deleteAssistant(assistantId);
          console.log(result);

          // Sending response back to the client
          res.json({ message: 'Task processed successfully.', result });
      } catch (error) {
          // Logging and returning the error response
          console.error('Error processing task:', error);
          res.status(500).json({ error: 'Error processing task' });
      }
    });

    app.post('/delete-agents', authenticateToken, async (req, res) => {
      try {
          const result = await aiServices.deleteAllAssistants();
          console.log(result);

          // Sending response back to the client
          res.json({ message: 'Task processed successfully.', result });
      } catch (error) {
          // Logging and returning the error response
          console.error('Error processing task:', error);
          res.status(500).json({ error: 'Error processing task' });
      }
    });

    app.post('/upload-thread-file', async (req, res) => {
      if (!req.files || !req.files.zipfile) {
        return res.status(400).send('No zip file was uploaded.');
      }

      const zipfile = req.files.zipfile;
      const threadId = req.body.threadId;
      const filename = req.body.filename;

      try {
        // Use the buffer and original filename to upload the file
        const fileId = await uploadFileFromBuffer(zipfile.data, zipfile.name);
        console.log('Successfully processed zip file:', zipfile.name);
        const linkedFile = await aiServices.addFileToThread(threadId, filename, fileId);
        console.log('Successfully linked zip file to thread:', zipfile.name);
        
        res.status(200).json({ 
          message: 'Zip file processed successfully', 
          filename: zipfile.name,
          fileId: fileId // Assuming fileId is what you want to return
        });
      } catch (error) {
        console.error('Error processing zip file:', error);
        res.status(500).send('Error processing zip file.');
      }
    });

    app.post('/add-thread-message', authenticateToken, async (req, res) => {
      try {
          // Extract parameters from the request body
          const { threadId, message } = req.body;

          // Logging the extracted parameters
          console.log('threadId:', threadId);
          const result = await aiServices.addMessageToThread(threadId, message);
          console.log(result);

          // Sending response back to the client
          res.json({ message: 'Task processed successfully.', result });
      } catch (error) {
          // Logging and returning the error response
          console.error('Error processing task:', error);
          res.status(500).json({ error: 'Error processing task' });
      }
    });

    app.post('/run-agent-thread', authenticateToken, async (req, res) => {
      try {

          // Extract parameters from the request body
          const { threadId, assistantId } = req.body;

          const result = await aiServices.runThread(threadId, assistantId);
          console.log(result);

          // Sending response back to the client
          res.json({ message: 'Task processed successfully.', result });
      } catch (error) {
          // Logging and returning the error response
          console.error('Error processing task:', error);
          res.status(500).json({ error: 'Error processing task' });
      }
    });

    app.post('/view-thread-conversation', authenticateToken, async (req, res) => {
      try {
        // Extract assistantId from the request body
        const { threadId } = req.body;

        // Log the assistantId for debugging
        console.log('Retrieving thread for:', threadId);

        // Use the function from aiServices to find the threads
        const threadConversation = await aiServices.getThreadTranscript(threadId);
        
        // Sending the found agent threads back to the client
        res.json({ message: 'Thread conversation retrieved', threadConversation });
      } catch (error) {
        // Logging and returning the error response
        console.error('Error searching for agent threads:', error);
        res.status(500).json({ error: 'Error searching for agent threads' });
      }
    });

    app.post('/search-agent-threads', authenticateToken, async (req, res) => {
      try {
        // Extract assistantId from the request body
        const { assistantId } = req.body;

        // Log the assistantId for debugging
        console.log('Searching for agent threads with assistantId:', assistantId);

        // Use the function from aiServices to find the threads
        const agentThreads = await findAgentThreadsByAssistantId(assistantId);
        
        // Sending the found agent threads back to the client
        res.json({ message: 'Agent threads retrieved successfully.', agentThreads });
      } catch (error) {
        // Logging and returning the error response
        console.error('Error searching for agent threads:', error);
        res.status(500).json({ error: 'Error searching for agent threads' });
      }
    });

  /* Ticket Functions Below */
    app.post('/create-ticket', authenticateToken, async (req, res) => {
      try {
          // Extract parameters from the request body
          const { name, description, priority, threadId } = req.body;

          // Passing the extracted parameters to the processComplexTask method    askDescription, agentName, filePath, fileIncluded
          const result = await insertTicket(name, description, priority, threadId);

          // Sending response back to the client
          res.json({ message: 'Task processed successfully.', result });
      } catch (error) {
          // Logging and returning the error response
          console.error('Error processing task:', error);
          res.status(500).json({ error: 'Error processing task' });
      }
    });

    app.get('/list-tickets', authenticateToken, async (req, res) => {
      try {
        console.log('List tickets');
          let modelName = 'Ticket';
          const result = await getRecordsByModelName(modelName);
          console.log(result);

          // Sending response back to the client
          res.json({ message: 'Task processed successfully.', result });
      } catch (error) {
          // Logging and returning the error response
          console.error('Error processing task:', error);
          res.status(500).json({ error: 'Error processing task' });
      }
    });

    app.get('/delete-tickets', authenticateToken, async (req, res) => {
      try {
          // Extract parameters from the request body
          const { id } = req.body;
          let modelName = 'Ticket';

          // Passing the extracted parameters to the processComplexTask method    askDescription, agentName, filePath, fileIncluded
          const result = await deleteRecordsByModelName(modelName);

          // Sending response back to the client
          res.json({ message: 'Task processed successfully.', result });
      } catch (error) {
          // Logging and returning the error response
          console.error('Error processing task:', error);
          res.status(500).json({ error: 'Error processing task' });
      }
    });

    app.post('/delete-ticket-by-id', authenticateToken, async (req, res) => {
      try {
          // Extract parameters from the request body
          const { id } = req.body;

          // Passing the extracted parameters to the processComplexTask method    askDescription, agentName, filePath, fileIncluded
          const result = await deleteTicketById(id);

          // Sending response back to the client
          res.json({ message: 'Task processed successfully.', result });
      } catch (error) {
          // Logging and returning the error response
          console.error('Error processing task:', error);
          res.status(500).json({ error: 'Error processing task' });
      }
    });

    app.post('/update-ticket-by-id', authenticateToken, async (req, res) => {
      try {
          // Extract parameters from the request body
          const { id, status, name, description } = req.body;

          // Passing the extracted parameters to the processComplexTask method    askDescription, agentName, filePath, fileIncluded
          const result = await updateTicketStatusById(id, status, name, description);

          // Sending response back to the client
          res.json({ message: 'Task processed successfully.', result });
      } catch (error) {
          // Logging and returning the error response
          console.error('Error processing task:', error);
          res.status(500).json({ error: 'Error processing task' });
      }
    });

/* Directory Ednpoint Below */
  // API endpoint to get directory contents
  app.get('/get-directory', async (req, res) => {
    const directoryPath = req.query.path || '/Users/JJ/Documents/Projects/virtual-agent-system/file_outputs/uncompressed_directories';
  
    try {
      const files = await readdir(directoryPath);
      const contents = await Promise.all(files.map(async (file) => {
        const filePath = path.join(directoryPath, file);
        const stats = await stat(filePath);
        return {
            name: file,
            isFolder: stats.isDirectory(),
            path: filePath
        };
      }));
  
      res.json(contents);
    } catch (error) {
      console.error('Error reading directory', error);
      res.status(500).send('Error reading directory');
    }
  });

  // Endpoint to retrieve file contents
  app.get('/get-file', async (req, res) => {
    const filePath = req.query.path;

    if (!filePath) {
      return res.status(400).json({ error: 'A file path is required' });
    }

    try {
      const data = await readFile(filePath, 'utf-8');
      res.send(data); // Send file contents back as plain text
    } catch (error) {
      console.error(`Error reading file at path ${filePath}:`, error);
      res.status(500).json({ error: `Error reading file at path ${filePath}` });
    }
  });




/* Functional APIs below */
  // User registration
  app.post('/register', [
    body('username').isString(),
    body('password').isLength({ min: 5 })
  ], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      const { username, password } = req.body;
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = new User({ username, password: hashedPassword });
      await user.save();
      res.status(201).json({ message: 'User created!' });
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({ error: 'Error creating user' });
    }
  });

  // User login
  app.post('/login', async (req, res) => {
    try {
      const user = await User.findOne({ username: req.body.username });
      if (user && await bcrypt.compare(req.body.password, user.password)) {
        const token = jwt.sign({ userId: user._id }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '24h' });
        res.json({ token });
      } else {
        res.status(401).json({ error: 'Invalid credentials' });
      }
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Error during login' });
    }
  });

  // Submit commplex task
  app.post('/submit-task', authenticateToken, async (req, res) => {
    try {
        // Extract parameters from the request body
        const { threadId, assistantId, taskName } = req.body;

        // Passing the extracted parameters to the processComplexTask method   
        const result = await managingAgent.processComplexTask(threadId, assistantId, taskName);

        // Sending response back to the client
        res.json({ message: 'Task processed successfully.', result });
    } catch (error) {
        // Logging and returning the error response
        console.error('Error processing task:', error);
        res.status(500).json({ error: 'Error processing task' });
    }
  });

  // Generate invoices 
  app.post('/generate-invoice', authenticateToken, async (req, res) => {
    try {
      const serviceManager = new ServiceManager();
      const { clientEmail, client, invoiceNumber, startDate, endDate, hoursWorked, hourlyRate } = req.body;

      console.log('clientEmail:', clientEmail);
      console.log('client:', client);
      console.log('invoiceNumber:', invoiceNumber);

      // Execute the service and handle the result
      const result = await serviceManager.executeService('admin', 'sendInvoiceEmail', { 
        clientEmail, 
        client, 
        invoiceNumber, 
        startDate, 
        endDate, 
        hoursWorked, 
        hourlyRate 
      });

      // Send the response
      console.log('Service execution result:', result);
      res.json({ message: 'Task processed successfully.', result });
    } catch (error) {
      console.error('Error processing task:', error);
      res.status(500).json({ error: 'Error processing task' });
    }
  });

  // Download files
  app.get('/test-file-download', authenticateToken, async (req, res) => {
    try {
      // Let's say you receive a message with a file URL or path
      const fileUrl = 'https://fileserviceuploadsperm.blob.core.windows.net/files/file-a0o6Vn15CMv3aDb09etBHX3x?se=2024-04-02T03%3A13%3A53Z&sp=r&sv=2021-08-06&sr=b&rscc=max-age%3D299%2C%20immutable&rscd=attachment%3B%20filename%3DLockEthUpdated.sol&sig=aF5uG7NReMXhJvfqETKBhMCZkjhrDKu%2BSorIoFTI1ac%3D'; // You would replace this with the actual URL from the response
      const fileName = 'testFile'; // You would replace this with the actual file name
    
      // Fetch the file content using axios (or another HTTP client)
      const response = await axios({
        method: 'get',
        url: fileUrl,
        responseType: 'arraybuffer' // to handle binary data
      });
      console.log(response);
    
      const filePath = path.join(__dirname, '..', 'file_outputs', 'downloads', fileName);
    
      // Write the file to the local filesystem
      fs.writeFileSync(filePath, response.data);
      console.log('file downloaded!');
    
      // ... the rest of your existing code ...
    
    } catch (error) {
      console.error('Error in processComplexTask:', error);
    }
  });


  
// Save file function 
app.post('/save-file', authenticateToken, (req, res) => {
  const { path, content } = req.body;

  console.log('Attempting to save to path:', path);  // Log the path to see what is being received

  // Simple check to prevent trying to write to a directory path
  if (path.endsWith('/')) {
      return res.status(400).json({ error: 'The path must include the file name, not just the directory.' });
  }

  fs.writeFile(path, content, 'utf8', function(error) {
      if (error) {
          console.error('Failed to save file:', error);
          res.status(500).json({ error: 'Failed to save the file', details: error });
      } else {
          res.json({ message: 'File saved successfully' });
      }
  });
});



// Salesforce functionality below
app.post('/retrieve-salesforce-metadata', authenticateToken, async (req, res) => {
    try {
        const { orgDir } = req.body;

        if (!orgDir) {
            return res.status(400).json({ error: 'orgDir parameter is required' });
        }

        // Call the function to process the Salesforce org directory
        const operationId = await runSampleForOrg(orgDir);

        res.json({ 
          message: `Metadata retrieval started successfully for org: ${orgDir}`, 
          response: operationId 
      });
    } catch (error) {
        console.error('Error retrieving Salesforce metadata:', error);
        res.status(500).json({ error: 'Error retrieving Salesforce metadata' });
    }
});

app.post('/check-salesforce-metadata-status', authenticateToken, async (req, res) => {
  try {
      const { orgDir, retrieveRequestId } = req.body;

      if (!orgDir || !retrieveRequestId) {
          return res.status(400).json({ error: 'orgDir and retrieveRequestId parameters are required' });
      }

      // Call the function to check the status of the Salesforce metadata retrieval job
      const statusResponse = await checkRetrieveStatus(orgDir, retrieveRequestId);

      res.json(statusResponse);
  } catch (error) {
      console.error('Error checking Salesforce metadata status:', error);
      res.status(500).json({ error: 'Error checking Salesforce metadata status' });
  }
});

// Example usage inside your existing flow:
app.post('/extract-salesforce-metadata', authenticateToken, async (req, res) => {
  try {
      const { orgDir } = req.body;

      if (!orgDir) {
          return res.status(400).json({ error: 'orgDir parameter is required' });
      }

      // Extract the metadata.zip file for the given orgDir
      const destinationPath = await extractMetadataZipForOrg(orgDir);

      res.json({ message: `Metadata extracted successfully to ${destinationPath}` });
  } catch (error) {
      console.error('Error extracting Salesforce metadata:', error);
      res.status(500).json({ error: 'Error extracting Salesforce metadata' });
  }
});

// Helper function to handle the metadata retrieval process
async function runSampleForOrg(orgDir) {
  const orgFolderPath = path.join(__dirname, `../file_inputs/salesforce/sf_orgs/${orgDir}`);
  const envFilePath = path.join(orgFolderPath, 'envs/.env');
  const xmlFilePath = path.join(orgFolderPath, 'xmls/package.xml');  // Path to the package.xml file

  try {
      // Read the package.xml file
      const xmlBody = fs.readFileSync(xmlFilePath, 'utf8');  // Read the XML file contents as a string

      // Get the Salesforce access token and instance URL
      const { accessToken, instanceUrl } = await getSFToken(orgDir);

      // Call the getSFMetadata function with the XML body, access token, and instance URL
      const operationId = await getSFMetadata(instanceUrl, accessToken, xmlBody);

      console.log(`Successfully completed operations for org: ${orgDir}`);
      return operationId;
        //  await getSFToolingMetadata(instanceUrl, accessToken, orgFolderPath);
    //  generateDocumentation(orgFolderPath, orgName, orgId);
  } catch (error) {
      console.error(`Failed to run sample for org: ${orgDir}`, error);
      throw error;
  }
}

// http://localhost:3000/auth/salesforce?orgDir=sample_prod
// Step 1: Redirect to Salesforce OAuth URL
app.get('/auth/salesforce', (req, res) => {
  const orgDir = req.query.orgDir; // Get the orgDir from the request
  const envFilePath = path.join(__dirname, '../../file_inputs/salesforce/sf_orgs', orgDir, 'envs', '.env');

  if (!orgDir) {
    return res.status(400).json({ error: 'orgDir is required' });
  }

  // Log the values being passed to the authorization URL
  console.log('Authorization URL Parameters:', {
    SF_OAUTH_AUTHORIZE_URL,
    SF_CLIENT_ID,
    SF_REDIRECT_URI,
    orgDir
  });

  // Append orgDir as a query parameter to the redirect URL
  const authorizationUrl = `${SF_OAUTH_AUTHORIZE_URL}?response_type=code&client_id=${SF_CLIENT_ID}&redirect_uri=${encodeURIComponent(SF_REDIRECT_URI)}&state=${encodeURIComponent(orgDir)}`;
  
  res.redirect(authorizationUrl);
});




// Step 2: OAuth Callback - Exchange Authorization Code for Access Token
app.get('/auth/callback', async (req, res) => {
  const authCode = req.query.code;
  const orgDir = req.query.state;  // Salesforce will send back the state parameter as `state`

  if (!authCode || !orgDir) {
      return res.status(400).json({ error: 'Authorization code and orgDir are required' });
  }

  try {
    console.log('In callback function and about to get token');
    
    // Retrieve the OAuth token
    const { accessToken, refreshToken, instanceUrl } = await getOAuthToken(authCode, orgDir);
    
    // Log the retrieved token values
    console.log('Successfully retrieved OAuth token');
    console.log('Access Token:', accessToken);
    console.log('Refresh Token:', refreshToken);
    console.log('Instance URL:', instanceUrl);

    // Update the .env file for the corresponding org with the new tokens
    await updateEnvFileWithToken(orgDir, accessToken, refreshToken, instanceUrl);

    // Respond to the client that the authorization was successful
    res.json({
        message: 'Successfully retrieved Salesforce access token and updated .env file.',
        accessToken,
        refreshToken,
        instanceUrl
    });
  } catch (error) {
      console.error('Error during Salesforce OAuth flow:', error);
      res.status(500).json({ error: 'Error during Salesforce OAuth flow' });
  }
});




// Existing endpoint to retrieve Salesforce access token using username-password flow
app.post('/get-sf-access-token', authenticateToken, async (req, res) => {
  try {
      const { orgDir } = req.body;

      if (!orgDir) {
          return res.status(400).json({ error: 'orgDir parameter is required' });
      }

      // Call the getSFToken function to retrieve the access token
      const { accessToken, instanceUrl } = await getSFToken(orgDir);

      res.json({
          message: 'Successfully retrieved Salesforce access token.',
          accessToken,
          instanceUrl
      });
  } catch (error) {
      console.error('Error retrieving Salesforce access token:', error);
      res.status(500).json({ error: 'Error retrieving Salesforce access token' });
  }
});


//Delete Repos
app.post('/delete-repository', async (req, res) => {
  const GITHUB_TOKEN = ''; //Ensure full scope 
  const GITHUB_OWNER = '';

  const { repo } = req.body; // We only need the repo name from the request body

  if (!repo) {
    return res.status(400).json({ success: false, message: 'Missing required field: repo' });
  }

  try {
    const result = await deleteRepository(GITHUB_OWNER, repo);
    if (result.success) {
      return res.status(200).json({ success: true, message: `Repository ${repo} deleted successfully.` });
    } else {
      return res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/// Server setup // Websocket stuff
  app.get('/', (req, res) => {
    res.send('Virtual Agent System is up and running!');
  });

  const server = app.listen(3000, () => {
    console.log('Server listening on port 3000');
  });

  const wss = new Server({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, ws => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', function connection(ws, request) {
    const sessionId = uuidv4();
    console.log(`Session started: ${sessionId}`);

    ws.on('message', function incoming(message) {
        console.log(`Received message => ${message}`);

        const data = JSON.parse(message);

        if (data.action === "startStream") {
          console.log(`Starting stream for Thread ID: ${data.threadId} with Assistant ID: ${data.assistantId}`);
          const stream = aiServices.runThreadWithStreaming(data.threadId, data.assistantId);

          // Track this stream in activeStreams object if necessary
          activeStreams[sessionId] = { threadId: data.threadId, assistantId: data.assistantId };
          
          // Bind WebSocket message sending directly to the stream events
          stream.on('textCreated', (text) => {
            ws.send(JSON.stringify({ type: 'textCreated', text }));
          })
          .on('textDelta', (textDelta, snapshot) => {
              ws.send(JSON.stringify({ type: 'textDelta', textDelta }));
          })
          .on('toolCallCreated', (toolCall) => {
              ws.send(JSON.stringify({ type: 'toolCallCreated', toolCall }));
          })
          .on('runCompleted', (run) => {
              ws.send(JSON.stringify({ type: 'runCompleted', run }));
          })
          .on('error', (error) => {
              console.error("Streaming error:", error);
              ws.send(JSON.stringify({ type: 'error', error: error.message }));
          });
        }
    });

    ws.on('close', () => {
        console.log(`Session ended: ${sessionId}`);
        // Here you could add any cleanup logic for the stream
        delete activeStreams[sessionId];
    });
  });