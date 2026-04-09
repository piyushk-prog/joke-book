/**
 * prompts.js — Writing prompts to spark joke ideas
 */

const PROMPTS = [
  "What's something everyone does but nobody talks about?",
  "What's the worst advice you've ever received?",
  "What's a rule that exists because of one person?",
  "What's something that's technically legal but feels illegal?",
  "What would an alien think is weird about humans?",
  "What's the most overrated thing in your daily life?",
  "What's a lie you believed for way too long?",
  "What's the dumbest thing you've spent money on?",
  "What's something adults do that kids would find absurd?",
  "What unwritten rule should be made official?",
  "What's something that sounds smart but is actually stupid?",
  "What's the weirdest thing about your job that outsiders wouldn't believe?",
  "What invention is long overdue?",
  "What's something people are way too proud of?",
  "What's a conspiracy theory about something mundane?",
  "What's the most annoying thing about modern technology?",
  "What if [everyday thing] worked the same way as [other thing]?",
  "What's something from your childhood that would never fly today?",
  "What's the most useless talent you have?",
  "What's a hill you're willing to die on that nobody cares about?",
  "What's the difference between how you see yourself and how others see you?",
  "What's something you had to learn the hard way?",
  "What would happen if your pet could talk for one day?",
  "What's the most passive-aggressive thing you've witnessed?",
  "What's the worst small talk topic?",
  "What's an opinion that would get you in trouble at a dinner party?",
  "What would your autobiography be titled?",
  "What's the most Indian thing that's ever happened to you?",
  "What's the funniest misunderstanding you've had?",
  "What's a red flag that you just ignore anyway?",
  "What's something that gets funnier the more you think about it?",
  "What's a skill you have that's completely useless on your resume?",
  "What do you pretend to understand but actually don't?",
  "What's a first-world problem that genuinely bothers you?",
  "What's the most dramatic thing you've seen in a completely normal setting?",
  "What's something that's supposed to save time but actually doesn't?",
  "What would you put on a warning label for yourself?",
  "What's a social norm that makes zero sense?",
  "What's the most awkward silence you've ever experienced?",
  "What did you think was normal growing up but turned out to be just your family?",
];

let lastIndex = -1;

const Prompts = {
  /** Get a random prompt (avoids repeating the same one) */
  getRandom() {
    let idx;
    do {
      idx = Math.floor(Math.random() * PROMPTS.length);
    } while (idx === lastIndex && PROMPTS.length > 1);
    lastIndex = idx;
    return PROMPTS[idx];
  },

  /** Get all prompts */
  getAll() {
    return PROMPTS;
  }
};

export default Prompts;
