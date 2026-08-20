# Resume Tailor Tool

AI-powered resume optimization tool that analyzes resumes against job descriptions and provides actionable suggestions.

## Features

- Upload or paste resume content (PDF, DOCX, TXT)
- Input target job description
- AI-powered keyword matching and gap analysis
- Weighted match score (Technical 40%, Experience 30%, Soft Skills 20%, Education 10%)
- Prioritized suggestions for improvement
- Accept/reject suggestions individually
- Download tailored resume as PDF or DOCX
- Session-based privacy (data deleted after 30 min inactivity)

## Setup

1. Clone the repo
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and add your OpenAI API key
4. Start the server: `npm run server`
5. Start the frontend: `npm run dev`
6. Or run both: `npm run dev:all`

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Backend**: Express 5, TypeScript
- **AI**: OpenAI GPT (via openai SDK)
- **File Generation**: pdfkit (PDF), docx (DOCX)
- **File Parsing**: pdfjs-dist (PDF), mammoth (DOCX)
- **Testing**: Vitest, fast-check (property-based testing), Testing Library