import React from 'react';

import { classOptions } from '../../data/students';

export default function MarksheetFilters({
  selectedClass,
  setSelectedClass,
  isStudent,
}) {
  return (
    <div className="bg-white rounded-xl shadow-card p-4 flex flex-col md:flex-row gap-3 md:items-end">
      <div className="w-full md:w-52">
        <label htmlFor="marks-class-filter" className="block text-sm font-medium text-gray-700 mb-1">
          Class
        </label>
        <select
          id="marks-class-filter"
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          disabled={isStudent}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {!isStudent && <option value="ALL">All Classes</option>}
          {classOptions.filter((opt) => opt.value).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.value}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
