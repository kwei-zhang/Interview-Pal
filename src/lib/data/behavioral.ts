import type { BehavioralQuestion } from "../types";

export const behavioralQuestions: BehavioralQuestion[] = [
  {id: "team-collaboration", competency: "Teamwork", question: "Tell me about a project where collaboration made the difference.", followUp: "What did you personally do to help the team work together?"},
  {id: "team-support", competency: "Teamwork", question: "Describe a time you helped a teammate who was struggling.", followUp: "How did you balance supporting them with your own responsibilities?"},
  {id: "team-cross-functional", competency: "Teamwork", question: "Tell me about working with people outside your engineering team.", followUp: "How did you establish shared expectations?"},
  {id: "ownership-initiative", competency: "Ownership", question: "Describe a problem you took ownership of without being asked.", followUp: "How did you decide it was worth your time?"},
  {id: "ownership-incident", competency: "Ownership", question: "Tell me about a production issue you helped resolve.", followUp: "What changed afterward to reduce the chance of it happening again?"},
  {id: "ownership-tradeoff", competency: "Ownership", question: "Describe a time you chose between speed and long-term quality.", followUp: "What evidence guided the decision?"},
  {id: "conflict-disagreement", competency: "Conflict", question: "Tell me about a technical disagreement with a teammate.", followUp: "What did you learn from their perspective?"},
  {id: "conflict-feedback", competency: "Conflict", question: "Describe a time you received feedback that was difficult to hear.", followUp: "What did you change as a result?"},
  {id: "conflict-resolution", competency: "Conflict", question: "Tell me about a time competing priorities created tension.", followUp: "How did you reach a workable agreement?"},
  {id: "leadership-influence", competency: "Leadership", question: "Describe a time you influenced a decision without formal authority.", followUp: "How did you build support for your proposal?"},
  {id: "leadership-mentoring", competency: "Leadership", question: "Tell me about someone you mentored or helped develop.", followUp: "How did you know your support was effective?"},
  {id: "leadership-direction", competency: "Leadership", question: "Describe a time you helped a team find direction.", followUp: "What did you do when people wanted different outcomes?"},
  {id: "learning-failure", competency: "Learning", question: "Tell me about a mistake or failure that changed how you work.", followUp: "What concrete habit or process did you change?"},
  {id: "learning-new-skill", competency: "Learning", question: "Describe a time you learned an unfamiliar technology to deliver something.", followUp: "How did you choose what to learn first?"},
  {id: "learning-adjustment", competency: "Learning", question: "Tell me about a plan that did not work and how you adapted.", followUp: "What was the earliest signal that you needed to change course?"},
  {id: "communication-complexity", competency: "Communication", question: "Describe explaining a complex technical idea to a nontechnical audience.", followUp: "How did you check that they understood?"},
  {id: "communication-expectations", competency: "Communication", question: "Tell me about communicating a delay or difficult update.", followUp: "What did you offer people so they could make a decision?"},
  {id: "ambiguity-requirements", competency: "Ambiguity", question: "Describe a project where the requirements were unclear.", followUp: "Which assumptions did you validate first?"},
  {id: "impact-improvement", competency: "Impact", question: "Tell me about an improvement you made that had a measurable result.", followUp: "How did you measure the impact and separate it from other changes?"},
  {id: "impact-user", competency: "Impact", question: "Describe a time understanding a user's needs changed your solution.", followUp: "What evidence showed the new approach was better?"},
];

export const questionById = (id: string) => behavioralQuestions.find(q => q.id === id);
