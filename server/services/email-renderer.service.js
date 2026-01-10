const juice = require('juice');

class EmailRendererService {
  /**
   * Convert builder JSON to HTML
   * @param {Object} template - Template object with blocks and settings
   * @returns {string} - Rendered HTML email
   */
  renderToHTML(template) {
    const { blocks = [], settings = {} } = template;

    let html = this.getEmailWrapper(settings);

    for (const block of blocks) {
      html += this.renderBlock(block);
    }

    html += this.getEmailFooterWrapper();

    return this.inlineCSS(html);
  }

  /**
   * Render a single block to HTML
   * @param {Object} block - Block object
   * @returns {string} - HTML string
   */
  renderBlock(block) {
    switch (block.type) {
      case 'text':
        return this.renderTextBlock(block);
      case 'image':
        return this.renderImageBlock(block);
      case 'button':
        return this.renderButtonBlock(block);
      case 'divider':
        return this.renderDividerBlock(block);
      case 'spacer':
        return this.renderSpacerBlock(block);
      case 'social':
        return this.renderSocialBlock(block);
      case 'columns':
        return this.renderColumnsBlock(block);
      case 'header':
        return this.renderHeaderBlock(block);
      case 'footer':
        return this.renderFooterBlock(block);
      case 'html':
        return block.content || '';
      case 'video':
        return this.renderVideoBlock(block);
      default:
        return '';
    }
  }

  /**
   * Render text block
   */
  renderTextBlock(block) {
    const { content, settings = {} } = block;
    return `
      <div style="
        font-family: ${settings.fontFamily || 'Arial, sans-serif'};
        font-size: ${settings.fontSize || '16px'};
        color: ${settings.color || '#333333'};
        line-height: ${settings.lineHeight || '1.5'};
        text-align: ${settings.textAlign || 'left'};
        padding: ${this.formatPadding(settings.padding)};
        background-color: ${settings.backgroundColor || 'transparent'};
      ">
        ${content || ''}
      </div>
    `;
  }

  /**
   * Render image block
   */
  renderImageBlock(block) {
    const { settings = {} } = block;
    const imageHtml = `
      <img
        src="${settings.src || ''}"
        alt="${settings.alt || ''}"
        style="
          width: ${settings.width || '100%'};
          max-width: 100%;
          height: auto;
          border-radius: ${settings.borderRadius || '0px'};
          display: block;
        "
      />
    `;

    const wrappedImage = settings.link
      ? `<a href="${settings.link}" target="_blank">${imageHtml}</a>`
      : imageHtml;

    return `
      <div style="
        text-align: ${settings.align || 'center'};
        padding: ${this.formatPadding(settings.padding)};
      ">
        ${wrappedImage}
      </div>
    `;
  }

  /**
   * Render button block
   */
  renderButtonBlock(block) {
    const { settings = {} } = block;
    return `
      <div style="text-align: ${settings.align || 'center'}; padding: ${this.formatPadding(settings.padding)};">
        <a href="${settings.url || '#'}" style="
          display: ${settings.fullWidth ? 'block' : 'inline-block'};
          background-color: ${settings.backgroundColor || '#7C3AED'};
          color: ${settings.textColor || '#FFFFFF'};
          font-size: ${settings.fontSize || '16px'};
          font-weight: ${settings.fontWeight || 'bold'};
          padding: 12px 24px;
          border-radius: ${settings.borderRadius || '6px'};
          text-decoration: none;
          text-align: center;
        ">
          ${settings.text || 'Click Here'}
        </a>
      </div>
    `;
  }

  /**
   * Render divider block
   */
  renderDividerBlock(block) {
    const { settings = {} } = block;
    return `
      <div style="padding: ${this.formatPadding(settings.padding)};">
        <hr style="
          border: none;
          border-top: ${settings.thickness || '1px'} ${settings.style || 'solid'} ${settings.color || '#E5E7EB'};
          width: ${settings.width || '100%'};
          margin: 0 auto;
        " />
      </div>
    `;
  }

