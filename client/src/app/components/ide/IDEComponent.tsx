import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import FileBrowser from './fileBrowserComponent'; // Adjust the import path as necessary
import { editor } from 'monaco-editor';
import './IDEComponent.css';
import { useAuth } from '../general/auth-provider';
import { editor as monacoEditor } from 'monaco-editor'; 
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';




declare const monaco: any;
const MonacoEditor = dynamic(() => import('react-monaco-editor'), { ssr: false });
type EditorOptions = editor.IStandaloneEditorConstructionOptions;





const IDEComponent = ({ defaultPath = '/Users/JJ/Documents/Projects/virtual-agent-system/file_outputs/uncompressed_directories' }) => {
    const [code, setCode] = useState('');
    const [currentPath, setCurrentPath] = useState(defaultPath);
    const [currentFilePath, setCurrentFilePath] = useState();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const { token } = useAuth();
    const SERVER_BASE_URL = 'http://localhost:3000';
    const [fileSystem, setFileSystem] = useState({});
    const [currentContents, setCurrentContents] = useState([]);
    const editorRef = useRef<monacoEditor.IStandaloneCodeEditor | null>(null);
    const [language, setLanguage] = useState('plaintext'); // Initialize with 'javascript' or another default


    const options: EditorOptions = {
        selectOnLineNumbers: true,
        roundedSelection: false,
        readOnly: false,
        cursorStyle: 'line' as 'line', // Explicitly cast to 'line'
        automaticLayout: true,
        theme: 'vs-dark'
    };

    const handleEditorDidMount = (editor, monaco) => {
        // Initialize the editor with an empty model and set the language to 'javascript'
        const initialModel = monaco.editor.createModel(code, 'plaintext');
        editor.setModel(initialModel);
        editorRef.current = editor;
        setLanguage('plaintext');
    };
    


    const toggleFileBrowser = () => {
        setIsCollapsed(!isCollapsed);
    };

    // Utility function to get language from file extension
    const getLanguageByFileName = (filename) => {
        const extension = filename.split('.').pop().toLowerCase(); // Convert to lowercase to ensure case-insensitivity
        switch (extension) {
            case 'js':
            case 'jsx':
                return 'javascript';
            case 'ts':
            case 'tsx':
                return 'typescript';
            case 'json':
                return 'json';
            case 'cls':
                return 'apex'; // Assuming Salesforce Apex classes
            case 'java':
                return 'java';
            case 'txt':
                return 'plaintext';
            case 'md':
                return 'markdown';
            case 'sol':
                return 'solidity'; // Assuming Ethereum Solidity contracts
            // More cases for different file types can be added here
            case 'html':
                return 'html';
            case 'css':
                return 'css';
            case 'scss':
            case 'sass':
                return 'scss'; // Monaco editor uses 'scss' for both SASS and SCSS
            case 'py':
                return 'python';
            case 'cpp':
            case 'c':
            case 'h':
                return 'cpp'; // C and C++ can use the same highlighter
            case 'cs':
                return 'csharp';
            case 'xml':
                return 'xml';
            case 'php':
                return 'php';
            case 'rb':
                return 'ruby';
            case 'go':
                return 'go';
            case 'lua':
                return 'lua';
            case 'sh':
                return 'shell'; // Shell scripts
            case 'yaml':
            case 'yml':
                return 'yaml';
            case 'sql':
                return 'sql';
            case 'rs': // Add this case for Rust files
                return 'rust';
            // ...add other languages as needed
            default:
                return 'plaintext'; // Fallback language
        }
    };

    const fetchFileSystemContents = async (path) => {
        const response = await fetch(`${SERVER_BASE_URL}/get-directory?path=${encodeURIComponent(path)}`);
        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}`);
        }
        const data = await response.json();
        return data; // Returns the contents of the directory
    };

   // Function to handle when a file is clicked
   const onFileClick = async (filePath) => {
        try {
            const response = await fetch(`${SERVER_BASE_URL}/get-file?path=${encodeURIComponent(filePath)}`);
            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}`);
            }
            const content = await response.text();
            const newLanguage = getLanguageByFileName(filePath);
            setCurrentFilePath(filePath);
            
            // Check if the editorRef.current is not null before using it
            if (editorRef.current) {
                const model = editorRef.current.getModel();
                if (model) {
                    model.setValue(content);
                    // You will need to ensure that monaco is in scope. 
                    // If you're using the editor instance, you could do something like:
                    // editorRef.current.getModel().getModeId();
                    const monaco = await import('monaco-editor');
                    monaco.editor.setModelLanguage(model, newLanguage);
                }
            }
            
            setCode(content);
            setLanguage(newLanguage);
            
        } catch (error) {
            console.error('Error fetching file contents:', error);
        }
    };

    // Function to handle when a folder is clicked
    const onFolderClick = async (folderPath) => {
        try {
            const contents = await fetchFileSystemContents(folderPath);
            setCurrentContents(contents);
            setCurrentPath(folderPath);
        } catch (error) {
            console.error('Error fetching folder contents:', error);
        }
    };

    // Function to navigate back to the parent directory
    const onBackClick = async () => {
        const parts = currentPath.split('/').filter(Boolean); // Use filter(Boolean) to remove empty strings
        parts.pop(); // Remove the last segment to navigate up
    
        // Ensure the new path starts with a '/' making it an absolute path
        const newPath = '/' + parts.join('/'); 
    
        await onFolderClick(newPath); // Await is used because onFolderClick is now async
    };

    const saveFile = async () => {
        try {
            const response = await fetch(`${SERVER_BASE_URL}/save-file`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    path: currentFilePath, // or a specific file path if different
                    content: code
                })
            });
            const data = await response.json();
            if (response.ok) {
                alert('File saved successfully');
            } else {
                throw new Error(data.message || 'Failed to save the file');
            }
        } catch (error) {
            console.error('Error saving file:', error);
            alert('Error saving file: ' + error);
        }
    };

    const refresh = async () => {
        try {
            const contents = await fetchFileSystemContents(defaultPath);
            setCurrentContents(contents);
            setCurrentPath(defaultPath);
            setCode('');
            if (contents) {
                alert('File browser refreshed');
            } else {
                throw new Error(contents.message || 'Failed to refresh file browser');
            }
        } catch (error) {
            console.error('Error saving file:', error);
            alert('Error saving file: ' + error);
        }
    };
    
    

    

    useEffect(() => {
        if (!currentPath || !token) {
          console.log('Current path or token is not provided or invalid.');
          return;
        }
      
        const loadDirectory = async () => {
          try {
            const response = await fetch(`${SERVER_BASE_URL}/get-directory?path=${encodeURIComponent(currentPath)}`, {
              headers: {
                'Authorization': `Bearer ${token}`
              },
            });
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            const contents = await response.json();
            console.log('Got default directory');
            console.log(contents);
            setCurrentContents(contents); // Make sure you update the correct state here
            console.log
          } catch (error) {
            console.error("Failed to load directory", error);
          }
        };
      
        loadDirectory();
      }, [currentPath, token]); // Ensure this dependency list is correct
      

    
    return (
        <div className="ide-container">
            <div className={`file-browser ${isCollapsed ? 'collapsed' : ''}`}>
            <button className="back-button" onClick={onBackClick}>Back</button>
            <button className="back-button" onClick={refresh}>Refresh</button>
            <button className="back-button" onClick={saveFile}>Save</button>
                <FileBrowser
                    contents={currentContents}
                    onFileSelect={onFileClick}
                    onFolderSelect={onFolderClick}
                />
            </div>
            <button className="toggle-btn" onClick={toggleFileBrowser}>
                <FontAwesomeIcon icon={isCollapsed ? faChevronRight : faChevronLeft} />
            </button>
            <div className="editor-container">
            <MonacoEditor
                width="100%"
                height="88vh"
                language={language}
                theme="vs-dark"
                value={code}
                options={options}
                onChange={setCode}
                editorDidMount={handleEditorDidMount}
            />
            </div>
        </div>
    );
};

export default IDEComponent;
