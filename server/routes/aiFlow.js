const express = require('express');
const router = express.Router();
const FlowGenerator = require('../ai/FlowGenerator');
const FlowTemplates = require('../ai/FlowTemplates');
const PromptBuilder = require('../ai/PromptBuilder');
const authenticateToken = require('../middleware/auth');
const log = require('../utils/logger');

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * POST /api/ai/flow/generate
 * Generate a new flow from prompt
 */
router.post('/generate', async (req, res) => {
  try {
    const { prompt, options = {} } = req.body;

    if (!prompt || prompt.trim().length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a detailed prompt (at least 10 characters)'
      });
    }

    const result = await FlowGenerator.generateFlow(prompt, {
      ...options,
      userId: req.user.id,
      organizationId: req.user.current_organization_id
    });

    if (result.success) {
      res.json({
        success: true,
        flow: result.flow,
        metadata: result.metadata
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to generate flow'
      });
    }
  } catch (error) {
    log.error('Flow generation error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Internal server error during flow generation'
    });
  }
});

/**
 * POST /api/ai/flow/improve
 * Improve an existing flow based on suggestions
 */
router.post('/improve', async (req, res) => {
  try {
    const { flow, suggestions } = req.body;

    if (!flow || !flow.nodes) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid flow structure'
      });
    }

    if (!suggestions || (Array.isArray(suggestions) && suggestions.length === 0)) {
      return res.status(400).json({
        success: false,
        error: 'Please provide improvement suggestions'
      });
    }

    const result = await FlowGenerator.improveFlow(flow, suggestions);

    if (result.success) {
      res.json({
        success: true,
        flow: result.flow,
        changes: result.changes,
        metadata: result.metadata
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to improve flow'
      });
    }
  } catch (error) {
    log.error('Flow improvement error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Internal server error during flow improvement'
    });
  }
});

/**
 * POST /api/ai/flow/suggest-nodes
 * Get node suggestions for current flow
 */
router.post('/suggest-nodes', async (req, res) => {
  try {
    const { flow } = req.body;

    if (!flow || !flow.nodes) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid flow structure'
      });
    }

    const result = await FlowGenerator.suggestNextNodes(flow);

    if (result.success) {
      res.json({
        success: true,
        suggestions: result.suggestions,
        metadata: result.metadata
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to generate suggestions'
      });
    }
  } catch (error) {
    log.error('Node suggestion error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Internal server error during node suggestion'
    });
  }
});

/**
 * POST /api/ai/flow/generate-content
 * Generate content for a specific node type
 */
