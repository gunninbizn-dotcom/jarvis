# Jarvis

This repository is a Next.js web application scaffold with custom UI components and Mongo integration.

## Key features

- Next.js 15 application
- Tailwind CSS styling
- Custom `Jarvis` component suite in `components/jarvis/`
- Radix UI-based design system in `components/ui/`
- MongoDB-compatible backend support
- Local `.env` ignored by git

## Project structure

- `app/` - Next.js app directory
- `components/` - reusable UI components and `Jarvis` visual modules
- `hooks/` - custom React hooks
- `lib/` - utility functions

## Scripts

- `yarn dev` - start development server on `0.0.0.0:3000`
- `yarn build` - build the production app
- `yarn start` - start the production server

## Setup

1. Install dependencies:
   ```bash
   yarn install
   ```
2. Create a `.env` file if needed for local configuration.
3. Run the app:
   ```bash
   yarn dev
   ```

## Notes

- The repository is already configured to ignore common environment files and local secrets.
- If you add Mongo or other secrets, keep them in `.env` and do not commit the file.

