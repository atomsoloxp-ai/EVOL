import React, { useState } from 'react';
import { useEvolStore } from '../lib/storage/persistent-store';
import { Bot, Send, User, Sparkles, Terminal } from 'lucide-react';

export const AiCoachChat: React.FC = () => {
  const { coachMessages, sendCoachPrompt } = useEvolStore();
  const [inputText, setInputText] = useState('');
  const [persona, setPersona] = useState<'SYSTEM_ADMIN' | 'SHADOW_BERU' | 'ARCHITECT'>('SYSTEM_ADMIN');

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    sendCoachPrompt(inputText, persona);
    setInputText('');
  };

  const sendQuickPrompt = (prompt: string) => {
    sendCoachPrompt(prompt, persona);
  };

  const personaLabel = (p: string) => {
    if (p === 'SHADOW_BERU') return 'Motivator';
    if (p === 'ARCHITECT') return 'Data Analyst';
    return 'Direct Coach';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '0 16px' }}>
      {/* Coaching Style Selector */}
      <div className="system-card" style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Terminal size={16} color="var(--neon-cyan)" />
            <span className="system-title" style={{ fontSize: '0.8rem' }}>
              AI FITNESS COACH
            </span>
          </div>
        </div>

        {/* Coaching style toggle tabs */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => setPersona('SYSTEM_ADMIN')}
            style={{
              flex: 1,
              padding: '6px',
              borderRadius: '6px',
              fontFamily: 'var(--font-system)',
              fontSize: '0.65rem',
              fontWeight: 700,
              border: persona === 'SYSTEM_ADMIN' ? '1px solid var(--neon-cyan)' : '1px solid rgba(255,255,255,0.06)',
              background: persona === 'SYSTEM_ADMIN' ? 'rgba(0, 229, 255, 0.15)' : 'rgba(255,255,255,0.02)',
              color: persona === 'SYSTEM_ADMIN' ? 'var(--neon-cyan)' : 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            Direct Coach
          </button>
          <button
            onClick={() => setPersona('SHADOW_BERU')}
            style={{
              flex: 1,
              padding: '6px',
              borderRadius: '6px',
              fontFamily: 'var(--font-system)',
              fontSize: '0.65rem',
              fontWeight: 700,
              border: persona === 'SHADOW_BERU' ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.06)',
              background: persona === 'SHADOW_BERU' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255,255,255,0.02)',
              color: persona === 'SHADOW_BERU' ? '#a855f7' : 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            Motivator
          </button>
          <button
            onClick={() => setPersona('ARCHITECT')}
            style={{
              flex: 1,
              padding: '6px',
              borderRadius: '6px',
              fontFamily: 'var(--font-system)',
              fontSize: '0.65rem',
              fontWeight: 700,
              border: persona === 'ARCHITECT' ? '1px solid #fbbf24' : '1px solid rgba(255,255,255,0.06)',
              background: persona === 'ARCHITECT' ? 'rgba(251, 191, 36, 0.15)' : 'rgba(255,255,255,0.02)',
              color: persona === 'ARCHITECT' ? '#fbbf24' : 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            Data Analyst
          </button>
        </div>
      </div>

      {/* Chat Messages Log */}
      <div
        className="system-card"
        style={{
          minHeight: '260px',
          maxHeight: '340px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {coachMessages.map((msg) => {
          const isBot = msg.sender === 'SYSTEM';
          return (
            <div
              key={msg.id}
              style={{
                alignSelf: isBot ? 'flex-start' : 'flex-end',
                maxWidth: '85%',
                background: isBot ? 'rgba(16, 20, 32, 0.8)' : 'rgba(0, 229, 255, 0.12)',
                border: isBot ? '1px solid var(--border-cyan)' : '1px solid rgba(0, 229, 255, 0.3)',
                borderRadius: '10px',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.65rem' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-system)',
                    fontWeight: 700,
                    color: isBot ? 'var(--neon-cyan)' : '#38bdf8',
                  }}
                >
                  {isBot ? personaLabel(msg.persona) : 'You'}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>{msg.timestamp}</span>
              </div>

              <p style={{ fontSize: '0.78rem', color: '#fff', lineHeight: 1.4 }}>{msg.content}</p>
            </div>
          );
        })}
      </div>

      {/* Quick Prompts */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
        <button
          onClick={() => sendQuickPrompt('Evaluate my current readiness and recovery score')}
          className="btn-system-outline"
          style={{ padding: '4px 8px', fontSize: '0.65rem', whiteSpace: 'nowrap' }}
        >
          Check Readiness
        </button>
        <button
          onClick={() => sendQuickPrompt('Explain my next session plan and why it was chosen')}
          className="btn-system-outline"
          style={{ padding: '4px 8px', fontSize: '0.65rem', whiteSpace: 'nowrap', borderColor: 'var(--neon-cyan)', color: 'var(--neon-cyan)' }}
        >
          Next Session Plan
        </button>
        <button
          onClick={() => sendQuickPrompt('How are my injury limitations affecting exercises?')}
          className="btn-system-outline"
          style={{ padding: '4px 8px', fontSize: '0.65rem', whiteSpace: 'nowrap' }}
        >
          Injury Checks
        </button>
        <button
          onClick={() => sendQuickPrompt('Check my protein deficit and nutrition targets')}
          className="btn-system-outline"
          style={{ padding: '4px 8px', fontSize: '0.65rem', whiteSpace: 'nowrap' }}
        >
          Protein Deficit
        </button>
        <button
          onClick={() => sendQuickPrompt('How do I finish my weekly lifting challenge?')}
          className="btn-system-outline"
          style={{ padding: '4px 8px', fontSize: '0.65rem', whiteSpace: 'nowrap' }}
        >
          Weekly Challenge
        </button>
      </div>

      {/* Text Input */}
      <form onSubmit={handleSend} style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          placeholder="Ask your coach anything..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          style={{
            flex: 1,
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-cyan)',
            borderRadius: '8px',
            padding: '10px 12px',
            color: '#fff',
            fontFamily: 'var(--font-body)',
            fontSize: '0.82rem',
          }}
        />
        <button type="submit" className="btn-system" aria-label="Send message" style={{ padding: '10px 16px' }}>
          <Send size={15} />
        </button>
      </form>
    </div>
  );
};