router.post('/generate-content', async (req, res) => {
  try {
    const { nodeType, context = {} } = req.body;

    const validNodeTypes = [
      'message', 'question', 'input', 'menu', 'condition',
      'action', 'api_call', 'email', 'ai_response'
    ];

    if (!nodeType || !validNodeTypes.includes(nodeType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid node type. Valid types: ${validNodeTypes.join(', ')}`
      });
    }

    const result = await FlowGenerator.generateNodeContent(nodeType, context);

    if (result.success) {
      res.json({
        success: true,
        content: result.content,
        nodeType: result.nodeType,
        metadata: result.metadata
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to generate node content'
      });
    }
  } catch (error) {
    log.error('Content generation error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Internal server error during content generation'
    });
  }
});

/**
 * GET /api/ai/flow/templates
 * Get all available flow templates
 */
router.get('/templates', async (req, res) => {
  try {
    const { category, search } = req.query;

    let templates;

    if (search) {
      templates = FlowTemplates.searchTemplates(search);
    } else if (category) {
      templates = FlowTemplates.getTemplatesByCategory(category);
    } else {
      templates = FlowTemplates.getTemplates();
    }

    const categories = FlowTemplates.getCategories();

    res.json({
      success: true,
      templates,
      categories,
      total: templates.length
    });
  } catch (error) {
    log.error('Templates fetch error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch templates'
    });
  }
});

/**
 * GET /api/ai/flow/templates/:id
 * Get a specific template by ID
 */
router.get('/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const template = FlowTemplates.getTemplateById(id);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    res.json({
      success: true,
      template
    });
  } catch (error) {
    log.error('Template fetch error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch template'
    });
  }
});

/**
 * POST /api/ai/flow/analyze
 * Analyze a flow and provide insights
 */
router.post('/analyze', async (req, res) => {
  try {
    const { flow } = req.body;

    if (!flow || !flow.nodes) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid flow structure'
      });
    }

    // Basic validation
    const validation = FlowGenerator.validateFlow(flow);

    // Build analysis prompt and get AI analysis
    const analysisPrompt = PromptBuilder.buildAnalysisPrompt(flow);

    // Perform static analysis
    const staticAnalysis = performStaticAnalysis(flow);

    res.json({
      success: true,
      analysis: {
        validation: {
          isValid: true,
          nodeCount: validation.nodes?.length || 0,
          edgeCount: validation.edges?.length || 0,
          variableCount: validation.variables?.length || 0
        },
        staticAnalysis,
        suggestions: generateBasicSuggestions(flow, staticAnalysis)
      }
    });
  } catch (error) {
    log.error('Flow analysis error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to analyze flow'
    });
  }
});

/**
 * Perform static analysis on a flow
 */
function performStaticAnalysis(flow) {
  const analysis = {
    hasStartNode: false,
    hasEndNode: false,
    orphanedNodes: [],
    deadEnds: [],
    unreachableNodes: [],
    missingConnections: [],
    variableUsage: {
      defined: [],
      used: [],
      unused: [],
      undefined: []
    }
  };

  const nodes = flow.nodes || [];
  const edges = flow.edges || [];
  const variables = flow.variables || [];

  // Check for start and end nodes
  analysis.hasStartNode = nodes.some(n => n.type === 'start');
  analysis.hasEndNode = nodes.some(n => n.type === 'end');

  // Build node connection maps
  const nodeIds = new Set(nodes.map(n => n.id));
  const hasIncoming = new Set();
  const hasOutgoing = new Set();

  edges.forEach(edge => {
    if (nodeIds.has(edge.source)) hasOutgoing.add(edge.source);
    if (nodeIds.has(edge.target)) hasIncoming.add(edge.target);
  });

  // Find orphaned nodes (no connections at all)
  nodes.forEach(node => {
    if (node.type !== 'start' && !hasIncoming.has(node.id) && !hasOutgoing.has(node.id)) {
      analysis.orphanedNodes.push(node.id);
    }
  });

  // Find dead ends (no outgoing, not an end node)
  nodes.forEach(node => {
    if (node.type !== 'end' && !hasOutgoing.has(node.id)) {
      analysis.deadEnds.push(node.id);
    }
  });

  // Find unreachable nodes (no incoming, not a start node)
  nodes.forEach(node => {
    if (node.type !== 'start' && !hasIncoming.has(node.id)) {
      analysis.unreachableNodes.push(node.id);
    }
  });

  // Analyze variable usage
  analysis.variableUsage.defined = variables.map(v => v.name);

  // Find used variables in node content
  const variablePattern = /\{\{(\w+)\}\}/g;
  nodes.forEach(node => {
    const content = JSON.stringify(node.data || {});
    let match;
    while ((match = variablePattern.exec(content)) !== null) {
      if (!analysis.variableUsage.used.includes(match[1])) {
        analysis.variableUsage.used.push(match[1]);
      }
    }
  });

  // Find unused and undefined variables
  analysis.variableUsage.unused = analysis.variableUsage.defined.filter(
    v => !analysis.variableUsage.used.includes(v)
  );
  analysis.variableUsage.undefined = analysis.variableUsage.used.filter(
    v => !analysis.variableUsage.defined.includes(v)
  );

  return analysis;
}

/**
 * Generate basic suggestions based on analysis
 */
function generateBasicSuggestions(flow, analysis) {
  const suggestions = [];

  if (!analysis.hasStartNode) {
    suggestions.push({
      type: 'error',
      message: 'Flow is missing a start node',
      action: 'Add a start node as the entry point'
    });
  }

  if (!analysis.hasEndNode) {
    suggestions.push({
      type: 'warning',
      message: 'Flow is missing an end node',
      action: 'Add end nodes to properly terminate conversations'
    });
  }

  if (analysis.orphanedNodes.length > 0) {
    suggestions.push({
      type: 'error',
      message: `${analysis.orphanedNodes.length} orphaned node(s) found`,
      action: 'Connect or remove these nodes',
      nodes: analysis.orphanedNodes
    });
  }

  if (analysis.deadEnds.length > 0) {
    suggestions.push({
      type: 'warning',
      message: `${analysis.deadEnds.length} dead end(s) found`,
      action: 'Add connections from these nodes or convert to end nodes',
      nodes: analysis.deadEnds
    });
  }

  if (analysis.unreachableNodes.length > 0) {
    suggestions.push({
      type: 'warning',
      message: `${analysis.unreachableNodes.length} unreachable node(s) found`,
      action: 'Add incoming connections to these nodes',
      nodes: analysis.unreachableNodes
    });
  }

  if (analysis.variableUsage.undefined.length > 0) {
    suggestions.push({
      type: 'warning',
      message: `${analysis.variableUsage.undefined.length} undefined variable(s) used`,
      action: 'Define these variables or fix variable names',
      variables: analysis.variableUsage.undefined
    });
  }

  if (analysis.variableUsage.unused.length > 0) {
    suggestions.push({
      type: 'info',
      message: `${analysis.variableUsage.unused.length} unused variable(s) defined`,
      action: 'Consider using or removing these variables',
      variables: analysis.variableUsage.unused
    });
  }

  // Node count suggestions
  const nodeCount = flow.nodes?.length || 0;
  if (nodeCount > 30) {
    suggestions.push({
      type: 'info',
      message: 'Flow has many nodes',
      action: 'Consider breaking into multiple flows or simplifying'
    });
  }

  return suggestions;
}

module.exports = router;
