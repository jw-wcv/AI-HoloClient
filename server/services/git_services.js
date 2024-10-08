const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { Octokit } = require("@octokit/rest");

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });

  /*
  async function createOrUpdateFileOnGitHub(owner, repo, path, content, commitMessage) {
    const contentBase64 = Buffer.from(content, 'utf8').toString('base64');
  
    try {
      let fileExists = false;
      let sha;
  
      // Try to retrieve the file's SHA if it exists
      try {
        const response = await octokit.repos.getContent({ owner, repo, path });
        sha = response.data.sha;
        fileExists = true;
      } catch (error) {
        if (error.status !== 404) {
          throw error;
        }
        // If error status is 404, file doesn't exist and we'll create it without SHA
      }
  
      // Params for creating/updating file contents
      const params = {
        owner,
        repo,
        path,
        message: commitMessage,
        content: contentBase64,
        ...(fileExists && { sha }), // Include the SHA only if the file already exists
      };
  
      // Create or update the file on GitHub
      const response = await octokit.repos.createOrUpdateFileContents(params);
      console.log('GitHub file create/update successful');
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      // Handle conflict error by retrying with the latest SHA
      if (error.status === 409 && error.response.data.message.startsWith('sha does not match')) {
        const { data } = await octokit.repos.getContent({ owner, repo, path });
        const latestSha = data.sha;
        return createOrUpdateFileOnGitHub(owner, repo, path, content, commitMessage, latestSha);
      } else {
        // Log any other error and return it
        console.error('Error creating or updating the file on GitHub:', error);
        return {
          success: false,
          error: error.message,
        };
      }
    }
  }*/

  async function createOrUpdateFileOnGitHub(owner, repo, filePath, content, commitMessage) {
    const contentBase64 = Buffer.from(content, 'utf8').toString('base64');
  
    try {
      const params = {
        owner,
        repo,
        path: filePath,
        message: commitMessage,
        content: contentBase64,
      };
  
      let response;
      // Try to get the SHA if the file exists
      try {
        response = await octokit.repos.getContent({ owner, repo, path: filePath });
        params.sha = response.data.sha;
      } catch (error) {
        if (error.status !== 404) {
          throw error; // Rethrow if it's not a "Not Found" error
        }
      }
  
      // Create or update the file on GitHub
      response = await octokit.repos.createOrUpdateFileContents(params);
      console.log('GitHub file create/update successful');
      return { success: true, data: response.data };
    } catch (error) {
      // Handle conflict by retrying with the latest SHA once
      if (error.status === 409) {
        console.log('Conflict detected. Retrying with latest SHA...');
        try {
          const { data } = await octokit.repos.getContent({ owner, repo, path: filePath });
          params.sha = data.sha;
          response = await octokit.repos.createOrUpdateFileContents(params);
          console.log('GitHub file update successful after conflict resolution');
          return { success: true, data: response.data };
        } catch (retryError) {
          console.error('Error after retrying:', retryError);
          return { success: false, error: retryError.message };
        }
      } else {
        console.error('Error creating or updating the file on GitHub:', error);
        return { success: false, error: error.message };
      }
    }
  }
  

  async function deleteRepository(owner, repo) {
    try {
      const response = await octokit.repos.delete({
        owner,
        repo,
      });
      console.log(`Repository ${repo} deleted successfully.`);
      return { success: true, message: `Repository ${repo} deleted successfully.` };
    } catch (error) {
      console.error('Error deleting repository:', error);
      return { success: false, error: error.message };
    }
  }

    
  async function createRepository(repoName, isPrivate = true) {
      try {
        const response = await octokit.repos.createForAuthenticatedUser({
          name: repoName,
          private: isPrivate, // Set to true to create a private repository
        });
    
        return response.data; // Returns the created repository data
      } catch (error) {
        console.error('Error creating repository:', error);
        throw new Error('Failed to create repository.');
      }
    }

  async function checkRepositoryExists(owner, repo) {
  try {
      const response = await octokit.repos.get({
      owner,
      repo,
      });
      console.log('Repository exists:', response.data.full_name);
      return true;
  } catch (error) {
      if (error.status === 404) {
      console.log('Repository does not exist.');
      } else {
      console.error('Error checking repository:', error);
      }
      return false;
  }
  }

  async function getRepository(owner, repo) {
      try {
        const response = await octokit.repos.get({
          owner,
          repo,
        });
        console.log('Repository found.');
        return response.data; // This will return the repository details
      } catch (error) {
        if (error.status === 404) {
          console.error('Repository not found.');
        } else {
          console.error('Error getting repository:', error);
        }
        throw error; // Rethrow the error for further handling
      }
    }

  async function checkFileExists(owner, repo, path) {
  try {
      const response = await octokit.repos.getContent({
      owner,
      repo,
      path,
      });
      console.log('File exists:', path);
      return true;
  } catch (error) {
      if (error.status === 404) {
      console.log('File does not exist.');
      } else {
      console.error('Error checking file:', error);
      }
      return false;
  }
}

async function getFile(owner, repo, path) {
    try {
      const response = await octokit.repos.getContent({
        owner,
        repo,
        path,
      });
      console.log('File details:', response.data);
      return response.data; // This will return the file details
    } catch (error) {
      if (error.status === 404) {
        console.error('File not found.');
      } else {
        console.error('Error getting file:', error);
      }
      throw error; // Rethrow the error for further handling
    }
  }


module.exports = { deleteRepository, createOrUpdateFileOnGitHub, createRepository, checkRepositoryExists, checkFileExists, getRepository, getFile};
