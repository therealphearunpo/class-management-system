import React from 'react';

import Badge from '../common/Badge';
import Button from '../common/Button';

export default function createMarksheetColumns({ canEditMarks, subjects, openEditModal }) {
  return [
    {
      header: 'Rank',
      accessor: 'rank',
      sortable: true,
    },
    {
      header: 'Student',
      accessor: 'name',
      sortable: true,
    },
    {
      header: 'Class',
      accessor: 'class',
      sortable: true,
    },
    ...subjects.map((subject) => ({
      header: subject.toUpperCase(),
      accessor: subject,
      sortable: true,
    })),
    {
      header: 'Total',
      accessor: 'total',
      sortable: true,
    },
    {
      header: 'Average',
      accessor: 'avg',
      sortable: true,
    },
    {
      header: 'Grade',
      accessor: 'grade',
      sortable: true,
      render: (value) => {
        if (!value) return <span className="text-xs text-gray-400">Not entered</span>;
        const variant =
          value === 'A' ? 'success' : value === 'B' ? 'primary' : value === 'C' ? 'warning' : 'danger';
        return <Badge variant={variant}>{value}</Badge>;
      },
    },
    {
      header: 'Action',
      accessor: 'action',
      render: (_value, row) => (
        canEditMarks ? (
          <Button size="sm" variant="secondary" onClick={() => openEditModal(row)}>
            Edit
          </Button>
        ) : (
          <span className="text-xs text-gray-400">View only</span>
        )
      ),
    },
  ];
}
