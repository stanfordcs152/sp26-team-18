# PRD Template — CS 152 Milestone 2

> **How to use this template.** Copy this file to your own team's repository at `docs/PRD.md`, then edit each section. Delete this blockquote and the italicized prompts before you commit. Keep the section headings so TAs can grade consistently.
>
> Target length: **4–8 pages of rendered Markdown**. Tight and specific beats long and vague.
>
> Every section should be concrete enough that a new teammate joining on week three could start contributing without a meeting.

---

## Team

- **Team Number:** `18`
- **Project Name:** `Your product / codename`
- **One-line pitch:** _One sentence: what you are building and for whom._
- **Abuse path:** `Human-abuser` **or** `AI-as-abuser` _(pick one)_
- **Team members:** Name (GitHub handle) — role _(e.g., PM, backend, frontend, ML, research)_
  - Alex Example (@astamos) — PM
  - ...
- **Deployed URL:** `https://...` _(placeholder for Milestone 2; update once CI/CD is live)_
- **Repository:** `https://github.com/<org>/<repo>`

---

## 1. Problem Statement
We seek to mitigate the exploit of AI-generated images, posted onto social media platforms, as potential tools of political disinformation. AI tools are widely available to a range of potential actors—from government-linked networks to individual operaitves—to create images of real political figures saying or doing things they never did (Insikt Group, 2024). AI-generated fake imagery is an effective and cheap way to spread disinformation. The frequency of the attacks is difficult to gauge, but the scale of the problem is accelerating rapidly. Politically motivated deepfake incidents in Q1 2025 alone nearly matched the total recorded across all of 2024 (Surfshark, 2025). Victims of this abuse span multiple categories: (1) political figures, whose likeness is misappropriated (with women being disproportionately targeted), (2) ordinary citizens weaponized as props for pushing certain political narratives, (3) the general public, whose trust in institutions and political representatives can be adversely affected by exposure to such AI-generated content. Research confirms that negative effect as 60% of viewers in one study believed a labeled political deepfake was real, and 10% reported they would not vote for the targeted politician as a direct result (Momeni, 2025). It is difficult to directly mitigate the AI-generated content before the distribution stage, as this would need addressing at the generational stage of various AI models, both commercial and hosted locally. This means that the victims exposed to fake AI-imagery will be affected by the content when it goes viral, which is why it needs to be labeled as synthetically-generated media.


Insikt Group. (2024). Targets, objectives, and emerging tactics: Political deepfakes. Recorded Future.
https://www.recordedfuture.com/research/targets-objectives-emerging-tactics-political-deepfakes
Momeni, M. (2025). Artificial intelligence and political deepfakes: Shaping citizen perceptions through misinformation. Global Media and Communication, 20(1).
https://journals.sagepub.com/doi/10.1177/09732586241277335
Surfshark. (2025). Deepfake statistics 2025: How frequently are celebrities targeted? https://surfshark.com/research/study/deepfake-statistics


**Why this matters now:** 
This is a pressing issue, given the increased capability of AI models to release more hyperrealistic images. The urgency is compounded by the increasing accessibility of image generating softwares that lower the technical entry barrier for potential malicious actors. In mid-2025, Google launched an image-editor, Nano Banana. It went viral, attracting about 23 million users who transformed over 500 million images in the first two weeks of Nano Banana’s launch. All thanks to the easy usage of the platform as “to get the perfect picture, you simply pop an image into Gemini and tell it what you’d like to change” (Hart, 2025). More recently, just this past month, OpenAI released its newest image generator, ChatGPT Images 2.0. which “can generate more than one image from a single prompt, like an entire study booklet, as well as output text, including in non-English languages like Chinese and Hindi” (Rogers, 2026). This shows that the ability to generate hyperrealistic pictures of individuals, such as political leaders, in situations that had never taken place is eerily within anyone’s reach. This can lead to spread of disinformation, precipitated by such fake AI-generated images circulating on social media platforms, that can lead to eroding trust in political institutions, politicians, and democratic processes. These concerns are timely, as according to last year’s data, about half of U.S. adults (53%) say they at least sometimes get news from social media (Pew Research Center, 2025). Political figures themselves have called attention to the issue recently. For example, Italian PM, Giorgia Meloni, purposefully shared AI-generated pictures of herself in lingerie to warn the public that “AI-generated images were an increasingly dangerous tool capable of misleading and harming individuals” (Tondo, 2026).

