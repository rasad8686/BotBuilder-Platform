/**
 * Tour Templates Service
 * Handles template CRUD operations and system templates
 */

const db = require('../config/db');
const log = require('../utils/logger');

// System Templates - Pre-built templates
const SYSTEM_TEMPLATES = [
  {
    id: 'welcome-tour',
    name: 'Welcome Tour',
    description: 'A simple welcome tour to greet new users',
    category: 'onboarding',
    is_system: true,
    thumbnail_url: '/templates/welcome-tour.png',
    steps: [
      {
        order: 1,
        title: 'Welcome!',
        content: 'Welcome to our platform! Let us show you around.',
        target: 'body',
        placement: 'center',
        type: 'modal'
      },
      {
        order: 2,
        title: 'Navigation',
        content: 'Use the sidebar to navigate between different sections.',
        target: '.sidebar',
        placement: 'right',
        type: 'tooltip'
      },
      {
        order: 3,
        title: 'Get Started',
        content: 'Click here to create your first project!',
        target: '.create-button',
        placement: 'bottom',
        type: 'tooltip',
        showConfetti: true
      }
    ],
    settings: {
      showProgressBar: true,
      allowSkip: true,
      showStepNumbers: true,
      overlay: true,
      overlayOpacity: 0.5
    }
  },
  {
    id: 'feature-introduction',
    name: 'Feature Introduction',
    description: 'Introduce a new feature with detailed walkthrough',
    category: 'feature',
    is_system: true,
    thumbnail_url: '/templates/feature-intro.png',
    steps: [
      {
        order: 1,
        title: 'New Feature Alert!',
        content: 'We have added an exciting new feature. Let us show you how it works.',
        target: 'body',
        placement: 'center',
        type: 'modal'
      },
      {
        order: 2,
        title: 'Access the Feature',
        content: 'Click here to access the new feature.',
        target: '.feature-button',
        placement: 'bottom',
        type: 'tooltip'
      },
      {
        order: 3,
        title: 'Configure Settings',
        content: 'Customize the feature according to your needs.',
        target: '.settings-panel',
        placement: 'left',
        type: 'tooltip'
      },
      {
        order: 4,
        title: 'View Results',
        content: 'Your results will appear in this section.',
        target: '.results-area',
        placement: 'top',
        type: 'tooltip'
      },
      {
        order: 5,
        title: 'All Done!',
        content: 'You are all set! Start using the new feature now.',
        target: 'body',
        placement: 'center',
        type: 'modal',
        showConfetti: true
      }
    ],
    settings: {
      showProgressBar: true,
      allowSkip: true,
      showStepNumbers: true,
      overlay: true,
      highlightTarget: true
    }
  },
  {
    id: 'onboarding-checklist',
    name: 'Onboarding Checklist',
    description: 'Complete onboarding flow with checklist items',
    category: 'onboarding',
    is_system: true,
    thumbnail_url: '/templates/onboarding-checklist.png',
    steps: [
      {
        order: 1,
        title: 'Welcome to Your Journey',
        content: 'Complete these steps to get the most out of our platform.',
        target: 'body',
        placement: 'center',
        type: 'modal'
      },
      {
        order: 2,
        title: 'Step 1: Complete Your Profile',
        content: 'Add your information to personalize your experience.',
        target: '.profile-section',
        placement: 'right',
        type: 'tooltip',
        checklistItem: true
      },
      {
        order: 3,
        title: 'Step 2: Connect Your Account',
        content: 'Link your external accounts for seamless integration.',
        target: '.integrations',
        placement: 'bottom',
        type: 'tooltip',
        checklistItem: true
      },
      {
        order: 4,
        title: 'Step 3: Invite Team Members',
        content: 'Collaborate with your team by inviting them.',
        target: '.invite-button',
        placement: 'left',
        type: 'tooltip',
        checklistItem: true
      },
      {
        order: 5,
        title: 'Step 4: Create Your First Project',
        content: 'Start your first project to see the platform in action.',
        target: '.new-project',
        placement: 'bottom',
        type: 'tooltip',
        checklistItem: true
      },
      {
        order: 6,
        title: 'Step 5: Explore Templates',
        content: 'Use our templates to get started quickly.',
        target: '.templates-gallery',
        placement: 'right',
        type: 'tooltip',
        checklistItem: true
      },
      {
        order: 7,
        title: 'All Done!',
        content: 'Congratulations! You have completed the onboarding.',
        target: 'body',
        placement: 'center',
        type: 'modal',
        showConfetti: true
      }
    ],
    settings: {
      showProgressBar: true,
      allowSkip: false,
      showStepNumbers: true,
      overlay: true,
      showChecklist: true,
      persistProgress: true
    }
  },
  {
    id: 'new-feature-announcement',
    name: 'New Feature Announcement',
    description: 'Quick announcement for new features',
    category: 'announcement',
    is_system: true,
    thumbnail_url: '/templates/announcement.png',
    steps: [
      {
        order: 1,
        title: 'Something New!',
        content: 'We have just launched a new feature that will help you work faster.',
        target: 'body',
        placement: 'center',
        type: 'modal',
        image: '/images/feature-preview.png'
      },
      {
        order: 2,
        title: 'Try It Now',
        content: 'Click here to try out the new feature.',
        target: '.new-feature',
        placement: 'bottom',
        type: 'tooltip',
        ctaButton: {
          text: 'Try Now',
          action: 'navigate',
          url: '/new-feature'
        }
      }
    ],
    settings: {
      showProgressBar: false,
      allowSkip: true,
      showStepNumbers: false,
      overlay: true,
      overlayClickClose: true
    }
  },
  {
    id: 'feedback-survey',
    name: 'Feedback Survey',
    description: 'Collect user feedback with in-app survey',
    category: 'survey',
    is_system: true,
    thumbnail_url: '/templates/survey.png',
    steps: [
      {
        order: 1,
        title: 'We Value Your Feedback',
        content: 'Help us improve by answering a few quick questions.',
        target: 'body',
        placement: 'center',
        type: 'modal'
      },
      {
        order: 2,
        title: 'How satisfied are you?',
        content: 'Rate your overall experience with our platform.',
        target: 'body',
        placement: 'center',
        type: 'survey',
        surveyType: 'rating',
        surveyOptions: { min: 1, max: 5 }
      },
      {
        order: 3,
        title: 'What can we improve?',
        content: 'Select areas where you would like to see improvements.',
        target: 'body',
        placement: 'center',
        type: 'survey',
        surveyType: 'multiselect',
        surveyOptions: {
          choices: ['Performance', 'Features', 'UI/UX', 'Documentation', 'Support']
        }
      },
      {
        order: 4,
        title: 'Any other feedback?',
        content: 'Share any additional thoughts or suggestions.',
        target: 'body',
        placement: 'center',
        type: 'survey',
        surveyType: 'text'
      }
    ],
    settings: {
      showProgressBar: true,
      allowSkip: true,
      showStepNumbers: true,
      overlay: true,
      collectResponses: true
    }
  },
  {
    id: 'empty-template',
    name: 'Empty Template',
    description: 'Start from scratch with a blank template',
    category: 'onboarding',
    is_system: true,
    thumbnail_url: '/templates/empty.png',
    steps: [],
    settings: {
      showProgressBar: true,
      allowSkip: true,
      showStepNumbers: true,
      overlay: true
    }
  }
];

