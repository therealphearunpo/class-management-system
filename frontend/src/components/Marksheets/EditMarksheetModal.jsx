import React from 'react';

import { SUBJECTS } from './marksheetUtils';
import Button from '../common/Button';
import Modal from '../common/Modal';

export default function EditMarksheetModal({
  canEditMarks,
  editing,
  closeEditModal,
  handleSaveScores,
  formScores,
  setFormScores,
  isSaving,
}) {
  return (
    <Modal isOpen={Boolean(editing) && canEditMarks} onClose={closeEditModal} title="Update Marksheet">
      {editing && (
        <form onSubmit={handleSaveScores} className="space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-700">{editing.name}</p>
            <p className="text-xs text-gray-500">{editing.class}{editing.shift ? ` | ${editing.shift}` : ''}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {SUBJECTS.map((subject) => (
              <div key={subject}>
                <label htmlFor={`score-${subject}`} className="block text-xs font-medium text-gray-600 mb-1 capitalize">
                  {subject}
                </label>
                <input
                  id={`score-${subject}`}
                  type="number"
                  min="0"
                  max="100"
                  value={formScores[subject] ?? ''}
                  onChange={(e) => setFormScores((prev) => ({ ...prev, [subject]: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closeEditModal} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" loading={isSaving}>
              Save
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
