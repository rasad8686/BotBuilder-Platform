import React from 'react';
import KBCard from './KBCard';

const KBList = ({ knowledgeBases, selectedKB, onSelect, onDelete, onAssign }) => {
  if (knowledgeBases.length === 0) {
    return (
      <div className="kb-list-empty">
        <p>No knowledge bases yet</p>
        <p className="hint">Create one to get started</p>
        <style>{`
          .kb-list-empty {
            text-align: center;
            padding: 24px;
            color: #6b7280;
          }
          .kb-list-empty .hint {
            font-size: 13px;
            opacity: 0.8;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="kb-list">
      <h3>Your Knowledge Bases</h3>
      <div className="kb-list-items">
        {knowledgeBases.map(kb => (
          <KBCard
            key={kb.id}
            kb={kb}
            isSelected={selectedKB?.id === kb.id}
            onSelect={() => onSelect(kb)}
            onDelete={() => onDelete(kb)}
            onAssign={() => onAssign(kb)}
          />
        ))}
      </div>

      <style>{`
        .kb-list h3 {
          margin: 0 0 16px 0;
          font-size: 14px;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .kb-list-items {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
      `}</style>
    </div>
  );
};

export default KBList;
