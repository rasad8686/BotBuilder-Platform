/**
 * AnalyzerAgent - Analyzes data and provides insights
 */

const Agent = require('../core/Agent');

class AnalyzerAgent extends Agent {
  constructor(config) {
    super({
      ...config,
      role: config.role || 'analyzer',
      systemPrompt: config.systemPrompt || `You are an analytical agent specialized in data analysis and insight extraction.

Your responsibilities:
1. Analyze data, text, or any input thoroughly
2. Extract meaningful patterns and trends
3. Identify issues, anomalies, or areas of concern
4. Provide actionable insights and recommendations
5. Present findings in a clear, structured format
6. Use database and code execution tools to perform advanced analysis

Available tool types you can use:
- Database tools: Query databases for data to analyze
- Code execution tools: Run calculations and data processing

When analyzing, respond with a JSON object:
{
  "analysisType": "data|text|sentiment|pattern|comparison",
  "summary": "Brief overview of the analysis",
  "toolsUsed": ["tool_name1", "tool_name2"],
  "findings": [
    {
      "category": "Category name",
      "observation": "What was found",
      "significance": "high|medium|low",
      "details": "Additional details"
    }
  ],
  "patterns": [
    {
      "pattern": "Description of pattern",
      "frequency": "How often it occurs",
      "implications": "What this means"
    }
  ],
  "issues": [
    {
      "issue": "Problem identified",
      "severity": "critical|warning|info",
      "recommendation": "Suggested action"
    }
  ],
  "metrics": {
    "key": "value"
  },
  "recommendations": ["Actionable recommendations based on analysis"],
  "confidence": "high|medium|low"
}

Use tools to gather and process data before analysis.`
    });

    this.analysisType = config.analysisType || 'general';
  }

  /**
   * Set analysis type
   * @param {string} type - Type of analysis to perform
   */
  setAnalysisType(type) {
    this.analysisType = type;
  }

  /**
   * Build prompt with analysis context
   */
  buildPrompt(input, context) {
    const basePrompt = super.buildPrompt(input, context);

    if (this.analysisType && this.analysisType !== 'general') {
      basePrompt.messages.splice(1, 0, {
        role: 'system',
        content: `Focus on ${this.analysisType} analysis for this task.`
      });
    }

    // Add available analysis tools
    if (this.loadedTools.length > 0) {
      const analysisTools = this.loadedTools.filter(t =>
        ['database_query', 'code_execution'].includes(t.type)
      );

      if (analysisTools.length > 0) {
        const toolsInfo = analysisTools.map(t =>
          `- ${t.name}: ${t.description || t.type}`
        ).join('\n');

        basePrompt.messages.splice(1, 0, {
          role: 'system',
          content: `Analysis tools available:\n${toolsInfo}\n\nUse these tools for data queries and calculations.`
        });
      }
    }

    return basePrompt;
  }

  /**
   * Parse analysis results from output
   * @param {Object} output - Agent output
   * @returns {Object} - Parsed analysis
   */
  parseAnalysis(output) {
    try {
      const data = output.type === 'json' ? output.data : JSON.parse(output.raw);
      return {
        valid: true,
        analysis: data
      };
    } catch {
      return {
        valid: false,
        error: 'Failed to parse analysis results',
        raw: output.raw
      };
    }
  }

  /**
   * Extract key metrics from analysis
   * @param {Object} analysis - Parsed analysis
   * @returns {Object} - Key metrics
   */
  extractMetrics(analysis) {
    return {
      findingsCount: analysis.findings?.length || 0,
      issuesCount: analysis.issues?.length || 0,
      patternsCount: analysis.patterns?.length || 0,
      confidence: analysis.confidence || 'unknown',
      criticalIssues: analysis.issues?.filter(i => i.severity === 'critical').length || 0
    };
  }
}

module.exports = AnalyzerAgent;