Hart, R. (2025, September 15). Here's why usage of Gemini's Nano Banana image editor is growing. The Verge. https://www.theverge.com/news/778106/google-gemini-nano-banana-image-editor
Pew Research Center. (2025, September 25). Social media and news fact sheet. https://www.pewresearch.org/journalism/fact-sheet/social-media-and-news-fact-sheet/
Rogers, R. (2026, April 21). OpenAI beefs up ChatGPT's image generation model. Wired. https://www.wired.com/story/openai-beefs-up-chatgpts-image-generation-model/
Tondo, L. (2026, May 5). 'Think before sharing,' Giorgia Meloni says as AI-made lingerie image of her goes viral. The Guardian. https://www.theguardian.com/world/2026/may/05/giorgia-meloni-ai-generated-lingerie-image-deepfake

---

## 2. Users and User Stories

### Who are the users of this product?

- **Primary:** users of the platform (both the consumers and the creators of the image content)
- **Secondary:** trust & safety moderators responsible for content review on social media platforms
- **Tertiary (if applicable):** politicians, political organizations, and other individuals whose likeness might be misappropriated

### User stories

1.As a platform of the user, I want to know whether the political content I come across on the platform is reliable, so I want it to be automatically labeled before sharing or forming opinions.
2.As a trust & safety moderator, I want an automated detection queue that flags suspect AI-generated political images for review so that I can prioritize enforcement actions before content goes viral
3.As a trust & safety moderator, I want confidence scores assigned to the flagged content so that I can make faster and better-documented decisions.
4.As a social media platform, I want a transparent and consistently enforced label system so that I can maintain trust in my product and reduce regulatory and reputational risk.
5.As a politician, I want a rapid-response reporting channel for synthetic images misusing my likeness so that I can request expedited review before the content causes measurable reputational or electoral harm.


---

## 3. Scope and Non-Goals

### In scope for Milestone 2

- Introduce a moderator dashboard
- Create a function providing a confidence level to indicate whether the uploaded image is AI-generated


### In scope for Milestone 3

- Fine tune the model to improve the AI detection confidence
- Narrow the scope of the function to provide the AI-generation confidence levels only on relevant, politically-focused posts rather than the all posts on the platform 

### Non-goals

- This product does not act as a censoring tool. Flagging of the AI-generated content will not constitute grounds for removal nor demotion, unless the content breaches any of the rules specified in relevant community guidelines of the platform.
- The product does not explain why the image might be incorrect nor seeks to provide any further context. It lets the viewers make their own judgment of whether the content they are seeing is authentic or not.


---

## 4. Success Metrics

How will you know your system works? Be measurable. Pick a small number of real metrics, not a wishlist. For each, state a target and how you will measure it.

