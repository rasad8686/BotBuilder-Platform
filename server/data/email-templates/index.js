const welcomeTemplate = require('./welcome-template.json');
const newsletterTemplate = require('./newsletter-template.json');
const promotionalTemplate = require('./promotional-template.json');
const announcementTemplate = require('./announcement-template.json');
const transactionalTemplate = require('./transactional-template.json');

const systemTemplates = [
  welcomeTemplate,
  newsletterTemplate,
  promotionalTemplate,
  announcementTemplate,
  transactionalTemplate
];

module.exports = {
  systemTemplates,
  getSystemTemplateById: (id) => systemTemplates.find(t => t.id === id),
  getSystemTemplatesByCategory: (category) =>
    category ? systemTemplates.filter(t => t.category === category) : systemTemplates
};
