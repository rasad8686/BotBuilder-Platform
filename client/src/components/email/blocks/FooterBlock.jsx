import React from 'react';

const FooterBlock = ({ block, onUpdate, isEditing }) => {
  const { settings = {} } = block;

  const containerStyle = {
    backgroundColor: settings.backgroundColor || '#F9FAFB',
    color: settings.textColor || '#6B7280',
    fontSize: settings.fontSize || '12px',
    textAlign: 'center',
    padding: settings.padding
      ? `${settings.padding.top || 0}px ${settings.padding.right || 0}px ${settings.padding.bottom || 0}px ${settings.padding.left || 0}px`
      : '30px 20px'
  };

  return (
    <div style={containerStyle}>
      <p style={{ margin: '0 0 10px 0' }}>
        {settings.companyName || '{{company_name}}'}
      </p>
      <p style={{ margin: '0 0 10px 0' }}>
        {settings.address || '{{company_address}}'}
      </p>
      {settings.showUnsubscribe && (
        <p style={{ margin: '0' }}>
          <a
            href="#unsubscribe"
            style={{ color: settings.textColor || '#6B7280' }}
            onClick={(e) => isEditing && e.preventDefault()}
          >
            {settings.unsubscribeText || 'Unsubscribe'}
          </a>
        </p>
      )}
      {settings.showViewInBrowser && (
        <p style={{ margin: '10px 0 0 0' }}>
          <a
            href="#browser"
            style={{ color: settings.textColor || '#6B7280' }}
            onClick={(e) => isEditing && e.preventDefault()}
          >
            View in browser
          </a>
        </p>
      )}
    </div>
  );
};

export default FooterBlock;
