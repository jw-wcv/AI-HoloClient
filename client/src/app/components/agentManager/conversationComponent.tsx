import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { marked } from 'marked'; 
import './conversationListComponent.css';
import Editor, { useMonaco, OnMount } from "@monaco-editor/react";
import { editor as MonacoEditor } from 'monaco-editor';

interface ConversationMessage {
  speaker: string;
  message: string;
  highlight: boolean;
}


interface ConversationProps {
    threadId: string | null;
    assistantId: string | null;
    token: string | null;
    onClose: () => void; // This function is called when the modal is closed.
    agentName: string | null;
}

function ConversationComponent({ threadId, assistantId, token, onClose, agentName }: ConversationProps) {
  const [showModal, setShowModal] = useState(false);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [selectedAssistantId, setSelectedAssistantId] = useState<string | null>(null);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessages, setStreamingMessages] = useState<ConversationMessage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentSentence, setCurrentSentence] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [markdownContent, setMarkdownContent] = useState<string>('');
  // Adjust the ref type
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
  };

  function copyCodeToClipboard() {
    if (editorRef.current) {
      const code = editorRef.current.getValue();
      navigator.clipboard.writeText(code).then(() => {
        alert('Code copied to clipboard!');
      }).catch(err => {
        console.error('Failed to copy text: ', err);
      });
    }
  }

  const handleCodeExtraction = (message) => {
    const regex = /```(\w+)\s*([\s\S]*?)```/g;
    const matches = [...message.matchAll(regex)];
    if (matches.length > 0) {
      let language = matches[0][1];
      const code = matches[0][2].trim();
      switch (language.toLowerCase()) {
            case 'js':
            case 'javascript':
                language = 'javascript';
                console.log(language);
                break;
            case 'apex':
                language = 'apex';
                console.log(language);
                break;
            case 'json':
                language = 'json';
                console.log(language);
                break;
            case 'md':
            case 'markdown':
                language = 'markdown';
                console.log(language);
                break;
            case 'txt': // Add case for .txt files
                language = 'plaintext'; // Use plaintext for plain text files
                console.log(language);
                break;
            default:
                language = 'plaintext'; // Default case for unknown or unspecified languages
                console.log(language);
      }
      return { isCode: true, language, code };
    }
    return { isCode: false, language: null, code: null };
  };

  const extractCodeBlock = (text) => {
    const codeRegex = /```(\w+)\s*([\s\S]*?)```/; // Ensure this captures code blocks accurately
    const match = text.match(codeRegex);
    if (match) {
      return {
        isCode: true,
        language: match[1],
        code: match[2].trim(),
      };
    }
    return { isCode: false };
  };

  const loadConversation = async () => {
    if (!threadId || !token) return;
  
    try {
      const response = await axios.post(
        'http://localhost:3000/view-thread-conversation',
        { threadId },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      let theConvo = response.data.threadConversation;
      //console.log(theConvo);
      const conversationLines = theConvo.split('\n');
      let lastSpeaker = 'Unknown';
      let isNewSpeakerBlock = false;
  
      const transformedConversation = conversationLines.reduce((acc, line) => {
        let speaker = lastSpeaker;
        let highlight = false;
  
        if (line.includes('[User]')) {
          speaker = 'User';
        } else if (line.includes('[Assistant]')) {
          speaker = 'Agent';
        }
  
        if (speaker !== lastSpeaker) {
          lastSpeaker = speaker;
          isNewSpeakerBlock = true;
        } else {
          isNewSpeakerBlock = false;
        }
  
        const messageContent = line.replace('[User]', '').replace('[Assistant]', '').trim();
        if (messageContent) {
          const codeBlock = extractCodeBlock(messageContent);
          highlight = isNewSpeakerBlock;
  
          acc.push({
            speaker: speaker,
            message: messageContent,
            highlight: highlight,
            isCode: codeBlock.isCode,
            code: codeBlock.code,
            language: codeBlock.language
          });
        }
  
        return acc;
      }, []);
  
      setConversation(transformedConversation);
      setShowModal(true);
    } catch (error) {
      console.error('Error fetching thread conversation:', error);
    }
  };
  
  useEffect(() => {
    if (threadId && token) {
      loadConversation();
      console.log(agentName);
    }
  }, [threadId, token]); // This useEffect will trigger loadConversation whenever threadId or token changes.

  const handleCreateFile = async () => {
    if (!threadId || !token) {
      alert('Please select a thread and log in to send messages.');
      return;
    }
    try {
      const response = await axios.post(
        'http://localhost:3000/submit-task',
        { threadId, assistantId, taskName: agentName},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      console.log(response.data);
      setNewMessage('');
      await loadConversation(); // Refresh the conversation
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // Check if Enter key is pressed and Shift is not held down
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault(); // Prevent the default action to avoid submitting the form or adding a new line
      handleNewMessageSubmit(); // Call the submit function
    }
  };
  
  const handleNewMessageSubmit = async () => {
    if (!threadId || !token) {
      alert('Please select a thread and log in to send messages.');
      return;
    }
    try {
      const response = await axios.post(
        'http://localhost:3000/add-thread-message',
        { threadId, message: newMessage },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      console.log(response.data);
      setNewMessage('');
      await loadConversation(); // Refresh the conversation
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleFileUpload = async () => {
    if (!file || !threadId || !token) {
      alert('Please select a file and ensure you are logged in.');
      return;
    }
  
    const formData = new FormData();
    formData.append('zipfile', file);
    formData.append('threadId', threadId);
    formData.append('filename', file.name); // Assuming you want to pass the file's original name
  
    try {
      const response = await axios.post(
        'http://localhost:3000/upload-thread-file',
        formData,
        { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } }
      );
      console.log(response.data);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setFile(null);
    } catch (error) {
      console.error('Error uploading file:', error);
    }
  };

  const handleWebSocketMessage = (event) => {
    //console.log('Message from server:', event.data);
    const data = JSON.parse(event.data);
    const maxLineLength = 500; // Maximum number of characters per line
  
    if (data.type === 'textCreated' || data.type === 'textDelta') {
      const textFragment = data.text || (data.textDelta && data.textDelta.value);
  
      if (typeof textFragment === 'string') {
        setCurrentSentence((current) => {
          const updatedSentence = current + textFragment;
  
          // Check for sentence termination by length or punctuation
          if (updatedSentence.length > maxLineLength || /[\.\?\!]\s*$/.test(updatedSentence)) {
            setConversation(prevMessages => [
              ...prevMessages,
              { speaker: 'Assistant', message: updatedSentence.trim(), highlight: false } // highlight can be controlled as needed
            ]);
  
            scrollToBottom();
            return ''; // Reset current sentence
          } else {
            return updatedSentence; // Continue building the current sentence
          }
        });
      } else {
        console.warn('Received non-string messageContent:', textFragment);
      }
    }
  };
  
  
  // Updated function to start streaming
  const startStreaming = async () => {
    if (!threadId || !assistantId) {
      alert('Please select a thread and an assistant to start streaming.');
      return;
    }
  
    const ws = new WebSocket('ws://localhost:3000');
    let currentSentence = '';
  
    ws.onopen = () => {
      console.log('WebSocket connection established.');
      ws.send(JSON.stringify({ action: 'startStream', threadId: threadId, assistantId: assistantId }));
      setIsStreaming(true);
    };
  
    ws.onmessage = handleWebSocketMessage;
  
    ws.onclose = () => {
      console.log('WebSocket connection closed.');
      setIsStreaming(false);
  
      // If there's any remaining text that hasn't been added to messages, add it now.
      if (currentSentence) {
        setStreamingMessages(prevMessages => [
          ...prevMessages,
          { speaker: 'Assistant', message: currentSentence, highlight: false }
        ]);
      }
    };
  
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsStreaming(false);
    };
  };

  const scrollToBottom = () => {
    // Using the latest ref, scroll into view whenever the conversation updates
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  useEffect(() => {
    // Call this function every time the conversation updates
    scrollToBottom();
  }, [conversation])

  

  return (
    <>
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>{agentName}</h2>
              <button onClick={() => { setShowModal(false); onClose(); }}>✕</button>
            </div>
            <div className="modal-body" style={{ paddingBottom: '80px' }}>
              <>
                {conversation.map((message, index, array) => {
                  const isFirstOfBlock = index === 0 || message.speaker !== array[index - 1].speaker;
                  const { isCode, language, code } = handleCodeExtraction(message.message);
                  console.log('isCode: ', isCode);

                  return (
                    <React.Fragment key={index}>
                      {isFirstOfBlock && (
                        <div className={`speaker-tag ${message.speaker}-tag`}>{message.speaker}</div>
                      )}
                      {isCode ? (
                        <>
                          <Editor
                            height="200px"
                            language={language} // Set the language dynamically based on extraction
                            value={code}
                            theme="vs-dark"
                            options={{
                              readOnly: false,
                              minimap: { enabled: false },
                              lineNumbers: "off",
                              glyphMargin: false,
                            }}
                          />
                          <button onClick={() => navigator.clipboard.writeText(message.message.slice(6, -7))}>
                            Copy Code
                          </button>
                        </>
                      ) : (
                        <div className={`message ${message.speaker.toLowerCase()} ${message.highlight ? 'highlighted' : ''}`}>
                          <span>{message.message}</span>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
                <div ref={messagesEndRef} /> {/* Ensure this div is inside the rendering logic */}
              </>
            </div>
            <div className="message-input-container"> {/* This container is fixed at the bottom */}
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Type your message..."
                className="text-input"
              />
              <button onClick={handleNewMessageSubmit} className="send">+</button>
              <button onClick={startStreaming} className="stream">Run</button>
              <button onClick={handleCreateFile} className="send">C.F.</button>
              <div className="file-upload-container">
                <input
                  id="file-upload"
                  type="file"
                  onChange={handleFileChange}
                  className="file-input-hidden"
                  ref={fileInputRef}
                />
                <label htmlFor="file-upload" className="file-select-button">
                  {file ? `${file.name}` : 'Select File'}
                </label>
                <button 
                  onClick={handleFileUpload} 
                  className="upload-button"
                  disabled={!file}
                >
                  Upload
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
  
  

export default ConversationComponent;