  /**
   * Render spacer block
   */
  renderSpacerBlock(block) {
    const { settings = {} } = block;
    return `<div style="height: ${settings.height || '40px'};"></div>`;
  }

  /**
   * Render social block
   */
  renderSocialBlock(block) {
    const { settings = {} } = block;
    const platforms = settings.platforms || [];
    const iconSize = parseInt(settings.iconSize) || 32;

    const socialIcons = {
      facebook: 'https://cdn-icons-png.flaticon.com/32/733/733547.png',
      twitter: 'https://cdn-icons-png.flaticon.com/32/733/733579.png',
      instagram: 'https://cdn-icons-png.flaticon.com/32/733/733558.png',
      linkedin: 'https://cdn-icons-png.flaticon.com/32/733/733561.png',
      youtube: 'https://cdn-icons-png.flaticon.com/32/733/733646.png'
    };

    const iconsHtml = platforms
      .filter(p => p.enabled)
      .map(p => `
        <a href="${p.url || '#'}" style="display: inline-block; margin: 0 ${settings.spacing || '5px'};">
          <img
            src="${socialIcons[p.name] || ''}"
            alt="${p.name}"
            style="width: ${iconSize}px; height: ${iconSize}px;"
          />
        </a>
      `).join('');

    return `
      <div style="
        text-align: ${settings.align || 'center'};
        padding: ${this.formatPadding(settings.padding)};
      ">
        ${iconsHtml}
      </div>
    `;
  }

