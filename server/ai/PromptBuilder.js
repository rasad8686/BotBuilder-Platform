/**
 * Prompt Builder for AI Flow Generation
 * Constructs optimized prompts for OpenAI GPT-4
 */

class PromptBuilder {
  /**
   * Build system prompt for flow generation
   * @param {string} userInput - User's description
   * @param {object} context - Generation context
   * @returns {string} System prompt
   */
  static buildFlowPrompt(userInput, context = {}) {
    const {
      baseTemplate = null,
      language = 'en',
      complexity = 'medium',
      includeVariables = true,
      maxNodes = 20
    } = context;

    const complexityGuide = {
      simple: '5-8 nodes, straightforward linear flow',
      medium: '8-15 nodes, includes branching and conditions',
      advanced: '15-25 nodes, complex branching, multiple paths, API integrations'
    };

    let prompt = `You are an expert chatbot flow designer. Create a complete chatbot conversation flow based on the user's requirements.

## Output Format
Return a valid JSON object with this exact structure:
{
  "name": "Flow name",
  "description": "Brief description",
  "nodes": [
    {
      "id": "unique_id",
      "type": "node_type",
      "position": { "x": number, "y": number },
      "data": {
        "label": "Node label",
        "content": "Message or content",
        ...type-specific properties
      }
    }
  ],
  "edges": [
    {
      "id": "edge_id",
      "source": "source_node_id",
      "target": "target_node_id",
      "label": "optional condition label"
    }
  ],
  "variables": [
    {
      "name": "variable_name",
      "type": "string|number|boolean|array",
      "defaultValue": default_value
    }
  ]
}

## Node Types Available
- **start**: Entry point (required, only one)
- **message**: Display text to user
- **question**: Ask user a question with options
- **input**: Collect free-form user input (specify variableName)
- **menu**: Show multiple choice options
- **condition**: Branch based on variable values
- **action**: Perform an action (handoff, create_ticket, etc.)
- **api_call**: Make API request (specify endpoint, method)
- **set_variable**: Set a variable value
- **delay**: Wait for specified time
- **email**: Send email notification
- **webhook**: Trigger external webhook
- **ai_response**: Generate AI response (can use knowledge base)
- **goto**: Jump to another node
- **end**: End conversation

## Rules
1. Always start with a "start" node
2. Always end paths with an "end" node
3. Position nodes logically (x: horizontal, y: vertical spacing of ~100-150px)
4. Use meaningful node IDs (e.g., "welcome_msg", "collect_email")
5. Connect all nodes with edges
6. Include variables for all collected user inputs
7. Use {{variable_name}} syntax in messages to reference variables
8. Target complexity: ${complexityGuide[complexity] || complexityGuide.medium}
9. Maximum nodes: ${maxNodes}
10. Language for content: ${language === 'en' ? 'English' : language}

## Best Practices
- Start with a friendly greeting
- Use clear, concise messages
- Provide helpful options in menus
- Handle edge cases (user says no, invalid input)
- Include confirmation before important actions
- End with a polite closing message
- Consider adding "go back" or "start over" options`;

    if (baseTemplate) {
      prompt += `

## Base Template Reference
Use this template as inspiration but customize based on user requirements:
Template: ${baseTemplate.name}
Category: ${baseTemplate.category}
Features: ${baseTemplate.features?.join(', ')}`;
    }

    if (includeVariables) {
      prompt += `

## Variable Guidelines
- Create variables for all user inputs
- Use descriptive variable names (snake_case)
- Set appropriate types (string, number, boolean)
- Include default values`;
    }

    return prompt;
  }

  /**
   * Build prompt for node content generation
   * @param {string} nodeType - Type of node
   * @param {object} requirements - Content requirements
   * @returns {string} Node content prompt
   */
  static buildNodePrompt(nodeType, requirements = {}) {
    const {
      purpose = '',
      tone = 'professional',
      language = 'en',
      previousMessages = [],
      variables = []
    } = requirements;

    const toneGuides = {
      professional: 'formal, polite, and business-appropriate',
      friendly: 'warm, conversational, and approachable',
      casual: 'relaxed, informal, and personable',
      formal: 'very formal, corporate, and precise',
      playful: 'fun, engaging, with appropriate humor'
    };

    const nodeTypeInstructions = {
      message: `Create a clear, ${toneGuides[tone]} message that communicates the intended information.`,
      question: `Create a question with 2-5 clear answer options. Options should be mutually exclusive and cover common responses.`,
      input: `Create a prompt that clearly explains what information is needed and why. Be specific about format if applicable.`,
      menu: `Create a menu with 3-6 options. Each option should have a clear label and description.`,
      condition: `Define condition logic with clear operators (equals, contains, greater_than, etc.) and values.`,
      action: `Specify the action type and any required parameters.`,
      api_call: `Define the API endpoint, method, headers, and body structure.`,
      email: `Create email subject and body content with variable placeholders.`,
      ai_response: `Specify the context for AI to generate a response.`
    };

    let prompt = `You are a chatbot content writer. Generate content for a ${nodeType} node.

## Requirements
- Tone: ${toneGuides[tone] || toneGuides.professional}
- Language: ${language === 'en' ? 'English' : language}
- Purpose: ${purpose}

## Node Type Instructions
${nodeTypeInstructions[nodeType] || 'Create appropriate content for this node type.'}

## Output Format
Return a JSON object with the node content:
{
  "label": "Short descriptive label",
  "content": "The main content/message",
  ...type-specific properties
}`;

    if (previousMessages.length > 0) {
      prompt += `

## Conversation Context
Previous messages in the flow:
${previousMessages.map((m, i) => `${i + 1}. ${m}`).join('\n')}`;
    }

    if (variables.length > 0) {
      prompt += `

## Available Variables
You can use these variables with {{variable_name}} syntax:
${variables.map(v => `- {{${v.name}}}: ${v.type}`).join('\n')}`;
    }

    // Add type-specific output examples
    const typeExamples = {
      message: `
Example output:
{
  "label": "Welcome Message",
  "content": "Hello! Welcome to our service. How can I help you today?"
}`,
      question: `
Example output:
{
  "label": "Satisfaction Check",
  "content": "How satisfied are you with our service?",
  "options": ["Very satisfied", "Satisfied", "Neutral", "Dissatisfied"]
}`,
      input: `
Example output:
{
  "label": "Collect Email",
  "content": "Please enter your email address:",
  "variableName": "user_email",
  "validation": "email",
  "placeholder": "example@email.com"
}`,
      menu: `
Example output:
{
  "label": "Main Menu",
  "content": "What would you like to do?",
  "options": [
    { "id": "opt1", "label": "Check order status", "value": "order_status" },
    { "id": "opt2", "label": "Get support", "value": "support" },
    { "id": "opt3", "label": "Browse products", "value": "browse" }
  ]
}`,
      condition: `
Example output:
{
  "label": "Check User Type",
  "content": "Route based on user type",
  "variable": "user_type",
  "conditions": [
    { "operator": "equals", "value": "premium", "targetNodeId": "premium_path" },
    { "operator": "equals", "value": "basic", "targetNodeId": "basic_path" }
  ],
  "defaultTargetNodeId": "default_path"
}`
    };

    if (typeExamples[nodeType]) {
      prompt += typeExamples[nodeType];
    }

    return prompt;
  }

