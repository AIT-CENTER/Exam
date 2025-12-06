import { InlineMath, BlockMath } from "react-katex";
import "katex/dist/katex.min.css";

/**
 * Renders a string containing inline ($...$) and block ($$...$$) LaTeX math.
 * Handles multiple math expressions in the same string.
 */
const renderWithMath = (text?: string): JSX.Element => {
  if (!text) return <></>;

  const elements: JSX.Element[] = [];
  const regex = /(\$\$.*?\$\$)|(\$.*?\$)/g; // $$...$$ block or $...$ inline

  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Text before the math expression
    if (match.index > lastIndex) {
      elements.push(<span key={lastIndex}>{text.slice(lastIndex, match.index)}</span>);
    }

    const math = match[0];
    if (math.startsWith("$$")) {
      // Block math
      elements.push(<BlockMath key={match.index} math={math.slice(2, -2).trim()} />);
    } else {
      // Inline math
      elements.push(<InlineMath key={match.index} math={math.slice(1, -1).trim()} />);
    }

    lastIndex = match.index + math.length;
  }

  // Any remaining text after last match
  if (lastIndex < text.length) {
    elements.push(<span key={lastIndex}>{text.slice(lastIndex)}</span>);
  }

  return <>{elements}</>;
};

export default renderWithMath;
