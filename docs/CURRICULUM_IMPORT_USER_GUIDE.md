# NIU Curriculum Import: Complete Upload Guide

This guide explains how an authorised NIU administrator can import one complete certificate curriculum. The workflow is deliberately controlled:

> Upload curriculum → Analyze → Generate draft → Validate → Review → Approve → Publish

Generated records remain private drafts until an authorised administrator deliberately reviews, approves, and publishes them. The importer does not publish automatically, does not approve automatically, does not delete existing records, and does not overwrite existing published content.

## Before you begin

Use an approved curriculum document that NIU is authorised to use. The current importer is designed for a plain-text or Markdown document. If the source is in Word or PDF format, save or export a clean `.txt` or `.md` copy first. Do not upload a document containing invented placeholders, guessed objectives, guessed assessments, or information that has not been approved.

Prepare the following information before opening NIU:

| Required area | What must be explicit in the document |
|---|---|
| School | The existing school to which the new department belongs, selected in the import form if required |
| Department | Department name and a unique department code |
| Certificate programme | Programme name, unique programme code, description, and certificate-only scope |
| Course | Course title, unique course code if used, description, level, duration, requirements, and objectives |
| Modules | Ordered module number/title, description, and difficulty; preserve the intended order |
| Lessons | Ordered lesson number/title, description, objectives, activity or learning structure, required status, and points where applicable |
| Learning materials | Explicit title, category, description, and private file/reference information; do not claim ownership of external resources |
| Knowledge checks | Explicit check or question wording, answer options, correct answer, points, topic, and objective mapping if they are intended to be imported |
| Assessments | Assessment title, intended module, description, passing score, time limit, attempt limit, required-completion rule, and question/answer information |
| Final examination | Explicit title, module/programme placement, rules, points, passing score, time limit, attempts, and completion requirement |
| Certificate settings | Exact approved certificate name, completion requirements, signer/template settings, and any lawful recognition wording |

If required information is missing, stop and correct the source document first. NIU marks omissions and blocks generation rather than inventing academic content.

## Recommended curriculum document format

Use clear headings and labels. The following is a structural template only. Replace every bracketed value with approved information. Do not upload the template unchanged and do not use it as demo data.

```markdown
# Department: [Approved Department Name]
Department Code: [UNIQUE-DEPARTMENT-CODE]
School: [Existing NIU School Name]

# Programme: [Approved Certificate Programme Name]
Programme Code: [UNIQUE-PROGRAMME-CODE]
Description: [Approved certificate-only programme description]

## Course 1: [Approved Course Title]
Course Code: [UNIQUE-COURSE-CODE]
Description: [Approved course description]
Level: [Approved level]
Duration Minutes: [Positive whole number]
Requirements: [Approved learner requirements]
Objective: [Approved course objective 1]
Objective: [Approved course objective 2]

### Module 1: [Approved Module Title]
Description: [Approved module description]
Difficulty: introductory

#### Lesson 1: [Approved Lesson Title]
Description: [Approved lesson description]
Objective: [Approved lesson objective]
Activity: [Approved learning activity]
Required: true
Points: [Non-negative number]

#### Lesson 2: [Approved Lesson Title]
Description: [Approved lesson description]
Objective: [Approved lesson objective]
Activity: [Approved learning activity]
Required: true
Points: [Non-negative number]

### Module 2: [Approved Module Title]
Description: [Approved module description]
Difficulty: intermediate

#### Lesson 1: [Approved Lesson Title]
Description: [Approved lesson description]
Objective: [Approved lesson objective]
Activity: [Approved learning activity]
Required: true
Points: [Non-negative number]

## Assessment: [Approved Assessment Title]
Module: [Exact Intended Module Title]
Description: [Approved assessment description]
Passing Score: [Approved percentage or score]
Time Limit Minutes: [Positive whole number]
Attempt Limit: [Positive whole number]
Required Completion: true

Question: [Explicit question wording]
Option A: [Answer option]
Option B: [Answer option]
Correct Answer: [Exact option or answer key]
Topic: [Approved topic]
Learning Objective: [Exact objective text or approved objective reference]
Points: [Positive number]
Difficulty: intermediate

## Final Examination: [Approved Final Examination Title]
Description: [Approved examination description]
Passing Score: [Approved score]
Time Limit Minutes: [Positive whole number]
Attempt Limit: [Positive whole number]
Required Completion: true

## Certificate Settings
Certificate Title: [Approved certificate title]
Completion Rule: [Explicit approved completion rule]
Signer: Akin S. Sokpah — President and Founder
```

