import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Edit,
  Send,
  Monitor,
  Tablet,
  Smartphone,
  Sun,
  Moon,
  Download,
  Copy,
  Check,
  ExternalLink
} from 'lucide-react';
import { useTemplateQuery, useSendTestEmailMutation } from '../../hooks/email/useTemplates';

const TemplatePreviewPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const iframeRef = useRef(null);

  const [device, setDevice] = useState('desktop');
  const [darkMode, setDarkMode] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [copied, setCopied] = useState(false);
  const [htmlContent, setHtmlContent] = useState('');

  const { data: template, isLoading } = useTemplateQuery(id);
  const sendTestMutation = useSendTestEmailMutation();

  useEffect(() => {
    if (template) {
      // Generate HTML from blocks
      const html = generateEmailHTML(template.blocks, template.settings || {});
      setHtmlContent(html);
    }
  }, [template]);

  const generateEmailHTML = (blocks, settings) => {
    let blocksHtml = '';

    blocks?.forEach(block => {
      blocksHtml += renderBlockToHTML(block);
    });

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${template?.subject || ''}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, sans-serif !important;}
  </style>
  <![endif]-->
  <style>
    body { margin: 0; padding: 0; background-color: ${darkMode ? '#1f2937' : '#F3F4F6'}; }
    .email-wrapper { padding: 20px 0; }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: ${darkMode ? '#374151' : '#FFFFFF'};
      ${darkMode ? 'color: #f3f4f6;' : ''}
    }
    img { max-width: 100%; height: auto; }
    a { color: #7C3AED; }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                ${blocksHtml}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
    `;
  };

  const renderBlockToHTML = (block) => {
    const { type, content, settings = {} } = block;

    switch (type) {
      case 'text':
        return `
          <div style="
            font-family: ${settings.fontFamily || 'Arial, sans-serif'};
            font-size: ${settings.fontSize || '16px'};
            color: ${darkMode ? '#f3f4f6' : (settings.color || '#333333')};
            line-height: ${settings.lineHeight || '1.5'};
            text-align: ${settings.textAlign || 'left'};
            padding: ${formatPadding(settings.padding)};
            background-color: ${settings.backgroundColor || 'transparent'};
          ">
            ${content || ''}
          </div>
        `;

      case 'image':
        return `
          <div style="text-align: ${settings.align || 'center'}; padding: ${formatPadding(settings.padding)};">
            ${settings.link ? `<a href="${settings.link}">` : ''}
            <img
              src="${settings.src || 'https://via.placeholder.com/600x200'}"
              alt="${settings.alt || ''}"
              style="
                width: ${settings.width || '100%'};
                max-width: 100%;
                border-radius: ${settings.borderRadius || '0px'};
              "
            />
            ${settings.link ? '</a>' : ''}
          </div>
        `;

      case 'button':
        return `
          <div style="text-align: ${settings.align || 'center'}; padding: ${formatPadding(settings.padding)};">
            <a href="${settings.url || '#'}" style="
              display: inline-block;
              background-color: ${settings.backgroundColor || '#7C3AED'};
              color: ${settings.textColor || '#FFFFFF'};
              font-size: ${settings.fontSize || '16px'};
              font-weight: ${settings.fontWeight || 'bold'};
              padding: ${settings.buttonPadding || '12px 24px'};
              border-radius: ${settings.borderRadius || '6px'};
              text-decoration: none;
              ${settings.fullWidth ? 'display: block; text-align: center;' : ''}
            ">
              ${settings.text || 'Click Here'}
            </a>
          </div>
        `;

      case 'divider':
        return `
          <div style="padding: ${formatPadding(settings.padding)};">
            <hr style="
              border: none;
              border-top: ${settings.thickness || '1px'} ${settings.style || 'solid'} ${settings.color || '#E5E7EB'};
              width: ${settings.width || '100%'};
              margin: 0 auto;
            " />
          </div>
        `;

      case 'spacer':
        return `
          <div style="height: ${settings.height || '40px'};"></div>
        `;

      case 'social':
        const platforms = settings.platforms || [];
        const icons = platforms
          .filter(p => p.enabled)
          .map(p => `
            <a href="${p.url || '#'}" style="display: inline-block; margin: 0 ${settings.spacing || '5px'};">
              <img
                src="https://cdn-icons-png.flaticon.com/32/733/${getSocialIcon(p.name)}.png"
                alt="${p.name}"
                style="width: ${settings.iconSize || '32px'}; height: ${settings.iconSize || '32px'};"
              />
            </a>
          `).join('');

        return `
          <div style="text-align: ${settings.align || 'center'}; padding: ${formatPadding(settings.padding)};">
            ${icons}
          </div>
        `;

      case 'header':
        return `
          <div style="
            text-align: ${settings.logoAlign || 'center'};
            background-color: ${settings.backgroundColor || '#FFFFFF'};
            padding: ${formatPadding(settings.padding)};
          ">
            <img
              src="${settings.logo || 'https://via.placeholder.com/150x50'}"
              alt="Logo"
              style="width: ${settings.logoWidth || '150px'}; max-width: 100%;"
            />
          </div>
        `;

      case 'footer':
        return `
          <div style="
            background-color: ${settings.backgroundColor || '#F9FAFB'};
            color: ${settings.textColor || '#6B7280'};
            font-size: ${settings.fontSize || '12px'};
            text-align: center;
            padding: ${formatPadding(settings.padding)};
          ">
            <p style="margin: 0 0 10px 0;">${settings.companyName || 'Company Name'}</p>
            <p style="margin: 0 0 10px 0;">${settings.address || 'Company Address'}</p>
            ${settings.showUnsubscribe ? `<p style="margin: 0;"><a href="#unsubscribe" style="color: ${settings.textColor || '#6B7280'};">${settings.unsubscribeText || 'Unsubscribe'}</a></p>` : ''}
            ${settings.showViewInBrowser ? `<p style="margin: 10px 0 0 0;"><a href="#browser" style="color: ${settings.textColor || '#6B7280'};">View in browser</a></p>` : ''}
          </div>
        `;

      case 'columns':
        const columnCount = settings.columns || 2;
        const columnWidth = Math.floor(100 / columnCount);
        let columnsHtml = `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
        `;
        (block.children || []).forEach((col, i) => {
          columnsHtml += `
            <td style="width: ${columnWidth}%; vertical-align: top; ${i > 0 ? `padding-left: ${settings.columnGap || '20px'};` : ''}">
              ${(col.blocks || []).map(b => renderBlockToHTML(b)).join('')}
            </td>
          `;
        });
        columnsHtml += `</tr></table>`;
        return columnsHtml;

      case 'html':
        return content || '';

      case 'video':
        return `
          <div style="text-align: center; padding: ${formatPadding(settings.padding)};">
            <a href="${settings.videoUrl || '#'}">
              <div style="position: relative; display: inline-block;">
                <img
                  src="${settings.thumbnailUrl || 'https://via.placeholder.com/600x338'}"
                  alt="Video thumbnail"
                  style="width: ${settings.width || '100%'}; max-width: 100%;"
                />
                <div style="
                  position: absolute;
                  top: 50%;
                  left: 50%;
                  transform: translate(-50%, -50%);
                  width: 60px;
                  height: 60px;
                  background-color: ${settings.playButtonColor || '#FF0000'};
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                ">
                  <div style="
                    width: 0;
                    height: 0;
                    border-left: 20px solid white;
                    border-top: 12px solid transparent;
                    border-bottom: 12px solid transparent;
                    margin-left: 5px;
                  "></div>
                </div>
              </div>
            </a>
          </div>
        `;

      default:
        return '';
    }
  };

  const formatPadding = (padding) => {
    if (!padding) return '10px';
    return `${padding.top || 0}px ${padding.right || 0}px ${padding.bottom || 0}px ${padding.left || 0}px`;
  };

  const getSocialIcon = (name) => {
    const icons = {
      facebook: '547',
      twitter: '579',
      instagram: '558',
      linkedin: '561',
      youtube: '646'
    };
    return icons[name] || '547';
  };

  const getDeviceWidth = () => {
    switch (device) {
      case 'mobile': return 375;
      case 'tablet': return 768;
      default: return 700;
    }
  };

  const handleSendTest = async () => {
    if (!testEmail) return;
    try {
      await sendTestMutation.mutateAsync({
        templateId: id,
        email: testEmail
      });
      setShowTestModal(false);
      setTestEmail('');
      alert('Test email sent successfully!');
    } catch (error) {
      alert('Failed to send test email');
    }
  };

  const handleCopyHTML = () => {
    navigator.clipboard.writeText(htmlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadHTML = () => {
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template?.name || 'email-template'}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/email/templates')}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-medium text-gray-900 dark:text-white">
                {template?.name || 'Template Preview'}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {template?.subject || 'No subject'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Device Switcher */}
            <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
              <button
                onClick={() => setDevice('desktop')}
                className={`p-2 ${device === 'desktop' ? 'bg-purple-100 dark:bg-purple-900 text-purple-600' : 'text-gray-500'}`}
                title="Desktop"
              >
                <Monitor className="w-5 h-5" />
              </button>
              <button
                onClick={() => setDevice('tablet')}
                className={`p-2 ${device === 'tablet' ? 'bg-purple-100 dark:bg-purple-900 text-purple-600' : 'text-gray-500'}`}
                title="Tablet"
              >
                <Tablet className="w-5 h-5" />
              </button>
              <button
                onClick={() => setDevice('mobile')}
                className={`p-2 ${device === 'mobile' ? 'bg-purple-100 dark:bg-purple-900 text-purple-600' : 'text-gray-500'}`}
                title="Mobile"
              >
                <Smartphone className="w-5 h-5" />
              </button>
            </div>

            {/* Dark Mode Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-lg border ${
                darkMode
                  ? 'bg-gray-800 border-gray-600 text-yellow-400'
                  : 'bg-white border-gray-300 text-gray-500'
              }`}
              title={darkMode ? 'Light Mode' : 'Dark Mode'}
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />

            {/* Actions */}
            <button
              onClick={handleCopyHTML}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Copy HTML"
            >
              {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
            </button>
            <button
              onClick={handleDownloadHTML}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Download HTML"
            >
              <Download className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate(`/email/templates/${id}`)}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              Edit
            </button>
            <button
              onClick={() => setShowTestModal(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Send Test
            </button>
          </div>
        </div>
      </header>

      {/* Preview Area */}
      <div className="flex-1 overflow-auto bg-gray-200 dark:bg-gray-900 p-8">
        <div
          className="mx-auto bg-white dark:bg-gray-800 shadow-lg rounded-lg overflow-hidden transition-all duration-300"
          style={{ width: `${getDeviceWidth()}px` }}
        >
          {/* Email Client Header Mockup */}
          <div className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                <span className="text-purple-600 font-medium">
                  {template?.name?.[0]?.toUpperCase() || 'E'}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {template?.name || 'Sender Name'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  to me
                </p>
              </div>
            </div>
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
              {template?.subject || 'Email Subject'}
            </h2>
            {template?.previewText && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {template.previewText}
              </p>
            )}
          </div>

          {/* Email Content */}
          <iframe
            ref={iframeRef}
            srcDoc={htmlContent}
            className="w-full border-0"
            style={{ minHeight: '500px', height: 'auto' }}
            title="Email Preview"
            onLoad={() => {
              if (iframeRef.current) {
                const doc = iframeRef.current.contentDocument;
                if (doc) {
                  iframeRef.current.style.height = doc.body.scrollHeight + 'px';
                }
              }
            }}
          />
        </div>
      </div>

      {/* Test Email Modal */}
      {showTestModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Send Test Email
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Enter email address..."
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowTestModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSendTest}
                disabled={!testEmail || sendTestMutation.isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {sendTestMutation.isLoading ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplatePreviewPage;
