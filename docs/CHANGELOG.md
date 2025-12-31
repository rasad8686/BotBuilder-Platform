# Changelog

All notable changes to BotBuilder are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Mobile app support (React Native)
- Instagram channel integration
- Voice-to-bot conversion feature

### Changed
- Improved RAG search performance

### Fixed
- Fixed empty catch blocks throughout codebase

---

## [2.0.0] - 2024-12-30

### Added

#### Core Platform
- **Multi-Organization Support:** Complete multi-tenancy with organization-based data isolation
- **Role-Based Access Control (RBAC):** Viewer, Member, Admin roles with customizable permissions
- **AI Flow Studio:** Visual drag-and-drop bot builder using ReactFlow
- **Knowledge Base (RAG):** Retrieval Augmented Generation with pgvector
- **Multi-Agent Orchestration:** Coordinate multiple AI agents in workflows

#### AI Features
- **Claude Integration:** Support for Anthropic's Claude models
- **OpenAI GPT-4 Support:** Latest GPT-4 and GPT-4-Turbo models
- **Custom Fine-Tuning:** Fine-tune models with your data
- **AI Cost Tracking:** Track token usage and costs per bot

#### Enterprise Features
- **SSO Integration:** SAML 2.0, OIDC, Azure AD, Google, Okta
- **SCIM Provisioning:** Automated user lifecycle management
- **White-Label Support:** Custom branding per organization
- **Audit Logging:** Complete activity trail
- **Advanced Analytics:** Comprehensive reporting dashboard

#### Revenue Recovery Engine
- **Abandoned Cart Recovery:** Automated cart recovery workflows
- **Customer Health Scoring:** Predictive churn analysis
- **Win-Back Campaigns:** Personalized re-engagement
- **Multi-Channel Outreach:** Email, SMS, WhatsApp campaigns
- **Revenue Analytics:** ROI tracking and forecasting

#### Channels
- **WhatsApp Business Integration:** Full Meta Business API support
- **Telegram Bot Integration:** Complete Telegram Bot API
- **Slack Integration:** Workspace integration with Event API
- **Discord Bot:** Full Discord bot support
- **Web Widget:** Embeddable chat widget

#### Voice Features
- **Twilio Integration:** Voice calls via Twilio
- **Speech-to-Text:** Google Cloud Speech recognition
- **Text-to-Speech:** Multiple TTS providers
- **Voice Bot Builder:** Convert voice to bot flows

### Changed
- Complete backend rewrite with Express.js
- New React 18 frontend with Vite
- PostgreSQL with pgvector for vector search
- Improved authentication with refresh tokens
- Enhanced security with Helmet.js and rate limiting

### Security
- JWT authentication with short-lived tokens
- Refresh token rotation
- AES-256-GCM encryption for sensitive data
- CSRF protection
- Rate limiting on all endpoints
- Security headers (Helmet.js)

### Deprecated
- Legacy MongoDB support (removed)
- Old authentication system (replaced with JWT)

---

## [1.5.0] - 2024-06-15

### Added
- Intent Builder with training phrases
- Entity extraction support
- Basic analytics dashboard
- Email notifications

### Changed
- Improved bot response time
- Updated UI components

### Fixed
- Fixed message ordering in chat
- Fixed timezone issues in analytics

---

## [1.4.0] - 2024-03-01

### Added
- Telegram channel support
- Webhook management
- API token authentication
- Basic flow builder

### Changed
- Improved database performance
- Updated dependencies

### Fixed
- Fixed connection leak in database pool
- Fixed memory issues with large conversations

---

## [1.3.0] - 2023-12-01

### Added
- User registration and login
- Basic bot creation
- Simple chat interface
- PostgreSQL database support

### Changed
- Migrated from SQLite to PostgreSQL
- Improved error handling

---

## [1.2.0] - 2023-09-01

### Added
- OpenAI GPT-3.5 integration
- Basic conversation history
- Simple admin panel

### Fixed
- Various bug fixes

---

## [1.1.0] - 2023-06-01

### Added
- Basic chatbot functionality
- Simple rule-based responses
- Initial frontend UI

---

## [1.0.0] - 2023-03-01

### Added
- Initial release
- Basic Express.js backend
- Simple React frontend
- SQLite database

---

## Version History Summary

| Version | Date | Highlights |
|---------|------|------------|
| 2.0.0 | 2024-12-30 | Multi-org, AI Studio, RAG, Recovery Engine |
| 1.5.0 | 2024-06-15 | Intent Builder, Analytics |
| 1.4.0 | 2024-03-01 | Telegram, Webhooks, Flow Builder |
| 1.3.0 | 2023-12-01 | User auth, PostgreSQL |
| 1.2.0 | 2023-09-01 | OpenAI integration |
| 1.1.0 | 2023-06-01 | Basic chatbot |
| 1.0.0 | 2023-03-01 | Initial release |

---

## Upgrade Guides

### Upgrading from 1.x to 2.0

**Breaking Changes:**

1. **Authentication:** JWT tokens now expire in 15 minutes. Implement refresh token flow.

2. **Database:** Run migrations for new tables:
   ```bash
   npm run migrate
   ```

3. **Environment Variables:** New required variables:
   ```env
   JWT_SECRET=<64-char-secret>
   ENCRYPTION_KEY=<32-char-key>
   ```

4. **API Changes:**
   - All endpoints now require organization context
   - Bot endpoints moved to `/api/bots`
   - Auth endpoints moved to `/api/auth`

5. **Frontend:** Complete rebuild with React 18 and Vite

**Migration Steps:**

1. Backup database
2. Update environment variables
3. Run migrations
4. Update frontend build process
5. Test all integrations

---

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for how to contribute to this project.

## License

MIT License - see [LICENSE](../LICENSE) for details.
