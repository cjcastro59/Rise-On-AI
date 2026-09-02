# Changelog

All notable changes to **Rise On AI** are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [v2.0.0] — Final Defense Release
> Tag: `v2.0.0` · Branch: `main`

This is the final capstone release. All phases are complete. The system is
deployed to Vercel (production) with a full CI/CD pipeline backed by GitHub
Actions. The XLM-RoBERTa model is hosted on Hugging Face Inference API.

### Summary of complete system
- Multi-role platform: User, Counselor, Admin/Owner
- AI-powered journal sentiment analysis (Positive / Negative / Distress)
- Behavioral analytics, wellness assessment, distress risk indicator
- Adaptive conversational intelligence
- Mood trend visualization (recharts)
- Explainable AI with confidence scores
- Full security review (RBAC, RLS, reCAPTCHA, 2FA, CSRF, OWASP)
- Comprehensive test suite (vitest — unit, integration, AI, security)
- CI/CD pipeline (GitHub Actions → Vercel)
- Software versioning (SemVer, annotated Git tags, CHANGELOG)

---

## [v1.9.0] — CI/CD Pipeline
> Tag: `v1.9.0` · Commit: `c7c8695f`

**Phase 11 — GitHub Actions + Vercel**

### Added
- `.github/workflows/ci.yml` — runs lint, test, and build on every push and PR
- `.github/workflows/deploy.yml` — auto-deploys to Vercel production after CI passes on `main`
- `.github/workflows/rollback.yml` — manual workflow to promote any previous Vercel deployment back to production
- Concurrency controls to cancel redundant CI runs
- GitHub Actions job summaries with deployment URLs

### Infrastructure
- Vercel production region: `sin1` (Singapore)
- All secrets managed via GitHub Actions Secrets — no credentials in code

---

## [v1.8.0] — Security, Testing, Optimization & Deployment
> Tag: `v1.8.0` · Commit: `6cde7a4c`

**Phase 8 + Phase 9 + Phase 10**

### Security (Phase 8)
- Row Level Security (RLS) policies on all Supabase tables
- Role-Based Access Control (RBAC) via `useRBAC` hook
- Google reCAPTCHA v2 on login and registration
- TOTP Two-Factor Authentication (Google Authenticator)
- CSRF protection on state-mutation API routes
- Security headers: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `HSTS`
- Input validation and rate limiting on API routes
- Journal entry encryption at rest via Supabase
- Privacy Policy modal compliant with RA 10173 (Data Privacy Act of 2012)

### Testing (Phase 9)
- Vitest test suite: unit, integration, AI, and security test folders
- Coverage thresholds: statements ≥70%, branches ≥65%, functions ≥70%, lines ≥70%
- Tests cover: sentiment logic, behavioral analytics, wellness assessment, DRI, ACI, CSRF, input validation

### Optimization (Phase 7)
- Next.js `compress: true`, `reactStrictMode: true`
- Image optimization: AVIF/WebP formats, remote pattern allowlist
- Bundle analysis baseline established
- Supabase query optimization with indexed columns

### Deployment (Phase 10)
- Deployed to Vercel (free tier, region `sin1`)
- HuggingFace Inference API for XLM-RoBERTa model hosting
- `vercel.json` configured with build command, output directory, API cache headers

---

## [v1.7.0] — Mood Trend Visualization
> Tag: `v1.7.0` · Commit: `85ee1ea5`

**Phase 5**

### Added
- Mood distribution chart (Positive / Negative / Distress breakdown)
- Weekly mood trend line chart
- Monthly mood trend line chart
- Wellness score gauge/display
- Behavioral trend chart
- Distress risk/alert visualization
- All charts use real Supabase data — no fabricated values
- Responsive chart layout for mobile and desktop
- Empty/insufficient data states handled gracefully
- Admin mood trend monitoring page

---

## [v1.6.0] — Explainable AI
> Tag: `v1.6.0` · Commit: `ef3edfab`

**Phase 6**

### Added
- Confidence score returned alongside every sentiment prediction
- Softmax probability distribution across all three classes
- Attention-based token saliency as explainability signal
- `explain.py` server-side explainability module
- Documented limitations: word-level attribution not reliably supported by XLM-RoBERTa without SHAP/LIME; confidence scores used as primary explainability output
- Explainability data stored and surfaced in the Analysis page

---

## [v1.5.0] — Adaptive Conversational Intelligence
> Tag: `v1.5.0` · Commit: `9edfd594`

**Phase 4.4**

### Added
- `useAdaptiveResponse` hook — generates context-aware supportive responses
- `lib/adaptive-response.ts` — response strategy engine
- `/api/aci` route — ACI API endpoint
- Inputs: current sentiment, wellness score, DRI result, behavioral indicators, recent journal context
- Response strategies: positive reinforcement, empathetic support, distress safety messaging
- Safety constraints: no clinical diagnoses, no medical claims, always recommends professional help for distress
- Responses stored only as necessary for system functionality

---

## [v1.4.0] — Wellness Assessment + Distress Risk Indicator
> Tag: `v1.4.0` · Commit: `e5bb775f`

**Phase 4.2 + Phase 4.3**

### Added — Wellness Assessment
- `useWellnessAssessment` hook
- `/api/wellness` route
- Wellness Score: 0–10 scale derived from sentiment, behavioral indicators, and journal frequency
- Wellness Level: Poor / Fair / Good / Excellent
- Stored in Supabase `wellness_assessments` table

