# Rise-On-AI
Rise On AI is a web-based journaling and sentiment analysis system that supports mental wellness. It lets users write journal entries and receive AI-generated emotional insights. It also includes an admin dashboard for viewing anonymized emotional trends for educational and wellness use.

# Rise-On-AI

## AI-Assisted Mental Wellness Monitoring and Early Intervention System

Rise-On-AI is a web-based AI-assisted mental wellness monitoring system designed to support emotional awareness, self-reflection, and early intervention through digital journaling, sentiment analysis, behavioral analytics, wellness assessment, distress risk identification, adaptive conversational intelligence, and mood trend visualization.

> IMPORTANT:
> This system is intended to support emotional awareness and self-reflection.
> It is NOT a clinical diagnostic system, counseling replacement, or psychological treatment tool.

---

# 1. System Scope

The system allows users to:

- Create and manage digital journal entries
- Analyze journal entries using AI-assisted sentiment classification
- Monitor emotional patterns over time
- View wellness-related insights
- View mood trends and historical emotional information
- Receive supportive conversational responses
- Receive reflection prompts and wellness recommendations

The system also includes administrative and counselor-related functionality according to the implemented role-based access structure.

---

# 2. Technology Stack

## Frontend / Application

- Next.js
- React
- TypeScript

## Database / Authentication

- Supabase
- Supabase Authentication
- Supabase Database
- Row-Level Security where applicable

## AI / Machine Learning

- Python
- Hugging Face Transformers
- XLM-RoBERTa
- Sentiment Classification
- AI Inference API

## Visualization

- Recharts

## Security

- Authentication
- Role-Based Access Control
- Two-Factor Authentication
- Google reCAPTCHA
- Data encryption where implemented

## Deployment

- AWS
- GitHub
- GitHub Actions for CI/CD

---

# 3. Sentiment Classification

The system uses exactly THREE sentiment classifications as recommended by the client:

1. Positive
2. Negative
3. Distress

There is NO Neutral classification.

The sentiment classification process is intended to identify the emotional tone of journal entries and provide supporting information for the succeeding system modules.

---

# 4. System Processing Flow

The major processing workflow is:

User
↓
Journal Entry
↓
Text Preprocessing
↓
XLM-RoBERTa Sentiment Classification
↓
Positive / Negative / Distress
↓
Store Sentiment Result
↓
Behavioral Analytics
↓
Wellness Assessment
↓
Distress Risk Indicator
↓
Adaptive Conversational Intelligence
↓
Mood Trend Visualization

The modules should be implemented in a sequential and traceable manner.

---

# 5. Core Functionalities

## User Side

The user-side system includes:

- Registration
- Login
- Authentication
- Profile Management
- Journal CRUD
- Journal History
- Mood/Emotional History
- Dashboard
- Wellness Information
- Emotional Insights
- Mood Trend Visualization
- Supportive Responses

## Counselor Side

The counselor-side system includes:

- Counselor Authentication
- Counselor Dashboard
- Assigned Users
- User-Counselor Assignment
- Monitoring of assigned users
- Relevant emotional/wellness information
- Distress-related information where applicable
- Counselor profile/settings
- Role-based access restrictions

## Admin Side

The admin-side system includes:

- Admin Authentication
- User Management
- Counselor Management
- User-Counselor Assignment
- Role-Based Access Control
- Audit Logs
- Administrative Dashboard
- Administrative Settings

---

# 6. AI Modules

## 6.1 Text Preprocessing

Journal entries are prepared before AI classification.

The preprocessing stage should prepare the journal text for the XLM-RoBERTa model without unnecessarily removing meaningful emotional information.

---

## 6.2 XLM-RoBERTa Sentiment Classification

The XLM-RoBERTa model receives the processed journal entry and produces:

- Predicted sentiment class
- Confidence score

Possible classes:

- Positive
- Negative
- Distress

The system should not introduce a Neutral class.

---

## 6.3 AI Inference API

The AI inference API is responsible for:

1. Receiving journal text
2. Validating the input
3. Preprocessing the text
4. Passing the text to XLM-RoBERTa
5. Generating the prediction
6. Returning the predicted class
7. Returning the confidence score
8. Handling inference errors safely

