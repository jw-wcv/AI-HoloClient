
// AddAssistant.js
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import './addAssistant.css';

function AddAssistant({ showModal, setShowModal, form, handleFormChange, handleFormSubmit }) {
  return (
    <>
      <div>
        <button className="positive-button" onClick={() => setShowModal(true)}>
          <FontAwesomeIcon icon={faPlus} />
          <span></span>
        </button>
      </div>

      {showModal && (
        <div className="add-item-modal-overlay">
          <div className="add-item-modal">
          <form onSubmit={handleFormSubmit}>
              <div className="form-group">
                <label htmlFor="name">Name:</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={form.name}
                  onChange={handleFormChange}
                  maxLength={12}
                  placeholder="Leave blank for a random name"
                />
              </div>

              <div className="form-group">
                <label htmlFor="instructions">Instructions:</label>
                <textarea
                  id="instructions"
                  name="instructions"
                  value={form.instructions}
                  onChange={handleFormChange}
                  maxLength={15000}
                  rows={5}
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">Description:</label>
                <select id="description" name="description" value={form.description} onChange={handleFormChange}>
                  <option value="analyst">Analyst</option>
                  <option value="administrator">Administrator</option>
                  <option value="developer">Developer</option>
                  <option value="personal assistant">Personal Assistant</option>
                </select>
              </div>

              <div className="form-actions">
                <button type="submit" className="submit-button">Create Assistant</button>
                <button type="button" className="cancel-button" onClick={() => setShowModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default AddAssistant;

