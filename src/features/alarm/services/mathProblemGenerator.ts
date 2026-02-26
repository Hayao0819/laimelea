export interface MathProblem {
  question: string;
  answer: number;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateMathProblem(difficulty: number): MathProblem {
  if (difficulty <= 1) {
    // Easy: single-digit addition/subtraction
    const op = Math.random() < 0.5 ? "+" : "-";
    if (op === "+") {
      const a = randomInt(1, 9);
      const b = randomInt(1, 9);
      return { question: `${a} + ${b}`, answer: a + b };
    }
    const a = randomInt(2, 9);
    const b = randomInt(1, a); // ensure a >= b for non-negative result
    return { question: `${a} - ${b}`, answer: a - b };
  }

  if (difficulty === 2) {
    // Medium: two-digit addition/subtraction
    const op = Math.random() < 0.5 ? "+" : "-";
    if (op === "+") {
      const a = randomInt(10, 99);
      const b = randomInt(10, 99);
      return { question: `${a} + ${b}`, answer: a + b };
    }
    const a = randomInt(20, 99);
    const b = randomInt(10, a); // ensure a >= b
    return { question: `${a} - ${b}`, answer: a - b };
  }

  // Hard (difficulty >= 3): multiplication
  const a = randomInt(2, 9);
  const b = randomInt(11, 49);
  return { question: `${a} \u00d7 ${b}`, answer: a * b };
}
