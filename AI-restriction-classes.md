# AI Restriction Classes

A set of general-purpose classes defining how AI may be used for a task. **A** allows AI agents, **B** allows content generation, **C** allows support without incorporating AI-generated task content, and **D** prohibits AI use for the task.

Within A, B and C, level **1** is more permissive than level **2**. The person performing the task is the **user**; the person setting its rules is the **organiser**.

| Class | AI involvement |
|---|---|
| **A1** | An agent can work independently within an authorised scope. |
| **A2** | An agent can work with the user’s approval for each action. |
| **B1** | AI can generate a complete result for the user to review. |
| **B2** | AI can generate or modify parts of the result. |
| **C1** | AI can discuss task-specific ideas and provide feedback. |
| **C2** | AI can explain concepts and give unrelated examples. |
| **D** | AI is not used for the task. |

## A1 — Autonomous agent

**Purpose:** An AI agent carries out a task and makes intermediate decisions within an agreed scope.

- **Allowed:** Planning, generating and modifying content, using authorised tools, and performing authorised actions without approval at every step.
- **Conditions:** The organiser or user defines the agent’s goal, permitted actions, boundaries and any actions requiring separate approval. The user reviews the result as required by the task.
- **Not allowed:** Acting outside the authorised scope. Permission to work on the task does not automatically permit sending messages, publishing, submitting work or accessing protected data.
- **Assistant instruction:** 
You are working under the A1 — Autonomous Agent policy.

Your task:
[Project description]

You are authorised to:
Planning, generating and modifying content, using authorised tools, and performing authorised actions without approval at every step.

You may use these tools and resources:
[Additional to the class restrictions]

Actions that require my separate approval:
[Additional to the class restrictions]

Your instructions:

1. Plan and carry out the task within the authorised scope.
   You may make intermediate decisions and revise your work without
   asking for approval at every step.

2. Use only the authorised tools, resources, and data. If a necessary
   action or resource is outside the defined scope, ask before using it.

3. Do not send messages, publish, deploy, submit work, access protected
   data, or share information unless I explicitly authorise that
   specific action.

4. Prepare a concrete, reviewable result before requesting approval
   for an action that requires it.

5. When the task is complete, tell me:
   - What you did and produced.
   - Which tools or resources you used.
   - What you checked.
   - Any unresolved issues or limitations.
   - Any action still awaiting my approval.

Work autonomously within these boundaries. If a boundary is unclear
and affects an action, ask for clarification before taking that action. 
Full description: [link]

## A2 — Supervised agent

**Purpose:** An AI agent assists with the task while the user controls its actions.

- **Allowed:** Planning, generating and modifying content, and proposing tool use or other actions.
- **Conditions:** The agent asks for the user’s approval before each tool execution, file modification or other external action. The action must also be permitted by the task policy.
- **Not allowed:** Performing those actions without approval or outside the authorised scope.
- **Assistant instruction:** You are my AI agent for [Project Name]. 

## B1 — Full generation

**Purpose:** AI can generate a complete result, while the user directs and reviews the work.

- **Allowed:** Generating, rewriting and improving a complete text, analysis, design, image, audio, video or code result.
- **Human contribution:** The user sets the goal, makes decisions, reviews the result and checks relevant claims and sources.
- **Not allowed:** Autonomous tool use or external actions unless separately authorised by the task policy.
- **Assistant instruction:** You are my AI assistant for [Project Name]. 

## B2 — Partial generation

**Purpose:** AI can create or modify parts of the result; the user retains control of the overall work.

- **Allowed:** Drafting a section, fixing a function, editing language, suggesting alternatives or improving part of a design.
- **Not allowed:** Generating the complete result, including by assembling it through many small requests, unless an explicit exception permits it.
- **Human contribution:** The user develops and reviews the overall result and checks relevant claims and sources.
- **Assistant instruction:** You are my AI assistant for [Project Name]. 

A **part** is a distinguishable component of the result; a **whole** contains its essential required elements. The boundary depends on the task, not on a fixed number of words or lines.

## C1 — Task-specific support

**Purpose:** AI helps the user think through the task without producing content for inclusion in the result.

- **Allowed:** Discussing task-specific ideas, suggesting directions, asking questions and giving feedback on the user’s work.
- **Not allowed:** Providing a completed solution or substantive AI-generated text, code, analysis or other content for incorporation into the result.
- **Human contribution:** The user makes the decisions and creates the result themselves.
- **Assistant instruction:** You are my AI assistant for [Project Name]. 

Learning from a discussion is allowed. Changing the wording of a generated solution does not automatically make it independent work; if the distinction is unclear, ask the organiser.

## C2 — General support

**Purpose:** AI helps the user understand relevant concepts without advising on the specific task.

- **Allowed:** General explanations, practice questions and worked examples unrelated to the specific task.
- **Not allowed:** Task-specific ideas, feedback, solutions or generated content for the result.
- **Human contribution:** The user applies their understanding and completes the task independently.
- **Assistant instruction:** You are my AI assistant for [Project Name]. 

## D — No AI

**Purpose:** The task is completed without using AI.

- **Allowed:** Non-AI tools and support, subject to the task’s other rules.
- **Not allowed:** Using AI for any part of the task, including explanations, feedback, generation or technical assistance.

## Applying the classes

The organiser selects one class and may add task-specific restrictions or explicitly approved exceptions. The assistant receives the selected class together with those rules. If an approval, exception, task boundary or permitted action is unclear, it asks for clarification.

AI-generated content can be incorporated only where the selected class or a valid exception permits it. The user remains responsible for reviewing the result and following any task-specific disclosure requirements. Permission to generate content never automatically grants permission to run commands, edit files, access protected data, send messages, publish or submit.
