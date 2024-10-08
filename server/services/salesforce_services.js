require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { parseStringPromise } = require('xml2js');
const { createWriteStream } = require('fs');
const extract = require('extract-zip');
const dotenv = require('dotenv');
const xml2js = require('xml2js');
const unzipper = require('unzipper');

// Constants for directories
const FILE_INPUTS_DIR = path.join(__dirname, '..', 'file_inputs', 'salesforce');
const FILE_OUTPUTS_DIR = path.join(__dirname, '..', 'file_outputs', 'salesforce');
const ENVS_DIR = path.join(FILE_INPUTS_DIR, 'envs');
const XMLS_DIR = path.join(FILE_INPUTS_DIR, 'xmls');
const DOCUMENTATION_DIR = path.join(FILE_OUTPUTS_DIR, 'documentation');
// Constants for directories
const SF_ORGS_DIR = path.join(__dirname, '..', 'file_inputs', 'salesforce', 'sf_orgs');

// Helper function to log the metadata request details
function logMetadataRequestDetails(instanceUrl, accessToken, packageXml) {
    console.log('--- Salesforce Metadata Request Details ---');
    console.log(`Instance URL: ${instanceUrl}`);
    console.log(`Access Token: ${accessToken}`);
    console.log('Package XML:');
    console.log(packageXml);
    console.log('-------------------------------------------');
}