class TourTemplatesService {
  /**
   * Get all templates by category
   */
  async getTemplates(category = null, organizationId = null) {
    try {
      // Get system templates
      let systemTemplates = [...SYSTEM_TEMPLATES];
      if (category) {
        systemTemplates = systemTemplates.filter(t => t.category === category);
      }

      // Get user templates from database
      let query = db('tour_templates').where({ is_system: false });

      if (organizationId) {
        query = query.where({ organization_id: organizationId });
      }

      if (category) {
        query = query.where({ category });
      }

      const userTemplates = await query.orderBy('use_count', 'desc');

      // Parse JSON fields
      const parsedUserTemplates = userTemplates.map(t => ({
        ...t,
        steps: typeof t.steps === 'string' ? JSON.parse(t.steps) : t.steps,
        settings: typeof t.settings === 'string' ? JSON.parse(t.settings) : t.settings
      }));

      return {
        system: systemTemplates,
        user: parsedUserTemplates,
        total: systemTemplates.length + parsedUserTemplates.length
      };
    } catch (error) {
      log.error('Get templates error', { error: error.message });
      throw error;
    }
  }

  /**
   * Get template by ID
   */
  async getTemplateById(templateId) {
    try {
      // Check if system template
      const systemTemplate = SYSTEM_TEMPLATES.find(t => t.id === templateId);
      if (systemTemplate) {
        return { ...systemTemplate, isSystem: true };
      }

      // Get from database
      const template = await db('tour_templates')
        .where({ id: templateId })
        .first();

      if (!template) {
        throw new Error('Template not found');
      }

      return {
        ...template,
        steps: typeof template.steps === 'string' ? JSON.parse(template.steps) : template.steps,
        settings: typeof template.settings === 'string' ? JSON.parse(template.settings) : template.settings,
        isSystem: false
      };
    } catch (error) {
      log.error('Get template by ID error', { templateId, error: error.message });
      throw error;
    }
  }