### Added — Distress Risk Indicator
- `useDistressRisk` hook
- `/api/distress-risk` route
- Risk categories: Low / Moderate / High / Critical
- Inputs: latest sentiment, historical behavioral indicators, wellness score
- Distress alerts created and stored for admin/counselor review
- Admin distress alerts management: assign, review, resolve
- Not a clinical diagnosis — decision-support tool only

---

## [v1.3.0] — Behavioral Analytics
> Tag: `v1.3.0` · Commit: `4709f0b8`

**Phase 4.1**

### Added
- `useBehavioralIndicators` hook
- `/api/behavioral` and `/api/behavioral/compute` routes
- Indicators: journaling frequency, mood consistency score, behavioral trend (Improving / Stable / Declining)
- Historical analysis over configurable rolling window
- Stored in Supabase `behavioral_indicators` table
- Integrated into dashboard and counselor view

---

## [v1.2.0] — Fine-tuned XLM-RoBERTa
> Tag: `v1.2.0` · Commit: `dd3e06c1`

**Phase 3**

### Added
- Full training pipeline in `scripts/sentiment-model-training/`
  - `01_prepare_dataset.py` — synthetic data generation, stratified split
  - `02_finetune_xlmroberta.py` — LoRA/full fine-tuning with Hugging Face Trainer
  - `03_export_model.py` — ONNX export
  - `04_evaluate_model.py` — accuracy, precision, recall, F1, confusion matrix
  - `05_evaluate_standalone.py` — standalone evaluation script
  - `run_pipeline.py` — end-to-end pipeline runner
- Three-class model: Positive / Negative / Distress (no Neutral class)
- Multilingual support: English + Filipino (Tagalog)
- Model hosted on HuggingFace: `cjcastro/xlm-roberta-Rise-On-AI`
- `requirements.txt` with pinned dependency versions

---

## [v1.1.0] — AI Integration
> Tag: `v1.1.0` · Commit: `874d0242`

**Phase 2**

### Added
- XLM-RoBERTa integrated into the Next.js application
- `/api/sentiment/analyze` route — calls HuggingFace Inference API
- `/api/sentiment/predict` route — prediction endpoint
- Keyword-based sentiment fallback for offline/cold-start scenarios
- Sentiment result stored in Supabase per journal entry
- Analysis page displays sentiment classification and confidence
- Sentiment classes: Positive / Negative / Distress

---

## [v1.0.0] — Core Functionalities
> Tag: `v1.0.0` · Commit: `250e2c62`

**Phase 1**

### Added
- Next.js 14 project scaffold with TypeScript, Tailwind CSS, App Router
- Supabase integration (authentication + database)
- User registration with email confirmation
- Login with email/password
- Forgot password + reset password flow
- Two-Factor Authentication (TOTP) setup and verification
- Role-based routing: User, Counselor, Admin/Owner
- Protected route middleware
- Journal entry creation and history
- User dashboard layout and sidebar navigation
- Admin dashboard layout
- Counselor dashboard layout
- Profile and settings pages
- Emergency support page
- Google reCAPTCHA v2 on auth forms
- Audit logging

---

## Branching Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production — only merged code that has passed CI |
| `Admin` | Admin/Owner feature development |
| `Admin-Counselor` | Counselor role features |
| `ruz` | Developer feature branch |
| `feature/*` | Short-lived feature branches (recommended going forward) |
| `fix/*` | Bug fix branches (recommended going forward) |

**Rules:**
- Never commit secrets or `.env.local` to any branch
- All branches must pass CI before merging to `main`
- Use Pull Requests for all merges into `main`
- Tag `main` after every milestone with an annotated tag

## Versioning Rules (going forward)

| Change type | Version bump | Example |
|-------------|-------------|---------|
| New feature / milestone | `MINOR` | `v2.1.0` |
| Bug fix / patch | `PATCH` | `v2.0.1` |
| Breaking change / new major release | `MAJOR` | `v3.0.0` |
| Release candidate | pre-release suffix | `v2.1.0-rc.1` |

[v2.0.0]: https://github.com/cjcastro59/Rise-On-AI/releases/tag/v2.0.0
[v1.9.0]: https://github.com/cjcastro59/Rise-On-AI/releases/tag/v1.9.0
[v1.8.0]: https://github.com/cjcastro59/Rise-On-AI/releases/tag/v1.8.0
[v1.7.0]: https://github.com/cjcastro59/Rise-On-AI/releases/tag/v1.7.0
[v1.6.0]: https://github.com/cjcastro59/Rise-On-AI/releases/tag/v1.6.0
[v1.5.0]: https://github.com/cjcastro59/Rise-On-AI/releases/tag/v1.5.0
[v1.4.0]: https://github.com/cjcastro59/Rise-On-AI/releases/tag/v1.4.0
[v1.3.0]: https://github.com/cjcastro59/Rise-On-AI/releases/tag/v1.3.0
[v1.2.0]: https://github.com/cjcastro59/Rise-On-AI/releases/tag/v1.2.0
[v1.1.0]: https://github.com/cjcastro59/Rise-On-AI/releases/tag/v1.1.0
[v1.0.0]: https://github.com/cjcastro59/Rise-On-AI/releases/tag/v1.0.0
