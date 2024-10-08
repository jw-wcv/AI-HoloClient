import React, { useState } from 'react';
import './IDEComponent.css';

const FileBrowser = ({ contents, onFileSelect, onFolderSelect }) => {
    const [selectedPath, setSelectedPath] = useState(null); // State to track the selected path

    const handleOnClick = (item) => {
        setSelectedPath(item.path); // Set the selected path
        item.isFolder ? onFolderSelect(item.path) : onFileSelect(item.path);
    };

    const renderContents = (contents) => {
        return contents.map((item) => {
            return (
                <div
                    key={item.path}
                    onClick={() => handleOnClick(item)}
                    className={`item ${item.isFolder ? 'folder' : 'file'} ${item.path === selectedPath ? 'selected' : ''}`}
                >
                    {item.isFolder ? <b>{item.name}/</b> : item.name}
                </div>
            );
        });
    };

    return (
        <div className="file-browser">
            {renderContents(contents)}
        </div>
    );
};


export default FileBrowser;