---

# 7. Behavioral Analytics

Behavioral Analytics analyzes multiple historical journal records rather than relying only on a single journal entry.

The module uses historical journal entries, sentiment classifications, mood selections, and submission dates.

Current behavioral indicators include:

- Total Journal Entries
- Positive Journal Entries
- Negative Journal Entries
- Consecutive Negative Entries
- Distress Journal Entries
- Journaling Frequency
- Most Frequent Mood
- Behavioral Trend Score
- Mood Consistency

Behavioral Analytics provides supporting information for:

- Wellness Assessment
- Distress Risk Indicator
- Adaptive Conversational Intelligence
- Mood Trend Visualization

---

# 8. Wellness Assessment

The Wellness Assessment evaluates the user's overall emotional wellness using historical behavioral indicators.

Primary inputs include:

- Behavioral Trend Score
- Journaling Frequency Score
- Consecutive Negative Entry Score
- Mood Consistency Score

The system generates a Wellness Score from:

0–10

Wellness levels:

| Score | Wellness Level |
|---|---|
| 8.00–10.00 | Healthy |
| 6.00–7.99 | Stable |
| 4.00–5.99 | Moderate Concern |
| 2.00–3.99 | At Risk |
| 0.00–1.99 | High Risk |

The Wellness Assessment is updated when new journal data becomes available.

---

# 9. Distress Risk Indicator

The Distress Risk Indicator is a decision-support module.

It does NOT provide a clinical diagnosis.

Inputs include:

- Predicted Sentiment Classification
- Behavioral Trend Score
- Wellness Score
- Consecutive Negative Journal Entries
- Historical Emotional Patterns

The module evaluates:

- Frequency of negative entries
- Consecutive negative entries
- Declining Wellness Score
- Repeated distress-related classifications

Risk levels:

- Low Risk
- Moderate Risk
- High Risk
- Critical Risk

---

# 10. Adaptive Conversational Intelligence

Adaptive Conversational Intelligence generates supportive responses based on the user's emotional assessment.

Primary inputs include:

- Predicted Sentiment
- Behavioral Trend Score
- Wellness Score
- Distress Risk Level

Response categories:

- Positive Response
- Negative Response
- Distress Response

There is NO Neutral Response category.

Responses must:

- Be supportive
- Encourage reflection
- Encourage healthy coping practices
- Avoid clinical diagnosis
- Avoid claiming to replace professional counseling

---

# 11. Mood Trend Visualization

Mood Trend Visualization presents historical emotional information through graphical representations.

Primary data includes:

- Journal Entry Date
- Predicted Sentiment Classification
- Wellness Score
- Distress Risk Level

The records are organized chronologically and transformed into graphical reports.

Planned visualizations include:

- Mood Distribution
- Weekly Mood Trend
- Monthly Mood Trend
- Wellness Score Trend
- Behavioral Trend
- Distress Risk Indicators

---

# 12. Development Phases

## Phase 1 — Core Functionalities

Status: Mostly completed / for verification

Verify:

- User functionality
- Counselor functionality
- Admin functionality
- Authentication
- RBAC
- Journal CRUD
- User-Counselor assignment
- Audit Logs
- Security features
- Database integration

---

## Phase 2 — AI Foundation

Status: In progress / partially completed

Verify:

- Text preprocessing
- XLM-RoBERTa integration
- AI inference API
- Three-class classification
- Confidence scores
- Supabase integration
- Error handling
- API validation

---

## Phase 3 — AI Model Optimization

Current focus:

### Fine-tuning XLM-RoBERTa

Tasks:

- Prepare multilingual dataset
- Validate labels
- Balance dataset
- Fine-tune model
- Hyperparameter tuning
- Evaluate model
- Select best model
- Export production model

Languages may include:

- English
- Filipino
- Taglish

Classes:

- Positive
- Negative
- Distress

---

## Phase 4 — Behavioral Intelligence

Implement and verify:

- Behavioral Analytics
- Behavioral Trend Score
- Journaling Frequency
- Mood Consistency
- Consecutive Negative Entries
- Wellness Assessment
- Wellness Score
- Distress Risk Indicator
- Risk classification