// Function to handle Salesforce OAuth flow and retrieve access token
async function getOAuthToken(authCode, orgDir) {
    // Adjust the path to start from the project's root directory
    const envFilePath = path.join(__dirname, '../../file_inputs/salesforce/sf_orgs', orgDir, 'envs', '.env');

    console.log(`Loading environment variables from: ${envFilePath}`);
    
    // Load environment variables from the specified .env file
    const envResult = dotenv.config({ path: envFilePath });
    if (envResult.error) {
        throw new Error(`Error loading .env file at ${envFilePath}: ${envResult.error}`);
    }

    // Extract the environment variables
    const { SF_CLIENT_ID, SF_CLIENT_SECRET, SF_REDIRECT_URI, SF_TOKEN_URL } = process.env;

    console.log('OAuth Environment Variables:', {
        SF_CLIENT_ID,
        SF_CLIENT_SECRET,
        SF_REDIRECT_URI,
        SF_TOKEN_URL
    });

    // Check if required environment variables are present
    if (!SF_CLIENT_ID || !SF_CLIENT_SECRET || !SF_REDIRECT_URI || !SF_TOKEN_URL) {
        throw new Error('Missing Salesforce OAuth environment variables');
    }

    try {
        // Make the OAuth token request
        const response = await axios.post(SF_TOKEN_URL, null, {
            params: {
                grant_type: 'authorization_code',
                client_id: SF_CLIENT_ID,
                client_secret: SF_CLIENT_SECRET,
                redirect_uri: SF_REDIRECT_URI,
                code: authCode
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        // Extract the token details from the response
        const { access_token, refresh_token, instance_url } = response.data;
        console.log('Successfully retrieved Salesforce access token via OAuth.');
        return { accessToken: access_token, refreshToken: refresh_token, instanceUrl: instance_url };
    } catch (error) {
        console.error('Error retrieving Salesforce OAuth token:', error.response ? error.response.data : error.message);
        throw error;
    }
}

// Function to refresh the access token using the refresh token
async function refreshAccessToken() {
    const { SF_CLIENT_ID, SF_CLIENT_SECRET, SF_REFRESH_TOKEN, SF_TOKEN_URL } = process.env;

    try {
        const response = await axios.post(SF_TOKEN_URL, null, {
            params: {
                grant_type: 'refresh_token',
                client_id: SF_CLIENT_ID,
                client_secret: SF_CLIENT_SECRET,
                refresh_token: SF_REFRESH_TOKEN,
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const { access_token, instance_url } = response.data;
        console.log('Access token refreshed successfully.');
        return { accessToken: access_token, instanceUrl: instance_url };
    } catch (error) {
        console.error('Error refreshing access token:', error.response ? error.response.data : error.message);
        throw error;
    }
}

async function getSFToken(orgDir) {
    // Adjust the path to start from the project's root directory
    const envFilePath = path.join(__dirname, '../../file_inputs/salesforce/sf_orgs', orgDir, 'envs', '.env');

    console.log(`Loading environment variables from: ${envFilePath}`);
    
    // Load environment variables from the specified .env file
    const envResult = dotenv.config({ path: envFilePath });
    if (envResult.error) {
        throw new Error(`Error loading .env file at ${envFilePath}: ${envResult.error}`);
    }

    // Extract relevant environment variables
    const {
        SF_CLIENT_ID,
        SF_CLIENT_SECRET,
       // SF_USERNAME,
       // SF_PASSWORD,
        SF_TOKEN_URL,
        SF_ACCESS_TOKEN,
        SF_REFRESH_TOKEN,
        SF_INSTANCE_URL,
    } = process.env;

    console.log('Environment Variables:', {
        SF_CLIENT_ID,
        SF_CLIENT_SECRET,
     //   SF_USERNAME,
     //   SF_PASSWORD,
        SF_TOKEN_URL,
        SF_ACCESS_TOKEN,
        SF_REFRESH_TOKEN,
        SF_INSTANCE_URL
    });

     // Log the environment variables to verify their values
     console.log('Loaded Environment Variables:');
     console.log(`SF_CLIENT_ID: ${SF_CLIENT_ID}`);
     console.log(`SF_CLIENT_SECRET: ${SF_CLIENT_SECRET}`);
   //  console.log(`SF_USERNAME: ${SF_USERNAME}`);
   //  console.log(`SF_PASSWORD: ${SF_PASSWORD}`);
     console.log(`SF_TOKEN_URL: ${SF_TOKEN_URL}`);
     console.log(`SF_ACCESS_TOKEN: ${SF_ACCESS_TOKEN}`);
     console.log(`SF_REFRESH_TOKEN: ${SF_REFRESH_TOKEN}`);
     console.log(`SF_INSTANCE_URL: ${SF_INSTANCE_URL}`);

    // If OAuth token is available, return it directly
    if (SF_ACCESS_TOKEN && SF_INSTANCE_URL) {
        console.log('Using existing OAuth access token.');
        return { accessToken: SF_ACCESS_TOKEN, instanceUrl: SF_INSTANCE_URL };
    }

    /*

    // If OAuth tokens are not available, fall back to username-password flow
    if (!SF_CLIENT_ID || !SF_CLIENT_SECRET || !SF_USERNAME || !SF_PASSWORD) {
        throw new Error('Missing Salesforce environment variables for username-password flow.');
    }

    try {
        console.log('Using username-password flow.');
        const response = await axios.post(SF_TOKEN_URL, null, {
            params: {
                grant_type: 'password',
                client_id: SF_CLIENT_ID,
                client_secret: SF_CLIENT_SECRET,
                username: SF_USERNAME,
                password: SF_PASSWORD
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const { access_token, instance_url } = response.data;
        console.log('Successfully retrieved Salesforce access token via username-password flow.');
        return { accessToken: access_token, instanceUrl: instance_url };
    } catch (error) {
        console.error('Error retrieving Salesforce token:', error.response ? error.response.data : error.message);
        throw error;
    }

    */
}

// Function to update .env file for the authorized Salesforce org
async function updateEnvFileWithToken(orgDir, accessToken, refreshToken, instanceUrl) {
    const envFilePath = path.join(__dirname, `../../file_inputs/salesforce/sf_orgs/${orgDir}/envs/.env`);
    console.log('Env file path: ' + envFilePath);

    // Check if the env directory exists, and create it if it doesn't
    const envDir = path.dirname(envFilePath);
    if (!fs.existsSync(envDir)) {
        fs.mkdirSync(envDir, { recursive: true });
        console.log(`Created directory: ${envDir}`);
    }

    // Load existing .env file or create an empty object if the file does not exist
    let envVariables = {};
    if (fs.existsSync(envFilePath)) {
        const envResult = dotenv.config({ path: envFilePath });
        if (!envResult.error) {
            envVariables = envResult.parsed || {};
            console.log('Loaded existing .env content:', envVariables);
        }
    } else {
        console.log(`.env file does not exist at ${envFilePath}, creating a new one.`);
    }

    // Set or update the new OAuth tokens and instance URL
    envVariables.SF_ACCESS_TOKEN = accessToken;
    envVariables.SF_REFRESH_TOKEN = refreshToken;
    envVariables.SF_INSTANCE_URL = instanceUrl;

    // Convert the updated envVariables object back to a string format while preserving existing content
    const existingContent = Object.keys(envVariables)
        .map(key => `${key}=${envVariables[key]}`)
        .join('\n');

    // Write the updated content to the .env file without overwriting existing values
    try {
        fs.writeFileSync(envFilePath, existingContent);
        console.log(`Successfully updated ${envFilePath} with new OAuth tokens.`);

        // Verify by reading back the file content
        const updatedContent = fs.readFileSync(envFilePath, 'utf8');
        console.log('Updated .env file content:', updatedContent);
    } catch (error) {
        console.error(`Error writing to ${envFilePath}:`, error);
    }
}

// Function to get Salesforce Org details
async function getOrgDetails(instanceUrl, accessToken) {
    try {
        const response = await axios.get(`${instanceUrl}/services/data/v59.0/sobjects/Organization`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const org = response.data;
        
        // Log the response to ensure we are getting the correct values
        console.log('Retrieved Org Details:', org);
        
        return { orgName: org.Name, orgId: org.Id };
    } catch (error) {
        console.error('Error retrieving Salesforce Org details:', error.response ? error.response.data : error.message);
        throw error;
    }
}

// Function to rename the org folder based on org name and ID
function renameOrgFolder(oldOrgFolderPath, orgName, orgId) {
    const newOrgFolderPath = path.join(path.dirname(oldOrgFolderPath), `${orgName}_${orgId}`);
    if (!fs.existsSync(newOrgFolderPath)) {
        fs.renameSync(oldOrgFolderPath, newOrgFolderPath);
        console.log(`Renamed org folder to ${newOrgFolderPath}`);
    } else {
        console.log(`Org folder ${newOrgFolderPath} already exists.`);
    }
    return newOrgFolderPath;
}

// Function to get metadata using the package.xml
async function getSFMetadata(instanceUrl, accessToken) {
    try {
        // Correctly structured SOAP request
        const soapEnvelope = 
                `<?xml version="1.0" encoding="UTF-8"?>
        <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                        xmlns:met="http://soap.sforce.com/2006/04/metadata">
        <soapenv:Header>
            <met:SessionHeader>
                <met:sessionId>${accessToken}</met:sessionId>
            </met:SessionHeader>
        </soapenv:Header>
        <soapenv:Body>
            <met:retrieve>
                <met:retrieveRequest>
                    <met:apiVersion>59.0</met:apiVersion>
                    <met:singlePackage>true</met:singlePackage>
                    <met:unpackaged>
                    <met:types>
                        <met:members>*</met:members>
                        <met:name>ApexClass</met:name>
                    </met:types>
                    <met:types>
                        <met:members>*</met:members>
                        <met:name>ApexComponent</met:name>
                    </met:types>
                    <met:types>
                        <met:members>*</met:members>
                        <met:name>ApexPage</met:name>
                    </met:types>
                    <met:types>
                        <met:members>*</met:members>
                        <met:name>ApexTrigger</met:name>
                    </met:types>
                    <met:types>
                        <met:members>*</met:members>
                        <met:name>AssignmentRules</met:name>
                    </met:types>
                    <met:types>
                        <met:members>*</met:members>
                        <met:name>AutoResponseRules</met:name>
                    </met:types>
                    <met:types>
                        <met:members>*</met:members>
                        <met:name>CustomApplication</met:name>
                    </met:types>
                    <met:types>
                        <met:members>*</met:members>
                        <met:name>CustomField</met:name>
                    </met:types>
                    <met:types>
                        <met:members>*</met:members>
                        <met:name>CustomObject</met:name>
                    </met:types>
                    <met:types>
                        <met:members>*</met:members>
                        <met:name>CustomTab</met:name>
                    </met:types>
                    <met:types>
                        <met:members>*</met:members>
                        <met:name>Dashboard</met:name>
                    </met:types>
                    <met:types>
                        <met:members>*</met:members>
                        <met:name>Document</met:name>
                    </met:types>
                    <met:types>
                        <met:members>*</met:members>
                        <met:name>EmailTemplate</met:name>
                    </met:types>
                    <met:types>
                        <met:members>*</met:members>
                        <met:name>FieldSet</met:name>
                    </met:types>
                    <met:types>
                        <met:members>*</met:members>
                        <met:name>FlexiPage</met:name>
                    </met:types>
                    <met:types>
                        <met:members>*</met:members>
                        <met:name>Flow</met:name>
                    </met:types>
                    <met:types>
                        <met:members>*</met:members>
                        <met:name>GlobalValueSet</met:name>
                    </met:types>
                    <met:types>
                        <met:members>*</met:members>
                        <met:name>HomePageComponent</met:name>
                    </met:types>
                    <met:types>
                        <met:members>*</met:members>
                        <met:name>HomePageLayout</met:name>
                    </met:types>
                    <met:types>
                        <met:members>*</met:members>
                        <met:name>Layout</met:name>
                    </met:types>
                    <met:types>
                        <met:members>*</met:members>
                        <met:name>Letterhead</met:name>
                    </met:types>
                    <met:types>
                        <met:members>*</met:members>
                        <met:name>ListView</met:name>
                    </met:types>
                    <met:types>
                        <met:members>*</met:members>
                        <met:name>PermissionSet</met:name>
                    </met:types>
                    <met:types>
                        <met:members>*</met:members>
                        <met:name>Profile</met:name>
                    </met:types>
                    <met:types>
                        <met:members>*</met:members>
                        <met:name>Queue</met:name>
                    </met:types>
                    <met:types>
                        <met:members>*</met:members>
                        <met:name>QuickAction</met:name>
                    </met:types>
                    <met:types>
                        <met:members>*</met:members>
                        <met:name>Report</met:name>
                    </met:types>
                    <met:types>
                        <met:members>*</met:members>
                        <met:name>ReportType</met:name>
                    </met:types>
                    <met:types>
                        <met:members>*</met:members>
                        <met:name>Role</met:name>
                    </met:types>
                    <met:types>
                        <met:members>*</met:members>
                        <met:name>SharingRules</met:name>
                    </met:types>
                    <met:types>
                        <met:members>*</met:members>
                        <met:name>StaticResource</met:name>
                    </met:types>
                    <met:types>
                        <met:members>*</met:members>
                        <met:name>Translations</met:name>
                    </met:types>
                    <met:types>
                        <met:members>*</met:members>
                        <met:name>ValidationRule</met:name>
                    </met:types>
                    <met:types>
                        <met:members>*</met:members>
                        <met:name>Workflow</met:name>
                    </met:types>
                    </met:unpackaged>
                </met:retrieveRequest>
            </met:retrieve>
        </soapenv:Body>
        </soapenv:Envelope>`;


        console.log("Sending the following SOAP envelope to Salesforce:");
        console.log(soapEnvelope);

        const response = await axios({
            method: 'post',
            url: `${instanceUrl}/services/Soap/m/59.0`,
            headers: {
                'Content-Type': 'text/xml',
                'SOAPAction': 'retrieve',
                'Authorization': `Bearer ${accessToken}`,
                'User-Agent': 'axios/1.6.7',
                'Accept-Encoding': 'gzip, compress, deflate, br'
            },
            data: soapEnvelope
        });

        console.log("Received response from Salesforce:");
        console.log("Status Code:", response.status);
        console.log("Headers:", response.headers);
        console.log("Response Data:", response.data);
        const result = response.data; // XML response

        // Extract the operation ID (retrieve request ID) from the response XML
        const operationId = await extractRetrieveRequestId(result);
        return { result, operationId };
    } catch (error) {
        console.error("Error retrieving Salesforce metadata:", error.message);
        if (error.response) {
            console.error("Response Status:", error.response.status);
            console.error("Response Headers:", error.response.headers);
            console.error("Response Data:", error.response.data);
        }
        throw error;
    }
}

// Helper function to extract retrieve request ID from XML
async function extractRetrieveRequestId(xmlData) {
    try {
        const parser = new xml2js.Parser();
        const parsedData = await parser.parseStringPromise(xmlData);

        // Extract the operation ID from the parsed XML structure
        const operationId = parsedData['soapenv:Envelope']['soapenv:Body'][0]['retrieveResponse'][0]['result'][0]['id'][0];
        return operationId;
    } catch (error) {
        console.error("Error parsing XML:", error.message);
        throw error;
    }
}

// Function to check the status of a Salesforce retrieve job
async function checkRetrieveStatus(orgDir, retrieveRequestId) {
    const orgFolderPath = path.join(__dirname, `../../file_inputs/salesforce/sf_orgs/${orgDir}`);

    try {
        // Get the Salesforce access token and instance URL
        const { accessToken, instanceUrl } = await getSFToken(orgDir);

        const soapEnvelope = 
        `<?xml version="1.0" encoding="UTF-8"?>
        <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                          xmlns:met="http://soap.sforce.com/2006/04/metadata">
           <soapenv:Header>
              <met:SessionHeader>
                 <met:sessionId>${accessToken}</met:sessionId>
              </met:SessionHeader>
           </soapenv:Header>
           <soapenv:Body>
              <met:checkRetrieveStatus>
                 <met:retrieveRequestId>${retrieveRequestId}</met:retrieveRequestId>
              </met:checkRetrieveStatus>
           </soapenv:Body>
        </soapenv:Envelope>`;

        console.log("Sending SOAP envelope to check retrieve status:");
        console.log(soapEnvelope);

        const response = await axios({
            method: 'post',
            url: `${instanceUrl}/services/Soap/m/59.0`,
            headers: {
                'Content-Type': 'text/xml',
                'SOAPAction': 'checkRetrieveStatus',
                'Authorization': `Bearer ${accessToken}`,
                'User-Agent': 'axios/1.6.7',
                'Accept-Encoding': 'gzip, compress, deflate, br'
            },
            data: soapEnvelope
        });

        console.log("Status response from Salesforce:");
        console.log("Status Code:", response.status);
        console.log("Headers:", response.headers);
        console.log("Response Data:", response.data);

       // Parse the response to check if the retrieve operation is done and get the zip file if available
       return parseAndSaveRetrieveStatus(response.data, orgFolderPath);

    } catch (error) {
        console.error("Error checking retrieve status:", error.message);
        if (error.response) {
            console.error("Response Status:", error.response.status);
            console.error("Response Headers:", error.response.headers);
            console.error("Response Data:", error.response.data);
        }
        throw error;
    }
}

// Function to parse the retrieve status and save the zip file if the operation is done
function parseAndSaveRetrieveStatus(responseData, orgFolderPath) {
    const doneMatch = responseData.match(/<done>(true|false)<\/done>/);
    const done = doneMatch && doneMatch[1] === 'true';

    if (done) {
        const zipFileMatch = responseData.match(/<zipFile>(.+?)<\/zipFile>/);
        const zipFile = zipFileMatch ? zipFileMatch[1] : null;

        if (zipFile) {
            // Decode Base64 zip file content
            const buffer = Buffer.from(zipFile, 'base64');

            // Save the file to the org's folder
            const zipFilePath = path.join(orgFolderPath, 'metadata.zip');
            fs.writeFileSync(zipFilePath, buffer);

            console.log(`Saved metadata zip file to: ${zipFilePath}`);
            return { done, zipFilePath };
        }
    }

    return { done };
}

// Function to extract the ZIP file
async function extractMetadataZipForOrg(orgDir) {
    try {
        // Build the path to the metadata.zip file in the org directory
        const orgFolderPath = path.join(__dirname, `../../file_inputs/salesforce/sf_orgs/${orgDir}`);
        const zipFilePath = path.join(orgFolderPath, 'metadata.zip');
        const destinationPath = path.join(orgFolderPath, 'extracted_metadata');

        // Check if metadata.zip exists
        if (!fs.existsSync(zipFilePath)) {
            throw new Error(`metadata.zip file not found in the directory: ${zipFilePath}`);
        }

        // Ensure the destination directory exists
        if (!fs.existsSync(destinationPath)) {
            fs.mkdirSync(destinationPath, { recursive: true });
        }

        // Extract the ZIP file contents
        await fs.createReadStream(zipFilePath)
            .pipe(unzipper.Extract({ path: destinationPath }))
            .promise();

        console.log(`Successfully extracted metadata.zip to ${destinationPath}`);
        return destinationPath;
    } catch (error) {
        console.error("Error extracting ZIP file:", error.message);
        throw error;
    }
}







// Function to retrieve metadata using the Tooling API
async function getSFToolingMetadata(instanceUrl, accessToken, orgFolderPath) {
    const queries = [
        { type: 'CustomLabel', query: 'SELECT Id, Name, Value FROM CustomLabel' },
        { type: 'StaticResource', query: 'SELECT Id, Name FROM StaticResource' },
        { type: 'CustomObject', query: 'SELECT Id, DeveloperName FROM CustomObject WHERE IsCustomSetting = true' },
        { type: 'CustomMetadata', query: 'SELECT Id, DeveloperName FROM CustomMetadata' },
        { type: 'ApexPage', query: 'SELECT Id, Name FROM ApexPage' },
        { type: 'ApexComponent', query: 'SELECT Id, Name FROM ApexComponent' },
        { type: 'AuraDefinitionBundle', query: 'SELECT Id, DeveloperName FROM AuraDefinitionBundle' },
        { type: 'RecordType', query: 'SELECT Id, DeveloperName, SObjectType FROM RecordType' },
        { type: 'PermissionSet', query: 'SELECT Id, Name FROM PermissionSet' },
    ];

    const results = {};

    for (const { type, query } of queries) {
        try {
            const response = await axios.get(`${instanceUrl}/services/data/v59.0/tooling/query/?q=${encodeURIComponent(query)}`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            results[type] = response.data.records;
            console.log(`Retrieved ${type} metadata.`);
        } catch (error) {
            console.error(`Error retrieving ${type} metadata:`, error.response ? error.response.data : error.message);
        }
    }

    // Build tooling.xml
    const toolingXml = buildToolingXml(results);

    // Save tooling.xml to the appropriate org folder
    const toolingXmlPath = path.join(orgFolderPath, 'tooling.xml');
    fs.writeFileSync(toolingXmlPath, toolingXml);
    console.log(`Tooling metadata saved to ${toolingXmlPath}`);
}

// Function to build tooling.xml from Tooling API results
function buildToolingXml(results) {
    let toolingXml = `<?xml version="1.0" encoding="UTF-8"?>\n<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n`;

    for (const [type, records] of Object.entries(results)) {
        if (records.length > 0) {
            toolingXml += `<types>\n`;
            records.forEach(record => {
                toolingXml += `<members>${record.Name || record.DeveloperName}</members>\n`;
            });
            toolingXml += `<name>${type}</name>\n</types>\n`;
        }
    }

    toolingXml += `<version>59.0</version>\n</Package>`;
    return toolingXml;
}

// Function to generate documentation and save it to the documentation directory
function generateDocumentation(metadataDir, orgName, orgId) {
    // Placeholder for actual documentation generation logic
    const docContent = `Documentation for Org: ${orgName} (ID: ${orgId})\nRetrieved metadata located in ${metadataDir}`;
    
    const documentationPath = path.join(DOCUMENTATION_DIR, `${orgName}_${orgId}_documentation.txt`);
    fs.writeFileSync(documentationPath, docContent);
    console.log(`Documentation generated and saved to ${documentationPath}`);
}

module.exports = {
    updateEnvFileWithToken,
    getOAuthToken,
    getSFToken,
    getOrgDetails,
    getSFMetadata,
    getSFToolingMetadata,
    generateDocumentation,
    checkRetrieveStatus,
    extractMetadataZipForOrg,
    refreshAccessToken
};
