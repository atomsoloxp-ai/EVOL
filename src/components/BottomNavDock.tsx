import React from 'react';
import { Shield, Swords, Flame, HeartPulse, Terminal, Activity } from 'lucide-react';
import { sound } from '../lib/audio/sound-fx';

export type ActiveTab =
  | 'HUNTER'
  | 'QUESTS'
  | 'CALENDAR'
  | 'DUNGEON'
  | 'WORKOUT'
  | 'RECOVERY'
  | 'SYSTEM'
  | 'SETTINGS';

interface BottomNavDockProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

export const BottomNavDock: React.FC<BottomNavDockProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'HUNTER' as const, label: 'Profile', icon: Shield },
    { id: 'QUESTS' as const, label: 'Goals', icon: Swords },
    { id: 'DUNGEON' as const, label: 'Challenges', icon: Flame },
    { id: 'WORKOUT' as const, label: 'Workouts', icon: Activity },
    { id: 'RECOVERY' as const, label: 'Recovery', icon: HeartPulse },
    { id: 'SYSTEM' as const, label: 'Coach', icon: Terminal },
  ];

  const handleSelect = (tab: ActiveTab) => {
    sound.playClick();
    sound.triggerHaptic(25);
    onTabChange(tab);
  };

  return (
    <nav className="mobile-bottom-nav">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => handleSelect(tab.id)}
            className={`nav-item-btn ${isActive ? 'active' : ''}`}
            aria-label={tab.label}
          >
            <Icon className="nav-icon" />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
