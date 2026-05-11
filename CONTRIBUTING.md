# Contributing to Quotidy

Thank you for your interest in contributing to Quotidy! Quotidy is an open-source web application designed for fair household chore coordination.

## Getting Started

### Prerequisites
- Node.js (v20+)
- PostgreSQL database
- Git

### Local Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/CesarPierr/quotidy.git
   cd quotidy
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   Copy `.env.example` to `.env.local` and set your local PostgreSQL database URL and NextAuth secret.
   ```bash
   cp .env.example .env.local
   ```

4. **Initialize the database:**
   ```bash
   npm run db:migrate
   npm run db:generate
   ```
   *(Optional)* To populate the database with mock data for testing:
   ```bash
   npm run db:seed
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:3000`.

## Development Guidelines

- **UI/UX First**: Quotidy is heavily optimized for mobile (375x812 viewport). When making UI changes, always test on a narrow screen first.
- **Form Submissions**: All forms should use the `useFormAction` hook rather than standard `<form action="...">` to provide interactive toast feedback.
- **Time/Dates**: To avoid timezone drift, always use the utility functions in `src/lib/date-input.ts` and `src/lib/time.ts` for manipulating dates.
- **Styling**: We use TailwindCSS (v4). Custom tokens (e.g., colors) are defined directly in `src/app/globals.css`.

## Testing & Quality

Before submitting a Pull Request, please ensure you run the pre-commit checks:

```bash
npm run lint
npm run typecheck
npm test
```

All 3 commands must pass. Our scheduling and math logic are heavily unit-tested with Vitest. If you modify any engine logic (e.g., in `src/lib/scheduling/`), please include or update the relevant Vitest test cases.

## Pull Request Process
1. Fork the repository and create a feature branch (`git checkout -b feature/my-cool-feature`).
2. Commit your changes.
3. Ensure the test suite and linter pass.
4. Push your branch to GitHub and open a Pull Request.

Welcome to the project!
