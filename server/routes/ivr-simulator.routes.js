/**
 * IVR Simulator API Routes
 * Handles IVR flow simulation for testing
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const ivrSimulator = require('../services/ivr-simulator.service');
const ivrService = require('../services/ivr.service');

/**
 * @route POST /api/voice/ivr/:id/simulate/start
 * @desc Start IVR simulation
 * @access Private
 */
router.post('/:id/simulate/start', auth, async (req, res) => {
  try {
    const { id: flowId } = req.params;
    const { testNumber, debugMode, stepByStep } = req.body;

    // Verify access
    const flow = await ivrService.getFlowById(flowId);
    if (!flow) {
      return res.status(404).json({ success: false, error: 'Flow not found' });
    }

    const organizationId = req.user.organization_id || req.user.org_id;
    if (flow.organization_id !== organizationId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const result = await ivrSimulator.simulateCall(flowId, testNumber, {
      debugMode,
      stepByStep
    });

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error starting simulation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/voice/ivr/:id/simulate/input
 * @desc Send input to simulation
 * @access Private
 */
router.post('/:id/simulate/input', auth, async (req, res) => {
  try {
    const { simulationId, digit, speech, inputType } = req.body;

    if (!simulationId) {
      return res.status(400).json({ success: false, error: 'Simulation ID required' });
    }

    let result;
    if (inputType === 'speech' || speech) {
      result = await ivrSimulator.simulateSpeech(simulationId, speech);
    } else {
      result = await ivrSimulator.simulateInput(simulationId, digit);
    }

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error sending input:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route GET /api/voice/ivr/:id/simulate/state
 * @desc Get simulation state
 * @access Private
 */
router.get('/:id/simulate/state', auth, async (req, res) => {
  try {
    const { simulationId } = req.query;

    if (!simulationId) {
      return res.status(400).json({ success: false, error: 'Simulation ID required' });
    }

    const state = await ivrSimulator.getSimulatorState(simulationId);

    res.json({ success: true, ...state });
  } catch (error) {
    console.error('Error getting state:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/voice/ivr/:id/simulate/end
 * @desc End simulation
 * @access Private
 */
router.post('/:id/simulate/end', auth, async (req, res) => {
  try {
    const { simulationId } = req.body;

    if (!simulationId) {
      return res.status(400).json({ success: false, error: 'Simulation ID required' });
    }

    const result = await ivrSimulator.endSimulation(simulationId);

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error ending simulation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route GET /api/voice/ivr/:id/simulate/history
 * @desc Get simulation history
 * @access Private
 */
router.get('/:id/simulate/history', auth, async (req, res) => {
  try {
    const { id: flowId } = req.params;
    const { page, limit } = req.query;

    // Verify access
    const flow = await ivrService.getFlowById(flowId);
    if (!flow) {
      return res.status(404).json({ success: false, error: 'Flow not found' });
    }

    const organizationId = req.user.organization_id || req.user.org_id;
    if (flow.organization_id !== organizationId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const result = await ivrSimulator.getSimulationHistory(flowId, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    });

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error getting history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/voice/ivr/:id/simulate/timeout
 * @desc Simulate timeout
 * @access Private
 */
router.post('/:id/simulate/timeout', auth, async (req, res) => {
  try {
    const { simulationId } = req.body;

    if (!simulationId) {
      return res.status(400).json({ success: false, error: 'Simulation ID required' });
    }

    const result = await ivrSimulator.simulateTimeout(simulationId);

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error simulating timeout:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== DEBUG MODE ENDPOINTS ====================

/**
 * @route POST /api/voice/ivr/:id/simulate/pause
 * @desc Pause simulation
 * @access Private
 */
router.post('/:id/simulate/pause', auth, async (req, res) => {
  try {
    const { simulationId } = req.body;
    const result = ivrSimulator.pauseSimulation(simulationId);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/voice/ivr/:id/simulate/resume
 * @desc Resume simulation
 * @access Private
 */
router.post('/:id/simulate/resume', auth, async (req, res) => {
  try {
    const { simulationId } = req.body;
    const result = ivrSimulator.resumeSimulation(simulationId);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/voice/ivr/:id/simulate/step
 * @desc Step to next node (debug mode)
 * @access Private
 */
router.post('/:id/simulate/step', auth, async (req, res) => {
  try {
    const { simulationId } = req.body;
    const result = await ivrSimulator.stepNext(simulationId);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/voice/ivr/:id/simulate/variable
 * @desc Set variable (debug mode)
 * @access Private
 */
router.post('/:id/simulate/variable', auth, async (req, res) => {
  try {
    const { simulationId, name, value } = req.body;
    const result = ivrSimulator.setVariable(simulationId, name, value);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/voice/ivr/:id/simulate/jump
 * @desc Jump to node (debug mode)
 * @access Private
 */
router.post('/:id/simulate/jump', auth, async (req, res) => {
  try {
    const { simulationId, nodeId } = req.body;
    const result = await ivrSimulator.jumpToNode(simulationId, nodeId);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route GET /api/voice/ivr/:id/simulate/twiml
 * @desc Get TwiML preview
 * @access Private
 */
router.get('/:id/simulate/twiml', auth, async (req, res) => {
  try {
    const { simulationId } = req.query;
    const result = await ivrSimulator.getTwiMLPreview(simulationId);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== TEST SCENARIOS ====================

/**
 * @route POST /api/voice/ivr/:id/simulate/test/scenario
 * @desc Run test scenario
 * @access Private
 */
router.post('/:id/simulate/test/scenario', auth, async (req, res) => {
  try {
    const { id: flowId } = req.params;
    const { scenario } = req.body;

    const result = await ivrSimulator.runTestScenario(flowId, scenario);

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error running test scenario:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/voice/ivr/:id/simulate/test/happy-path
 * @desc Run happy path test
 * @access Private
 */
router.post('/:id/simulate/test/happy-path', auth, async (req, res) => {
  try {
    const { id: flowId } = req.params;
    const { maxSteps } = req.body;

    const result = await ivrSimulator.runHappyPathTest(flowId, maxSteps);

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error running happy path test:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/voice/ivr/:id/simulate/test/timeout
 * @desc Run timeout test
 * @access Private
 */
router.post('/:id/simulate/test/timeout', auth, async (req, res) => {
  try {
    const { id: flowId } = req.params;

    const result = await ivrSimulator.runTimeoutTest(flowId);

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error running timeout test:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/voice/ivr/:id/simulate/scenarios/save
 * @desc Save test scenario
 * @access Private
 */
router.post('/:id/simulate/scenarios/save', auth, async (req, res) => {
  try {
    const { id: flowId } = req.params;
    const { scenario } = req.body;

    const result = ivrSimulator.saveTestScenario(flowId, scenario);

    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route GET /api/voice/ivr/:id/simulate/scenarios
 * @desc Get saved test scenarios
 * @access Private
 */
router.get('/:id/simulate/scenarios', auth, async (req, res) => {
  try {
    const { id: flowId } = req.params;

    const scenarios = ivrSimulator.loadTestScenarios(flowId);

    res.json({ success: true, scenarios });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