The headings and labels above communicate structure; the actual importer may display validation messages if a field name or value is not recognized. Follow the labels presented by NIU’s import screen and correct the document when the review panel identifies a missing field.

## Complete phone workflow

### 1. Sign in

Open the NIU website and tap **Sign in**. Use the approved NIU administrator account. Public student accounts cannot use the Curriculum Import workflow. If you are not shown the administrator workspace, do not attempt to bypass the restriction; use the authorised staff account or ask an NIU Super Administrator to assign the correct role.

### 2. Open the guided academic package

From the administrator dashboard, open the guided academic package or programme-package workspace. This is the area that organizes the department, certificate programme, course, modules, lessons, protected materials, validation, review, and publication steps.

### 3. Tap Import Complete Curriculum

Inside the guided package workflow, tap **Import Complete Curriculum**. This is the single entry point for a complete curriculum upload. Do not create a separate programme, course, or module first unless the import screen specifically asks you to select an existing school or other parent record. The import is designed to create a new draft version for the uploaded curriculum.

### 4. Select the approved document

Tap the upload control and choose the approved `.md` or `.txt` curriculum file from your phone. Check the filename before continuing. Do not select a personal document, an unapproved curriculum, a file containing private information that NIU is not permitted to process, or a file with unresolved placeholders.

The source document is stored in NIU’s private learning-materials storage. It is not made public by upload. Learner access to learning materials remains dependent on the existing enrollment and protected-content rules.

### 5. Confirm the source details

Enter or confirm the source title and any required school selection. Check that the source belongs to a new imported version. The system uses duplicate checks for department, programme, course, and module titles/codes. If the screen warns that a matching record already exists, stop and decide whether the document should be corrected or imported as a distinct approved version. Do not force a duplicate.

### 6. Tap Analyze

Tap **Analyze**. NIU reads explicit headings, labels, ordering, relationships, objectives, activities, knowledge checks, assessments, examination details, and certificate settings. It does not guess missing information from the document.

Wait for the progress screen to show the analysis stage has finished. Keep the page open until the result appears. If the phone changes screens or the upload appears stuck, return to the import workspace and check the import status before trying again. Avoid repeated uploads that could create confusion about which source is being reviewed.

### 7. Read the analysis summary

Review the detected counts and order carefully:

| Check | Confirm |
|---|---|
| Department | Correct name, code, and selected school |
| Programme | Correct title, code, description, and certificate-only wording |
| Courses | Correct titles, order, descriptions, levels, duration, requirements, and objectives |
| Modules | Correct course relationship, module number, title, order, description, and difficulty |
| Lessons | Correct module relationship, order, title, objectives, activity structure, required state, and points |
| Materials | Correct lesson relationship and private-storage treatment |
| Questions | Complete wording, answer options, correct answer, objective map, topic, difficulty, and points |
| Assessments | Correct module, rules, passing score, time limit, attempt limit, and completion requirement |
| Examination | Correct final-exam placement and rules |
| Certificate | Correct title and lawful certificate settings |

If the order is wrong, correct the source document and analyze again. Do not manually rearrange generated content before understanding the source problem.

### 8. Resolve validation errors and missing information

The validation panel explains each blocked action. Common blockers include:

- missing department code or programme code;
- missing school relationship;
- duplicate department, programme, course, or module title/code;
- missing course description, level, duration, requirement, or objective;
- missing module difficulty or unsupported difficulty value;
- missing lesson objective, activity, required state, or points;
- question without answer options or without one valid correct answer;
- question mapped to an objective that does not exist;
- assessment without an intended module;
- passing score outside the permitted range;
- zero or negative time limit;
- zero or negative attempt limit;
- required completion enabled without a valid completion rule;
- learning material without a private storage path or approved external reference;
- unsupported file type or invalid source encoding.