  /**
   * Create tour from template
   */
  async createFromTemplate(templateId, tourData, workspaceId) {
    try {
      const template = await this.getTemplateById(templateId);

      // Merge template with provided tour data
      const tourToCreate = {
        workspace_id: workspaceId,
        name: tourData.name || template.name,
        description: tourData.description || template.description,
        settings: JSON.stringify({ ...template.settings, ...(tourData.settings || {}) }),
        theme: tourData.theme ? JSON.stringify(tourData.theme) : null,
        status: 'draft',
        created_at: new Date(),
        updated_at: new Date()
      };

      // Create tour
      const [tour] = await db('tours')
        .insert(tourToCreate)
        .returning('*');

      // Create steps from template
      if (template.steps && template.steps.length > 0) {
        const stepsToCreate = template.steps.map((step, index) => ({
          tour_id: tour.id,
          order_index: index + 1,
          title: step.title,
          content: step.content,
          target_selector: step.target,
          placement: step.placement || 'bottom',
          type: step.type || 'tooltip',
          settings: JSON.stringify({
            showConfetti: step.showConfetti,
            checklistItem: step.checklistItem,
            surveyType: step.surveyType,
            surveyOptions: step.surveyOptions,
            ctaButton: step.ctaButton,
            image: step.image
          }),
          created_at: new Date(),
          updated_at: new Date()
        }));

        await db('tour_steps').insert(stepsToCreate);
      }

      // Increment use count for non-system templates
      if (!template.isSystem) {
        await db('tour_templates')
          .where({ id: templateId })
          .increment('use_count', 1);
      }

      // Get full tour with steps
      const steps = await db('tour_steps')
        .where({ tour_id: tour.id })
        .orderBy('order_index');

      return {
        ...tour,
        settings: typeof tour.settings === 'string' ? JSON.parse(tour.settings) : tour.settings,
        theme: tour.theme ? (typeof tour.theme === 'string' ? JSON.parse(tour.theme) : tour.theme) : null,
        steps
      };
    } catch (error) {
      log.error('Create from template error', { templateId, error: error.message });
      throw error;
    }
  }