  /**
   * Build prompt for flow improvement
   * @param {object} flow - Existing flow structure
   * @param {string} feedback - Improvement suggestions
   * @returns {string} Improvement prompt
   */
  static buildImprovementPrompt(flow, feedback) {
    const nodeCount = flow.nodes?.length || 0;
    const edgeCount = flow.edges?.length || 0;
    const variableCount = flow.variables?.length || 0;

    return `You are an expert chatbot flow optimizer. Improve the existing flow based on the feedback provided.

## Current Flow Statistics
- Nodes: ${nodeCount}
- Connections: ${edgeCount}
- Variables: ${variableCount}

## Improvement Guidelines
1. Preserve the overall structure unless explicitly asked to change it
2. Keep existing node IDs when possible for tracking
3. Improve message clarity and tone
4. Add error handling where missing
5. Optimize conversation paths
6. Ensure all paths lead to an end node
7. Add helpful fallback options

## Feedback to Address
${feedback}

## Output Requirements
Return the complete improved flow as a JSON object with the same structure:
- Keep working parts unchanged
- Modify parts that need improvement
- Add new nodes/edges if needed
- Update variables if new inputs are collected

## Important
- Maintain all existing functionality
- Only remove elements if explicitly requested
- Preserve user experience continuity
- Add comments in node labels if major changes were made (e.g., "[IMPROVED] Welcome Message")`;
  }

  /**
   * Build prompt for generating flow from natural language
   * @param {string} description - Natural language description
   * @returns {string} Natural language prompt
   */
  static buildNaturalLanguagePrompt(description) {
    return `You are a chatbot architect. Convert the following natural language description into a structured chatbot flow.

## Description
"${description}"

## Analysis Steps
1. Identify the main purpose of the chatbot
2. Extract key conversation points
3. Determine required user inputs
4. Identify decision points and branches
5. Plan the conversation flow

## Output
Create a complete flow JSON with:
- Logical node sequence
- Clear branching where needed
- Variables for all user inputs
- Proper node connections
- Error handling paths

Return a valid JSON flow structure.`;
  }

  /**
   * Build prompt for flow analysis
   * @param {object} flow - Flow to analyze
   * @returns {string} Analysis prompt
   */
  static buildAnalysisPrompt(flow) {
    return `Analyze this chatbot flow and provide insights:

## Flow Structure
${JSON.stringify(flow, null, 2)}

## Analysis Required
1. **Completeness**: Are all paths complete? Any dead ends?
2. **User Experience**: Is the conversation natural and helpful?
3. **Error Handling**: Are edge cases handled?
4. **Efficiency**: Any redundant nodes or paths?
5. **Variables**: Are all collected inputs used appropriately?

## Output Format
{
  "score": 1-10,
  "strengths": ["list of things done well"],
  "weaknesses": ["list of issues"],
  "suggestions": ["specific improvement suggestions"],
  "missingElements": ["elements that should be added"],
  "redundantElements": ["elements that could be removed"]
}`;
  }

  /**
   * Build prompt for generating test scenarios
   * @param {object} flow - Flow to generate tests for
   * @returns {string} Test generation prompt
   */
  static buildTestGenerationPrompt(flow) {
    const nodeTypes = [...new Set(flow.nodes?.map(n => n.type) || [])];

    return `Generate test scenarios for this chatbot flow.

## Flow Overview
- Total Nodes: ${flow.nodes?.length || 0}
- Node Types Used: ${nodeTypes.join(', ')}
- Variables: ${flow.variables?.map(v => v.name).join(', ') || 'None'}

## Flow Structure
${JSON.stringify(flow, null, 2)}

## Generate
Create 5-10 test scenarios covering:
1. Happy path (ideal user journey)
2. Edge cases (unusual inputs)
3. Error scenarios (invalid inputs)
4. All branch paths
5. Variable handling

## Output Format
{
  "testScenarios": [
    {
      "name": "Scenario name",
      "description": "What this tests",
      "steps": [
        { "input": "user input", "expectedNode": "node_id", "expectedResponse": "expected bot response" }
      ],
      "expectedOutcome": "final result"
    }
  ]
}`;
  }
}

module.exports = PromptBuilder;