| Metric | Target | How measured |
|---|---|---|
| Recall | ≥ 0.85 | # of flagged deepfakes / # of total true deepfakes |
| False Positive Rates | ≤ 0.05 | # of real images flagged as deepfakes / # total real images. |
| Moderator Precision (True Positives) | >= 0.90 | # of flagged deepfakes / # total images sent to moderator |
| Latency | < 5s | Average time from the user clicking "Upload" to the classification API returning a confidence score. |
| User Reported Abuse | > 0.30 | (0.7) * (# Deepfake reports before) >= (# Deepfake reports after)  |
| Shares and Posts | < 100 | # of views a political deepfake has before our moderation team gets to it. |

Some metrics — especially qualitative ones like "victim feels heard" — are hard to quantify. For those, define how you will assess them (user study? structured review? TA feedback?).

---

## 5. System Architecture

### Diagram

Include a system diagram. Lightweight ways to do this:

- Hand-drawn on paper, scan, commit as PNG
- [Excalidraw](https://excalidraw.com/) → export PNG
- [tldraw](https://www.tldraw.com/) → export PNG
- Mermaid in the Markdown itself (GitHub renders it):

    ````md
    ```mermaid
    flowchart LR
      User[End User] --> UploadUI[Upload UI]
      UploadUI --> Classification["Classification Layer<br/>(AWS Rekognition & OpenAI)"]

      %% Primary Classification Branches
      Classification -->|Good Score| PublicUpload[Publicly Visible Post]
      Classification -->|Bad Score| RestrictedUpload[Temporary Restricted Upload]
      Classification -->|Bad Score| ModQueue[Moderator Queue]

      %% Moderator Workflow
      ModQueue --> ModUI[Moderator UI]
      ModUI -->|Reviews| ModDecision{Moderator Decision}

      %% Moderator Decision Branches
      ModDecision -->|Valid| PublicUpload
      ModDecision -->|Violates Policy| TakeDown[Take Down Post]

### Components

For each box in your diagram, write 2–3 sentences:

- **Product UI** — _The Product UI is built with Next.js and Tailwind, allowing users to browse and upload photos from their gallery. It is hosted on Vercel, which makes it easier for us to handle upload requests and keep the frontend deployment simple._
- **Mitigation Layer** — _The backend uses AWS Rekognition to detect whether someone in an image may be a politician. It combines those facial recognition flags with contextual analysis from the OpenAI API to generate an AI certainty score, which then routes the upload to one of three states: public, temporarily restricted, or sent to the moderator review queue._
- **Moderator UI** — _The Moderator UI allows moderators to efficiently review images that were flagged by the mitigation layer. Right now, the moderator tab is password protected, but for Milestone 3 we plan to incorporate Supabase and proper authentication._
- **Data store** — _A managed PostgreSQL database serves as the main relational system for our app. It stores user profiles, upload metadata, AI classification scores, and the current status of each item in the moderator queue. If an image has already been reviewed before, it is saved in the moderator cache so moderators do not have to classify the same image twice._
- **External services** — _The main external services we use are AWS Rekognition, the OpenAI API, and Supabase. AWS helps with image and facial recognition, OpenAI helps with contextual analysis, and Supabase will support authentication and database-related functionality._
- **CI/CD pipeline** — _GitHub Actions helps automate our development process. Whenever someone opens a pull request, it can run checks to make sure the code works properly and follows our project standards. Once the code is approved and merged into the main branch, it automatically helps deploy the updated frontend to Vercel and apply any needed backend or database changes, reducing the amount of manual work._

### Data flow

Narrate one request end-to-end: a user does X → a request hits Y → classifier returns Z → moderator sees W.

Data Flow:
    - Upload: 
        - User uploads an image via the Frontend.
    - Inference:
        - The backend intercepts the upload and sends it to the Classification Service to detect AI signatures and known political figures.
    - Quarantine & Labeling: 
        - If flagged as an AI political figure, the Backend atomatically labels this as "Potential AI". The post's database status is set to visibility: restricted (visible only to direct connections/friends) and added to the Mod Queue.
    - Moderator Review: 
        - An T&S member uses the Moderator UI to review the queued image. They can either choose "Approve to Public", "Keep Restricted", or "Takedown."

---

## 6. Data Sources and Test Sets

### Training data (if any)

_Are you training a classifier? If so, what data are you using? Public dataset? Scraped? Synthetic? Document sourcing, licensing, and any ethical considerations._

### Test sets for Milestone 3 evaluation

You will need **two labeled sets** for Milestone 3:

- **Allow set** — benign examples that should pass through. Target size: ≥ 100.
  - _Source: describe how you obtained or generated this._
- **Unallow set** — abusive examples that must be caught. Target size: ≥ 100.
  - _Source: describe._
  - _For illegal or extremely harmful content, use stand-ins (e.g., photos of nude kittens instead of CSAM). Document the stand-in choice._

### Public datasets worth considering

_(Delete this subsection once you've picked yours.)_

- [HuggingFace Datasets](https://huggingface.co/datasets) — search for your abuse type
- [Papers With Code → Datasets](https://paperswithcode.com/datasets)
- [Stanford Digital Repository](https://searchworks.stanford.edu/) (via Stanford Libraries)
- [The Journal of Online Trust and Safety](https://tsjournal.org/) often publishes linked datasets

---

## 7. Risks and Mitigations

For each risk, state the risk, likelihood (Low / Medium / High), impact, and how you plan to mitigate it.

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| _The classifier has a chance of taking too long_, frustrating users_ | _M_ | _H_ | _Use an existing lightweight classification model_ |
| _Moderators cannot reach the post in timely manner_ | _H_ | _M_ | _Try to cache existing images so the moderators doesn't classify the same image twice_ |
| _Scraped dataset contains PII_ | _L_ | _H_ | _Review before commit; never push raw to public repo; use synthetic examples if in doubt_ |
| _Users purposely flood AI images to slow the moderator work down_ | _L_ | _H_ | _Restrict the posts per user depending on their account age (how long ago was this account made?)_ | 
| _False postives may drift poltics off of our social platform hindering low funded campaigns and underpresenting certain poltical figures_ | _M_ | _L_ | _Ensure that our false positive rate stays below our threshold to avoid discouraging campaigns from moving off the platform_ |


Call out at least one **ethical risk** and one **technical risk** explicitly.

---

## 8. Model Safety Spec _(AI-as-abuser teams only — delete this section if you are on the human-abuser path)_

Teams whose project protects users from a harmful AI model (rather than from other humans) must fill this out. This is the AI-as-abuser counterpart to the "Policy Language" deliverable human-abuser teams produce.

### The harmful model

- **Source:** _e.g., `failspy/Llama-3-8B-Instruct-abliterated` from HuggingFace, or Llama-3-8B-Instruct with a custom system prompt._
- **How you run it:** _Ollama locally? Google Cloud GPU VM? HuggingFace Inference Endpoints? llama.cpp?_
- **What harmful behavior you are eliciting:** _Be specific. "Gives medical dosing advice without any safety caveats to a user posing as a teen" or "agrees to role-play as a romantic partner with a minor" — something concrete enough that you can test for it._

### What your system disallows

Write the Model Safety Spec as if it were a policy document the harmful model's operators would be required to comply with. Under 400 words, plain language. Things to include:

- Categories of output that are always disallowed (with short definitions)
- Categories that are allowed with modifications (e.g., "medical information is allowed if accompanied by 'consult a doctor'")
- The behavior your mitigation will take on each category (block, rewrite, warn, route to moderator, log)
- Edge cases the policy explicitly does or does not cover

### Interface between harmful model, mitigation, and user

- _Where does the mitigation sit in the request path? (Pre-generation prompt filter? Post-generation content filter? Both?)_
- _What happens when mitigation fires? User sees what?_
- _What gets logged for the moderator?_

---

## 9. Open Questions

_List questions you haven't resolved yet. These are OK to have in a PRD — better to flag them than to pretend they don't exist._

- _Implement crowdsource reports instead of independently checking every photo_
- _How can we avoid against AI deepfake videos? AI voice recordings?_
- _How might we implement a cacheing system_
- _How can we train / detect to make this specific to politicians?_
- _How else can we decrease our latency?_
---

## 10. Milestones and Timeline

Rough week-by-week plan from now through Milestone 3. Keep it realistic — slack is good.

| Week of | Target |
|---|---|
| _May 8_ | Finish PRD & Submit Video |
| _May 15_ | Have wokring classifier and have image transfering onto the Moderator UI |
| _May 22_ | Poster draft and Metric Comparisons |
| _May 30_ | Poster Final and rehearsal |
| _June 2_ | Poster session 5–7 PM CoDa Sunken Courtyard; final code on `main` by 11:59 PM |


---

## 11. AI Use Statement

_Keep this current through Milestone 3. Honest and specific beats vague and defensive._

Example entries:

- _Claude Code: Used by Luis and Zareef to generate initial moderator and user UI. Also used by Zareef to generate scoring funciton of images._
- _OpenAI: Used by Zareef to write a classification function to give us an AI detection score via prompt._
- _Gemini: Used by Jonathan to brainstorm the pipeline to determine whether or not we should train our own model or see what Open AI would offer._


---

_End of PRD template. Delete this line before committing your version._
