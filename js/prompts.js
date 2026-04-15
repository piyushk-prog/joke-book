/**
 * prompts.js — Writing prompts to spark joke ideas (Indian middle-class flavor)
 */

const PROMPTS = [
  "What's something every Indian household does but nobody admits to?",
  "What's the worst career advice you got from a relative?",
  "What's a rule in your housing society that exists because of one resident?",
  "What's something technically legal but treated like a crime in Indian families?",
  "What would a foreigner at their first Indian wedding find most confusing?",
  "What's the most overrated thing relatives rave about at every function?",
  "What's a lie your parents told you that you believed for way too long?",
  "What's the dumbest thing you've spent money on at Sarojini, Colaba, or Commercial Street?",
  "What's something Indian adults do that would shock a kid from another country?",
  "What unwritten family rule should be made official?",
  "What's a \"home remedy\" your mom swears by that is definitely made up?",
  "What's the weirdest thing about your job that only desis would get?",
  "What Indian invention is long overdue?",
  "What's something people in your city are way too proud of?",
  "What's a conspiracy theory about something boring — railways, LPG cylinders, DTH recharge?",
  "What's the most annoying thing about calling any Indian customer care?",
  "What if your relatives actually ran the country for one day?",
  "What's something from a 90s or 2000s Indian childhood that would never fly today?",
  "What's the most useless skill you picked up at a coaching class or tuition?",
  "What's a hill you're willing to die on that no aunty will ever understand?",
  "What's the difference between how your parents describe you to others vs. who you actually are?",
  "What's something you had to learn the hard way in Indian adulting?",
  "What would happen if your mom saw your Instagram for one day?",
  "What's the most passive-aggressive thing a society aunty has said to you?",
  "What's the worst small-talk question at an Indian wedding?",
  "What's an opinion that would get you cancelled at the next family function?",
  "What would your Indian autobiography be titled?",
  "What's the most \"only in India\" thing that's happened to you this month?",
  "What's the funniest Hinglish or regional-language mix-up you've had?",
  "What's a red flag in a rishta profile that everyone pretends not to see?",
  "What's something about an Indian government office that gets funnier the longer you think about it?",
  "What's a skill every Indian has that's completely useless on a resume?",
  "What do you pretend to understand — at a puja, at work, with your in-laws?",
  "What's a middle-class Indian problem that genuinely bothers you?",
  "What's the most dramatic reaction you've seen to something completely normal?",
  "What's a \"jugaad\" that was supposed to save time but somehow made things worse?",
  "What would you put on a warning label before introducing someone to your parents?",
  "What's an Indian social norm that makes absolutely zero sense?",
  "What's the most awkward silence you've sat through at a family dinner?",
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
