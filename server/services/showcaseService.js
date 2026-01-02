const db = require('../config/db');

const showcaseService = {
  async getProjects(filters = {}) {
    const { category, industry, status, search, limit = 20, offset = 0 } = filters;
    let query = db('showcase_projects').where('status', 'approved');
    if (category) query = query.where('category', category);
    if (industry) query = query.where('industry', industry);
    if (search) query = query.where('title', 'ilike', `%${search}%`);
    return query.orderBy('created_at', 'desc').limit(limit).offset(offset);
  },

  async getProjectBySlug(slug) {
    await db('showcase_projects').where('slug', slug).increment('views_count', 1);
    return db('showcase_projects').where('slug', slug).first();
  },

  async getFeaturedProjects(limit = 6) {
    return db('showcase_projects')
      .where({ status: 'approved', is_featured: true })
      .orderBy('created_at', 'desc')
      .limit(limit);
  },

  async createProject(userId, orgId, data) {
    const [project] = await db('showcase_projects')
      .insert({ ...data, user_id: userId, organization_id: orgId, status: 'pending' })
      .returning('*');
    return project;
  },

  async updateProject(id, userId, data) {
    const project = await db('showcase_projects').where({ id, user_id: userId }).first();
    if (!project) throw new Error('Project not found or unauthorized');
    const [updated] = await db('showcase_projects').where('id', id).update(data).returning('*');
    return updated;
  },

  async deleteProject(id, userId) {
    const project = await db('showcase_projects').where({ id, user_id: userId }).first();
    if (!project) throw new Error('Project not found or unauthorized');
    await db('showcase_projects').where('id', id).del();
    return true;
  },

  async toggleLike(projectId, userId) {
    const existing = await db('showcase_likes').where({ project_id: projectId, user_id: userId }).first();
    if (existing) {
      await db('showcase_likes').where({ project_id: projectId, user_id: userId }).del();
      await db('showcase_projects').where('id', projectId).decrement('likes_count', 1);
      return { liked: false };
    } else {
      await db('showcase_likes').insert({ project_id: projectId, user_id: userId });
      await db('showcase_projects').where('id', projectId).increment('likes_count', 1);
      return { liked: true };
    }
  },

  async addComment(projectId, userId, content) {
    const [comment] = await db('showcase_comments')
      .insert({ project_id: projectId, user_id: userId, content })
      .returning('*');
    return comment;
  },

  async getComments(projectId) {
    return db('showcase_comments')
      .join('users', 'showcase_comments.user_id', 'users.id')
      .where('project_id', projectId)
      .select('showcase_comments.*', 'users.name as user_name')
      .orderBy('created_at', 'desc');
  },

  async approveProject(id) {
    const [project] = await db('showcase_projects')
      .where('id', id)
      .update({ status: 'approved', approved_at: new Date() })
      .returning('*');
    return project;
  },

  async rejectProject(id) {
    const [project] = await db('showcase_projects')
      .where('id', id)
      .update({ status: 'rejected' })
      .returning('*');
    return project;
  },

  async toggleFeature(id) {
    const project = await db('showcase_projects').where('id', id).first();
    const [updated] = await db('showcase_projects')
      .where('id', id)
      .update({ is_featured: !project.is_featured })
      .returning('*');
    return updated;
  },

  async getCategories() {
    return db('showcase_projects')
      .where('status', 'approved')
      .select('category')
      .count('* as count')
      .groupBy('category');
  },

  async getUserProjects(userId) {
    return db('showcase_projects').where('user_id', userId).orderBy('created_at', 'desc');
  },

  async getPendingProjects() {
    return db('showcase_projects').where('status', 'pending').orderBy('created_at', 'asc');
  }
};

module.exports = showcaseService;
