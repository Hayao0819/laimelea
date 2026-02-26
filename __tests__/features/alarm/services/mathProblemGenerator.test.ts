import { generateMathProblem } from "../../../../src/features/alarm/services/mathProblemGenerator";

describe("generateMathProblem", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should return a question and answer", () => {
    const problem = generateMathProblem(1);
    expect(problem.question).toBeTruthy();
    expect(typeof problem.answer).toBe("number");
  });

  it("should generate easy problems (single-digit) for difficulty 1", () => {
    // Force addition path
    jest.spyOn(Math, "random").mockReturnValue(0.3);
    const problem = generateMathProblem(1);
    expect(problem.question).toMatch(/^\d \+ \d$/);
    expect(problem.answer).toBeGreaterThan(0);
    expect(problem.answer).toBeLessThanOrEqual(18);
  });

  it("should generate subtraction with non-negative result for difficulty 1", () => {
    // Force subtraction path
    jest.spyOn(Math, "random").mockReturnValue(0.6);
    const problem = generateMathProblem(1);
    expect(problem.question).toMatch(/^\d - \d$/);
    expect(problem.answer).toBeGreaterThanOrEqual(0);
  });

  it("should generate medium problems (two-digit) for difficulty 2", () => {
    jest.spyOn(Math, "random").mockReturnValue(0.3);
    const problem = generateMathProblem(2);
    expect(problem.question).toMatch(/^\d{2} \+ \d{2}$/);
    expect(problem.answer).toBeGreaterThanOrEqual(20);
  });

  it("should generate multiplication for difficulty 3", () => {
    jest.spyOn(Math, "random").mockReturnValue(0.5);
    const problem = generateMathProblem(3);
    expect(problem.question).toContain("\u00d7");
    expect(problem.answer).toBeGreaterThan(0);
  });

  it("should always produce correct answers", () => {
    jest.restoreAllMocks();
    for (let d = 1; d <= 3; d++) {
      for (let i = 0; i < 20; i++) {
        const problem = generateMathProblem(d);
        // Evaluate the question to verify
        const evalQuestion = problem.question.replace("\u00d7", "*");
        // eslint-disable-next-line no-eval
        expect(eval(evalQuestion)).toBe(problem.answer);
      }
    }
  });
});
