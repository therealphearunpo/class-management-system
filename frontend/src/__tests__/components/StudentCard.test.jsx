import React from 'react';

import { render, screen, fireEvent } from '@testing-library/react';

import StudentCard from '../../components/Attendance/StudentCard';
import { AttendanceProvider } from '../../context/AttendanceContext';
import { AuthProvider } from '../../context/AuthContext';

const mockStudent = {
  id: 1,
  name: 'John Doe',
  avatar: 'avatar-url',
  rollNo: 123,
};

const renderWithContext = (component) => {
  return render(
    <AuthProvider>
      <AttendanceProvider>
        {component}
      </AttendanceProvider>
    </AuthProvider>
  );
};

describe('StudentCard', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders student name correctly', () => {
    renderWithContext(<StudentCard student={mockStudent} />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('displays roll number', () => {
    renderWithContext(<StudentCard student={mockStudent} />);
    expect(screen.getByText(/Roll #123/)).toBeInTheDocument();
  });

  it('marks attendance when P button is clicked', () => {
    renderWithContext(<StudentCard student={mockStudent} />);
    const presentButton = screen.getByTitle('Present');
    fireEvent.click(presentButton);
    expect(presentButton).toHaveClass('present');
  });

  it('toggles attendance status on repeated clicks', () => {
    renderWithContext(<StudentCard student={mockStudent} />);
    const presentButton = screen.getByTitle('Present');
    
    fireEvent.click(presentButton);
    expect(presentButton).toHaveClass('present');
    
    fireEvent.click(presentButton);
    expect(presentButton).toHaveClass('inactive');
  });
});
