import StartNode from './StartNode';
import TextNode from './TextNode';
import QuestionNode from './QuestionNode';
import ConditionNode from './ConditionNode';
import EndNode from './EndNode';
import SMSNode from './SMSNode';

// Define nodeTypes outside of any component to ensure stable reference
export const nodeTypes = {
  start: StartNode,
  text: TextNode,
  question: QuestionNode,
  condition: ConditionNode,
  end: EndNode,
  sms: SMSNode
};

export { StartNode, TextNode, QuestionNode, ConditionNode, EndNode, SMSNode };