  /**
   * Save tour as template
   */
  async saveAsTemplate(tourId, templateData, organizationId) {
    try {
      // Get tour with steps
      const tour = await db('tours')
        .where({ id: tourId })
        .first();

      if (!tour) {
        throw new Error('Tour not found');
      }

      const steps = await db('tour_steps')
        .where({ tour_id: tourId })
        .orderBy('order_index');

      // Prepare template steps
      const templateSteps = steps.map(step => ({
        order: step.order_index,
        title: step.title,
        content: step.content,
        target: step.target_selector,
        placement: step.placement,
        type: step.type,
        ...(step.settings ? (typeof step.settings === 'string' ? JSON.parse(step.settings) : step.settings) : {})
      }));

      // Create template
      const [template] = await db('tour_templates')
        .insert({
          organization_id: organizationId,
          name: templateData.name || `${tour.name} Template`,
          description: templateData.description || tour.description,
          category: templateData.category || 'onboarding',
          steps: JSON.stringify(templateSteps),
          settings: tour.settings,
          is_system: false,
          thumbnail_url: templateData.thumbnail_url || null,
          use_count: 0,
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('*');

      return {
        ...template,
        steps: templateSteps,
        settings: typeof template.settings === 'string' ? JSON.parse(template.settings) : template.settings
      };
    } catch (error) {
      log.error('Save as template error', { tourId, error: error.message });
      throw error;
    }
  }

  /**
   * Get system templates only
   */
  getSystemTemplates() {
    return SYSTEM_TEMPLATES;
  }

  /**
   * Get user templates for organization
   */
  async getUserTemplates(organizationId, options = {}) {
    try {
      const { category, limit = 50, offset = 0 } = options;

      let query = db('tour_templates')
        .where({ organization_id: organizationId, is_system: false });

      if (category) {
        query = query.where({ category });
      }

      const templates = await query
        .orderBy('use_count', 'desc')
        .limit(limit)
        .offset(offset);

      return templates.map(t => ({
        ...t,
        steps: typeof t.steps === 'string' ? JSON.parse(t.steps) : t.steps,
        settings: typeof t.settings === 'string' ? JSON.parse(t.settings) : t.settings
      }));
    } catch (error) {
      log.error('Get user templates error', { organizationId, error: error.message });
      throw error;
    }
  }

  /**
   * Update template
   */
  async updateTemplate(templateId, data) {
    try {
      const updates = {
        updated_at: new Date()
      };

      if (data.name) updates.name = data.name;
      if (data.description) updates.description = data.description;
      if (data.category) updates.category = data.category;
      if (data.steps) updates.steps = JSON.stringify(data.steps);
      if (data.settings) updates.settings = JSON.stringify(data.settings);
      if (data.thumbnail_url) updates.thumbnail_url = data.thumbnail_url;

      const [template] = await db('tour_templates')
        .where({ id: templateId })
        .update(updates)
        .returning('*');

      return {
        ...template,
        steps: typeof template.steps === 'string' ? JSON.parse(template.steps) : template.steps,
        settings: typeof template.settings === 'string' ? JSON.parse(template.settings) : template.settings
      };
    } catch (error) {
      log.error('Update template error', { templateId, error: error.message });
      throw error;
    }
  }

  /**
   * Delete template
   */
  async deleteTemplate(templateId) {
    try {
      await db('tour_templates')
        .where({ id: templateId, is_system: false })
        .delete();

      return { success: true };
    } catch (error) {
      log.error('Delete template error', { templateId, error: error.message });
      throw error;
    }
  }

  /**
   * Get template categories
   */
  getCategories() {
    return [
      { id: 'onboarding', name: 'Onboarding', description: 'User onboarding flows' },
      { id: 'feature', name: 'Feature Introduction', description: 'New feature walkthroughs' },
      { id: 'announcement', name: 'Announcement', description: 'Product announcements' },
      { id: 'survey', name: 'Survey', description: 'User feedback surveys' }
    ];
  }
}

module.exports = new TourTemplatesService();
