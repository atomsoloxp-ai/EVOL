import React, { useState, useEffect } from 'react';
import { HeaderNav } from './components/HeaderNav';
import { HunterProfileCard } from './components/HunterProfileCard';
import { QuestSection } from './components/QuestSection';
import { DungeonRaidSection } from './components/DungeonRaidSection';
import { WorkoutLoggerModal } from './components/WorkoutLoggerModal';
import { RecoveryLoggerModal } from './components/RecoveryLoggerModal';
import { BiometricsPanel } from './components/BiometricsPanel';
import { AiCoachChat } from './components/AiCoachChat';
import { BottomNavDock, ActiveTab } from './components/BottomNavDock';
import { SystemAlertModal } from './components/SystemAlertModal';
import { OnboardingModal } from './components/OnboardingModal';
import { HonestyCheckModal } from './components/HonestyCheckModal';
import { ApologyModal } from './components/ApologyModal';
import { SideNavDrawer } from './components/SideNavDrawer';
import { SettingsView } from './components/SettingsView';
import { CalendarWidget } from './components/CalendarWidget';
import { useEvolStore } from './lib/storage/persistent-store';

const VALID_TABS: ActiveTab[] = [
  'HUNTER',
  'QUESTS',
  'CALENDAR',
  'DUNGEON',
  'WORKOUT',
  'RECOVERY',
  'SYSTEM',
  'SETTINGS',
];

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.replace('#', '').toUpperCase() as ActiveTab;
      if (VALID_TABS.includes(hash)) {
        return hash;
      }
    }
    return 'HUNTER';
  });

  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);

  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash) {
        const hash = window.location.hash.replace('#', '').toUpperCase() as ActiveTab;
        if (VALID_TABS.includes(hash)) {
          setActiveTab(hash);
        }
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleTabSelect = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      window.location.hash = tab.toLowerCase();
    }
  };

  const {
    pendingHonestyCheckQuestId,
    confirmHonestyQuestClaim,
    setPendingHonestyCheck,
    isApologyModalOpen,
    completePenaltyOath,
    quests,
    storageWarning,
    dismissStorageWarning,
    refreshDailyStateIfNeeded,
  } = useEvolStore();

  // Refresh date-aware metrics & daily rollover on mount and window focus/visibility resume
  useEffect(() => {
    refreshDailyStateIfNeeded();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshDailyStateIfNeeded();
      }
    };
    window.addEventListener('focus', handleVisibility);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', handleVisibility);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refreshDailyStateIfNeeded]);

  const pendingQuest = quests.find((q) => q.id === pendingHonestyCheckQuestId) || null;

  return (
    <div className="app-viewport">
      {/* Cyber System Scanline Texture Overlay */}
      <div className="scanline-overlay" />

      {/* Top System Header with 3-Dots Main Menu Trigger & Calendar Verification */}
      <HeaderNav
        onOpenMenu={() => setIsSideMenuOpen(true)}
        onNavigate={handleTabSelect}
      />

      {/* Slide-out Sideways Navigation Drawer */}
      <SideNavDrawer
        isOpen={isSideMenuOpen}
        activeTab={activeTab}
        onSelectTab={handleTabSelect}
        onClose={() => setIsSideMenuOpen(false)}
      />

      {/* Main Content Area */}
      <main style={{ flex: 1, paddingBottom: '20px' }}>
        {storageWarning && (
          <div
            style={{
              margin: '0 16px 12px',
              padding: '10px 12px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.14)',
              border: '1px solid #ef4444',
              color: '#fca5a5',
              fontSize: '0.74rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>{storageWarning}</span>
            <button
              type="button"
              onClick={dismissStorageWarning}
              style={{
                background: 'transparent',
                border: '1px solid #fca5a5',
                borderRadius: '4px',
                color: '#fff',
                padding: '2px 6px',
                fontSize: '0.68rem',
                cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          </div>
        )}

        {activeTab === 'HUNTER' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <HunterProfileCard onNavigate={handleTabSelect} />
          </div>
        )}

        {activeTab === 'QUESTS' && <QuestSection />}

        {activeTab === 'CALENDAR' && (
          <div style={{ padding: '0 16px' }}>
            <CalendarWidget />
          </div>
        )}

        {activeTab === 'DUNGEON' && <DungeonRaidSection />}

        {activeTab === 'WORKOUT' && <WorkoutLoggerModal />}

        {activeTab === 'RECOVERY' && <RecoveryLoggerModal />}

        {activeTab === 'SYSTEM' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <AiCoachChat />
            <BiometricsPanel />
          </div>
        )}

        {activeTab === 'SETTINGS' && <SettingsView />}
      </main>

      {/* Floating System Notification / Level Up Modal */}
      <SystemAlertModal />

      {/* Player Awakening & Setup Wizard */}
      <OnboardingModal />

      {/* Honesty Confirmation Modal */}
      <HonestyCheckModal
        isOpen={!!pendingHonestyCheckQuestId}
        questTitle={pendingQuest?.title || 'Daily Quest'}
        rewardsSummary={
          pendingQuest
            ? `+${pendingQuest.rewards.xp} XP ${
                pendingQuest.rewards.statPoints
                  ? Object.entries(pendingQuest.rewards.statPoints)
                      .map(([k, v]) => `• +${v} ${k.toUpperCase()}`)
                      .join(' ')
                  : ''
              }`
            : undefined
        }
        onConfirm={() => {
          if (pendingHonestyCheckQuestId) {
            confirmHonestyQuestClaim(pendingHonestyCheckQuestId);
          }
        }}
        onCancel={() => setPendingHonestyCheck(null)}
      />

      {/* Arrogance Check / Anti-Cheat Apology Oath Modal */}
      <ApologyModal
        isOpen={isApologyModalOpen}
        onSuccess={() => completePenaltyOath()}
      />

      {/* Mobile APK Bottom Navigation Dock */}
      <BottomNavDock activeTab={activeTab} onTabChange={handleTabSelect} />
    </div>
  );
};

export default App;
