import { test } from "node:test";
import assert from "node:assert/strict";
import { GENERAL_QUESTIONS, validateQuestions } from "../supabase/functions/generate-tree/questions";

function set(count: number) {
  return {
    questions: Array.from({ length: count }, (_, index) => ({
      question: `Question number ${index + 1} about the goal?`,
      options: ["First choice", "Second choice"],
    })),
  };
}

test("up to five tailored questions are accepted, six are not", () => {
  assert.equal(validateQuestions(set(1))?.length, 1);
  assert.equal(validateQuestions(set(5))?.length, 5);
  assert.equal(validateQuestions(set(6)), null);
  assert.equal(validateQuestions(set(0)), null);
});

test("the general fallback asks five questions", () => {
  assert.equal(GENERAL_QUESTIONS.length, 5);
  assert.equal(validateQuestions({ questions: GENERAL_QUESTIONS })?.length, 5);
});

test("sensitive wording is still refused, including in a fifth question", () => {
  const questions = set(5).questions.map((item) => ({ ...item }));
  questions[4].question = "What medication are you taking for this?";
  assert.equal(validateQuestions({ questions }), null);
});
