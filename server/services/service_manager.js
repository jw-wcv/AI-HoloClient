const { getRecordsByModelName, deleteRecordsByModelName } = require('./database_services');
const { createAssistant, createThread, runThread, addMessageToThread, retrieveRun, listAssistants, deleteAssistant, deleteAllAssistants } = require('./ai_services');
const { createRepository, checkRepositoryExists, checkFileExists, getRepository, getFile } = require('./git_services');
const { generateInvoice, sendInvoiceEmail } = require('./admin_services');

class ServiceManager {
    constructor() {
        this.services = {
            'database': {
                'getRecordsByModelName': getRecordsByModelName,
                'deleteRecordsByModelName': deleteRecordsByModelName
            },
            'ai': {
                'createAssistant': createAssistant,
                'createThread': createThread,
                'addMessageToThread': addMessageToThread,
                'runThread': runThread,
                'retrieveRun': retrieveRun,
                'listAssistants': listAssistants,
                'deleteAssistant': deleteAssistant,
                'deleteAllAssitants': deleteAllAssistants
            },
            'git': {
                'createRepository': createRepository,
                'checkRepositoryExists': checkRepositoryExists,
                'checkFileExists': checkFileExists,
                'getRepository': getRepository,
                'getFile': getFile
            },
            'admin': {
                'sendInvoiceEmail': sendInvoiceEmail
            },
            'all': {
                'git': 'git',
                'ai': 'ai',
                'database': 'database',
                'admin': 'admin'
            }
            // ... other categories
        };
    }

    listServices(category) {
        if (!this.services[category]) {
            throw new Error(`Category '${category}' does not exist.`);
        }

        return Object.keys(this.services[category]);
    }

    async executeService(category, service, parameterObject) {
        if (!this.services[category] || !this.services[category][service]) {
            throw new Error(`Service '${service}' in category '${category}' does not exist.`);
        }

        try {
            const serviceFunction = this.services[category][service];
            return await serviceFunction(...Object.values(parameterObject));
        } catch (error) {
            console.error(`Error executing service '${service}':`, error);
            throw error;
        }
    }
}

module.exports = ServiceManager;
