import React from 'react';
import { useGameStore } from '../store/game-store';
import './NewsPanel.css';

const NewsPanel: React.FC = () => {
  const { news } = useGameStore();

  const typeIcons = {
    info: 'ℹ️',
    warning: '⚠️',
    danger: '🚨'
  };

  return (
    <div className="news-panel gothic-panel" data-tour="news">
      <h2 className="panel-title gothic-text">📰 NOTICIAS</h2>

      <div className="news-list">
        {news.length === 0 && (
          <p className="no-news">Sin noticias recientes...</p>
        )}

        {news.slice().reverse().map(item => (
          <div key={item.id} className={`news-item news-${item.type}`}>
            <div className="news-header">
              <span className="news-icon">{typeIcons[item.type]}</span>
              <span className="news-day">Día {item.day}</span>
            </div>
            <h4 className="news-title">{item.title}</h4>
            <p className="news-description">{item.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NewsPanel;
