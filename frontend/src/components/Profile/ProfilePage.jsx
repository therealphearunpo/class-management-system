import React, { useState } from 'react';

import { HiOutlineAcademicCap, HiOutlineCalendar, HiOutlineIdentification, HiOutlineMail, HiOutlinePhone, HiOutlineUser } from 'react-icons/hi';

import { ACCOUNT_ROLES, ROLE_CAPABILITIES, ROLE_LABELS, normalizeRole } from '../../constants/roles';
import { useAuth } from '../../context/AuthContext';
import { generateAvatarByGender, normalizeGender } from '../../utils/avatar';
import Avatar from '../common/Avatar';
import Button from '../common/Button';

function InfoCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Icon className="w-4 h-4" />
        <span>{label}</span>
      </div>
      <p className="mt-1 text-sm font-semibold text-gray-800 break-all">{value || '-'}</p>
    </div>
  );
}

function formatClassLabel(classCode, section) {
  const baseClass = String(classCode || '').trim();
  const baseSection = String(section || '').trim();
  if (!baseClass) return baseSection;
  if (!baseSection) return baseClass;

  const normalizedClass = baseClass.toUpperCase();
  const normalizedSection = baseSection.toUpperCase();
  if (normalizedClass.endsWith(normalizedSection)) {
    return baseClass;
  }

  return `${baseClass} ${baseSection}`.trim();
}

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [formData, setFormData] = useState({});

  const valueFor = (field, fallback = '') => {
    if (Object.prototype.hasOwnProperty.call(formData, field)) {
      return formData[field];
    }
    return user?.[field] || fallback;
  };

  const textValue = (field, fallback = '') => String(valueFor(field, fallback) || '');
  const avatar = textValue('avatar').trim();
  const gender = normalizeGender(valueFor('gender'), 'male');
  const profileSeed = valueFor('email') || valueFor('name') || 'user';
  const previewAvatar = avatar || generateAvatarByGender(profileSeed, gender);
  const currentRole = normalizeRole(valueFor('role') || user?.role);
  const roleCapabilities = ROLE_CAPABILITIES[currentRole] || [];
  const isStudent = currentRole === ACCOUNT_ROLES.STUDENT;

  const profileCards = [
    { icon: HiOutlineMail, label: 'Email', value: textValue('email') },
    { icon: HiOutlinePhone, label: 'Phone', value: textValue('phone') },
    { icon: HiOutlineUser, label: 'Gender', value: gender === 'female' ? 'Female' : 'Male' },
    { icon: HiOutlineUser, label: 'Role', value: ROLE_LABELS[currentRole] },
    ...(isStudent
      ? [
          { icon: HiOutlineIdentification, label: 'Student ID', value: textValue('studentId') },
          { icon: HiOutlineAcademicCap, label: 'Class', value: formatClassLabel(textValue('class'), textValue('section')) },
          { icon: HiOutlineCalendar, label: 'Date of Birth', value: textValue('dateOfBirth') },
        ]
      : []),
  ];

  const onChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Please upload an image file.' });
      e.target.value = '';
      return;
    }

    const maxSizeBytes = 700 * 1024;
    if (file.size > maxSizeBytes) {
      setMessage({ type: 'error', text: 'Image size must be 700KB or less for reliable saving.' });
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      onChange('avatar', String(reader.result || ''));
      setMessage({ type: 'success', text: 'Profile picture selected. Click Save Profile.' });
      e.target.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      const result = await updateProfile({
        name: textValue('name').trim(),
        email: textValue('email').trim(),
        role: normalizeRole(valueFor('role')),
        phone: textValue('phone').trim(),
        gender,
        avatar: textValue('avatar').trim(),
        dateOfBirth: textValue('dateOfBirth').trim(),
      });

      if (result.success) {
        setMessage({ type: 'success', text: result.warning || 'Profile updated successfully.' });
        setFormData({});
      } else {
        setMessage({ type: 'error', text: result.error || 'Unable to update profile.' });
      }
    } catch (_error) {
      setMessage({ type: 'error', text: 'Unable to update profile.' });
    }

    setIsSaving(false);
    setTimeout(() => setMessage(null), 3000);
  };

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar name={valueFor('name', 'User')} src={previewAvatar} size="xl" />
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{valueFor('name', 'User')}</h1>
              <p className="text-sm text-gray-500">{textValue('email', 'No email')}</p>
              <p className="text-xs mt-1 inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                {ROLE_LABELS[currentRole]} Account
              </p>
            </div>
          </div>
          <div className="text-xs text-gray-500 max-w-xs">
            Manage your account information and update your profile details.
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {profileCards.map((card) => (
            <InfoCard
              key={`${card.label}-${card.value}`}
              icon={card.icon}
              label={card.label}
              value={card.value}
            />
          ))}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-blue-800">
          {ROLE_LABELS[currentRole]} Account Capabilities
        </h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {roleCapabilities.map((capability) => (
            <span key={capability} className="text-xs px-2 py-1 rounded-md bg-white border border-blue-100 text-blue-700">
              {capability}
            </span>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card p-6">
        <h2 className="text-lg font-semibold text-gray-800">Edit Profile</h2>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="profile-name" className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                id="profile-name"
                type="text"
                value={textValue('name')}
                onChange={(e) => onChange('name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>
            <div>
              <label htmlFor="profile-email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="profile-email"
                type="email"
                value={textValue('email')}
                onChange={(e) => onChange('email', e.target.value)}
                readOnly={isStudent}
                className={`w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                  isStudent ? 'bg-gray-50 text-gray-600 cursor-not-allowed' : ''
                }`}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="profile-phone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                id="profile-phone"
                type="text"
                value={textValue('phone')}
                onChange={(e) => onChange('phone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label htmlFor="profile-role" className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <select
                id="profile-role"
                value={normalizeRole(valueFor('role'))}
                onChange={(e) => onChange('role', e.target.value)}
                disabled
                className={`w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white ${
                  'bg-gray-50 text-gray-600 cursor-not-allowed'
                }`}
              >
                <option value={ACCOUNT_ROLES.ADMIN}>{ROLE_LABELS[ACCOUNT_ROLES.ADMIN]}</option>
                <option value={ACCOUNT_ROLES.STUDENT}>{ROLE_LABELS[ACCOUNT_ROLES.STUDENT]}</option>
                <option value={ACCOUNT_ROLES.TEACHER}>{ROLE_LABELS[ACCOUNT_ROLES.TEACHER]}</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="profile-gender" className="block text-sm font-medium text-gray-700 mb-1">
              Gender
            </label>
            <select
              id="profile-gender"
              value={gender}
              onChange={(e) => onChange('gender', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>

          {isStudent && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="profile-dob" className="block text-sm font-medium text-gray-700 mb-1">
                  Date of Birth
                </label>
                <input
                  id="profile-dob"
                  type="date"
                  value={textValue('dateOfBirth')}
                  onChange={(e) => onChange('dateOfBirth', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label htmlFor="profile-student-id" className="block text-sm font-medium text-gray-700 mb-1">
                  Student ID
                </label>
                <input
                  id="profile-student-id"
                  type="text"
                  value={textValue('studentId')}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-600"
                />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="profile-avatar" className="block text-sm font-medium text-gray-700 mb-1">
              Avatar URL
            </label>
            <input
              id="profile-avatar"
              type="url"
              value={textValue('avatar')}
              onChange={(e) => onChange('avatar', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="https://..."
            />
          </div>

          <div>
            <label htmlFor="profile-avatar-upload" className="block text-sm font-medium text-gray-700 mb-1">
              Upload From Device
            </label>
            <input
              id="profile-avatar-upload"
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 file:mr-3 file:px-3 file:py-1.5 file:border-0 file:rounded-md file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
            />
            <p className="text-xs text-gray-500 mt-1">Accepted: image files (max 700KB)</p>
          </div>

          <div className="flex justify-end">
            <Button type="submit" loading={isSaving}>Save Profile</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
