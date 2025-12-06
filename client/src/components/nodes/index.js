import StartNode from './StartNode';
import TextNode from './TextNode';
import QuestionNode from './QuestionNode';
import ConditionNode from './ConditionNode';
import EndNode from './EndNode';

// Define nodeTypes outside of any component to ensure stable reference
export const nodeTypes = {
  start: StartNode,
  text: TextNode,
  question: QuestionNode,
  condition: ConditionNode,
  end: EndNode
};

export { StartNode, TextNode, QuestionNode, ConditionNode, EndNode };
