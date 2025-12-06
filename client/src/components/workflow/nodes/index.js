import StartNode from './StartNode';
import EndNode from './EndNode';
import AgentNode from './AgentNode';
import ConditionNode from './ConditionNode';
import ParallelNode from './ParallelNode';

export { StartNode, EndNode, AgentNode, ConditionNode, ParallelNode };

export const nodeTypes = {
  start: StartNode,
  end: EndNode,
  agent: AgentNode,
  condition: ConditionNode,
  parallel: ParallelNode
};

export default nodeTypes;