---

## Phase 5 — Adaptive Conversational Intelligence

Implement:

- Positive Response
- Negative Response
- Distress Response
- Context-aware supportive responses
- Reflection prompts
- Wellness recommendations

---

## Phase 6 — Visualization

Implement:

- Mood Distribution
- Weekly Mood Trend
- Monthly Mood Trend
- Wellness Score
- Behavioral Trend
- Distress Risk Visualization

---

## Phase 7 — Explainability

Optional unless required by the adviser/panel.

Possible features:

- Confidence Score
- Prediction explanation
- Influential text features

Do not introduce this phase unless it is compatible with the approved documentation.

---

## Phase 8 — System Optimization

Evaluate:

- AI inference speed
- API response time
- Database query performance
- Next.js performance
- Bundle size
- Caching
- Overall system responsiveness

---

## Phase 9 — Security Review

Review:

- Authentication
- Authorization
- RBAC
- API validation
- Rate limiting
- Sensitive data protection
- OWASP Top 10 considerations
- Supabase security policies
- Environment variables

---

## Phase 10 — Testing

### Functional Testing

- Unit Testing
- Integration Testing
- System Testing
- User Acceptance Testing

### AI Evaluation

- Accuracy
- Precision
- Recall
- F1-score
- Confusion Matrix

### Performance Testing

- Response Time
- API Latency
- Concurrent Users

---

## Phase 11 — AWS Deployment

Deployment target:

AWS

Required deployment components should be determined based on the final architecture.

Potential components:

- Next.js application
- Python AI inference service
- Environment variables
- HTTPS
- Domain
- SSL/TLS

Do not assume Vercel as the production deployment platform.

---

## Phase 12 — CI/CD

Target workflow:

GitHub
↓
GitHub Actions
↓
Install Dependencies
↓
Build
↓
Run Tests
↓
Deploy
↓
AWS

Every production deployment should be associated with a Git commit/version.

---

## Phase 13 — Versioning

Use versioning to track major system milestones.

Example:

v1.0.0 — Core Functionalities
v1.1.0 — AI Integration
v1.2.0 — Fine-tuned XLM-RoBERTa
v1.3.0 — Behavioral Analytics
v1.4.0 — Wellness Assessment
v1.5.0 — Distress Risk Indicator
v1.6.0 — Adaptive Conversational Intelligence
v1.7.0 — Mood Trend Visualization
v2.0.0 — Final Release

Actual version numbers may be adjusted based on the team's Git workflow.

---

# 14. Documentation Consistency Rules

IMPORTANT FOR DEVELOPERS AND AI CODING ASSISTANTS:

1. Do not introduce a Neutral sentiment class.
2. Sentiment classes must remain:
   - Positive
   - Negative
   - Distress
3. Do not change the approved algorithm structure without checking the Capstone documentation.
4. Each major algorithm/module should follow the documented step-by-step process.
5. Do not replace documented computations with unrelated approaches.
6. Do not introduce NLP functionality that is not actually implemented merely because NLP appears in the literature or architectural documentation.
7. Do not introduce clinical diagnosis functionality.
8. Do not represent the system as a replacement for professional mental health services.
9. Preserve existing User, Counselor, and Admin role separation.
10. Verify existing functionality before modifying it.
11. Do not rewrite completed modules unnecessarily.
12. When implementing a new module, explain which documented module it corresponds to.
13. Keep the implementation consistent with the approved Scope and Limitations.
14. If the code and documentation conflict, report the conflict before making architectural changes.

---

# 15. AI Coding Assistant Instructions

Before modifying the system:

1. Inspect the existing code.
2. Identify the relevant module.
3. Compare the implementation against this README and the Capstone documentation.
4. Determine whether the feature is:
   - COMPLETE
   - PARTIALLY COMPLETE
   - NOT IMPLEMENTED
   - NEEDS VERIFICATION
5. Do not rebuild an already completed feature.
6. Make the smallest necessary change.
7. Preserve existing functionality.
8. Explain the files changed.
9. Explain how the change maps to the documented algorithm.
10. Run appropriate tests after implementation.

When asked to implement a new phase, work only on that phase unless a dependency requires changes elsewhere.