Correct the original document or use the permitted individual correction controls in the review screen. NIU blocks generation when a required field is missing so that no placeholder academic content is created.

### 9. Generate the draft package

When validation shows that the required source information is complete, tap **Generate private draft package**. Confirm the warning that generation creates new draft records only. This action may create the imported department, certificate programme, courses, ordered modules, lessons, question banks, assessments, and final examination as a new draft version. It does not publish or approve them.

Do not tap the action repeatedly. If the button is disabled or the system displays a duplicate warning, use the existing import job and correct it instead of creating another import.

### 10. Wait for generation to finish

Keep the progress screen open while NIU creates the draft relationships. Confirm that the final status indicates draft generation or review, not publication. If the generation reports an error, save the displayed message and use **Regenerate incomplete sections** only after correcting the identified source or metadata.

### 11. Review every generated area

Open the generated draft package in Course Studio. Review the programme, each course, every module, every lesson, all imported material references, each question bank, assessments, the final examination, completion rules, points, and certificate settings.

Use the curriculum tree to confirm that lessons are inside the correct modules and that module order matches the source. Check that questions are mapped to the correct learning objectives and assessments are mapped to their intended modules. Check that required lessons have a learning structure and that private materials are attached to the intended lessons.

### 12. Correct individual records

Use the individual correction controls in Course Studio for small approved corrections. Keep the content in Draft while editing. A correction does not approve or publish the record. Re-run validation after each material correction and confirm the validation messages disappear only when the requirement is actually satisfied.

Do not replace missing academic information with assumptions. If the source document does not contain a passing score, a correct answer, a time limit, a module objective, or a certificate setting, return to the curriculum owner for an approved decision and then enter the confirmed value.

### 13. Regenerate incomplete sections

If a section is incomplete, use **Regenerate incomplete sections** after correcting the source or the approved correction data. Regeneration is for incomplete sections only. Review the resulting draft again for ordering, relationships, duplicate warnings, and missing fields. Never assume regeneration is approval.

### 14. Move content to Review manually

When the package is complete, use the governed action to move the relevant draft records to **Review**. This is a manual staff action. The importer does not move content to Review automatically as part of upload or generation.

At this stage, confirm that all questions have complete answer keys, points, topic, difficulty, and learning-objective mapping; all assessments have valid rules; and every required lesson has learning structure and protected-material treatment where required.

### 15. Approve after institutional review

An authorised reviewer must inspect the draft package and use the governed approval action. Approval is separate from generation and separate from publication. Do not approve content simply because the importer completed successfully. The review must confirm academic correctness, lawful certificate-only wording, source authorization, ordering, materials, assessment rules, and learner-access safeguards.

### 16. Publish only through the existing gate

After the package is approved and all readiness requirements are satisfied, an authorised administrator may use NIU’s existing publication gate. Publication is never automatic. If the publication control is blocked, read the readiness message and correct the specific prerequisite. Do not bypass the gate by editing the database or by attempting to publish individual records out of sequence.

### 17. Verify after publication

Only after the deliberate publication action succeeds should you verify the public programme and course routes. Confirm that public pages expose published content only, that draft material remains private, and that protected learning resources still require an enrolled learner or authorised staff access. Do not treat a successful upload or generation screen as proof that content is publicly available.

## What to do when something fails

If upload fails, confirm the file is a clean `.md` or `.txt` document, is within the displayed size limit, and is an approved curriculum source. If analysis fails, correct the document headings and labels. If generation is blocked, read each validation message and supply the missing approved information. If a duplicate warning appears, do not create another record; review the existing record or correct the new version’s approved identity. If protected material cannot be opened, stop and contact NIU support rather than making the file public.

## Safety rules to remember

Never upload fake curriculum content, placeholders, or guessed answers. Never expect upload to publish content. Never approve your own content if NIU’s governance requires a separate reviewer. Never use a public URL for a protected learning material unless the resource is explicitly authorized as an external reference. Never edit or delete an existing published programme to make room for an import. Create and review a new draft version instead.

The final state should be **published only after** the approved source has been analyzed, the generated draft has passed validation, every relationship has been reviewed, the authorized reviewer has approved the package, and the authorized administrator has deliberately used the existing publication gate.
