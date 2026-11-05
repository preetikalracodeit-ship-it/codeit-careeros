/**
 * Turns a recommended project into a step-by-step completion plan.
 *
 * The backend owns the project (title, description, difficulty, weeks and
 * target skills). This module only expands that data into the sequence a
 * student should follow, with a checklist and a clear definition of done.
 * The same project always produces the same plan.
 */

function skillNames(project) {
  return (project?.skills || []).map((skill) => skill.skillName).filter(Boolean);
}

function schedule(estimatedWeeks) {
  const weeks = Math.max(1, Number(estimatedWeeks) || 2);
  return {
    weeks,
    core: weeks > 3 ? `Weeks 2-${weeks - 1}` : "Week 2",
    test: weeks > 2 ? `End of week ${weeks - 1}` : "End of week 2",
    polish: weeks > 2 ? `Week ${weeks}` : "Final 2 days",
  };
}

export function buildProjectPlan(project) {
  const title = project?.title || "this project";
  const skills = skillNames(project);
  const skillText = skills.length > 0 ? skills.join(", ") : "the skills this project targets";
  const { core, test, polish } = schedule(project?.estimatedWeeks);

  return {
    outcome: `A working ${title} that you can demo, explain and put on your CV — built with ${skillText}.`,
    steps: [
      {
        key: "scope",
        title: "Clarify the brief and define done",
        when: "Days 1-2",
        detail:
          "Turn the project description into a small, testable scope. Write down what you will build, who it is for, and what you will deliberately leave out.",
        checklist: [
          "Rewrite the goal in one sentence: who uses it and what changes for them.",
          "List the 3-5 must-have features and park everything else.",
          "Write one acceptance criterion for each must-have.",
          "Sketch the main screen or data flow on paper.",
        ],
      },
      {
        key: "setup",
        title: "Set up the repo and the stack",
        when: "Days 2-3",
        detail: `Create a clean project you can run from a fresh clone. Use the skills this project targets: ${skillText}.`,
        checklist: [
          "Create a Git repo with a README, .gitignore and an .env.example.",
          `Set up ${skillText} and get a blank app running locally.`,
          "Add lint, test and build commands.",
          "Create sample data or a seed script so the app is never empty.",
          "Break the work into weekly milestones.",
        ],
      },
      {
        key: "slice",
        title: "Build one end-to-end slice",
        when: "Week 1",
        detail:
          "Prove the architecture with the smallest path a real user can complete. It is better to have one thin working flow than five half-built screens.",
        checklist: [
          "Create the data model or API contract for the main feature.",
          "Make one feature work from the interface through to storage.",
          "Add loading, empty and error states.",
          "Commit working code at least every other day.",
        ],
      },
      {
        key: "core",
        title: "Complete the core features",
        when: core,
        detail:
          "Build the remaining must-haves one at a time. Finish and test each feature before starting the next so the project stays demoable.",
        checklist: [
          "Implement each must-have against its acceptance criterion.",
          "Add input validation and permission checks where needed.",
          "Handle the edge cases you listed in step 1.",
          "Check the main flow on a phone-sized screen.",
          "Keep a short list of bugs and decisions as you go.",
        ],
      },
      {
        key: "test",
        title: "Test and harden",
        when: test,
        detail:
          "Spend focused time breaking your own project before a reviewer does. Fix the highest-impact issues first.",
        checklist: [
          "Test the critical path plus one edge case.",
          "Run the app from a fresh clone and follow the README.",
          "Check labels, keyboard navigation and colour contrast.",
          "Fix the top three issues you find.",
        ],
      },
      {
        key: "polish",
        title: "Polish, document and deploy",
        when: polish,
        detail:
          "Make the project easy to understand and easy to run. A reviewer should be able to open it without asking you questions.",
        checklist: [
          "Write a README: problem, screenshots, setup, architecture and trade-offs.",
          "Deploy it or record a demo link.",
          "Add a short section on what you would improve next.",
          "Confirm the app runs from a fresh clone with the documented commands.",
        ],
      },
      {
        key: "publish",
        title: "Publish and tell the story",
        when: "After the build",
        detail:
          "Turn the build into career evidence. The demo and CV bullet matter as much as the code.",
        checklist: [
          "Record a 3-minute demo: problem, walkthrough, result.",
          "Add a CV bullet with action + stack + measurable result.",
          "Post the repo and demo on LinkedIn or GitHub.",
          "Ask one mentor for feedback and note the next improvement.",
        ],
      },
    ],
    done: [
      "The main user journey works end to end.",
      "The project runs from a fresh clone using the README.",
      "Critical paths have tests or a documented manual test.",
      "The README explains the problem, approach, result and next steps.",
      "You can demo the result in under 3 minutes.",
      "A CV bullet and LinkedIn entry describe the outcome.",
    ],
  };
}
