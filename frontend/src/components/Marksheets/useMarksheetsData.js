import { useEffect, useState } from 'react';

import {
  LOCAL_MARKSHEETS_KEY,
  LOCAL_STUDENTS_KEY,
  normalizeScoreMap,
  normalizeStudent,
  safeReadJson,
  uniqueStudents,
} from './marksheetUtils';
import { marksheetsAPI, studentsAPI } from '../../services/api';

export default function useMarksheetsData() {
  const [students, setStudents] = useState([]);
  const [marksByStudent, setMarksByStudent] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const localStudents = safeReadJson(LOCAL_STUDENTS_KEY, []).map(normalizeStudent);

      let mergedStudents;
      try {
        const response = await studentsAPI.getAll();
        const apiStudents = Array.isArray(response?.data) ? response.data : [];
        mergedStudents = uniqueStudents([...localStudents, ...apiStudents.map(normalizeStudent)]);
      } catch {
        mergedStudents = uniqueStudents(localStudents);
      }

      let apiScores = {};
      try {
        const response = await marksheetsAPI.getAll();
        const payload = Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response?.data?.items)
            ? response.data.items
            : response?.data;
        apiScores = normalizeScoreMap(payload);
      } catch {
        apiScores = {};
      }

      const localScores = normalizeScoreMap(safeReadJson(LOCAL_MARKSHEETS_KEY, {}));
      setStudents(mergedStudents);
      setMarksByStudent({ ...apiScores, ...localScores });
      setLoading(false);
    };

    loadData();
  }, []);

  return {
    students,
    marksByStudent,
    setMarksByStudent,
    loading,
  };
}