  /**
   * Render columns block
   */
  renderColumnsBlock(block) {
    const { settings = {}, children = [] } = block;
    const columnCount = settings.columns || 2;
    const columnWidth = Math.floor(100 / columnCount);

    let columnsHtml = '';
    for (let i = 0; i < columnCount; i++) {
      const columnBlocks = children[i]?.blocks || [];
      const columnContent = columnBlocks.map(b => this.renderBlock(b)).join('');

      columnsHtml += `
        <td style="
          width: ${columnWidth}%;
          vertical-align: top;
          ${i > 0 ? `padding-left: ${settings.columnGap || '20px'};` : ''}
        ">
          ${columnContent}
        </td>
      `;
    }

    return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding: ${this.formatPadding(settings.padding)};">
        <tr>
          ${columnsHtml}
        </tr>
      </table>
    `;
  }

  /**
   * Render header block
   */
  renderHeaderBlock(block) {
    const { settings = {} } = block;
    return `
      <div style="
        text-align: ${settings.logoAlign || 'center'};
        background-color: ${settings.backgroundColor || '#FFFFFF'};
        padding: ${this.formatPadding(settings.padding)};
      ">
        <img
          src="${settings.logo || ''}"
          alt="Logo"
          style="width: ${settings.logoWidth || '150px'}; max-width: 100%; height: auto;"
        />
      </div>
    `;
  }

  /**
   * Render footer block
   */
  renderFooterBlock(block) {
    const { settings = {} } = block;

    let footerContent = `
      <p style="margin: 0 0 10px 0;">${settings.companyName || ''}</p>
      <p style="margin: 0 0 10px 0;">${settings.address || ''}</p>
    `;

    if (settings.showUnsubscribe !== false) {
      footerContent += `
        <p style="margin: 0;">
          <a href="{{unsubscribe_url}}" style="color: ${settings.textColor || '#6B7280'};">
            ${settings.unsubscribeText || 'Unsubscribe'}
          </a>
        </p>
      `;
    }

    if (settings.showViewInBrowser) {
      footerContent += `
        <p style="margin: 10px 0 0 0;">
          <a href="{{view_in_browser_url}}" style="color: ${settings.textColor || '#6B7280'};">
            View in browser
          </a>
        </p>
      `;
    }

    return `
      <div style="
        background-color: ${settings.backgroundColor || '#F9FAFB'};
        color: ${settings.textColor || '#6B7280'};
        font-size: ${settings.fontSize || '12px'};
        text-align: center;
        padding: ${this.formatPadding(settings.padding)};
      ">
        ${footerContent}
      </div>
    `;
  }

  /**
   * Render video block
   */
  renderVideoBlock(block) {
    const { settings = {} } = block;
    return `
      <div style="text-align: center; padding: ${this.formatPadding(settings.padding)};">
        <a href="${settings.videoUrl || '#'}">
          <div style="position: relative; display: inline-block;">
            <img
              src="${settings.thumbnailUrl || ''}"
              alt="Video thumbnail"
              style="width: ${settings.width || '100%'}; max-width: 100%; display: block;"
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
            ">
              <div style="
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-40%, -50%);
                width: 0;
                height: 0;
                border-left: 20px solid white;
                border-top: 12px solid transparent;
                border-bottom: 12px solid transparent;
              "></div>
            </div>
          </div>
        </a>
      </div>
    `;
  }

  /**
   * Get email wrapper HTML
   */
  getEmailWrapper(settings) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${settings.subject || ''}</title>
        <!--[if mso]>
        <style type="text/css">
          body, table, td {font-family: Arial, sans-serif !important;}
        </style>
        <![endif]-->
        <style>
          body {
            margin: 0;
            padding: 0;
            background-color: #F3F4F6;
            font-family: Arial, sans-serif;
          }
          img {
            max-width: 100%;
            height: auto;
          }
          a {
            color: #7C3AED;
          }
          @media only screen and (max-width: 600px) {
            .email-container {
              width: 100% !important;
            }
            .stack-column {
              display: block !important;
              width: 100% !important;
            }
          }
        </style>
      </head>
      <body style="margin: 0; padding: 0; background-color: #F3F4F6;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="padding: 20px 0;">
              <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; max-width: 600px;">
                <tr>
                  <td>
    `;
  }

  /**
   * Get email footer wrapper HTML
   */
  getEmailFooterWrapper() {
    return `
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  /**
   * Format padding object to CSS string
   */
  formatPadding(padding) {
    if (!padding) return '10px';
    return `${padding.top || 0}px ${padding.right || 0}px ${padding.bottom || 0}px ${padding.left || 0}px`;
  }

  /**
   * Inline CSS for better email client compatibility
   */
  inlineCSS(html) {
    try {
      return juice(html, {
        removeStyleTags: false,
        preserveMediaQueries: true,
        preserveFontFaces: true
      });
    } catch (error) {
      console.error('CSS inlining failed:', error);
      return html;
    }
  }

  /**
   * Replace template variables with actual values
   * @param {string} html - HTML string
   * @param {Object} variables - Variables to replace
   * @returns {string} - HTML with replaced variables
   */
  replaceVariables(html, variables = {}) {
    let result = html;

    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value || '');
    });

    return result;
  }

  /**
   * Generate plain text version of email
   * @param {Object} template - Template object
   * @returns {string} - Plain text version
   */
  renderToPlainText(template) {
    const { blocks = [] } = template;
    let text = '';

    for (const block of blocks) {
      switch (block.type) {
        case 'text':
          // Strip HTML tags
          text += (block.content || '').replace(/<[^>]*>/g, '') + '\n\n';
          break;
        case 'button':
          text += `${block.settings?.text || 'Click Here'}: ${block.settings?.url || ''}\n\n`;
          break;
        case 'divider':
          text += '---\n\n';
          break;
        case 'spacer':
          text += '\n';
          break;
        case 'header':
          text += 'Logo\n\n';
          break;
        case 'footer':
          text += `\n${block.settings?.companyName || ''}\n${block.settings?.address || ''}\n`;
          if (block.settings?.showUnsubscribe !== false) {
            text += '\nUnsubscribe: {{unsubscribe_url}}\n';
          }
          break;
        case 'video':
          text += `Video: ${block.settings?.videoUrl || ''}\n\n`;
          break;
      }
    }

    return text.trim();
  }
}

module.exports = new EmailRendererService();
